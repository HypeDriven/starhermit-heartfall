/* Heartfall — versioned content: themes, journey stages, challenges,
 * practice presets, daily ruleset generator, tutorial lessons, AI personas.
 * Shared browser (window.HFContent) / Node. Content is data-only; all
 * randomness enters through the config seed.
 */
(function (root, factory) {
  var RNG = (typeof module === 'object' && module.exports) ? require('./rng.js') : root.HFRNG;
  var api = factory(RNG);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HFContent = api;
})(typeof self !== 'undefined' ? self : this, function (RNG) {
  'use strict';

  var CONTENT_VERSION = 1;

  // ---------- AI personas (conservatory night-shift regulars) ----------
  var PERSONAS = [
    { name: 'Fern',  tag: 'patient gardener' },
    { name: 'Moth',  tag: 'lamp chaser' },
    { name: 'Luna',  tag: 'moon watcher' },
    { name: 'Pip',   tag: 'seed counter' }
  ];
  function seatName(seat, players) {
    if (seat === 0) return 'You';
    return PERSONAS[(seat - 1) % PERSONAS.length].name;
  }

  // ---------- themes (cosmetic only: materials, light, ambience) ----------
  var THEMES = [
    { id: 'moonlit',  name: 'Moonlit Glasshouse', unlockStars: 0,
      palette: { sky: 0x0d1526, dome: 0x1c2b47, mullion: 0x2a3c5e, floor: 0x1a2438,
                 felt: 0x1e4d3a, tableRim: 0x5a4028, light: 0xbfd4ff, accent: 0x8fb4ff,
                 moon: 0xf2f5e8, foliage: 0x2d5a3d, pot: 0x6e4526 } },
    { id: 'verdant',  name: 'Verdant Night', unlockStars: 12,
      palette: { sky: 0x0c1a12, dome: 0x1a3324, mullion: 0x2a4a34, floor: 0x14241a,
                 felt: 0x2a5230, tableRim: 0x6a5230, light: 0xd6ffb0, accent: 0x9fe080,
                 moon: 0xf0ffe0, foliage: 0x3a7a46, pot: 0x5d5230 } },
    { id: 'rose',     name: 'Nocturne Rose', unlockStars: 30,
      palette: { sky: 0x1c1020, dome: 0x33203a, mullion: 0x4a2e52, floor: 0x241826,
                 felt: 0x4a2440, tableRim: 0x5d3a2c, light: 0xffc0d8, accent: 0xff90b8,
                 moon: 0xffe8f0, foliage: 0x4a3a5a, pot: 0x6e4638 } },
    { id: 'pond',     name: 'Starlit Pond', unlockStars: 55,
      palette: { sky: 0x081c22, dome: 0x14333c, mullion: 0x1f4a54, floor: 0x10262c,
                 felt: 0x1c4a50, tableRim: 0x4a4436, light: 0xb0f0f4, accent: 0x7fd8e0,
                 moon: 0xe8fffa, foliage: 0x2a6a54, pot: 0x54483a } },
    { id: 'ivory',    name: 'Ivory Moon', unlockStars: 85,
      palette: { sky: 0x232230, dome: 0x3a3848, mullion: 0x524f66, floor: 0x2a2836,
                 felt: 0x3a4a5e, tableRim: 0x8a6a4a, light: 0xfff2dd, accent: 0xffd9a0,
                 moon: 0xfffaf0, foliage: 0x4a5a48, pot: 0x8a6a4a } }
  ];

  // ---------- journey ----------
  // Compact authored rows:
  // [id, name, seed, players, threshold, passCycle, aiLevel, eclipseRule,
  //  goalType, goalValue, themeIdx, intro]
  // goal: 'win' | 'score-under' | 'avoid-queen' | 'eclipse' | 'no-hearts-round'
  var PASS_STD = ['left', 'right', 'across', 'none'];
  var PASS_LR = ['left', 'right', 'none'];
  var J = [
    ['j01', 'First Hand',        201, 4, 25, PASS_LR,  'easy',   'others', 'win', 0, 0,
     'Take tricks, dodge hearts. Lowest score when someone reaches 25 wins.'],
    ['j02', 'Open Windows',      202, 4, 25, PASS_LR,  'easy',   'others', 'win', 0, 0, ''],
    ['j03', 'Night Shift',       203, 4, 50, PASS_STD, 'easy',   'others', 'win', 0, 0,
     'Now you pass across the table on the third round, and hold everything on the fourth.'],
    ['j04', 'Watch the Queen',   204, 4, 50, PASS_STD, 'easy',   'others', 'avoid-queen', 0, 0,
     'The Nightshade Queen (Q♠) is worth 13 penalty points. Win without ever taking her.'],
    ['j05', 'Three at the Table',205, 3, 50, PASS_LR,  'easy',   'others', 'win', 0, 1,
     'Three seats tonight. With fewer players, every void suit matters more.'],
    ['j06', 'Quiet Hands',       206, 4, 50, PASS_STD, 'easy',   'others', 'score-under', 30, 1,
     'Win the match and keep your own total at 29 or less.'],
    ['j07', 'Passing Trade',     207, 4, 50, PASS_STD, 'normal', 'others', 'win', 0, 1,
     'Fern has learned to pass her dangers away. So should you.'],
    ['j08', 'Heartbreak Hotel',  208, 4, 50, PASS_STD, 'normal', 'others', 'no-hearts-round', 0, 1,
     'Win, and finish at least one full round without taking a single heart.'],
    ['j09', 'Long Night',        209, 4, 75, PASS_STD, 'normal', 'others', 'win', 0, 1, ''],
    ['j10', 'Glasshouse Trial',  210, 4, 75, PASS_STD, 'normal', 'others', 'score-under', 40, 1,
     'MASTERY: win a full 75-point match and stay at 39 or less.'],
    ['j11', 'No Passing Lane',   211, 4, 50, ['none'], 'normal', 'others', 'win', 0, 2,
     'No passing tonight — you play the hand you are dealt.'],
    ['j12', 'Queen\u2019s Garden',   212, 4, 50, PASS_STD, 'normal', 'others', 'avoid-queen', 0, 2, ''],
    ['j13', 'Short Visit',       213, 4, 25, PASS_LR,  'normal', 'others', 'score-under', 12, 2,
     'A quick 25-point match. Win it with 11 or fewer points of your own.'],
    ['j14', 'Moon Debt',         214, 4, 50, PASS_STD, 'normal', 'self',   'win', 0, 2,
     'House rule: an Eclipse subtracts 26 from the capturer instead of taxing the table.'],
    ['j15', 'Triple Moon',       215, 3, 75, PASS_LR,  'normal', 'others', 'win', 0, 2, ''],
    ['j16', 'Eclipse Season',    216, 4, 75, PASS_STD, 'normal', 'others', 'eclipse', 0, 2,
     'Capture every penalty card in one round — all thirteen hearts plus the Queen.'],
    ['j17', 'High Stakes Tea',   217, 4, 75, PASS_STD, 'normal', 'others', 'score-under', 35, 2, ''],
    ['j18', 'Right Hand Only',   218, 4, 50, ['right'], 'normal', 'others', 'win', 0, 2,
     'Every pass goes right, every round. Plan for what your left neighbor sends back.'],
    ['j19', 'Duel at Dusk',      219, 2, 50, PASS_LR,  'normal', 'others', 'win', 0, 3,
     'Heads-up: half the deck sleeps face-down. Read Moth, not the cards.'],
    ['j20', 'Conservatory Exam', 220, 4, 100, PASS_STD, 'normal', 'others', 'score-under', 50, 3,
     'MASTERY: a full-length match against settled opponents. Stay under 50.'],
    ['j21', 'Hard Frost',        221, 4, 50, PASS_STD, 'hard',   'others', 'win', 0, 3,
     'Luna takes the seat. She counts everything.'],
    ['j22', 'Queen\u2019s Gambit',   222, 4, 50, PASS_STD, 'hard',   'others', 'avoid-queen', 0, 3, ''],
    ['j23', 'Lean Table',        223, 3, 50, PASS_LR,  'hard',   'others', 'score-under', 25, 3, ''],
    ['j24', 'No Mercy Rule',     224, 4, 50, PASS_STD, 'hard',   'self',   'eclipse', 0, 3,
     'Eclipse subtracts from your own score — a reason to be greedy. Do it once.'],
    ['j25', 'Swift Night',       225, 4, 25, PASS_LR,  'hard',   'others', 'win', 0, 3, ''],
    ['j26', 'Garden of Hearts',  226, 4, 75, PASS_STD, 'hard',   'others', 'no-hearts-round', 0, 3, ''],
    ['j27', 'Duel of Wits',      227, 2, 75, PASS_LR,  'hard',   'others', 'win', 0, 3, ''],
    ['j28', 'Across the Moon',   228, 4, 75, ['across', 'left', 'right', 'none'], 'hard', 'others', 'win', 0, 3, ''],
    ['j29', 'Thin Ice',          229, 4, 50, ['none'], 'hard',   'others', 'score-under', 30, 4,
     'No passes, sharp opponents, and a tight budget.'],
    ['j30', 'Midnight Mastery',  230, 4, 100, PASS_STD, 'hard',   'others', 'score-under', 60, 4,
     'MASTERY: the full examination at the hardest table.'],
    ['j31', 'Pip\u2019s Riddle',     231, 3, 50, PASS_LR,  'hard',   'others', 'avoid-queen', 0, 4, ''],
    ['j32', 'The Long Count',    232, 4, 100, PASS_STD, 'hard',   'others', 'win', 0, 4, ''],
    ['j33', 'Queen Hunting',     233, 4, 50, PASS_STD, 'hard',   'others', 'no-hearts-round', 0, 4, ''],
    ['j34', 'Cheap Victory',     234, 4, 50, PASS_STD, 'hard',   'others', 'score-under', 20, 4,
     'Win a 50-point match with 19 or fewer points of your own.'],
    ['j35', 'Trio Finale',       235, 3, 100, PASS_LR,  'hard',   'others', 'win', 0, 4, ''],
    ['j36', 'Duel Under Glass',  236, 2, 100, PASS_LR,  'hard',   'others', 'score-under', 45, 4, ''],
    ['j37', 'Eclipse or Bust',   237, 4, 75, PASS_STD, 'hard',   'self',   'eclipse', 0, 4, ''],
    ['j38', 'Iron Nerves',       238, 4, 75, ['none'], 'hard',   'others', 'avoid-queen', 0, 4,
     'No passing and no Queen. Survive the hand you are dealt.'],
    ['j39', 'Last Lamp Burning', 239, 4, 100, PASS_STD, 'hard',   'others', 'score-under', 55, 4, ''],
    ['j40', 'Heartfall',         240, 4, 100, PASS_STD, 'hard',   'self',   'score-under', 50, 0,
     'MASTERY: everything the conservatory has taught you, in one final sitting.']
  ];

  var GOAL_TEXT = {
    'win': 'Win the match',
    'score-under': 'Win with your score at {v} or less',
    'avoid-queen': 'Win without taking the Nightshade Queen',
    'eclipse': 'Win, and capture every penalty card in one round',
    'no-hearts-round': 'Win, with one round of zero hearts taken'
  };

  function expandLevel(row, idx) {
    return {
      id: row[0], version: CONTENT_VERSION, kind: 'journey', index: idx,
      name: row[1], seed: row[2], players: row[3], threshold: row[4],
      maxRounds: 0, passCycle: row[5], passCount: 3,
      eclipseRule: row[7], noPenaltyFirstTrick: true,
      ai: { level: row[6] },
      goal: { type: row[8], value: row[9] },
      parScore: row[8] === 'score-under' ? row[9] : Math.max(10, Math.round(row[4] * 0.6)),
      mechanics: { undo: false, hint: true },
      theme: THEMES[row[10]].id,
      intro: row[11] || '',
      mastery: /MASTERY/.test(row[11] || '')
    };
  }

  var JOURNEY = J.map(expandLevel);

  function goalText(goal) {
    return (GOAL_TEXT[goal.type] || GOAL_TEXT.win).replace('{v}', goal.value - 1);
  }

  // ---------- challenges ----------
  var CHALLENGES = [
    { id: 'c1', name: 'Queen Dodger', seed: 601, kind: 'challenge', players: 4,
      threshold: 50, maxRounds: 0, passCycle: PASS_STD, passCount: 3,
      eclipseRule: 'others', noPenaltyFirstTrick: true, ai: { level: 'normal' },
      goal: { type: 'avoid-queen', value: 0 }, parScore: 30,
      mechanics: { undo: false, hint: false }, theme: 'moonlit',
      intro: 'Win a 50-point match without ever taking the Nightshade Queen. No assists.' },
    { id: 'c2', name: 'Total Eclipse', seed: 602, kind: 'challenge', players: 4,
      threshold: 75, maxRounds: 0, passCycle: PASS_STD, passCount: 3,
      eclipseRule: 'self', noPenaltyFirstTrick: true, ai: { level: 'normal' },
      goal: { type: 'eclipse', value: 0 }, parScore: 40,
      mechanics: { undo: false, hint: false }, theme: 'pond',
      intro: 'An Eclipse pays you, not the table. Capture all 26 points in a round, then win.' },
    { id: 'c3', name: 'Sprint Night', seed: 603, kind: 'challenge', players: 4,
      threshold: 25, maxRounds: 0, passCycle: PASS_LR, passCount: 3,
      eclipseRule: 'others', noPenaltyFirstTrick: true, ai: { level: 'hard' },
      goal: { type: 'win', value: 0 }, parScore: 12,
      mechanics: { undo: false, hint: true }, theme: 'verdant',
      intro: 'One or two rounds, hard opponents. Every point is fatal.' },
    { id: 'c4', name: 'Three\u2019s Company', seed: 604, kind: 'challenge', players: 3,
      threshold: 75, maxRounds: 0, passCycle: PASS_LR, passCount: 3,
      eclipseRule: 'others', noPenaltyFirstTrick: true, ai: { level: 'hard' },
      goal: { type: 'win', value: 0 }, parScore: 40,
      mechanics: { undo: false, hint: true }, theme: 'rose',
      intro: 'Seventeen cards each, no 2♦, hard company.' },
    { id: 'c5', name: 'Clean Hands', seed: 605, kind: 'challenge', players: 4,
      threshold: 50, maxRounds: 0, passCycle: ['none'], passCount: 3,
      eclipseRule: 'others', noPenaltyFirstTrick: true, ai: { level: 'hard' },
      goal: { type: 'score-under', value: 15 }, parScore: 15,
      mechanics: { undo: false, hint: false }, theme: 'ivory',
      intro: 'No passing, no hints, hard table: win with 14 points or fewer.' },
    { id: 'c6', name: 'Moon Marathon', seed: 606, kind: 'challenge', players: 4,
      threshold: 150, maxRounds: 0, passCycle: PASS_STD, passCount: 3,
      eclipseRule: 'self', noPenaltyFirstTrick: true, ai: { level: 'hard' },
      goal: { type: 'win', value: 0 }, parScore: 80,
      mechanics: { undo: false, hint: false }, theme: 'moonlit',
      intro: 'A 150-point marathon against the hardest seats in the house.' }
  ].map(function (c) { c.version = CONTENT_VERSION; return c; });

  // ---------- practice presets ----------
  var PRACTICE = [
    { id: 'casual', name: 'Casual', players: 4, threshold: 50,
      passCycle: PASS_STD, passCount: 3, eclipseRule: 'others',
      noPenaltyFirstTrick: true, ai: { level: 'easy' },
      mechanics: { undo: true, hint: true } },
    { id: 'apprentice', name: 'Apprentice', players: 4, threshold: 75,
      passCycle: PASS_STD, passCount: 3, eclipseRule: 'others',
      noPenaltyFirstTrick: true, ai: { level: 'normal' },
      mechanics: { undo: true, hint: true } },
    { id: 'expert', name: 'Expert', players: 4, threshold: 100,
      passCycle: PASS_STD, passCount: 3, eclipseRule: 'others',
      noPenaltyFirstTrick: true, ai: { level: 'hard' },
      mechanics: { undo: true, hint: true } }
  ].map(function (p) { p.version = CONTENT_VERSION; p.kind = 'practice'; p.maxRounds = 0; p.goal = { type: 'win', value: 0 }; return p; });

  // ---------- daily ----------
  // One immutable ruleset per UTC day, derived purely from the date string.
  function dailyConfig(dateStr) {
    var seed = RNG.hashString('heartfall-daily-v' + CONTENT_VERSION + '-' + dateStr);
    var day = Math.floor(Date.parse(dateStr + 'T00:00:00Z') / 86400000);
    var rot = ((day % 7) + 7) % 7;
    var levels = ['normal', 'normal', 'hard', 'normal', 'hard', 'normal', 'hard'];
    var thresholds = [50, 75, 50, 100, 50, 75, 100];
    var players = [4, 4, 3, 4, 4, 3, 4];
    var cycles = [PASS_STD, PASS_LR, PASS_LR, PASS_STD, ['none'], PASS_LR, PASS_STD];
    return {
      id: 'daily-' + dateStr, version: CONTENT_VERSION, kind: 'daily',
      name: 'Daily ' + dateStr, seed: seed, date: dateStr,
      players: players[rot], threshold: thresholds[rot], maxRounds: 0,
      passCycle: cycles[rot], passCount: 3,
      eclipseRule: rot % 3 === 2 ? 'self' : 'others',
      noPenaltyFirstTrick: true,
      ai: { level: levels[rot] },
      goal: { type: 'win', value: 0 },
      parScore: Math.round(thresholds[rot] * 0.55),
      mechanics: { undo: false, hint: true },
      theme: THEMES[rot % THEMES.length].id,
      intro: 'One shared table for everyone, today only.'
    };
  }

  function utcDateString(nowMs) {
    var d = new Date(nowMs == null ? Date.now() : nowMs);
    return d.getUTCFullYear() + '-' +
      String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
      String(d.getUTCDate()).padStart(2, '0');
  }

  // ---------- tutorial (Learn) ----------
  // Fixture shapes are applied by the session after createGame: they
  // overwrite hands/trick/phase so each lesson isolates one rule.
  var S = 0, H = 13, D = 26, C = 39; // suit bases for readable fixtures
  function tutorialLessons() {
    return [
      { id: 't1', title: 'Follow the suit',
        text: 'Cards are played in tricks. When a suit is led, you must play that suit if you have it. Fern led a diamond — answer with your 7♦.',
        goal: { kind: 'play' },
        fixture: function (st) {
          st.phase = 'play'; st.firstTrick = false; st.heartsBroken = false;
          st.trick = [{ p: 1, card: D + 9 }]; // J♦ led
          st.leader = 1; st.actor = 0;
          st.hands[0] = [D + 5, C + 2, H + 4];           // 7♦, 4♣, 6♥
          st.hands[1] = [D + 2, S + 3, C + 5];
          st.hands[2] = [D + 8, S + 6, H + 9];
          st.hands[3] = [S + 1, C + 7, H + 11];
        },
        cfg: { id: 't1', seed: 9001 } },
      { id: 't2', title: 'Pass three cards',
        text: 'Before most rounds you pass three cards to another seat. Send your most dangerous cards away — select three and confirm the pass.',
        goal: { kind: 'pass' },
        cfg: { id: 't2', seed: 9002 } },
      { id: 't3', title: 'Duck the points',
        text: 'A heart was discarded into this trick. If you win the trick, you take the point. Play your 2♠ — stay out of it and let Fern keep her heart.',
        goal: { kind: 'duck' },
        fixture: function (st) {
          st.players = 3;
          st.phase = 'play'; st.firstTrick = false; st.heartsBroken = true;
          st.trick = [{ p: 1, card: D + 10 }, { p: 2, card: H + 6 }]; // Q♦, 8♥
          st.leader = 1; st.actor = 0;
          st.hands[0] = [D + 11, S + 0];                 // K♦, 2♠
          st.hands[1] = [C + 1];
          st.hands[2] = [C + 3];
          st.taken = [[], [], []];
        },
        cfg: { id: 't3', seed: 9003, players: 3 } },
      { id: 't4', title: 'Dump the Queen',
        text: 'The Nightshade Queen (Q♠) costs 13 points to whoever takes her. You have no diamonds — this is your chance to drop her on someone else. Play Q♠.',
        goal: { kind: 'queen-dump' },
        fixture: function (st) {
          st.phase = 'play'; st.firstTrick = false; st.heartsBroken = false;
          st.trick = [{ p: 1, card: D + 12 }, { p: 2, card: D + 11 }]; // A♦, K♦
          st.leader = 1; st.actor = 0;
          st.hands[0] = [S + 10, C + 0, H + 3];          // Q♠, 2♣, 5♥
          st.hands[1] = [C + 2, H + 5, S + 2];
          st.hands[2] = [D + 0, C + 4, H + 7];
          st.hands[3] = [D + 2, S + 4, C + 6];
        },
        cfg: { id: 't4', seed: 9004 } },
      { id: 't5', title: 'Catch the Eclipse',
        text: 'You have quietly taken every penalty so far — 25 points. Win this last trick and the Eclipse flips the table: everyone else takes 26. Play your A♦.',
        goal: { kind: 'eclipse' },
        fixture: function (st) {
          st.phase = 'play'; st.firstTrick = false; st.heartsBroken = true;
          st.trick = [{ p: 1, card: D + 1 }, { p: 2, card: H + 0 }, { p: 3, card: D + 3 }]; // 3♦, 2♥, 5♦
          st.leader = 1; st.actor = 0;
          st.hands = [[D + 12], [C + 0], [C + 1], [C + 2]];   // A♦ last
          var eaten = [S + 10]; // Q♠
          for (var h = 1; h < 13; h++) eaten.push(H + h);     // 3♥..A♥
          st.taken = [eaten, [S + 1], [S + 2], [S + 3]];
        },
        cfg: { id: 't5', seed: 9005 } },
      { id: 't6', title: 'Second chances',
        text: 'In Practice you can undo a play (U) or ask for a hint (H). Make any legal play, then undo it to finish the lesson.',
        goal: { kind: 'undo' },
        fixture: function (st) {
          st.phase = 'play'; st.firstTrick = false; st.heartsBroken = false;
          st.trick = [{ p: 1, card: C + 9 }];
          st.leader = 1; st.actor = 0;
          st.hands[0] = [C + 3, D + 4, S + 5];
          st.hands[1] = [D + 2, S + 3, H + 5];
          st.hands[2] = [D + 6, C + 8, H + 9];
          st.hands[3] = [S + 1, D + 7, H + 11];
        },
        cfg: { id: 't6', seed: 9006, mechanics: { undo: true, hint: true } } }
    ].map(function (l) {
      l.cfg = Object.assign({
        version: CONTENT_VERSION, kind: 'tutorial', players: 4, threshold: 999,
        maxRounds: 0, passCycle: ['none'], passCount: 3, eclipseRule: 'others',
        noPenaltyFirstTrick: true, ai: { level: 'easy' },
        goal: { type: 'win', value: 0 },
        mechanics: { undo: false, hint: true }, theme: 'moonlit'
      }, l.cfg);
      if (l.id === 't2') l.cfg.passCycle = ['left'];
      return l;
    });
  }

  // ---------- achievements (stable lowercase keys, idempotent) ----------
  var ACHIEVEMENTS = [
    { key: 'first-win',      name: 'First Sitting',      desc: 'Win your first match.' },
    { key: 'first-eclipse',  name: 'Total Eclipse',      desc: 'Capture every penalty card in one round.' },
    { key: 'queen-dodger',   name: 'Queen Dodger',       desc: 'Win a match without taking the Nightshade Queen.' },
    { key: 'clean-round',    name: 'Clean Hands',        desc: 'Finish a round with zero penalty points.' },
    { key: 'streak-3',       name: 'Regular',            desc: 'Win 3 matches in a row.' },
    { key: 'journey-half',   name: 'Half the Night',     desc: 'Finish 20 journey stages.' },
    { key: 'journey-done',   name: 'Conservatory Master', desc: 'Finish all 40 journey stages.' },
    { key: 'daily-7',        name: 'Moon Watcher',       desc: 'Finish 7 daily challenges.' },
    { key: 'matches-50',     name: 'Night Owl',          desc: 'Play 50 matches.' }
  ];

  return {
    CONTENT_VERSION: CONTENT_VERSION,
    PERSONAS: PERSONAS,
    seatName: seatName,
    THEMES: THEMES,
    JOURNEY: JOURNEY,
    CHALLENGES: CHALLENGES,
    PRACTICE: PRACTICE,
    ACHIEVEMENTS: ACHIEVEMENTS,
    dailyConfig: dailyConfig,
    utcDateString: utcDateString,
    tutorialLessons: tutorialLessons,
    goalText: goalText
  };
});
