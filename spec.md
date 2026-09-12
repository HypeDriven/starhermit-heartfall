# Heartfall — game design document

Running spec. Present tense; everything below describes what the shipped build does today.
Anything the design wants but the code does not yet do is collected in
**Design intent not yet implemented** at the end.

---

## 1. Overview

**Pitch.** A moonlit Victorian conservatory, a green baize card table, three quiet regulars and
you: pass three cards, follow suit, and try not to be the one holding the hearts when the lamp
burns out — unless you can take *every* penalty and turn the night inside out.

| | |
|---|---|
| Genre | Trick-taking card game (Hearts family), single-player vs. AI |
| Players | 1 human (seat 0) + 1–3 AI seats; tables of 2, 3 or 4 |
| Session length | 90 s (a Learn lesson) to ~12 min (a 100-point Journey match); one round is ~60–90 s |
| Platforms | Browser, desktop and mobile, portrait and landscape; offline-capable, no backend required |
| Rendering | 2D canvas (`#game-canvas`, `drawTable`) over DOM/CSS HUD. Painted table plate from `assets/table.webp`; hand, HUD and overlays are real DOM elements |
| Audio | WebAudio: 20 authored Opus one-shots on an effects bus + a generative ambient pad on a music bus, each with a synthesized fallback |
| Persistence | `localStorage` (`hf-settings-v1`, `hf-progress-v1`), mirrored to the StarHermit cloud-save slot when a launch token is present |

### File map

| Path | Contents |
|---|---|
| `index.html` | All ten screens as static markup; loads the five scripts in order |
| `css/style.css` | Complete stylesheet: palette tokens, screens, cards, HUD, overlays, key-art backgrounds |
| `js/rng.js` | `HFRNG`: mulberry32 PRNG, FNV-1a `hashString`, three derived streams (rules / decor / av) |
| `js/rules.js` | `HFRules`: the whole rules contract — deck, deal, pass, legality, trick resolution, scoring, terminal states, AI, hints, serialization |
| `js/content.js` | `HFContent`: themes, 40 Journey stages, 6 Challenges, 3 Practice presets, the daily generator, 6 Learn lessons, achievement definitions |
| `js/platform.js` | `HFPlatform`: StarHermit adapter — launch-token read/strip, Bearer + 45-min refresh, profile nickname, cloud-save mirror (stored zip + base64), sync status; inert without a token |
| `js/game.js` | `HFGame`: DOM wiring, screen navigation, session loop, AI pump, audio, canvas painting, results, local achievements, platform chip/adoption |
| `js/three.min.js`, `vendor/three.module.min.js` | three.js r160 (MIT). Loaded but not used for rendering — see Known limitations |
| `server.js` | Static file server (`PORT`, default 8000), path-traversal and dotfile guarded |
| `sfx/` | 20 Opus clips + `manifest.txt` (canonical, code-bound) + `manifest.md`/`manifest.json` (generation prompts) |
| `assets/` | `keyart.webp`, `table.webp`, `eclipse.webp` |
| `coverart.png` | 1200×675 store cover |
| `tests/rules-sanity.mjs`, `tests/lesson-check.mjs` | `npm test` |
| `tests/e2e.mjs` | Playwright playthrough of the real UI at desktop and mobile |
| `starhermit.txt` | Platform manifest: name, launch, owner, server, version, contentVersion, cover |

---

## 2. Vision and design pillars

**1. The table is legible before it is beautiful.** Every card in hand shows rank and suit as
text at all times; illegal cards are dimmed, not hidden, so you can see *why* you cannot play
them. Rules in: the painted plate as a backdrop under a 38 % scrim. Rules out: card-back art,
fans that hide ranks, any animation that moves a card while it is clickable.

**2. Hearts, honestly.** Classic rules, never bent for drama: follow suit, hearts break, the
Queen costs 13, shooting the moon (the Eclipse) flips the round. Rules in: house-rule *variants*
as declared table settings (`eclipseRule`, `passCycle`, `passCount`, `players`, `threshold`).
Rules out: hidden modifiers, rubber-banding AI, per-hand luck correction.

**3. Determinism you can trust.** `createGame(cfg)` plus a command log reproduces a match
exactly: no `Date.now()` or `Math.random()` in `js/rules.js`, and AI choices are computed outside
`applyCommand` and applied as ordinary commands. Rules in: the shared Daily table, seeded stages,
hashable state, undo-by-snapshot. Rules out: live-time effects and any rule reading the clock.

**4. A quiet room, not a casino.** Paper, felt and glass; a pad of three detuned voices under a
520 Hz lowpass swept by a 0.07 Hz LFO. Rules in: per-event one-shots at −20 LUFS, moonlit blues.
Rules out: stings, voice-over, fanfares louder than the room, flashing.

**5. Teach one rule at a time.** Learn is six fixtures, each making exactly one action
interesting — lesson 1 leaves you exactly one legal card. Rules in: hand-authored fixtures that
overwrite the dealt state. Rules out: wall-of-text tutorials and modal rule dumps.

---

## 3. Player experience

**Target player.** Someone who knows Hearts or can learn it in four minutes, wants a short solo
sitting with a clear ledger, and would rather read a table than watch a spectacle.

**First 60 seconds.** Title screen: painted conservatory, `HEARTFALL`, the tagline
"A moonlit conservatory card table", and five buttons. **Play** → Modes, where the first card is
**Learn — "Tutorial — the rules, one at a time."** Learn lesson 1 ("Follow the suit") deals a
three-card fixture in which only the 7♦ is legal; the other two are dimmed, the objective line
reads "Your turn — play a card.", and clicking the one bright card completes the lesson and
offers **Next lesson**. A player who instead taps **Play → Journey** lands on stage 1
("First Hand"), whose intro text is the whole rules contract in one line: "Take tricks, dodge
hearts. Lowest score when someone reaches 25 wins." Illegal taps never silently fail: they play
`invalid` and raise a toast naming the reason ("must-follow-suit", "Select 3 cards to pass.").
**Help** on the title screen restates the loop, the controls and the tie-break order.

**Session shape.** Pick a table → pass 3 cards (unless the round's direction is `none`) →
13 tricks with 450 ms of AI thinking between plays → round scored, next hand dealt → repeat
until a seat reaches the threshold → results overlay with per-seat totals, the goal line, and
**Play again** / **Leave to title**.

**The emotional beat.** Being void in the led suit while holding the Nightshade Queen. The build
is shaped around making that moment legible: `queen-taken` is a deep deliberate thud, the Queen
and every heart print in `#b3372c`, and lesson 4 exists purely to rehearse it.

---

## 4. Core loop and rules contract

All of section 4 is implemented in `js/rules.js` unless stated.

### Cards and entities

Card `id = suit*13 + rank`; suits `0 spades, 1 hearts, 2 diamonds, 3 clubs`; ranks `0 = 2 … 12 = ace`
(`cardSuit`, `cardRank`, `cardName`). **Q♠ is id 10, the "Nightshade Queen".**
`penaltyOf(id)`: hearts = 1, Q♠ = 13, everything else 0. `ECLIPSE_POINTS = 26`.
The deck is all 52 ids except at 3 players, where 2♦ is removed so 51 divides by 3
(`buildDeck`). Hand size: 13 at 2 players (half the deck sleeps), `floor(deck.length / n)`
otherwise — 17 at 3, 13 at 4.

State (`createGame`) carries: `cfg`, `seed`, `rngState`, `tick`, `round`, `phase`
(`pass | play | done`), `passDir`, `hands`, `passes`, `trick`, `leader`, `actor`, `startCard`,
`heartsBroken`, `firstTrick`, `taken`, `matchScores`, `roundSummaries`, `stats`, `terminal`,
`events`, and `v: 1` (`STATE_VERSION`).

### Deal, opening and passing

`dealRound` shuffles with the rules stream (`RNG.derive(seed, STREAM_RULES)`), deals round-robin,
sorts each hand ascending by id, and picks the opener with `findStarter`: the lowest club in play,
else the lowest diamond, spade, then heart. That card is `startCard`, its holder is `leader`. A
pass direction of `none` starts the round in `play`, otherwise in `pass`.

`passDirection(cfg, round)` indexes `cfg.passCycle` by `(round - 1) % cycle.length`, demoting
`across` to `left` below 4 players; `passTarget` maps `left → +1`, `right → −1`, `across → +2`
(mod `players`). Each seat submits exactly `cfg.passCount` (always 3) distinct held cards
(`checkPass`; rejections `wrong-pass-count`, `duplicate-pass-card`, `card-not-in-hand`,
`pass-already-submitted`, `not-your-turn`). Seats submit in order but the swap is simultaneous:
on the last submission all donor cards are removed then delivered, hands re-sorted, and the leader
re-derived from whoever now holds `startCard`.

### Playing a trick

`checkPlay` in order: game over → `game-ended`; wrong phase → `wrong-phase`; not your turn →
`not-your-turn`; malformed or unheld card → `bad-card` / `card-not-in-hand`. Then:

* **Leading.** On the first trick of a round you must lead `startCard` exactly (`must-lead-starter`).
  You may not lead a heart while `heartsBroken` is false *if you hold any non-heart*
  (`hearts-not-broken`).
* **Following.** If you hold the led suit you must play it (`must-follow-suit`). On the first
  trick, with `cfg.noPenaltyFirstTrick` (true everywhere), you may not discard a heart or the
  Queen if you hold any non-penalty card (`no-penalty-first-trick`).

`legalPlays(state, seat)` is exactly the subset of the hand for which `checkPlay` returns null,
and is what greys cards in the UI — legality has one implementation, not two.

`applyPlay` removes the card, appends `{p, card}` to `trick`, emits `play`, emits `queen` for Q♠,
and sets `heartsBroken` + emits `hearts-broken` on the round's first heart. On a full trick the
highest rank **of the led suit** wins (off-suit can never win), the winner takes every card into
`taken[winner]`, `stats` update, a `trick` event carries the winner and the trick's penalty total,
`firstTrick` clears, and the winner leads next. Otherwise `actor = (p + 1) % players` — turn order
is strictly clockwise by seat index.

### Scoring a round (`endRound`), with a worked example

1. `raw[p] = Σ penaltyOf(c)` over `taken[p]`. Across the table `Σ raw = 26`.
2. If any seat's `raw` is exactly 26, that is an **Eclipse**:
   * `eclipseRule: 'others'` (default) → that seat scores 0, everyone else scores 26.
   * `eclipseRule: 'self'` → that seat scores −26, everyone else keeps their raw 0.
3. `matchScores[p] += final[p]`; a `roundSummaries` row records `rawPoints`, `points`, `hearts`,
   `eclipseBy` and the running `scores`; a `round-end` event carries the same.

*Worked example (4 seats, `eclipseRule: 'others'`).* Round 3 ends with hearts split
You 5, Fern 6, Moth 2, Luna 0 and the Queen taken by Fern.
`raw = [5, 19, 2, 0]`, sum 26, no seat at 26, so `final = raw`. Running totals go from
`[14, 22, 9, 30]` to `[19, 41, 11, 30]`. Had Fern instead taken all 13 hearts *and* the Queen,
`raw = [0, 26, 0, 0]` and `final = [26, 0, 26, 26]` → `[40, 22, 35, 56]`.

### Terminal states, tie-breaks, goals

After scoring, the match ends when `max(matchScores) ≥ cfg.threshold` (25/50/75/100/150 by table)
or `cfg.maxRounds` is reached — reason `threshold`, or `rounds-cap` if the cap fired first.
**Lowest score wins**, and `winners` is *every* seat tied at the minimum: a tie is a shared win,
never broken. `terminal.winner` is `winners[0]` as a display label only; the headline reads
"You win the table." whenever seat 0 is among the winners. `{type:'resign'}` ends the match at
once in favour of the lowest-scoring other seat (`resigned`); no UI sends it.
Stage and challenge goals are checked separately in `goalMet` (`js/game.js`) and always require
seat 0 among the winners *as well as* the goal: `win`, `score-under` (own score ≤ `value − 1`),
`avoid-queen` (`stats.queensTaken[0] === 0`), `eclipse` (`stats.eclipses[0] > 0`),
`no-hearts-round` (a round summary with `hearts[0] === 0`).

### RNG, determinism, assists, AI

One 32-bit master seed per table feeds three independent mulberry32 streams
(`STREAM_RULES / STREAM_DECOR / STREAM_AV`), so shuffling can never be perturbed by cosmetic
randomness. Seeds: authored constants for Journey (201–240) and Challenges (601–606),
`hashString('heartfall-daily-v1-YYYY-MM-DD')` for the Daily, `hashString('heartfall-<mode>-<id>')`
otherwise. AI tie-breaks draw from `aiRng(state, seat, salt)` (a hash of
`rngState:tick:round:seat:salt`), so the same state always yields the same choice. `hashState`
(stable-stringify minus `events`, FNV-1a) fingerprints a state; `serialize`/`deserialize`
round-trip it and reject a mismatched `STATE_VERSION`; `validateCommandShape` is the
network/replay boundary check (≤ 512 bytes, known type, seat 0–3).

Undo is snapshot-based — `js/game.js` pushes `Rules.serialize(game)` before each human pass or
play when assists are on, and `doUndo` restores the top snapshot. Assists are on in **Practice**
and **Learn** only (`assistsOn`), regardless of a level's `mechanics` block. `Rules.hint(state, 0)`
runs the *hard* AI over the same legality surface the player has and returns a card (or three pass
cards) plus a plain-English reason ("Duck under — let someone else eat the points."); the hinted
card is outlined `#7fd4ff`, hinted pass cards are pre-selected.

`aiChoose` is pure and returns an ordinary command. **easy** shuffles/picks from a seeded stream.
**normal** passes by a danger score (Q♠ when spade cover ≤ 3, high spades, hearts by rank, any
honour); following, it ducks under the high card when the trick has points and otherwise wins as
cheaply as possible; void, it dumps by `dumpValue` (Queen 100 > K♠/A♠ > hearts > rank).
**hard** is the same with fatter weights, void-creation bonuses for short non-spade suits, and
low leads from its longest safe non-heart suit while avoiding spades.

---

## 5. Modes and progression

Every mode is a `cfg` handed to the same `createGame`; nothing else differs.

| Mode | Content | Tables | Assists | Goal | Progress |
|---|---|---|---|---|---|
| **Learn** | `tutorialLessons()` | 6 fixtures | Hint + Undo | One action per lesson | `progress.learn[id]` |
| **Journey** | `JOURNEY` (40 rows) | 2–4 seats, 25–100 pts, `easy → normal → hard` | Hint + Undo *(see limitations)* | Per-stage goal | `progress.journey[id]` |
| **Daily** | `dailyConfig(date)` | 7 rotating rulesets, last 7 UTC days listed | Hint only by config | Win | `progress.daily[date]` |
| **Practice** | `PRACTICE` (3) | Casual / Apprentice / Expert, 50 / 75 / 100 pts | Hint + Undo | Win | not tracked |
| **Challenge** | `CHALLENGES` (6) | Six constrained tables | none by config | Per-challenge goal | `progress.challenge[id]` |

**Learn** (6 lessons): follow the suit → pass three cards → duck the points → dump the Queen →
catch the Eclipse → second chances (undo). Lessons 1 and 3–6 overwrite the dealt state with an
authored fixture; lesson 2 uses a real pass phase. `checkLessonComplete` detects the goal kind
(`play`, `pass`, `duck`, `queen-dump`, `eclipse`, `undo`); ducking wrongly toasts "You took the
trick — try to stay out of it." and lets you retry.

**Journey curve.** 1–10 `easy`, 25–75 points, introducing the pass cycle, the Queen, a 3-seat
table and score budgets. 7–20 `normal`, adding no-pass tables, the `self` Eclipse rule,
right-only passing, a 2-seat duel and the first 100-point match. 21–40 `hard`, ending on stage 40
"Heartfall" (100 points, `self` Eclipse, finish under 50). Stages whose intro begins "MASTERY"
are flagged `mastery`; the four difficulty bands also step through the five cosmetic themes.

**Daily.** `dailyConfig(dateStr)` derives everything from the UTC date string: the seed from
`hashString`, then a 7-slot rotation over AI level, threshold (50/75/50/100/50/75/100), seats
(4/4/3/4/4/3/4), pass cycle, eclipse rule (`self` on slots 2 and 5) and theme — so every player's table
for a given date is identical. The list shows today plus the six previous days, all playable.

**Challenges.** Queen Dodger (win 50 without the Queen, no assists) · Total Eclipse (`self` rule,
shoot the moon then win) · Sprint Night (25 points, hard) · Three's Company (3 seats, 17 cards,
hard) · Clean Hands (no passing, no hints, win under 15) · Moon Marathon (150 points, hard).

**Unlocks.** All stages, challenges and dailies are open from the start; progress marks are
records, not gates. `THEMES` carries `unlockStars` thresholds (0/12/30/55/85) that no code
currently reads — themes are selected by the level's `theme` field.

---

## 6. Controls and interaction

| Input | Desktop | Mobile | Result |
|---|---|---|---|
| Card, pass phase | Click | Tap | Toggle selection (max `passCount`); `card-select`; over the max → `invalid` + "Only 3 cards." |
| Card, play phase | Click | Tap | Play if legal (`card-play`); illegal → `invalid` + a toast naming the rule |
| Card | `Enter` / `Space` when focused | — | Same as click (cards are `role="button"`, `tabIndex=0`) |
| Pass button | Click | Tap | Submits when the count matches, else `invalid` + toast |
| `H` / Hint button | Yes | Hint button | Suggest a card or pass set + reason toast (Practice/Learn) |
| `U` / Undo button | Yes | Undo button | Restore the previous snapshot (Practice/Learn); empty stack → `invalid` |
| `Escape` / ⏸ | Yes | ⏸ button (44×44, top right) | Toggle the pause overlay |
| Back arrow | Click | Tap | Pop the nav stack (`ui-back`) |

**Input locking.** Hand input is ignored while the pause overlay is open, while the results or
lesson overlay is up (`sess.lessonDone`), when the screen is not `play`, and when it is not your
turn (`simPaused`, and the phase/actor checks in `onHandClick`). The AI pump itself parks on
`simPaused` — pausing, navigating away, or hiding the tab stops the simulation, and `document.hidden`
is part of that test, so a backgrounded tab never plays on without you.

**Feedback for every input.** Selection = a `#ffd54a` outline; hint = a `#7fd4ff` outline;
illegal = dimmed at 50 % opacity *before* you tap and `invalid` + a toast if you tap anyway;
the active seat is `#f7c948` in both the score row and the painted table; the objective line
(`aria-live="polite"`) always names the current expectation.

---

## 7. Screens and UI flow

Ten `<section class="screen">` elements exist in `index.html` from load; `showScreen(name)`
toggles `.hidden` on exactly one. Navigation is a stack (`navStack`), pushed by `navTo` and
popped by `navBack`; `leaveToTitle` resets the session and jumps to `title`.

```
title ─Play→ modes ─┬→ learn ──→ play(learn)
  ├→ daily          ├→ journey ─→ play(journey)
  ├→ journey        ├→ daily ───→ play(daily)
  ├→ settings       ├→ practice → play(practice)
  └→ help           └→ challenge→ play(challenge)

play ─Escape/⏸→ pause overlay ─┬→ resume → play
                               ├→ settings (screen)
                               └→ leave → title
play ─match end→ results overlay ─┬→ again → play
                                  └→ leave → title
play(learn) ─goal met→ lesson overlay ─┬→ next lesson
                                       └→ back to lessons
```

**Layout.** Every screen is `100vw × 100vh` with `overflow:hidden` on the body; list screens
scroll inside `.panel` (`max-height: calc(100vh - 58px)`). The play screen is a positioned
wrapper: full-bleed canvas, `#hud-top` (title, objective, score row) centred at the top,
`#btn-pause` fixed top-right, `#hud-bottom` (hand + actions) centred at the bottom, toast at 46 %
height. The viewport is declared `viewport-fit=cover`.

**Portrait mobile** (≤700 px): cards shrink to 44×62 px with a −16 px overlap so a 13-card hand
fits the width. The painted table is drawn to *cover* the canvas (`max(w, h) × 1.06`), never
letterboxed, under a `rgba(9,14,26,0.38)` scrim. Seat labels are clamped inside the canvas by a
`measureText` inset and the round line sits top-left, clear of the HUD and the hand.
**Desktop and landscape** use the same layout with 74×98 px cards. The two things that must never
be cut off are your hand and the objective line; e2e screenshots both at 1280×800 and 390×844.

---

## 8. Art direction

**Palette** (from `css/style.css` and `js/game.js`):

| Token / use | Hex |
|---|---|
| `--bg` ground / `--panel` / `--line` | `#0d1526` / `#141f38` / `#2a3c5e` |
| `--text` / `--dim` | `#dbe7ff` / `#9fb0cc` |
| Button / primary button | `#233a6b` / `#2f6fd0` |
| Canvas ground / fallback felt | `#17251d` / `#1f3328` |
| Card face / card ink / penalty ink | `#f2f5fa` / `#1a2340` / `#b3372c` |
| Active seat / selected outline / hint outline | `#f7c948` / `#ffd54a` / `#7fd4ff` |
| Success / failure | `#7fd8a0` / `#e08a8a` |
| Toast / overlay scrim | `#3a2f5e` / `rgba(8,12,24,.78)` |

`js/content.js` additionally carries five cosmetic `THEMES` (Moonlit Glasshouse, Verdant Night,
Nocturne Rose, Starlit Pond, Ivory Moon) as full numeric palettes — see Known limitations.

**Shape language.** Rounded 6 px card rectangles, a circular table plate, flat rectangular
buttons, hairline `--line` rules between list rows — no bevels except the painted walnut rim.

**Typography.** `"Segoe UI", system-ui, sans-serif`; headings 600 weight, 0.5 px tracking; title
48 px; card faces 20 px desktop / 14 px mobile; canvas text 15 px seat labels, 26 px trick cards,
13 px round line. The cover wordmark is letter-spaced DejaVu Serif Bold.

**Motion.** Almost none, deliberately: no card tweening, no shuffle animation. The only timing is
the 450 ms gap between AI plays that lets you read each card as it lands, plus a 2.2 s toast
dwell. Nothing moves, so `Settings → Reduced motion` has nothing to switch off.

**The hero** is your hand; the plate, the scrim and the score row are deliberately lower contrast
so the 13 cards you are choosing between read first.

**Visual assets the design calls for:** conservatory key art for the title, a top-down table
plate for the canvas, a results illustration that pays off the Eclipse, and a cover that is the
game rather than a template. All four ship (§15).

---

## 9. Audio direction

**Mix philosophy.** Paper, felt, glass and brass in a large quiet room. Nothing in the mix is
brighter than the `hint` ting or lower than `queen-taken`. Clips are loudness-normalised to
−20 LUFS / −2 dBTP so no single cue jumps.

**Buses.** Two gain nodes on `AudioContext.destination`: `fxBus` (all SFX, sample and synth) at
`settings.sfx / 100`, and `musicBus` at `settings.music / 100 × 0.5`. Both are driven live by the
Settings sliders and persisted. Audio is created lazily and unlocked on the first `pointerdown`
or `keydown` (`unlockAudio`).

**Music / ambience.** No music files. `startMusic` builds a generative pad once after unlock:
sine 110 Hz, sine 164.81 Hz and triangle 220 Hz (an A-minor-ish open fifth), through a lowpass at
520 Hz / Q 0.4, whose cutoff is swept ±140 Hz by a 0.07 Hz sine LFO — a slow breath, roughly one
cycle every 14 seconds.

**Sample loading.** `playSfx(name)` prefers the decoded Opus one-shot, kicks off a lazy
`fetch('sfx/<name>.opus')` + `decodeAudioData` on first use, and *always* falls back to the
synthesized `synthEvent(name)` if the sample is not ready, failed, or audio is not yet unlocked.
Every event therefore fires audibly even with `sfx/` entirely absent.

**SFX event table** — this is the source for `sfx/manifest.txt`.

| event id | file | description | usage context |
|---|---|---|---|
| `ui-click` | `ui-click.opus` | Soft fingertip tap on a polished wooden button, warm tick | Forward menu buttons; Resume, Settings, Play again, Next lesson |
| `ui-back` | `ui-back.opus` | Muted wooden toggle flicking back, low knock with a felt brush | Back arrows; Leave to title |
| `pause` | `pause.opus` | Velvet curtain drawn halfway, fabric hush into a low thump | Pause overlay opens (⏸ or Escape) |
| `card-select` | `card-select.opus` | Card lifted from felt, crisp paper snap with a finger slide | Any tap on a hand card; pass selection toggles |
| `card-play` | `card-play.opus` | Card placed firmly face-up, sharp slap with a fabric thud | Your play; each opponent card landing |
| `card-pass` | `card-pass.opus` | Three cards slid across green felt, sustained paper whisper | Confirming your pass |
| `cards-deal` | `cards-deal.opus` | Cards dealt one by one, rapid light paper snaps | Entering the play screen; Play again |
| `invalid` | `invalid.opus` | Knuckle rapping twice on a table edge, dull warning knocks | Any rejected action, always with an explanatory toast |
| `turn-prompt` | `turn-prompt.opus` | Small brass bell chimed once, gentle ring with quick decay | Control returns to seat 0 |
| `hint` | `hint.opus` | Fingernail tapped on a conservatory pane, bright delicate ting | Hint button / `H` |
| `undo` | `undo.opus` | Card drawn back across felt, soft dragging paper slide | Undo button / `U` |
| `trick-take` | `trick-take.opus` | Stack scooped across felt into a pile, layered slides into a tap | A trick you won |
| `heart-taken` | `heart-taken.opus` | Card dropped onto a pile, muted paper thud with low warmth | Reserved penalty accent (see limitations) |
| `queen-taken` | `queen-taken.opus` | Heavy card placed slowly, deep thud with room resonance | Q♠ hits the table, whoever plays it |
| `hearts-broken` | `hearts-broken.opus` | Thin pane of glass cracking softly, crystalline splinter into a low hum | The round's first heart is played |
| `eclipse` | `eclipse.opus` | Full deck fanned in a wide arc, cascading paper flourish | A seat captures all 26 penalty points |
| `round-end` | `round-end.opus` | Stack squared and tapped twice, tidy taps into a settling shuffle | A round is scored |
| `lesson-complete` | `lesson-complete.opus` | Glass wind chime struck once, three bright tones with a warm decay | A Learn lesson goal is satisfied |
| `match-win` | `match-win.opus` | Cards riffled and sprung between two hands, bright crescendo | Results with seat 0 among the winners |
| `match-lose` | `match-lose.opus` | Cards gathered in near silence, slow slides into one soft thud | Results without seat 0 among the winners |

Rules events map to cues in one place — `playEventSfx(events, selfSeat)` in `js/game.js` — so a
trick, a Queen, a heart-break, an Eclipse and a round end sound identical whether you or an AI
seat caused them.

---

## 10. Localization

**Shipped today: en-US only.** All player-visible text is hard-coded English, in three places:
static markup in `index.html` (menu labels, mode cards, settings legends), the `HELP_TEXT` array
and toast strings in `js/game.js`, and the authored content strings in `js/content.js` (stage
names, intros, `GOAL_TEXT`, persona names, achievement names/descriptions). Some toasts surface
raw rule ids (`must-follow-suit`) rather than sentences.

**Required set** (product rule): en-US, en-GB, es-419, es-ES, de-DE, fr-FR, fr-CA, pt-BR, it-IT.

**The design the code is shaped for.** A single `js/i18n.js` exposing `t(key, vars)` over one
`data/strings/<locale>.json` per language, keyed by dotted ids (`menu.play`, `rule.follow-suit`,
`stage.j04.intro`), with `en-US` as the fallback chain terminus (`fr-CA → fr-FR → en-US`,
`es-ES → es-419 → en-US`, `en-GB → en-US`). Language is chosen by, in order: a `?lang=` query
parameter, a persisted `hf-lang-v1` setting, then `navigator.languages`. Static markup carries
`data-i18n` attributes so one pass at boot can rewrite it. Expansion allowance: German and
French run 30–35 % longer than English, so every button is sized by content with wrapping
allowed, and the three fixed-width elements (⏸, back arrow, card faces) contain no words —
card faces are rank glyphs plus suit symbols, which need no translation in any target locale.
See **Design intent not yet implemented**.

---

## 11. Accessibility

* **Keyboard-only path.** Every control is a real `<button>` or a `tabIndex=0` `role="button"`
  list item, so Tab reaches all of them in document order and Enter/Space activates them. Hand
  cards handle Enter and Space explicitly (`#hand` keydown). `Escape` pauses, `H` hints, `U`
  undoes. The full flow title → mode → stage → pass → play → results → leave is reachable without
  a pointer.
* **Focus.** `:focus-visible` gives buttons and list items a 2 px `#8fb4ff` outline and cards a
  3 px white outline, both against dark grounds.
* **Live announcements.** `#objective` is `aria-live="polite"` and restates whose turn it is and
  what is expected; `#toast` is `role="status"` `aria-live="polite"`, so every rejection reason,
  hint reason and lesson correction is announced. Each screen carries an `aria-label`; the pause
  button has an explicit `aria-label="Pause game"`.
* **Contrast.** `#dbe7ff` on `#0d1526` ~14:1; secondary `#9fb0cc` ~7.5:1; card ink on the card
  face ~14:1; penalty red `#b3372c` ~5.4:1 and never the only cue (the suit glyph is printed too).
* **Reduced motion / larger text.** Two persisted Settings toggles; `.large-text` is applied to
  `<body>`, and there is no animation for reduced motion to switch off.
* **Target sizes.** ⏸ and the back arrow are 44×44 px. Mobile cards are 44×62 px overlapped by
  16 px, exposing a 28 px strip per inner card — under the guideline, and the price of showing a
  whole 13-card hand at once (Known limitations #4).
* **Colour independence.** Legality reads as opacity, selection and hints as outlines, the active
  seat as colour *and* the objective text — no state is colour-only.

---

## 12. StarHermit integration

Conventions: https://wiki.starhermit.com/

**Used.** The platform manifest `starhermit.txt` declares `name=Heartfall`, `launch=index.html`,
`owner`, `server=server.js`, `version=1.0.0`, `contentVersion=1`, `cover=coverart.png`. The game
ships a real `server.js` (a hardened static host: path-normalised, rejects escapes above the
root and any dotfile segment, `PORT` from the environment).

**Hosted identity + cloud save (js/platform.js).** On-platform, the launch token arrives in the
URL fragment `#game_token=<jwt>`, is read once and stripped (`history.replaceState`); the JWT
payload (base64url decode, no verify) supplies `sub` and `game_scope` (the slug — never
hard-coded). Every REST call sends `Authorization: Bearer`, and the scoped token is re-minted
every 45 min via `POST /api/v1/games/{slug}/launch-token` (60 s retry on failure). The player
name comes from `GET /api/v1/users/{sub}/profile` (never `/api/v1/me`, never usernames; fallback
`Player ` + id.slice(0,8)) and is shown with the sync state in a chip on the title screen.
Progress is mirrored to the single cloud-save slot `GET`/`PUT /api/v1/me/cloud-saves/{slug}` as
a stored zip with a base64 body; the remote copy wins on load, saves are debounced 2 s and
flushed on `pagehide`/`visibilitychange`, and `hf-settings-v1`/`hf-progress-v1` remain the
offline cache. Without a token none of this runs and no network is touched.

**Shaped for it.** The pieces a platform integration needs already exist and are deliberately
platform-shaped: stable content ids (`j01`…`j40`, `c1`…`c6`, `daily-YYYY-MM-DD`),
`CONTENT_VERSION`, a fixed nine-entry `ACHIEVEMENTS` table with stable lowercase keys (awarded
locally and mirrored in the cloud doc — a pure browser game has no server-authoritative unlock
path), a per-table `parScore`, a fully deterministic engine plus `hashState` and
`validateCommandShape` for server-side verification of a submitted command log, and a Daily
whose ruleset is derived from the UTC date alone so every player's table is identical without a
server telling them so. Leaderboards are read-only by contract (clients can never submit); the
game shows local records only and makes no leaderboard calls. Presence/sessions remain unwired.

---

## 13. Technical architecture

**Module responsibilities.** Five classic scripts, loaded in dependency order and exposing UMD
globals so the same files run under Node in tests: `rng.js` (`HFRNG`) knows nothing about cards;
`rules.js` (`HFRules`) knows nothing about the DOM, time or rendering and never calls
`Math.random`; `content.js` (`HFContent`) is data plus pure expanders; `platform.js`
(`HFPlatform`) owns the StarHermit adapter — launch token, profile nickname, cloud-save mirror —
and is inert without a token; `game.js` (`HFGame`) owns everything else impure — DOM, audio,
canvas, `localStorage`, `setTimeout`.

**Determinism and replay.** See §4. A match is `(cfg, seed, command log)`; AI decisions are
commands, so a log replays exactly. `hashState` gives a comparable fingerprint.

**Persistence.** Two `localStorage` keys, both read through try/catch with a full default object
so a blocked or corrupt store degrades to defaults rather than throwing: `hf-settings-v1`
(`music`, `sfx`, `quality`, `reducedMotion`, `largeText`) and `hf-progress-v1`
(`learn`/`journey`/`challenge`/`daily` → id → true, plus `achievements` → key → true and
`stats` → `played`/`winStreak`). Progress is a set of completion marks only;
no scores or times are stored. When hosted, both keys are mirrored to the cloud-save slot
(remote wins on load); offline they are the whole store.

**Performance budgets.** The canvas repaints only on `syncUI` (a state change) and `resize` —
no rAF loop, so an idle table costs no frames; a repaint is one image draw, one scrim fill,
`players` labels and up to `players` card rectangles. Shipped payload excluding the unused
three.js copies is well under 1 MB (150 KB key art, 76 KB eclipse, 44 KB plate, ~330 KB of Opus
fetched lazily on first use of each event). The AI timer is 450 ms and `simPaused` stops it
whenever the tab is hidden.

**How the e2e drives the real UI.** `tests/e2e.mjs` serves the repo on an ephemeral port and
drives system Chrome through `playwright-core` at 1280×800 and at 390×844 with touch. It reads
state *only* from what a player can see — `#objective` text, `#hand li.card` counts and their
`.dim`/`.sel` classes, overlay `.hidden` state — and every action is a real click, tap or key
press. It fails on any `pageerror` or non-allowlisted `console.error`.

---

## 14. Testing and acceptance criteria

**`npm test`** = `tests/rules-sanity.mjs` + `tests/lesson-check.mjs`, zero dependencies.

*rules-sanity* — for 2, 3 and 4 seats × 5 seeds: drives a full match by AI self-play, asserting
that `aiChoose` always returns a command, that every command is legal, and that the match reaches
a terminal state within 5000 commands; and that `hashState(deserialize(serialize(s))) === hashState(s)`.
Then replays **all 40 Journey stages and all 6 Challenges** by self-play and asserts each
terminates within 8000 commands — i.e. no authored config can hang.

*lesson-check* — for each of the six lessons: the fixture contains no duplicate card across hands
and trick; lesson 1 has exactly one legal play (7♦) and playing it gives the trick to seat 1;
lesson 2 really starts in `pass` phase; lesson 3's duck leaves the trick to another seat;
lesson 4 lets Q♠ be discarded; lesson 5's last card triggers an `eclipse` event for seat 0;
lesson 6 has a legal play available to undo. Plus round-summary `hearts` accounting and the
determinism of `dailyConfig` for fixed dates.

**`npm run test:e2e`** (`tests/e2e.mjs`), per viewport: load and title visible → Play → Modes →
Journey lists exactly 40 stages → stage 1 deals a hand → Escape pauses, Resume, Settings from
pause and back → a *complete* match played through the visible UI, only ever clicking non-dimmed
cards and the real Pass button → results overlay with a headline and one score row per seat →
Play again → pause → Leave to title → Daily and Journey sub-menus open and close → Practice
(Hint toast, pass, Undo restores the pre-pass state, re-pass, play) → Learn lesson 1 applies its
fixture, completes on the forced play, persists progress, and Next lesson starts lesson 2 →
assert zero page errors.

**QA bar** (from the product QA rules), as checkable statements:

1. A new player is taught: Learn is the first mode card, lesson 1 is completable in one click,
   every Journey stage that adds a rule carries an intro line, and Help restates the loop. ✅
2. Every implemented feature is reachable in the browser: all five modes, both assists, pause,
   settings, help, and all four settings controls. ✅
3. No console errors or warnings during a full playthrough at either viewport — asserted by e2e. ✅
4. Text and UI are visible and not cut off at 1280×800 and 390×844: seat labels are clamped
   inside the canvas, the round line sits clear of the HUD and hand, list panels scroll rather
   than clip, and results content is centred with a max width. ✅ *(one exception: see
   Known limitations #4)*
5. Features that could use platform APIs do so. ❌ — see §12 and the intent list.

---

## 15. Asset inventory

| Path | Purpose | Source | Status |
|---|---|---|---|
| `assets/keyart.webp` | Title-screen background (1536×864, 150 KB) | FLUX.2 klein, seed 4211, 30 steps | Generated this pass; wired via `#screen-title` background |
| `assets/table.webp` | Painted table plate drawn to cover the play canvas (1024², 44 KB) | FLUX.2 klein, seed 4222, 30 steps | Generated this pass; wired in `drawTable` with the flat-felt fallback kept |
| `assets/eclipse.webp` | Results-overlay background (1024×576, 76 KB) | FLUX.2 klein, seed 4233, 30 steps | Generated this pass; wired via `#results-overlay` background |
| `coverart.png` | 1200×675 store cover, wordmark composited over the key art | FLUX.2 klein seed 4211 + ffmpeg drawtext (DejaVu Serif) | Regenerated this pass, replacing a generic template card |
| `icon.png`, `favicon.svg` | App icon / tab icon | Hand-authored | Shipped |
| `sfx/ui-click, ui-back, pause` | Menu cues | MOSS-SoundEffect v2.0 | Shipped |
| `sfx/card-select, card-play, card-pass, cards-deal` | Card handling | MOSS-SoundEffect v2.0 | Shipped |
| `sfx/invalid, turn-prompt, hint, undo` | Feedback and assists | MOSS-SoundEffect v2.0 | Shipped |
| `sfx/trick-take, heart-taken, queen-taken` | Trick and penalty cues | MOSS-SoundEffect v2.0 | Shipped |
| `sfx/hearts-broken.opus` | The round's first heart | MOSS-SoundEffect v2.0, 100 steps | Generated this pass; new event id wired in `playEventSfx` + synth fallback |
| `sfx/lesson-complete.opus` | Learn lesson goal met | MOSS-SoundEffect v2.0, 100 steps | Generated this pass; wired in `lessonComplete` + synth fallback |
| `sfx/eclipse, round-end, match-win, match-lose` | Round and match outcomes | MOSS-SoundEffect v2.0 | Shipped |
| `sfx/manifest.txt` | Canonical clip → event → description → context map | Authored | Shipped |
| `sfx/manifest.md`, `sfx/manifest.json` | Generation prompts for the MOSS batch tool | Authored | Shipped |
| Ambient pad | Generative WebAudio, no file | `startMusic` in `js/game.js` | Shipped |
| Card faces | Unicode rank + suit glyphs, no card art | — | By design: no card image assets |
| 3D models / character animation | — | — | Not called for: the game renders 2D and has no humanoid |

---

## 16. Known limitations

1. **No localization.** en-US strings are hard-coded in three places; the other eight required
   locales are absent (§10). Some toasts show raw rule ids (`must-follow-suit`,
   `hearts-not-broken`) instead of sentences.
2. **No server-authoritative records.** Identity, cloud save and token refresh are wired (§12),
   but presence/sessions are unwired and there is no leaderboard submission (clients can never
   submit) and no server-validated achievement unlock — achievements are local flags inside the
   cloud-saved progress doc, awarded at match end, with no screen listing them.
3. **three.js is loaded but unused.** `index.html` imports `js/three.min.js` (670 KB) and sets
   `window.THREE`; `js/game.js` reads it and `window.HFRender`, which no file defines, so `Render`
   is always `null`. `vendor/three.module.min.js` is a second identical copy. The table is drawn
   entirely in 2D canvas. This is dead payload, not a broken feature.
4. **Overlapping mobile cards are under the 44 px touch target.** At ≤700 px a 13-card hand
   overlaps by 16 px, exposing a 28 px strip per inner card, and the rightmost card sits flush
   against the viewport edge. Legible, but tight.
5. **Themes are decorative data only.** All five `THEMES` palettes and their `unlockStars`
   thresholds are authored and assigned per level, but nothing reads them.
6. **`heart-taken.opus` is unbound.** The heart cue on air is `hearts-broken`; `heart-taken`
   stays in the manifest and `SFX_EVENTS` as a reserved accent with no current trigger.
7. **Per-level `mechanics.undo` / `mechanics.hint` are ignored.** Assists are gated by mode alone
   (`assistsOn`), so a Journey stage authored with `hint: true` shows no Hint button.
8. **Undo is unbounded**: the snapshot stack grows for a whole session, each entry a full state.
9. **`quality` (Low/Medium/High) persists but changes nothing** — no quality-dependent rendering.
10. **Resign has no UI**, though the engine implements `{type:'resign'}` and its terminal reason.
11. **Ties are shared wins.** Help text describes an objective / invalid-action / elapsed-time /
    session-id tie-break order that the engine does not implement — every seat at the minimum wins.

---

## Design intent not yet implemented

* **Nine-locale localization** exactly as specified in §10: `js/i18n.js` with `t(key, vars)`,
  `data/strings/<locale>.json` for en-US, en-GB, es-419, es-ES, de-DE, fr-FR, fr-CA, pt-BR, it-IT,
  `data-i18n` attributes on the static markup, the fallback chains, and `?lang=` / stored setting /
  `navigator.languages` selection. Rule-rejection ids get one localized sentence each.
* **StarHermit presence + validated Daily leaderboard**: report presence while a match is live,
  open a session per match and close it with the final score, and submit Daily results to a
  per-date leaderboard keyed on `daily-YYYY-MM-DD`. `server.js` grows a verification endpoint
  that replays a submitted command log through `js/rules.js` and compares `hashState`, so a
  Daily leaderboard entry can be trusted. (Identity, cloud save, token refresh and local
  achievements shipped in §12; clients still can never submit to a leaderboard directly.)
* **Theme application**: bind the level's `theme` palette to the canvas paint and to CSS custom
  properties, and gate the four unlockable themes on the `unlockStars` totals already authored.
* **Per-level assists**: honour `mechanics.undo` / `mechanics.hint` from the level config instead
  of gating on mode, so Challenges can genuinely ban assists and Journey stages can allow hints.
* **Achievements surface**: a screen listing the nine achievements with locked/unlocked state.
* **Drop the unused three.js payload** (both copies and the module import), or replace the 2D
  canvas with the 3D conservatory table those files were originally added for.
* **Trim the undo stack** to a bounded depth, and add a resign control to the pause overlay now
  that the engine supports it.
