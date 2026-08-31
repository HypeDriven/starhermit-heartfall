/* Heartfall — pure deterministic rules engine.
 * Trick-taking: pass cards, follow suit, avoid penalty hearts and the
 * Nightshade Queen (Q♠, 13 points) — or capture every penalty for an
 * Eclipse. Lowest match score wins once anyone reaches the threshold.
 *
 * No rendering, no DOM, no Date.now(): every transition derives from
 * (state, command) only. AI seat choices are computed OUTSIDE
 * applyCommand and logged as ordinary commands, so a command log fully
 * replays a match. Usable from browser (window.HFRules) and Node.
 */
(function (root, factory) {
  var RNG = (typeof module === 'object' && module.exports) ? require('./rng.js') : root.HFRNG;
  var api = factory(RNG);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HFRules = api;
})(typeof self !== 'undefined' ? self : this, function (RNG) {
  'use strict';

  var STATE_VERSION = 1;

  // ---------- cards ----------
  // id = suit*13 + rank. Suits: 0 spades, 1 hearts, 2 diamonds, 3 clubs.
  // Ranks: 0 = 2 … 12 = ace. Q♠ = id 10 ("Nightshade Queen", 13 points).
  var SUIT_NAMES = ['spades', 'hearts', 'diamonds', 'clubs'];
  var SUIT_GLYPHS = ['\u2660', '\u2665', '\u2666', '\u2663'];
  var RANK_NAMES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  var QUEEN_SPADES = 10;
  var ECLIPSE_POINTS = 26;

  function cardSuit(id) { return Math.floor(id / 13); }
  function cardRank(id) { return id % 13; }
  function cardName(id) { return RANK_NAMES[cardRank(id)] + SUIT_GLYPHS[cardSuit(id)]; }
  function penaltyOf(id) {
    if (cardSuit(id) === 1) return 1;
    return id === QUEEN_SPADES ? 13 : 0;
  }
  function isPenalty(id) { return penaltyOf(id) > 0; }

  var TERMINAL = {
    THRESHOLD: 'threshold',
    ROUNDS_CAP: 'rounds-cap',
    RESIGN: 'resigned'
  };

  var INVALID = {
    ENDED: 'game-ended',
    PHASE: 'wrong-phase',
    TURN: 'not-your-turn',
    NO_CARD: 'card-not-in-hand',
    MUST_LEAD: 'must-lead-starter',
    FOLLOW: 'must-follow-suit',
    HEARTS: 'hearts-not-broken',
    FIRST_TRICK: 'no-penalty-first-trick',
    PASS_COUNT: 'wrong-pass-count',
    PASS_DUP: 'duplicate-pass-card',
    PASS_ALREADY: 'pass-already-submitted',
    BAD_CARD: 'bad-card',
    BAD_CMD: 'unknown-command',
    BAD_SHAPE: 'malformed-command'
  };

  // ---------- helpers ----------

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function stableStringify(v) {
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    if (Array.isArray(v)) {
      var out = '[';
      for (var i = 0; i < v.length; i++) out += (i ? ',' : '') + stableStringify(v[i]);
      return out + ']';
    }
    var keys = Object.keys(v).sort(), s = '{';
    for (var k = 0; k < keys.length; k++) {
      s += (k ? ',' : '') + JSON.stringify(keys[k]) + ':' + stableStringify(v[keys[k]]);
    }
    return s + '}';
  }

  function hashState(state) {
    var copy = clone(state);
    delete copy.events;
    return RNG.hashString(stableStringify(copy));
  }

  function sortHand(hand) {
    hand.sort(function (a, b) { return a - b; });
    return hand;
  }

  function passDirection(cfg, round) {
    var cycle = cfg.passCycle && cfg.passCycle.length ? cfg.passCycle : ['left'];
    var dir = cycle[(round - 1) % cycle.length];
    if (cfg.players < 4 && dir === 'across') dir = 'left';
    return dir;
  }

  function passTarget(cfg, seat, dir) {
    var n = cfg.players;
    if (dir === 'left') return (seat + 1) % n;
    if (dir === 'right') return (seat + n - 1) % n;
    if (dir === 'across') return (seat + 2) % n;
    return seat;
  }

  function buildDeck(players) {
    var deck = [];
    for (var id = 0; id < 52; id++) {
      if (players === 3 && id === 2 * 13 + 0) continue; // 2♦ removed for 3 players
      deck.push(id);
    }
    return deck;
  }

  // The card that must open the round: lowest club in play, then diamonds,
  // spades, hearts as deterministic fallback.
  function findStarter(hands) {
    for (var s = 0; s < 4; s++) {
      var suitOrder = [3, 2, 0, 1][s]; // clubs, diamonds, spades, hearts
      var best = null;
      for (var p = 0; p < hands.length; p++) {
        for (var i = 0; i < hands[p].length; i++) {
          var id = hands[p][i];
          if (cardSuit(id) !== suitOrder) continue;
          if (best === null || cardRank(id) < cardRank(best.card)) best = { p: p, card: id };
        }
      }
      if (best) return best;
    }
    return { p: 0, card: hands[0][0] };
  }

  // ---------- game creation ----------

  // cfg: { id, version, kind, name, seed, players(2..4), threshold,
  //        maxRounds, passCycle, passCount, eclipseRule('others'|'self'),
  //        noPenaltyFirstTrick, ai:{level}, mechanics:{undo,hint},
  //        goal, theme, intro }
  function createGame(cfg) {
    var seed = cfg.seed >>> 0;
    var rng = RNG.derive(seed, RNG.STREAM_RULES);
    var n = cfg.players;
    if (!(n >= 2 && n <= 4)) throw new Error('players must be 2..4');

    var state = {
      v: STATE_VERSION,
      cfg: clone(cfg),
      seed: seed,
      rngState: 0,
      tick: 0,
      players: n,
      round: 1,
      phase: 'pass',          // pass | play | done
      passDir: 'left',
      hands: [],
      passes: [],             // null | {to, cards}
      trick: [],              // [{p, card}] in play order
      leader: 0,
      actor: 0,
      startCard: -1,
      heartsBroken: false,
      firstTrick: true,
      taken: [],
      matchScores: [],
      roundSummaries: [],
      stats: { eclipses: [], queensTaken: [], heartsTaken: [], tricksWon: [] },
      terminal: null,
      events: []
    };
    for (var p = 0; p < n; p++) {
      state.passes.push(null);
      state.taken.push([]);
      state.matchScores.push(0);
      state.stats.eclipses.push(0);
      state.stats.queensTaken.push(0);
      state.stats.heartsTaken.push(0);
      state.stats.tricksWon.push(0);
    }
    dealRound(state, rng);
    state.rngState = rng.state;
    return state;
  }

  function dealRound(state, rng) {
    var n = state.players;
    var deck = buildDeck(n);
    rng.shuffle(deck);
    var handSize = n === 2 ? 13 : Math.floor(deck.length / n);
    state.hands = [];
    for (var p = 0; p < n; p++) state.hands.push([]);
    for (var i = 0; i < handSize * n; i++) state.hands[i % n].push(deck[i]);
    for (p = 0; p < n; p++) sortHand(state.hands[p]);
    state.trick = [];
    state.passes = [];
    for (p = 0; p < n; p++) state.passes.push(null);
    state.taken = [];
    for (p = 0; p < n; p++) state.taken.push([]);
    state.heartsBroken = false;
    state.firstTrick = true;
    var starter = findStarter(state.hands);
    state.leader = starter.p;
    state.startCard = starter.card;
    state.passDir = passDirection(state.cfg, state.round);
    if (state.passDir === 'none') {
      state.phase = 'play';
      state.actor = starter.p;
    } else {
      state.phase = 'pass';
      state.actor = firstUnsubmitted(state);
    }
    state.events.push({ type: 'deal', round: state.round, passDir: state.passDir });
  }

  function firstUnsubmitted(state) {
    for (var p = 0; p < state.players; p++) if (!state.passes[p]) return p;
    return -1;
  }

  // ---------- legality ----------

  function checkPass(state, p, cards) {
    if (state.terminal) return INVALID.ENDED;
    if (state.phase !== 'pass') return INVALID.PHASE;
    if (state.actor !== p) return INVALID.TURN;
    if (state.passes[p]) return INVALID.PASS_ALREADY;
    if (!Array.isArray(cards) || cards.length !== state.cfg.passCount) return INVALID.PASS_COUNT;
    var seen = {};
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      if (!Number.isInteger(c) || c < 0 || c > 51) return INVALID.BAD_CARD;
      if (seen[c]) return INVALID.PASS_DUP;
      seen[c] = true;
      if (state.hands[p].indexOf(c) < 0) return INVALID.NO_CARD;
    }
    return null;
  }

  function checkPlay(state, p, card) {
    if (state.terminal) return INVALID.ENDED;
    if (state.phase !== 'play') return INVALID.PHASE;
    if (state.actor !== p) return INVALID.TURN;
    if (!Number.isInteger(card) || card < 0 || card > 51) return INVALID.BAD_CARD;
    if (state.hands[p].indexOf(card) < 0) return INVALID.NO_CARD;
    var hand = state.hands[p];
    if (state.trick.length === 0) {
      // Leading.
      if (state.firstTrick && card !== state.startCard) return INVALID.MUST_LEAD;
      if (cardSuit(card) === 1 && !state.heartsBroken) {
        var nonHeart = hand.some(function (c) { return cardSuit(c) !== 1; });
        if (nonHeart) return INVALID.HEARTS;
      }
    } else {
      var ledSuit = cardSuit(state.trick[0].card);
      var hasLed = hand.some(function (c) { return cardSuit(c) === ledSuit; });
      if (hasLed && cardSuit(card) !== ledSuit) return INVALID.FOLLOW;
      if (state.firstTrick && state.cfg.noPenaltyFirstTrick && isPenalty(card)) {
        var nonPenalty = hand.some(function (c) { return !isPenalty(c); });
        if (nonPenalty) return INVALID.FIRST_TRICK;
      }
    }
    return null;
  }

  function legalPlays(state, p) {
    if (state.terminal || state.phase !== 'play' || state.actor !== p) return [];
    return state.hands[p].filter(function (c) { return checkPlay(state, p, c) === null; });
  }

  // ---------- resolution ----------

  function applyCommand(state, cmd) {
    if (!cmd || typeof cmd !== 'object' || typeof cmd.type !== 'string') {
      return { ok: false, reason: INVALID.BAD_SHAPE, state: state, events: [] };
    }
    if (cmd.type === 'resign') {
      if (state.terminal) return { ok: false, reason: INVALID.ENDED, state: state, events: [] };
      var rs = clone(state);
      rs.events = [];
      rs.tick++;
      var seat = Number.isInteger(cmd.p) ? cmd.p : 0;
      var best = null;
      for (var p = 0; p < rs.players; p++) {
        if (p === seat) continue;
        if (best === null || rs.matchScores[p] < rs.matchScores[best]) best = p;
      }
      rs.terminal = { reason: TERMINAL.RESIGN, winner: best, winners: [best], scores: rs.matchScores.slice(), resigned: seat };
      rs.phase = 'done';
      rs.events.push({ type: 'match-end', reason: TERMINAL.RESIGN, winner: best, winners: [best] });
      return { ok: true, state: rs, events: rs.events };
    }
    if (cmd.type === 'pass') return applyPass(state, cmd);
    if (cmd.type === 'play') return applyPlay(state, cmd);
    return { ok: false, reason: INVALID.BAD_CMD, state: state, events: [] };
  }

  function applyPass(state, cmd) {
    var p = Number.isInteger(cmd.p) ? cmd.p : state.actor;
    var reason = checkPass(state, p, cmd.cards);
    if (reason) return { ok: false, reason: reason, state: state, events: [] };

    var s = clone(state);
    s.events = [];
    s.tick++;
    var to = passTarget(s.cfg, p, s.passDir);
    s.passes[p] = { to: to, cards: cmd.cards.slice().sort(function (a, b) { return a - b; }) };
    s.events.push({ type: 'pass', p: p, to: to, dir: s.passDir });

    var next = firstUnsubmitted(s);
    if (next === -1) {
      // All passes in: swap simultaneously.
      var moving = [];
      for (var i = 0; i < s.players; i++) moving.push(s.passes[i].cards);
      for (i = 0; i < s.players; i++) {
        s.hands[i] = s.hands[i].filter(function (c) { return moving[i].indexOf(c) < 0; });
      }
      for (i = 0; i < s.players; i++) {
        var tgt = s.passes[i].to;
        for (var k = 0; k < moving[i].length; k++) s.hands[tgt].push(moving[i][k]);
      }
      for (i = 0; i < s.players; i++) sortHand(s.hands[i]);
      // The dealt starter card may have moved hands; re-derive who leads.
      var holder = -1;
      for (i = 0; i < s.players; i++) if (s.hands[i].indexOf(s.startCard) >= 0) holder = i;
      s.leader = holder >= 0 ? holder : findStarter(s.hands).p;
      if (holder < 0) s.startCard = findStarter(s.hands).card;
      s.phase = 'play';
      s.actor = s.leader;
      s.events.push({ type: 'pass-done', dir: s.passDir });
    } else {
      s.actor = next;
    }
    return { ok: true, state: s, events: s.events };
  }

  function applyPlay(state, cmd) {
    var p = Number.isInteger(cmd.p) ? cmd.p : state.actor;
    var reason = checkPlay(state, p, cmd.card);
    if (reason) return { ok: false, reason: reason, state: state, events: [] };

    var s = clone(state);
    s.events = [];
    s.tick++;
    var rng = RNG.create(s.rngState);

    s.hands[p].splice(s.hands[p].indexOf(cmd.card), 1);
    s.trick.push({ p: p, card: cmd.card });
    s.events.push({ type: 'play', p: p, card: cmd.card });
    if (cmd.card === QUEEN_SPADES) s.events.push({ type: 'queen', p: p });
    if (cardSuit(cmd.card) === 1 && !s.heartsBroken) {
      s.heartsBroken = true;
      s.events.push({ type: 'hearts-broken' });
    }

    if (s.trick.length === s.players) {
      // Resolve the trick: highest rank of the led suit takes it.
      var ledSuit = cardSuit(s.trick[0].card);
      var winIdx = 0;
      for (var i = 1; i < s.trick.length; i++) {
        var e = s.trick[i];
        if (cardSuit(e.card) === ledSuit && cardRank(e.card) > cardRank(s.trick[winIdx].card)) winIdx = i;
      }
      var winner = s.trick[winIdx].p;
      var cards = s.trick.map(function (e) { return e.card; });
      var pts = 0;
      cards.forEach(function (c) { pts += penaltyOf(c); });
      for (i = 0; i < cards.length; i++) s.taken[winner].push(cards[i]);
      s.stats.tricksWon[winner]++;
      cards.forEach(function (c) {
        if (cardSuit(c) === 1) s.stats.heartsTaken[winner]++;
        if (c === QUEEN_SPADES) s.stats.queensTaken[winner]++;
      });
      s.events.push({ type: 'trick', winner: winner, points: pts, cards: cards });
      s.trick = [];
      s.firstTrick = false;
      s.leader = winner;
      s.actor = winner;

      var empty = s.hands.every(function (h) { return h.length === 0; });
      if (empty) endRound(s, rng);
    } else {
      s.actor = (p + 1) % s.players;
    }

    s.rngState = rng.state;
    return { ok: true, state: s, events: s.events };
  }

  function endRound(s, rng) {
    var n = s.players;
    var raw = [];
    for (var p = 0; p < n; p++) {
      raw.push(s.taken[p].reduce(function (a, c) { return a + penaltyOf(c); }, 0));
    }
    var eclipseBy = -1;
    for (p = 0; p < n; p++) if (raw[p] === ECLIPSE_POINTS) eclipseBy = p;
    var final = raw.slice();
    if (eclipseBy >= 0) {
      s.stats.eclipses[eclipseBy]++;
      if (s.cfg.eclipseRule === 'self') {
        final[eclipseBy] = -ECLIPSE_POINTS;
      } else { // 'others'
        for (p = 0; p < n; p++) final[p] = p === eclipseBy ? 0 : ECLIPSE_POINTS;
      }
      s.events.push({ type: 'eclipse', p: eclipseBy, rule: s.cfg.eclipseRule });
    }
    for (p = 0; p < n; p++) s.matchScores[p] += final[p];
    s.roundSummaries.push({
      round: s.round, rawPoints: raw, points: final,
      eclipseBy: eclipseBy >= 0 ? eclipseBy : null, scores: s.matchScores.slice()
    });
    s.events.push({
      type: 'round-end', round: s.round, points: final, rawPoints: raw,
      eclipseBy: eclipseBy >= 0 ? eclipseBy : null, scores: s.matchScores.slice()
    });

    var maxScore = Math.max.apply(null, s.matchScores);
    var capped = s.cfg.maxRounds && s.round >= s.cfg.maxRounds;
    if (maxScore >= s.cfg.threshold || capped) {
      var min = Math.min.apply(null, s.matchScores);
      var winners = [];
      for (p = 0; p < n; p++) if (s.matchScores[p] === min) winners.push(p);
      var reason = capped && maxScore < s.cfg.threshold ? TERMINAL.ROUNDS_CAP : TERMINAL.THRESHOLD;
      s.terminal = { reason: reason, winner: winners[0], winners: winners, scores: s.matchScores.slice() };
      s.phase = 'done';
      s.events.push({ type: 'match-end', reason: reason, winner: winners[0], winners: winners, scores: s.matchScores.slice() });
      return;
    }
    s.round++;
    dealRound(s, rng);
  }

  // ---------- AI (pure; choices are logged as ordinary commands) ----------

  // Deterministic per (state, seat): same state → same choice.
  function aiRng(state, seat, salt) {
    return RNG.create(RNG.hashString(
      state.rngState + ':' + state.tick + ':' + state.round + ':' + seat + ':' + (salt || '')
    ));
  }

  function aiChoose(state, seat) {
    if (state.terminal) return null;
    var level = (state.cfg.ai && state.cfg.ai.level) || 'normal';
    if (state.phase === 'pass' && !state.passes[seat]) {
      return { type: 'pass', p: seat, cards: aiPassCards(state, seat, level) };
    }
    if (state.phase === 'play' && state.actor === seat) {
      return { type: 'play', p: seat, card: aiPlayCard(state, seat, level) };
    }
    return null;
  }

  function suitCounts(hand) {
    var counts = [0, 0, 0, 0];
    hand.forEach(function (c) { counts[cardSuit(c)]++; });
    return counts;
  }

  function aiPassCards(state, seat, level) {
    var hand = state.hands[seat].slice();
    var rng = aiRng(state, seat, 'pass');
    if (level === 'easy') { rng.shuffle(hand); return hand.slice(0, state.cfg.passCount); }

    var counts = suitCounts(hand);
    var scored = hand.map(function (c) {
      var suit = cardSuit(c), rank = cardRank(c), score = 0;
      if (level === 'hard') {
        // Danger of holding the Queen with thin spade cover.
        if (c === QUEEN_SPADES) score += counts[0] <= 4 ? 60 : -25;
        else if (suit === 0 && rank >= 11) score += 28; // K♠/A♠ attract the Queen
        if (suit === 1) score += 4 + rank;             // shed hearts, high first
        // Void creation: dump cards from the shortest non-spade suit.
        if (suit !== 0 && counts[suit] <= 2) score += 18 - counts[suit] * 4;
        if (rank >= 11) score += 6;                    // generic high-card risk
      } else { // normal
        if (c === QUEEN_SPADES) score += counts[0] <= 3 ? 50 : -10;
        else if (suit === 0 && rank >= 11) score += 20;
        if (suit === 1) score += rank;
        if (rank >= 11) score += 4;
      }
      score += rng.next(); // seeded tie-break variety
      return { c: c, score: score };
    });
    scored.sort(function (a, b) { return b.score - a.score; });
    return scored.slice(0, state.cfg.passCount).map(function (e) { return e.c; });
  }

  function aiPlayCard(state, seat, level) {
    var legal = legalPlays(state, seat);
    if (!legal.length) return state.hands[seat][0];
    if (legal.length === 1) return legal[0];
    var rng = aiRng(state, seat, 'play');
    if (level === 'easy') return rng.pick(legal);

    var hand = state.hands[seat];
    var trick = state.trick;
    var trickPts = trick.reduce(function (a, e) { return a + penaltyOf(e.card); }, 0);

    if (trick.length > 0) {
      var ledSuit = cardSuit(trick[0].card);
      var follow = legal.filter(function (c) { return cardSuit(c) === ledSuit; });
      if (follow.length) {
        var high = Math.max.apply(null, trick.filter(function (e) {
          return cardSuit(e.card) === ledSuit;
        }).map(function (e) { return cardRank(e.card); }));
        var under = follow.filter(function (c) { return cardRank(c) < high; });
        var lastToAct = trick.length === state.players - 1;
        if (trickPts > 0) {
          // Duck beneath the trick if possible; otherwise shed the highest.
          if (under.length) return maxRank(under);
          return maxRank(follow);
        }
        if (under.length) return maxRank(under);
        // Must take it (or could win cheaply): take with the lowest winner.
        var winners = follow.filter(function (c) { return cardRank(c) > high; });
        if (winners.length && lastToAct && trickPts === 0) return minRank(winners);
        return minRank(winners.length ? winners : follow);
      }
      // Void in the led suit: dump the most dangerous card.
      var dumps = legal.slice().sort(function (a, b) { return dumpValue(state, hand, b) - dumpValue(state, hand, a); });
      return dumps[0];
    }

    // Leading.
    var nonHeart = legal.filter(function (c) { return cardSuit(c) !== 1; });
    var pool = nonHeart.length ? nonHeart : legal;
    if (level === 'hard') {
      // Lead low from the longest safe suit; avoid spades while the Queen lurks.
      var counts = suitCounts(hand);
      var bySuit = [0, 2, 3].filter(function (s) { return counts[s] > 0; });
      bySuit.sort(function (a, b) { return counts[b] - counts[a]; });
      for (var i = 0; i < bySuit.length; i++) {
        var inSuit = pool.filter(function (c) { return cardSuit(c) === bySuit[i] && c !== QUEEN_SPADES; });
        if (inSuit.length) return minRank(inSuit);
      }
    }
    return minRank(pool.filter(function (c) { return c !== QUEEN_SPADES; }).length
      ? pool.filter(function (c) { return c !== QUEEN_SPADES; }) : pool);
  }

  function dumpValue(state, hand, c) {
    if (c === QUEEN_SPADES) return 100;
    var suit = cardSuit(c), rank = cardRank(c);
    if (suit === 0 && rank >= 11) return 60 + rank; // K♠/A♠
    if (suit === 1) return 30 + rank;               // hearts, high first
    return rank;                                     // plain high cards
  }
  function minRank(cards) {
    return cards.reduce(function (a, c) { return cardRank(c) < cardRank(a) ? c : a; });
  }
  function maxRank(cards) {
    return cards.reduce(function (a, c) { return cardRank(c) > cardRank(a) ? c : a; });
  }

  // ---------- hints (same legality surface as play) ----------

  function hint(state, seat) {
    if (state.terminal) return null;
    if (state.phase === 'pass' && !state.passes[seat]) {
      var cards = aiPassCards(state, seat, 'hard');
      var why = 'Shed your most dangerous cards.';
      if (cards.indexOf(QUEEN_SPADES) >= 0) why = 'Pass the Nightshade Queen — she is 13 points of trouble.';
      else if (cards.some(function (c) { return cardSuit(c) === 0 && cardRank(c) >= 11; }))
        why = 'High spades attract the Queen. Let them go.';
      else if (cards.some(function (c) { return cardSuit(c) === 1; }))
        why = 'Pass your highest hearts before they stick to you.';
      return { kind: 'pass', cards: cards, why: why };
    }
    if (state.phase === 'play' && state.actor === seat) {
      var card = aiPlayCard(state, seat, 'hard');
      var t = state.trick;
      var why2;
      if (t.length === 0) why2 = 'Lead low and stay out of trouble.';
      else if (cardSuit(card) !== cardSuit(t[0].card)) {
        why2 = card === QUEEN_SPADES ? 'You are void — drop the Queen on someone.'
          : cardSuit(card) === 1 ? 'You are void — shed a heart.'
          : 'You are void — discard your most dangerous card.';
      } else {
        var pts = t.reduce(function (a, e) { return a + penaltyOf(e.card); }, 0);
        why2 = pts > 0 ? 'Duck under — let someone else eat the points.' : 'Follow suit, low and safe.';
      }
      return { kind: 'play', card: card, why: why2 };
    }
    return null;
  }

  // ---------- validation (network / replay boundary) ----------

  function validateCommandShape(cmd, maxLen) {
    if (!cmd || typeof cmd !== 'object') return INVALID.BAD_SHAPE;
    if (JSON.stringify(cmd).length > (maxLen || 512)) return INVALID.BAD_SHAPE;
    if (cmd.type !== 'pass' && cmd.type !== 'play' && cmd.type !== 'resign') return INVALID.BAD_CMD;
    if (cmd.id != null && (typeof cmd.id !== 'string' || cmd.id.length > 64)) return INVALID.BAD_SHAPE;
    if (cmd.p != null && (!Number.isInteger(cmd.p) || cmd.p < 0 || cmd.p > 3)) return INVALID.BAD_SHAPE;
    if (cmd.type === 'play' && !Number.isInteger(cmd.card)) return INVALID.BAD_SHAPE;
    if (cmd.type === 'pass' && !Array.isArray(cmd.cards)) return INVALID.BAD_SHAPE;
    return null;
  }

  // ---------- serialization ----------

  function serialize(state) { return JSON.stringify(state); }
  function deserialize(json) {
    var s = JSON.parse(json);
    if (s.v !== STATE_VERSION) throw new Error('unsupported state version ' + s.v);
    return s;
  }

  return {
    STATE_VERSION: STATE_VERSION,
    TERMINAL: TERMINAL,
    INVALID: INVALID,
    SUIT_NAMES: SUIT_NAMES,
    SUIT_GLYPHS: SUIT_GLYPHS,
    RANK_NAMES: RANK_NAMES,
    QUEEN_SPADES: QUEEN_SPADES,
    ECLIPSE_POINTS: ECLIPSE_POINTS,
    cardSuit: cardSuit,
    cardRank: cardRank,
    cardName: cardName,
    penaltyOf: penaltyOf,
    isPenalty: isPenalty,
    passDirection: passDirection,
    passTarget: passTarget,
    createGame: createGame,
    applyCommand: applyCommand,
    checkPass: checkPass,
    checkPlay: checkPlay,
    legalPlays: legalPlays,
    aiChoose: aiChoose,
    hint: hint,
    hashState: hashState,
    stableStringify: stableStringify,
    serialize: serialize,
    deserialize: deserialize,
    clone: clone,
    validateCommandShape: validateCommandShape
  };
});
