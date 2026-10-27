// Heartfall on the StarHermit engine: the entry module (starhermit.txt
// engine.entry), played natively by the StarHermit client and in browsers
// by the engine's web runtime. The rules, content and save model are the
// browser build's js/*.js, unchanged in what they decide; this module is
// what js/game.js did around them — navigation between the screens, a
// match's session (dealing a level, the player's passes and plays, the AI
// seats' turns, hint and undo in Practice and Learn, the lesson goals),
// rule refusals as the toast, the sounds, the results with the level goal,
// recording progress and achievements, and posting a finished Journey,
// Daily or Challenge match's winning margin to the leaderboard. The screens
// are drawn by screens.ts (starhermit:ui), the table by table.ts.
//
// Time is the runtime's fixed steps (60 a second): the AI seats' 450 ms
// between plays and the toasts count only steps while a match runs and is
// not paused, so a hidden window or the pause menu never moves the table
// and play scripts replay exactly.
import "./classic.ts";
import { clipboard, frame, onFixedUpdate, onQuit, onRender, onResume, onStart, onSuspend, onUpdate, setFixedRate } from "starhermit:engine";
import { onAction } from "starhermit:input";
import * as ui from "starhermit:ui";
import { requestSignIn } from "starhermit:platform";
import { Content as C, RNG, Rules as R, type Cfg, type Command, type GameEvent, type Level, type State } from "./classic.ts";
import * as audio from "./audio.ts";
import { N, pt, tr } from "./i18n.ts";
import * as platform from "./platform.ts";
import { lookFor, type Look } from "./quality.ts";
import { drawScreens } from "./screens.ts";
import { initStyles, applyLook as styleLook } from "./style.ts";
import * as table from "./table.ts";

export type Mode = "learn" | "journey" | "daily" | "practice" | "challenge";
export type ScreenName = "title" | "modes" | "learn" | "journey" | "daily" | "practice" | "challenge" | "help" | "play";
export const app = {
  screen: "title" as ScreenName,
  /** Frame the screen opened on (the press that opened it must not also act on it). */
  openedFrame: 0,
  /** Widget to focus once the screen is built. */
  focusNext: null as string | null,
  paused: false,
  pausedFrame: 0,
  look: lookFor("balanced", 2) as Look,
};
const navStack: ScreenName[] = [];

/** The match in progress. */
export interface Session {
  mode: Mode; id: string | number; level: Level; game: State;
  passSel: number[]; hintCard: number | null; undoStack: string[];
  resultsShown: boolean; lessonDone: boolean; met: boolean | null;
}
export let sess: Session | null = null;
/** The results card's leaderboard line (null: hidden), re-read in the current language. */
export let lbLine: (() => string) | null = null;
/** Play time: fixed steps while a match runs unpaused (ms). */
let playMs = 0;
/** Toast clock: fixed steps on the play screen, paused or not (ms). */
let toastMs = 0;
let nextAiAt = 0;
let suspended = false;
export const toastState = { text: null as (() => string) | null, until: 0 };
export const accountToast = { text: null as (() => string) | null, until: 0 };

// ------------------------------------------------------------------ helpers
export function announce(text: string): void { if (text) ui.announce(text.slice(0, 500), { politeness: "polite" }); }
/** The play screen's toast (js/game.js toast: 2.2 s). */
export function toast(text: () => string): void {
  toastState.text = text;
  toastState.until = toastMs + 2200;
  announce(text());
}
function accountNotice(text: () => string): void {
  accountToast.text = text;
  accountToast.until = frame().time + 3.5;
  announce(text());
}
export function seatLabel(seat: number): string { return tr(C.seatName(seat)); } // 'You' translates; persona names stay
export function cardLabel(id: number): string { return R.cardName(id); }
export function assistsOn(): boolean { return !!sess && (sess.mode === "practice" || sess.mode === "learn"); }

// ------------------------------------------------------------------ navigation
function show(name: ScreenName, focus: string | null = null): void {
  app.screen = name;
  app.openedFrame = frame().frame;
  app.focusNext = focus;
  if (name !== "play") toastState.text = null; // no stale toasts over menus
  ui.setFocus(null);
}
/** The widget a screen focuses when it opens (its first choice), for keyboard and gamepad players. */
function firstFocus(name: ScreenName): string | null {
  switch (name) {
    case "modes": return "mode-learn";
    case "learn": return "row-t1";
    case "journey": return "row-j01";
    case "daily": return `row-${dailyDates()[0]}`;
    case "practice": return "row-casual";
    case "challenge": return "row-c1";
    default: return null;
  }
}
export function navTo(name: ScreenName): void {
  if (app.screen !== name) navStack.push(app.screen);
  show(name, firstFocus(name));
}
export function navBack(): void {
  audio.play("ui-back");
  const to = navStack.pop() ?? "title";
  show(to, to === "title" ? "btn-play" : firstFocus(to));
}

// ------------------------------------------------------------------ dailies
/** The last seven UTC days (today first) on the platform's clock. */
export function dailyDates(): string[] {
  const now = platform.nowMs();
  const out: string[] = [];
  for (let i = 0; i < 7; i++) out.push(C.utcDateString(now - i * 86400000));
  return out;
}

// ------------------------------------------------------------------ the match
function levelFor(mode: Mode, id: string | number): Level {
  if (mode === "learn") return C.tutorialLessons()[id as number]!;
  if (mode === "journey") return C.JOURNEY[id as number]!;
  if (mode === "daily") return C.dailyConfig(id as string);
  if (mode === "practice") return C.PRACTICE.find((p) => p.id === id)!;
  return C.CHALLENGES.find((c) => c.id === id)!;
}

export function startPlay(mode: Mode, id: string | number): void {
  const level = levelFor(mode, id);
  let cfg = (level.cfg ?? level) as Cfg;
  if (cfg.seed === undefined) cfg = { ...cfg, seed: RNG.hashString("heartfall-" + mode + "-" + (cfg.id || id)) };
  const game = R.createGame(cfg);
  sess = { mode, id, level, game, passSel: [], hintCard: null, undoStack: [], resultsShown: false, lessonDone: false, met: null };
  if (mode === "learn" && level.fixture) {
    level.fixture(sess.game); // deterministic fixture overwrites the dealt state
    sess.game.events = [];
  }
  app.paused = false;
  lbLine = null;
  toastState.text = null;
  nextAiAt = playMs + 450;
  table.reset();
  if (app.screen !== "play") navStack.push(app.screen);
  show("play");
  audio.play("cards-deal");
  announce(levelTitle() + ". " + objectiveText());
}

export function levelTitle(): string {
  if (!sess) return "Heartfall";
  const level = sess.level;
  if (sess.mode === "daily") return tr("Daily {date}", { date: (level.date as string) || String(sess.id) });
  const name = level.name || level.title;
  return name ? tr(name) : "Heartfall";
}

const REASONS: Record<string, string> = {
  "game-ended": N("The match is over."), "wrong-phase": N("Not now."), "not-your-turn": N("It is not your turn."),
  "card-not-in-hand": N("That card is not in your hand."), "must-lead-starter": N("The first trick must open with the starting card."),
  "must-follow-suit": N("You must follow suit."), "hearts-not-broken": N("Hearts are not broken yet — lead another suit."),
  "no-penalty-first-trick": N("No penalty cards on the first trick."), "wrong-pass-count": N("Select the right number of cards to pass."),
  "duplicate-pass-card": N("Each card can be passed only once."), "pass-already-submitted": N("You already passed."),
};
/** Player-facing text for a refused pass/play (rules return stable reason codes). */
function reasonText(reason: string | null | undefined): string {
  if (reason && REASONS[reason]) return tr(REASONS[reason]!);
  return reason ? String(reason).replace(/-/g, " ") : tr("Not allowed.");
}

export function objectiveText(): string {
  const g = sess!.game;
  if (g.phase === "pass") {
    const dirs: Record<string, string> = { left: tr("to the left"), right: tr("to the right"), across: tr("across") };
    const dir = dirs[g.passDir] ?? "";
    return g.cfg.passCount === 1 ? tr("Pass 1 card {dir}.", { dir }) : tr("Pass {n} cards {dir}.", { n: g.cfg.passCount, dir });
  }
  if (g.phase === "play") return g.actor === 0 ? tr("Your turn — play a card.") : tr("{seat} is thinking…", { seat: seatLabel(g.actor) });
  return tr("Match over.");
}

/** Whether the table waits: the pause menu, a finished lesson or match, or another screen. */
function simPaused(): boolean {
  return app.paused || app.screen !== "play" || !sess || sess.lessonDone || sess.game.phase === "done";
}

function after(events: GameEvent[]): void {
  table.onEvents(events);
  if (sess && sess.game.phase === "done" && !sess.resultsShown) {
    sess.resultsShown = true;
    showResults();
  }
}

/** One AI seat's turn when it is due (js/game.js aiPump: one every 450 ms). */
function aiStep(): void {
  if (!sess || simPaused() || playMs < nextAiAt) return;
  const g = sess.game;
  if (g.phase === "pass" && g.passes[0] === null && g.actor === 0) return; // waiting for the player's pass
  if (g.phase === "play" && g.actor === 0) return; // waiting for the player's play
  const cmd = R.aiChoose(g, g.actor);
  if (!cmd) return;
  const r = R.applyCommand(g, cmd);
  if (!r.ok) return;
  sess.game = r.state;
  audio.playEvents(r.events, 0);
  if (sess.game.phase === "play" && sess.game.actor === 0) audio.play("turn-prompt");
  nextAiAt = playMs + 450;
  after(r.events);
}

export function passSelected(): void {
  if (!sess || sess.lessonDone || simPaused()) return;
  const g = sess.game;
  if (sess.passSel.length !== g.cfg.passCount) { audio.play("invalid"); toast(() => tr("Select {n} cards to pass.", { n: g.cfg.passCount })); return; }
  const reason = R.checkPass(g, 0, sess.passSel);
  if (reason) { audio.play("invalid"); toast(() => reasonText(reason)); return; }
  if (assistsOn()) sess.undoStack.push(R.serialize(g));
  const r = R.applyCommand(g, { type: "pass", p: 0, cards: sess.passSel.slice() });
  if (!r.ok) { audio.play("invalid"); toast(() => (r.reason ? reasonText(r.reason) : tr("Cannot pass those."))); return; }
  sess.game = r.state; sess.passSel = []; sess.hintCard = null;
  audio.play("card-pass");
  nextAiAt = playMs + 450;
  checkLessonComplete("pass", r.events);
  after(r.events);
}

/** A card of the hand pressed (js/game.js onHandClick): select it for the pass, or play it. */
export function handCard(card: number): void {
  if (!sess || sess.lessonDone || simPaused()) return;
  const g = sess.game;
  if (g.phase === "pass" && !g.passes[0]) {
    const i = sess.passSel.indexOf(card);
    if (i >= 0) sess.passSel.splice(i, 1);
    else if (sess.passSel.length < g.cfg.passCount) sess.passSel.push(card);
    else { audio.play("invalid"); toast(() => tr("Only {n} cards.", { n: g.cfg.passCount })); return; }
    sess.hintCard = null;
    audio.play("card-select");
    return;
  }
  if (g.phase === "play" && g.actor === 0) {
    const reason = R.checkPlay(g, 0, card);
    if (reason) { audio.play("invalid"); toast(() => reasonText(reason)); return; }
    if (assistsOn()) sess.undoStack.push(R.serialize(g));
    const r = R.applyCommand(g, { type: "play", p: 0, card } as Command);
    if (!r.ok) { audio.play("invalid"); toast(() => (r.reason ? reasonText(r.reason) : tr("Cannot play that."))); return; }
    sess.game = r.state; sess.hintCard = null;
    audio.play("card-play");
    audio.playEvents(r.events, 0);
    nextAiAt = playMs + 450;
    checkLessonComplete("play", r.events);
    after(r.events);
  }
}

// ------------------------------------------------------------------ assists
export function doHint(): void {
  if (!sess || !assistsOn() || sess.lessonDone || simPaused()) return;
  const h = R.hint(sess.game, 0);
  if (!h) return;
  sess.hintCard = h.kind === "play" ? h.card ?? null : null;
  if (h.kind === "pass") sess.passSel = (h.cards ?? []).slice();
  audio.play("hint");
  const why = h.why;
  toast(() => (why ? tr(why) : tr("Try this.")));
}
export function doUndo(): void {
  if (!sess || !assistsOn() || sess.lessonDone || simPaused()) return;
  const prev = sess.undoStack.pop();
  if (!prev) { audio.play("invalid"); toast(() => tr("Nothing to undo.")); return; }
  sess.game = R.deserialize(prev);
  sess.passSel = []; sess.hintCard = null;
  audio.play("undo");
  nextAiAt = playMs + 450;
  table.reset();
  checkLessonComplete("undo", []);
}

// ------------------------------------------------------------------ lessons
function checkLessonComplete(kind: string, events: GameEvent[]): void {
  if (!sess || sess.mode !== "learn" || sess.lessonDone) return;
  const goal = sess.level.goal?.kind;
  if (!goal) return;
  let done = false;
  if (goal === "play" && kind === "play") done = true;
  else if (goal === "pass" && kind === "pass") done = true;
  else if (goal === "undo" && kind === "undo") done = true;
  else if (goal === "queen-dump" && kind === "play") done = events.some((e) => e.type === "queen" && e.p === 0);
  else if (goal === "duck" && kind === "play") {
    const trick = events.find((e) => e.type === "trick");
    if (trick) {
      if (trick.winner !== 0) done = true;
      else toast(() => tr("You took the trick — try to stay out of it."));
    }
  } else if (goal === "eclipse") done = events.some((e) => e.type === "eclipse" && e.p === 0);
  if (!done) return;
  sess.lessonDone = true;
  markDone("learn", sess.level.id);
  platform.persist();
  audio.play("lesson-complete");
  app.focusNext = hasNextLesson() ? "btn-next-lesson" : "btn-exit-learn";
  app.openedFrame = frame().frame;
}
export function hasNextLesson(): boolean { return !!sess && (sess.id as number) + 1 < C.tutorialLessons().length; }
export function nextLesson(): void { if (sess) { audio.play("ui-click"); startPlay("learn", (sess.id as number) + 1); } }
export function exitLearn(): void {
  leaveToTitle();
  navTo("learn");
}

// ------------------------------------------------------------------ results
function markDone(mode: "learn" | "journey" | "challenge" | "daily", id: string): void {
  const p = platform.getDoc().progress;
  if (p[mode][id]) return;
  p[mode][id] = true;
}
/** Did seat 0 satisfy the level goal, given a finished match? */
function goalMet(level: Level, g: State): boolean {
  if (!level.goal) return true;
  if (g.terminal!.winners.indexOf(0) < 0) return false;
  switch (level.goal.type) {
    case "win": return true;
    case "score-under": return g.matchScores[0]! <= level.goal.value - 1;
    case "avoid-queen": return g.stats.queensTaken[0] === 0;
    case "eclipse": return g.stats.eclipses[0]! > 0;
    case "no-hearts-round": return g.roundSummaries.some((r) => !!r.hearts && r.hearts[0] === 0);
  }
  return false;
}
/** Goal line text: content goal templates are translation keys. */
export function goalText(): string {
  const goal = sess!.level.goal!;
  return tr(C.GOAL_TEXT[goal.type] ?? C.GOAL_TEXT.win!, { v: goal.value - 1 });
}

// Local awards by stable key, kept in the progress (and so in the cloud save), as the browser build did.
function awardAchievements(g: State): void {
  const p = platform.getDoc().progress;
  const won = g.terminal!.winners.indexOf(0) >= 0;
  p.stats.played++;
  p.stats.winStreak = won ? p.stats.winStreak + 1 : 0;
  const newly: string[] = [];
  const grant = (key: string): void => {
    if (p.achievements[key]) return;
    p.achievements[key] = true;
    const def = C.ACHIEVEMENTS.find((a) => a.key === key);
    if (def) newly.push(def.name);
  };
  if (won) grant("first-win");
  if (g.stats.eclipses[0]! > 0) grant("first-eclipse");
  if (won && g.stats.queensTaken[0] === 0) grant("queen-dodger");
  if (g.roundSummaries.some((r) => !!r.hearts && r.hearts[0] === 0)) grant("clean-round");
  if (p.stats.winStreak >= 3) grant("streak-3");
  if (p.stats.played >= 50) grant("matches-50");
  const jdone = C.JOURNEY.filter((lv) => p.journey[lv.id]).length;
  if (jdone >= 20) grant("journey-half");
  if (jdone >= C.JOURNEY.length) grant("journey-done");
  const ddone = Object.keys(p.daily).filter((k) => p.daily[k]).length;
  if (ddone >= 7) grant("daily-7");
  platform.persist();
  if (newly.length) toast(() => tr("Achievement unlocked: {names}", { names: newly.map((n) => tr(n)).join(" · ") }));
}

function showResults(): void {
  const s = sess!, g = s.game, t = g.terminal!;
  const won = t.winners.indexOf(0) >= 0;
  audio.play(won ? "match-win" : "match-lose");
  if (s.mode === "journey" || s.mode === "challenge") {
    s.met = goalMet(s.level, g);
    if (s.met) markDone(s.mode, s.level.id);
  }
  if (s.mode === "daily") markDone("daily", (s.level.date as string) || String(s.id));
  awardAchievements(g);
  postToLeaderboard(g);
  app.focusNext = "btn-again";
  app.openedFrame = frame().frame;
  announce(won ? tr("You win the table.") : tr("{seat} takes the table.", { seat: seatLabel(t.winner) }));
}

// Signed in: Journey, Daily and Challenge matches post the winning margin
// (lowest opponent total minus yours; negative when behind) to the board
// and show the rank. Offline and Practice/Learn post nothing.
function postToLeaderboard(g: State): void {
  lbLine = null;
  if (!sess || !platform.signedIn()) return;
  if (sess.mode !== "journey" && sess.mode !== "daily" && sess.mode !== "challenge") return;
  const sc = g.terminal!.scores;
  let opp = Infinity;
  for (let p = 1; p < sc.length; p++) opp = Math.min(opp, sc[p]!);
  const posting = (): string => pt("lb.posting");
  lbLine = posting;
  void platform.postLeaderboard(opp - sc[0]!).then((r) => {
    if (lbLine !== posting) return;
    lbLine = () => (!r.posted ? pt("lb.notPosted") : r.rank ? pt("lb.rank", { rank: r.rank }) : pt("lb.posted"));
  });
}

export function playAgain(): void { if (sess) { audio.play("ui-click"); startPlay(sess.mode, sess.id); } }
export function leaveToTitle(): void {
  audio.play("ui-back");
  sess = null;
  app.paused = false;
  navStack.length = 0;
  show("title", "btn-play");
}

// ------------------------------------------------------------------ pause
export function canPause(): boolean { return app.screen === "play" && !!sess && sess.game.phase !== "done" && !sess.lessonDone; }
export function setPaused(on: boolean): void {
  if (on === app.paused) return;
  if (on && !canPause()) return;
  app.paused = on;
  app.pausedFrame = frame().frame;
  audio.play(on ? "pause" : "ui-click");
  if (on) app.focusNext = "btn-resume";
}

// ------------------------------------------------------------------ the platform
export function copyInvite(): void {
  audio.play("ui-click");
  const link = platform.inviteLink();
  if (!link) return;
  let ok = false;
  try { clipboard.writeText(link); ok = true; } catch { ok = false; }
  accountNotice(() => (ok ? pt("sh.copied") : pt("sh.copyFailed", { link })));
}
export function signIn(): void { audio.play("ui-click"); void requestSignIn().catch(() => undefined); }
export { accountNotice };

// ------------------------------------------------------------------ input
onAction((e) => {
  if (!e.pressed) return;
  audio.unlock();
  if (e.action === "pause") {
    if (app.paused) setPaused(false);
    else if (canPause()) setPaused(true);
    return;
  }
  if (app.screen !== "play" || !sess || sess.game.phase === "done" || sess.lessonDone || app.paused) return;
  if (e.action === "undo") doUndo();
  if (e.action === "hint") doHint();
});

// ------------------------------------------------------------------ boot and lifecycle
let lookKey = "";
function applyLook(): void {
  const f = frame();
  const key = `${f.quality}:${f.levelIndex}`;
  if (key === lookKey) return;
  lookKey = key;
  app.look = lookFor(f.quality, f.levelIndex);
  styleLook(app.look);
  table.setLook(app.look);
}

onStart(() => {
  setFixedRate(60);
  initStyles();
  platform.initPlatform();
  platform.onSignedOut(() => accountNotice(() => pt("sh.signedOut")));
  platform.syncTime();
  audio.loadSfx();
  table.loadArt();
  applyLook();
  show("title", "btn-play");
});
onSuspend(() => { suspended = true; platform.flush(); });
onResume(() => { suspended = false; });
onQuit(() => { platform.flush(); });
onFixedUpdate(() => {
  if (suspended) return;
  toastMs += 1000 / 60;
  if (simPaused()) return;
  playMs += 1000 / 60;
  aiStep();
});
onUpdate(() => {
  applyLook();
  audio.update();
  if (toastState.text && (app.screen !== "play" || toastState.until <= toastMs)) toastState.text = null;
  if (accountToast.text && accountToast.until < frame().time) accountToast.text = null;
});
onRender(() => { drawScreens(); });
