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
| Platforms | A StarHermit engine script game (engine 1.24.0, host API 1.21): played natively by the StarHermit client and in browsers by the engine's web runtime, desktop and mobile, portrait and landscape; offline-capable |
| Rendering | `starhermit:draw` for the painted table, its light, fireflies, seat labels and trick cards (faces painted once into `starhermit:canvas` canvases); `starhermit:ui` (immediate mode) for every screen, the HUD, the hand and the overlays. Looks per graphics level (§8) |
| Audio | `starhermit:audio`: 20 authored Opus one-shots on the effects/interface buses + the ambient pad, rendered once into a seamless loop, on the music bus |
| Persistence | The runtime's save (`starhermit:storage` `saves`): progress on the device and, signed in, in the player's cloud slot |

### File map

| Path | Contents |
|---|---|
| `starhermit.txt` | Manifest: name, description, owner, `server=score-script.js`, version, contentVersion, cover, `launch=index.html`, `engine.*` (api 1, entry `native/main.ts`, version 1.24.0, minor 19, capabilities platform/storage/clipboard), `control.*` keys and `engine.gamepad.*` pads |
| `index.html`, `starhermit-files.json` | The engine's web loader and file index, written by `npm run package` (`starhermit package --web .`); never edited by hand |
| `native/main.ts` | Entry: navigation, the match session (passes, plays, AI seats on fixed steps, hint/undo, lesson goals), results, achievements, leaderboard posting, input actions, lifecycle |
| `native/screens.ts` | Every screen and overlay as `starhermit:ui`: title, modes, the five lists, Help, the play HUD and hand, pause / lesson / results overlays, toasts |
| `native/table.ts` | The painted table, title atmosphere, seat labels, trick cards and hand-card faces (`starhermit:draw`, `starhermit:canvas`) |
| `native/style.ts`, `assets/ui-style.json`, `tools/ui-style.css` | The UI theme and styles: the old `css/style.css` rewritten class-based (`tools/ui-style.css`) and converted with `starhermit css` (`npm run css`) |
| `native/quality.ts` | The browser build's graphics presets keyed by the runtime's quality tier and level |
| `native/audio.ts` | Clip loading (one at a time once the mixer runs), event → clip, the rendered pad |
| `native/platform.ts` | Save, conflict merge, browser-save migration, legacy settings removal, player, invite link, the platform clock, winning-margin posting |
| `native/i18n.ts`, `native/classic.ts` | Locale from the runtime's interface language; the classic scripts loaded with `loadClassic` and typed |
| `js/rng.js`, `js/rules.js`, `js/content.js` | `HFRNG`, `HFRules` (the whole rules contract, AI, hints), `HFContent` (stages, challenges, practice, dailies, lessons, achievements) — unchanged from the browser build |
| `js/store.js` | `HFStore`: the pure save model (fresh progress, engine save, browser-save migration, conflict merge) |
| `js/strings.js`, `js/i18n.js`, `js/platform-strings.js` | Translation tables (English keys) and `HFI18N` (`T`, `setLocale`); the account and leaderboard lines (`sh.*`, `lb.*`) in nine locales |
| `score-script.js` | The platform script (`server=`): range-checks a finished match's winning margin and posts it to the `margin` board |
| `server.js` | Local dev static file server (left out of the package) |
| `sfx/` | 20 Opus clips + `manifest.json` (event → file, read at start) + `manifest.txt`/`manifest.md` (left out of the package) |
| `assets/` | `keyart.webp`, `table.webp`, `table-graded.webp` (baked by `tools/bake-art.mjs`), `eclipse.webp`, `ui-style.json` |
| `tests/` | `rules-sanity.mjs`, `lesson-check.mjs`, `store.test.mjs`, `i18n.test.mjs`, `native.mjs` + `native/*.play` |
| `tools/` | `package-web.mjs`, `css.mjs`, `bake-art.mjs`, `gen-play.mjs` (generates the play scripts from the rules), `browser-play.mjs` (Chrome on the GPU) |

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
Stage and challenge goals are checked separately in `goalMet` (`native/main.ts`) and always require
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

Undo is snapshot-based — `native/main.ts` pushes `Rules.serialize(game)` before each human pass or
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

| Input | Keyboard / mouse | Touch | Gamepad | Result |
|---|---|---|---|---|
| Card, pass phase | Click; Tab/arrows + Enter/Space | Tap | D-pad focus + South | Toggle selection (max `passCount`); `card-select`; over the max → `invalid` + "Only 3 cards." |
| Card, play phase | Click; Enter/Space | Tap | South | Play if legal (`card-play`); illegal → `invalid` + a toast naming the rule |
| Pass n/3 button | Click / Enter | Tap | South | Submits when the count matches, else `invalid` + toast |
| Hint (`control.hint`) | `H` or the Hint button | Hint button | West (X) | Suggest a card or pass set + reason toast (Practice/Learn) |
| Undo (`control.undo`) | `U` or the Undo button | Undo button | North (Y) | Restore the previous snapshot (Practice/Learn); empty stack → `invalid` |
| Pause (`control.pause`) | `Escape` or the ❚❚ button | ❚❚ button (44×44, top right) | Start | Toggle the pause overlay; Back (Escape, East) also closes it |
| Back | ← button, `Escape` | Tap ← | East | Pop the nav stack (`ui-back`) |
| Options | Settings buttons, F1 | Settings buttons | the runtime's menu | The runtime's Options (sound, graphics, language, controls, accessibility) |

Players rebind keys and pads in the runtime's Options; Help names the effective keys
(`bindingLabel`). Each menu screen focuses its first choice when it opens (title: Play; modes:
Learn; a list: its first row), so keyboard and gamepad players start where the pointer would.

**Input locking.** Hand input and the assists are ignored while the pause overlay is open, while
the results or lesson overlay is up, when the screen is not `play`, and when it is not your turn.
The table's clock (the AI seats' 450 ms between plays) runs on the runtime's fixed steps (60 a
second) only while a match is live and unpaused, so pausing, leaving the screen or a suspended
window never plays on without you. Presses on widgets are collected while the frame's UI is built
and acted on after it.

**Feedback for every input.** Selection = a `#ffd54a` outline; hint = a `#7fd4ff` outline;
illegal = dimmed at 50 % opacity *before* you tap and `invalid` + a toast if you tap anyway;
the active seat is `#f7c948` in both the score row and the painted table; the objective line
always names the current expectation.

---

## 7. Screens and UI flow

`app.screen` names one of nine screens; `navTo` pushes the nav stack, `navBack` pops it and
`leaveToTitle` ends the session and returns to the title. Settings (title and pause menu) opens
the runtime's Options (`openMenu()`), which replaced the old Settings screen.

```
title ─Play→ modes ─┬→ learn ──→ play(learn)
  ├→ daily          ├→ journey ─→ play(journey)
  ├→ journey        ├→ daily ───→ play(daily)
  ├→ Settings (Options) ├→ practice → play(practice)
  └→ help           └→ challenge→ play(challenge)

play ─Escape/❚❚/Start→ pause overlay ─┬→ Resume → play
                                     ├→ Settings (Options)
                                     └→ Leave to title → title
play ─match end→ results overlay ─┬→ Play again → play
                                  └→ Leave to title → title
play(learn) ─goal met→ lesson overlay ─┬→ Next lesson
                                       └→ Back to lessons
```

**Layout** (logical pixels: the window less its safe area, divided by the UI scale). Menu
screens have a 58 px bar (44×44 ← and the heading) over a body that scrolls when taller than the
window. The play screen draws the table over the whole window; the HUD (level title, objective,
score row, wrapping on narrow windows) is anchored top-centre, the ❚❚ button top-right, the
actions over the hand bottom-centre, the toast at 46 % height. Seat labels keep clear of the
HUD bands (last frame's rectangles) and inside the window.

**Phones** (≤ 700 px wide): cards are 44×62 with a −16 px overlap; on wider windows 74×98 with
−18 px. The step between cards shrinks further when a hand would not fit the width, and each
card's rank and suit sit in the strip that shows. **Short landscape** (≤ 500 px tall): the HUD
compacts (17/13 px text, smaller buttons, closer to the edges). Overlays (pause, lesson, results)
are modal dialogs covering the window; their content scrolls when taller than it.

---

## 8. Art direction

**Palette** (`tools/ui-style.css`, `native/style.ts`, `native/table.ts`):

| Token / use | Hex |
|---|---|
| `--bg` ground / `--panel` / `--line` | `#0d1526` / `#141f38` / `#2a3c5e` |
| `--text` / `--dim` | `#dbe7ff` / `#9fb0cc` |
| Button / primary button | `#233a6b` / `#2f6fd0` |
| Table ground / felt fallback | `#17251d` / `#1f3328` |
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

**Motion.** Quiet and ambient: no card tweening, no shuffle animation. Game timing is the 450 ms
gap between AI plays that lets you read each card as it lands, plus a 2.2 s toast dwell. At
levels with ambient motion the lamp light breathes; fireflies drift whenever the level has them;
with detailed cards, hand cards lift 6 px on hover and selected/hinted cards sit raised. All of
it stops under the runtime's reduced-motion setting (fireflies then stand still).

**Graphics.** The table is drawn each frame with `starhermit:draw`: the painted plate (a square
1.06 × the window's longer side, cover-fitted; the colour-graded copy `assets/table-graded.webp`
when Grade is on — the browser build's `ctx.filter` contrast 1.08 / saturate 1.15 / brightness
1.03, baked once by `tools/bake-art.mjs` since the engine's canvas has no filters) under the
legibility scrim, then a warm lamp pool over the table centre (an additive gradient sprite) and a
cool moonlight wash from the upper left, drifting fireflies (seeded, additive, with glow sprites
when Bloom is on), a vignette, and on top the seat labels (dark pill when detailed, drop shadow,
gold glow on the active seat with Bloom at High/Ultra) and the trick cards (detailed: cream paper
gradient, gilt hairline, corner index, clear-coat sheen, a deterministic ±4° tilt; drop shadow per
the Shadows tier), painted once per card, look and scale into canvases. The title draws the key
art (cover) under its gradient with the lamp's glow and flame, the moon's halo, fireflies and a
vignette. Hand cards follow the same tiers (paper gradient, gilt inset, sheen, shadow depth), and
Bloom adds a warm halo to the wordmark and the active score.

The old Graphics panel is the runtime's Options now: Auto and the graphics level, render scale and
pixel-ratio cap, adaptive resolution, the frame-rate limit and readout. `native/quality.ts` keys the
browser build's four presets by the runtime's quality tier (`frame().quality`), scaling the firefly
budget within the tier by the level (`frame().levelIndex`, ≤ 4×, at most 160); the per-effect
overrides of the old panel are not offered.

| Tier | Shadows | Lighting | Bloom | Grade | Fireflies | Ambient motion | Cards | Card shadow cap | Seat glow |
|---|---|---|---|---|---|---|---|---|---|
| Low | off | flat | off | off | none | still | plain | 4 px | no |
| Balanced | low | lamp | off | on | 37.5 % of 36 | still | detailed | 6 px | no |
| High | medium | lamp | on | on | 37.5 % of 48 | animated | detailed | 12 px | yes |
| Ultra | high | lamp | on | on | 64 | animated | detailed | 16 px | yes |

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

**Buses.** The runtime's: effects (every card and table cue), interface (`ui-click`, `ui-back`,
`pause`) and music (the pad). Volumes, mute and the voice limit are the runtime's Options (they
replaced the old Music and Effects sliders). The old music bus ran at half the slider; the pad's
gain (0.5) keeps that balance.

**Music / ambience.** No music files. The browser build's generative pad — sine 110 Hz, sine
164.81 Hz and triangle 220 Hz through a lowpass at 520 Hz whose cutoff a 0.07 Hz LFO sweeps
±140 Hz — is rendered once (a slice a frame) into a seamless 1/0.07 s loop, each voice rounded to
whole cycles in the loop, and played looping from the first press.

**Sample loading.** `sfx/manifest.json` maps events to files; the clips load one at a time once
the mixer runs (natively at once, in a browser after the first press), the first cues of a match
first. A cue whose clip is still loading is silent; the synthesized stand-ins the browser build
played meanwhile are not ported (the web runtime drops clip loads while a synthesis graph changes).

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

Rules events map to cues in one place — `playEvents(events, selfSeat)` in `native/audio.ts` — so a
trick, a Queen, a heart-break, an Eclipse and a round end sound identical whether you or an AI
seat caused them.

---

## 10. Localization

Nine locales ship: **en-US, en-GB, es-419, es-ES, de-DE, fr-FR, fr-CA, pt-BR, it-IT**. Every
player-visible string is an English key in `js/strings.js` with es-419, de-DE, fr-FR, pt-BR and
it-IT translations; en-GB, es-ES and fr-CA carry only their differences and otherwise inherit
en-US, es-419 and fr-FR. That covers the menus, mode cards, headings, Help, the lists, the
objective, scores, action buttons, toasts, the table's "Round n" line, the overlays, the account
line, the rules engine's hint lines and rejection reasons, and the content names in
`js/content.js` (stage, challenge, practice and lesson names, `GOAL_TEXT`, achievement names, the
"You" seat). The account and leaderboard lines live in `js/platform-strings.js`. "Heartfall",
"StarHermit" and the persona names (Fern, Moth, Luna, Pip) are not translated; card faces are rank
glyphs plus suit symbols in every locale.

- **Language:** the runtime's interface language (`preferences().language`: the player's choice
  in Options › Language, else the account's preferred language or the device's), mapped to the
  nearest shipped locale (`es-MX → es-419`, `en-AU → en-GB`). The runtime's Options replaced the
  game's own Language menu (`sh-language.js`).
- **Live switching:** every string is looked up each frame, so a change shows at once without
  touching the match.

---

## 11. Accessibility

* **Keyboard and gamepad path.** Every control is a runtime widget: Tab / arrows / the D-pad move
  focus, Enter / Space / South activate. Hand cards are button widgets named by their card
  ("J♠") and described "Selected" / "Not playable". `Escape` / Start pauses, `H` / West hints, `U`
  / North undoes. The full flow title → mode → stage → pass → play → results → leave is reachable
  without a pointer.
* **Focus.** Buttons and cards get a 2 px `#8fb4ff` focus ring; each screen focuses its first
  choice when it opens.
* **Screen readers.** The runtime's accessibility tree names every widget; the table's seat
  labels and trick cards are `ui.target` labels; toasts (rejections, hints, lesson corrections,
  achievements) and the level/objective at a match's start and its result are announced.
* **Contrast.** `#dbe7ff` on `#0d1526` ~14:1; secondary `#9fb0cc` ~7.5:1; card ink on the card
  face ~14:1; penalty red `#b3372c` ~5.4:1 and never the only cue (the suit glyph is printed too).
  The runtime's high contrast forces the UI's colours (hand cards drop their gradients).
* **Reduced motion / larger text / UI size.** The runtime's settings: reduced motion stills the
  lamp, fireflies and card lifts; text size and interface size scale the UI and the table.
* **Target sizes.** ❚❚ and ← are 44×44. Phone cards are 44×62, overlapped (Known limitations #4).
* **Colour independence.** Legality reads as opacity, selection and hints as outlines, the active
  seat as colour *and* the objective text — no state is colour-only.

---

## 12. StarHermit integration

Conventions: https://wiki.starhermit.com/

**Manifest.** `starhermit.txt` (§1). `score-script.js` is the platform script: a practice session
that accepts `{type:'result', scores}`, range-checks each score against its board and posts it.

**Save** (`native/platform.ts`, `js/store.js`). The progress record (completed lessons, stages,
challenges and dailies; achievements; matches played and the win streak) is the runtime's save
`{ v: 1, progress }`, on the device and, signed in, in the cloud slot. When two devices saved, the
conflict merge keeps both: completions and achievements are unions, matches played the larger
count, this device's win streak. The browser build's cloud save (the JS SDK's `save.json` with
`{ v, settings, progress, savedAt }`) shows as foreign: its progress is merged in and the slot
replaced once (`replaceForeign`). Its settings — and the old per-player settings keys (`music`,
`sfx`, `gfx`, `reducedMotion`, `largeText`, `audio.options`, `graphics.gpu.*`, `ui.language`) — are
the runtime's Options now; the legacy keys are removed. Guests' old browser `localStorage`
progress (`hf-progress-v1`) cannot be read by the engine and does not carry over.

**Signed in**, the title shows the player's name (fallback "Player <id prefix>") and the sync
state (Saving… / Cloud synced / Cloud unreachable), and **Invite a friend** copies the invite link
(with a confirmation toast); a sign-out mid-run shows a notice and play continues on the device.
Guests see **Sign in with StarHermit** (`requestSignIn`).

**Leaderboard.** Every finished Journey, Daily or Challenge match posts its winning margin (the
lowest opponent total minus the player's, −500…500, negative when behind) through
`score-script.js` (a practice session whose game socket carries `{ type: 'result', scores: { margin } }`,
as the JS SDK's `submitScores` did); the results overlay shows "Leaderboard rank: #N" (or
posted / not posted). Practice and Learn post nothing. The score is the client's total,
range-checked by the script (the user's decision for solo boards); there is no multiplayer, so no
refereed results are needed.

**Daily date.** The Daily list's seven days come from the platform's clock (`serverNow()`), else
the device's UTC date offline.

**Achievements** stay local progress marks (awarded at match end, saved with the progress), as in
the browser build; they are not platform achievements.

---

## 13. Technical architecture

**Modules.** The rules, content and save model are classic UMD scripts (`js/*.js`) loaded with
`loadClassic` natively and run unchanged by the Node tests; `rules.js` knows nothing about time or
rendering and never calls `Math.random`. The TypeScript client (`native/*.ts`) owns everything
impure: UI, drawing, audio, storage, the platform.

**Determinism and replay.** See §4. A match is `(cfg, seed, command log)`; AI decisions are
commands; the client's clock is fixed steps, so play scripts replay a whole match exactly
(`tools/gen-play.mjs` writes them from the rules).

**Performance.** Everything is drawn with GPU primitives each frame; the only canvas work is
painting a trick card's face once per card, look and scale, and two gradient sprites at start.
The pad renders 8,000 samples a frame until done. The package is ~1.2 MB.

---

## 14. Testing and acceptance criteria

**`npm test`** = unit tests + `tests/native.mjs`:

- *rules-sanity* — for 2, 3 and 4 seats × 5 seeds a full match by AI self-play (every command
  legal, terminal within 5000 commands, serialize/deserialize keeps `hashState`), then all 40
  Journey stages and 6 Challenges terminate.
- *lesson-check* — each lesson's fixture is sound and its goal reachable; dailies deterministic.
- *store* — the fresh record, the browser cloud save migrated (settings dropped), junk dropped
  from an engine save, the conflict merge.
- *i18n* — every key the client, content and hint lines use is translated in every locale with
  its placeholders, no stale keys, the account lines in every locale, live locale switching.
- *native* — the web index is up to date, `tsc` (no skipLibCheck), `starhermit check .` with zero
  warnings, and the play scripts as signed-out render checks: `journey.play` (Journey 1 played to
  its results by the hint, clicking cards by name and the Pass button, then Play again),
  `lessons.play` (all six lessons by their actions, Hint in the pass lesson, U in the undo
  lesson), `screens.play` (title, Help with the effective keys, Options via Settings, the Daily
  and Challenge lists, Practice's Hint / Pass / U undo, the pause menu by Escape, Resume, Leave).

**Browser** (`npm run test:browser`, Chrome on the GPU via `~/games/tools/gpu-chrome.mjs`): the
packaged loader at 1366×768, a phone 390×844 at DPR 3 and the phone sideways — Enter through
Play, Learn and lesson 1, a click/tap on its card, the lesson overlay, Enter for lesson 2, H, the
pause menu by Escape and Resume — failing on console errors or warnings or the runtime's error
screen. `~/games/tools/engine-web-smoke.mjs` checks start-up at desktop and phone.

---

## 15. Asset inventory

| Path | Purpose | Source | Status |
|---|---|---|---|
| `assets/keyart.webp` | Title-screen background (1536×864, 150 KB) | FLUX.2 klein, seed 4211, 30 steps | Drawn cover-fitted behind the title (`table.ts drawTitle`) |
| `assets/table.webp` | Painted table plate drawn to cover the play canvas (1024², 44 KB) | FLUX.2 klein, seed 4222, 30 steps | Drawn as the table plate (`table.ts drawTableBack`) over the flat felt colour |
| `assets/table-graded.webp` | The plate through the Grade filter | `tools/bake-art.mjs` (canvas filter in Chrome) | Drawn when Grade is on |
| `assets/eclipse.webp` | Results-overlay background (1024×576, 76 KB) | FLUX.2 klein, seed 4233, 30 steps | The results overlay's background |
| `coverart.png` | 1200×675 store cover, wordmark composited over the key art | FLUX.2 klein seed 4211 + ffmpeg drawtext (DejaVu Serif) | Store cover (left out of the package; `cover.jpg` ships) |
| `icon.png` | App icon | Hand-authored | Shipped |
| `sfx/ui-click, ui-back, pause` | Menu cues | MOSS-SoundEffect v2.0 | Shipped |
| `sfx/card-select, card-play, card-pass, cards-deal` | Card handling | MOSS-SoundEffect v2.0 | Shipped |
| `sfx/invalid, turn-prompt, hint, undo` | Feedback and assists | MOSS-SoundEffect v2.0 | Shipped |
| `sfx/trick-take, heart-taken, queen-taken` | Trick and penalty cues | MOSS-SoundEffect v2.0 | Shipped |
| `sfx/hearts-broken.opus` | The round's first heart | MOSS-SoundEffect v2.0, 100 steps | Wired in `playEvents` |
| `sfx/lesson-complete.opus` | Learn lesson goal met | MOSS-SoundEffect v2.0, 100 steps | Played when a lesson goal is met |
| `sfx/eclipse, round-end, match-win, match-lose` | Round and match outcomes | MOSS-SoundEffect v2.0 | Shipped |
| `sfx/manifest.txt` | Canonical clip → event → description → context map | Authored | Shipped |
| `sfx/manifest.json` | Event → file map read at start (with the generation prompts) | Authored | Shipped |
| `sfx/manifest.md` | Generation prompts | Authored | Left out of the package |
| Ambient pad | Rendered at start into a loop, no file | `native/audio.ts` | Shipped |
| Card faces | Unicode rank + suit glyphs, no card art | — | By design: no card image assets |
| 3D models / character animation | — | — | Not called for: the game renders 2D and has no humanoid |

---

## 16. Known limitations

1. **Unshown content stays English.** Stage intros, lesson body texts, theme names and persona
   tags exist in `js/content.js` but no screen displays them, so they have no translations.
2. **Leaderboard margins are client-reported** (range-checked by `score-script.js`, not replay
   verified); achievements are local progress marks with no screen listing them.
3. **The tagline is upright**: the engine's UI has no italic faces.
4. **Overlapping phone cards are under the 44 px touch target**: a 13-card hand overlaps by 16 px,
   exposing a 28 px strip per inner card. Legible, but tight.
5. **Themes are decorative data only.** All five `THEMES` palettes are authored and assigned per
   level, but nothing reads them.
6. **`heart-taken.opus` is unbound** (a reserved accent with no trigger).
7. **Per-level `mechanics.undo` / `mechanics.hint` are ignored.** Assists are gated by mode alone.
8. **Undo is unbounded**: the snapshot stack grows for a whole match.
9. **Resign has no UI**, though the engine implements `{type:'resign'}`.
10. **Ties are shared wins.** Help describes a tie-break order the engine does not implement —
    every seat at the minimum wins (kept as is: the rules are unchanged by the port).
11. **The per-effect graphics overrides** of the old panel are not offered; the runtime's level
    chooses the look.
12. **Guests' browser progress** (`localStorage`) does not carry over to the engine build; signed-in
    players' cloud saves do.

---

## Design intent not yet implemented

* **Validated Daily leaderboard**: a per-date board keyed on `daily-YYYY-MM-DD` whose script
  replays a submitted command log through `js/rules.js` and compares `hashState`.
* **Theme application**: bind the level's `theme` palette to the table and UI, and gate the four
  unlockable themes on the `unlockStars` totals already authored.
* **Per-level assists**: honour `mechanics.undo` / `mechanics.hint` from the level config.
* **Achievements surface**: a screen listing the nine achievements with locked/unlocked state.
* **Trim the undo stack** to a bounded depth, and add a resign control to the pause overlay.
