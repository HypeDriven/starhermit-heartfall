// The browser build's DOM screens (index.html with js/game.js and
// css/style.css) as starhermit:ui, built every frame: the title over the key
// art (wordmark, tagline, account line, Sign in / Invite, Play, Daily
// Challenge, Journey, Settings, Help), the mode select, the Learn, Journey,
// Daily, Practice and Challenge lists, Help, and the play screen (the
// objective and scores, the pause button, the hand and the Pass / Hint /
// Undo buttons, the toast) with its pause, lesson-complete and results
// overlays. The CSS breakpoints are layouts picked by the window's logical
// size: phones (≤ 700 px wide: smaller cards) and short landscape (≤ 500 px
// tall: a compact HUD). Settings opens the runtime's Options (sound,
// graphics, language, controls, accessibility), which replaced the old
// Settings screen and its Graphics panel.
import { frame, openMenu } from "starhermit:engine";
import * as draw from "starhermit:draw";
import * as ui from "starhermit:ui";
import { bindingLabel } from "starhermit:input";
import { Content as C, Rules as R } from "./classic.ts";
import * as audio from "./audio.ts";
import { N, tr, pt } from "./i18n.ts";
import * as platform from "./platform.ts";
import {
  accountToast, app, assistsOn, copyInvite, dailyDates, doHint, doUndo, exitLearn, goalText, handCard, hasNextLesson,
  lbLine, leaveToTitle, levelTitle, navBack, navTo, nextLesson, objectiveText, passSelected, playAgain, seatLabel,
  sess, setPaused, signIn, startPlay, toastState, type Mode, type ScreenName,
} from "./main.ts";
import { COLORS } from "./style.ts";
import * as table from "./table.ts";

// ------------------------------------------------------------------ layout
interface Layout { lw: number; lh: number; sc: number; phone: boolean; shortLand: boolean }
function layoutNow(): Layout {
  const f = frame();
  const sc = ui.preferences().scale;
  const sa = f.safeArea;
  const lw = Math.max(1, (f.width - sa.left - sa.right) / sc), lh = Math.max(1, (f.height - sa.top - sa.bottom) / sc);
  return { lw, lh, sc, phone: lw <= 700, shortLand: lw > lh && lh <= 500 };
}
const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));
const gap = (h: number): void => { ui.widget("", { role: "none", size: { width: 1, height: h } }); };
/** Heights of blocks as last laid out (logical pixels). */
const lastH = new Map<string, number>();
function track(key: string, r: ui.Rect): void { lastH.set(key, r.height / ui.preferences().scale); }
const H = (key: string, def: number): number => lastH.get(key) ?? def;

function textWidth(text: string, style: readonly (string | ui.Style)[], kind?: "button" | "heading"): number {
  return ui.measureText(text, { ...(kind ? { kind } : {}), style: [...style] }).width / ui.preferences().scale;
}
/** Text up to `width` wide: one label when it fits, else a paragraph. */
function para(text: string, width: number, style: (string | ui.Style)[], id?: string): ui.Rect {
  let u = ui.style(...style);
  if (id) u = u.id(id);
  if (textWidth(text, style) <= width) return u.label(text);
  return u.paragraph(text, width);
}
interface Btn { id: string; text: string; style: (string | ui.Style)[]; act: () => void; content?: () => void; width?: number; height?: number }
/** Presses collected while building; acted on after the frame's UI is built. */
const pressed: (() => void)[] = [];
function button(b: Btn): void {
  const opts: ui.ButtonOptions = {};
  if (b.content) opts.content = b.content;
  else if (b.width != null && textWidth(b.text, b.style, "button") + 2 > b.width) {
    const inner = Math.max(20, b.width - 30);
    opts.content = () => { ui.style({ text: { align: "center" } }).paragraph(b.text, inner); };
  }
  const size: ui.Style = {};
  if (b.width != null) size.width = b.width;
  if (b.height != null) size.height = b.height;
  if (ui.style(...b.style, size).id(b.id).button(b.text, opts)) pressed.push(b.act);
}

// ------------------------------------------------------------------ the frame
export function drawScreens(): void {
  const L = layoutNow();
  const f = frame();
  if (app.screen === "title") table.drawTitle();
  else if (app.screen === "play" && sess) table.drawTableBack();
  else draw.rect(0, 0, f.width, f.height, COLORS.bg);
  ui.column("page", () => {
    switch (app.screen) {
      case "title": titleScreen(L); break;
      case "modes": modesScreen(L); break;
      case "learn": case "journey": case "daily": case "practice": case "challenge": listScreen(L, app.screen); break;
      case "help": helpScreen(L); break;
      case "play": if (sess) playScreen(L); break;
    }
  }, { width: L.lw, height: L.lh, spacing: 0 });
  if (app.screen === "play" && sess) {
    if (app.paused) pauseOverlay(L);
    else if (sess.lessonDone) lessonOverlay(L);
    else if (sess.game.phase === "done") resultsOverlay(L);
  }
  toasts(L);
  if (app.screen !== "title" && app.screen !== "play" && f.frame > app.openedFrame && ui.back()) pressed.push(navBack);
  if (app.focusNext) {
    const age = f.frame - app.openedFrame;
    if (age >= 1) ui.setFocus(app.focusNext);
    if (age >= 3) app.focusNext = null;
  }
  const acts = pressed.splice(0);
  for (const a of acts) a();
}

// ------------------------------------------------------------------ the title
function syncLabel(): string {
  const s = platform.syncState();
  return s === "synced" ? tr("Cloud synced") : s === "saving" ? tr("Saving…") : s === "error" ? tr("Cloud unreachable") : "";
}
function titleScreen(L: Layout): void {
  const menuW = Math.min(L.lw * 0.62, 520, L.lw - 32);
  const bigW = Math.min(L.lw * 0.7, 480, L.lw - 32);
  const titleSize = L.lw < 380 ? 40 : 48;
  ui.column("title-page", () => {
    gap(L.shortLand ? 12 : L.lh * 0.09);
    ui.style("game-title", { text: { size: titleSize } }).label("HEARTFALL");
    gap(10);
    para(tr("A moonlit conservatory card table."), L.lw - 32, ["tagline", { text: { align: "center" } }]);
    if (platform.signedIn()) {
      gap(16);
      const name = platform.displayName() || tr("Player {id}", { id: platform.shortId() });
      const sync = syncLabel();
      para(sync ? `${name} · ${sync}` : name, L.lw - 32, ["player-chip", { text: { align: "center" } }], "player-chip");
    }
    const acct: Btn[] = [];
    if (!platform.signedIn()) acct.push({ id: "btn-signin", text: pt("sh.signIn"), style: ["btn"], act: signIn });
    else if (platform.inviteLink()) acct.push({ id: "btn-invite", text: pt("sh.invite"), style: ["btn"], act: copyInvite });
    if (acct.length) { gap(12); ui.row("account-row", () => { for (const b of acct) button(b); }, { spacing: 10 }); }
    gap(L.shortLand ? 14 : 34);
    ui.column("menu", () => {
      button({ id: "btn-play", text: tr("Play"), style: ["btn-big"], width: bigW, act: () => { audio.play("ui-click"); navTo("modes"); } });
      subrow("sub1", menuW, 17,
        { id: "btn-daily", text: tr("Daily Challenge"), style: ["btn"], act: () => { audio.play("ui-click"); navTo("daily"); } },
        { id: "btn-journey", text: tr("Journey"), style: ["btn"], act: () => { audio.play("ui-click"); navTo("journey"); } });
      subrow("sub2", menuW, 9,
        { id: "btn-settings", text: tr("Settings"), style: ["btn"], act: () => { audio.play("ui-click"); openMenu(); } },
        { id: "btn-help", text: tr("Help"), style: ["btn"], act: () => { audio.play("ui-click"); navTo("help"); } });
    }, { align: "center", spacing: 10 });
  }, { align: "center", width: L.lw, spacing: 0 });
}
/** css .subrow: two buttons held apart by `gaps` 8 px gaps (the empty spans between them), centred. */
function subrow(id: string, width: number, gaps: number, a: Btn, b: Btn): void {
  const wa = textWidth(a.text, a.style, "button"), wb = textWidth(b.text, b.style, "button");
  const space = clamp(width - wa - wb, 8, gaps * 8);
  ui.row(id, () => { button(a); button(b); }, { spacing: space, align: "center", padding: { top: 6 } });
}

// ------------------------------------------------------------------ menu screens
/** css .bar: the back button and the heading, then the body (scrolling when taller than the window). */
function page(L: Layout, title: string, body: (w: number) => void): void {
  ui.row("bar", () => {
    button({ id: "btn-back", text: tr("Back"), style: ["btn-back"], width: 44, height: 44, act: navBack, content: () => ui.style({ text: { size: 20, align: "center" } }).label("←") });
    ui.style("h2").label(title);
  }, { spacing: 12, align: "center", height: 58 });
  const bodyH = L.lh - 58;
  const w = L.lw;
  const content = (): void => { track(`body-${app.screen}`, ui.column(`body-${app.screen}`, () => body(w - 36), { width: w, padding: { start: 18, end: 18, top: 6, bottom: 18 }, spacing: 0 })); };
  if (H(`body-${app.screen}`, 0) > bodyH + 1) ui.scrollArea(`scroll-${app.screen}`, { width: w, height: bodyH }, content);
  else content();
}

const MODES: { mode: Mode; name: string; desc: string }[] = [
  { mode: "learn", name: N("Learn"), desc: N("Tutorial — the rules, one at a time.") },
  { mode: "journey", name: N("Journey"), desc: N("An authored path through 40 stages.") },
  { mode: "daily", name: N("Daily Challenge"), desc: N("One shared table for everyone, today only.") },
  { mode: "practice", name: N("Practice"), desc: N("Select your difficulty. Undo and hints allowed.") },
  { mode: "challenge", name: N("Challenge"), desc: N("Six constrained tables with their own rules.") },
];
function modesScreen(L: Layout): void {
  page(L, tr("Modes"), (w) => {
    const cw = Math.min(L.lw * 0.9, 560, w);
    ui.column("modes", () => {
      for (const m of MODES) {
        gap(10);
        const name = tr(m.name), desc = tr(m.desc);
        button({ id: `mode-${m.mode}`, text: name, style: ["mode-card"], width: cw, act: () => { audio.play("ui-click"); navTo(m.mode); },
          content: () => { ui.style("mode-name").label(name); ui.style("mode-desc").paragraph(desc, cw - 30); } });
      }
    }, { width: w, align: "center", spacing: 0 });
  });
}

function listScreen(L: Layout, mode: Mode): void {
  const p = platform.getDoc().progress;
  const heads: Record<Mode, [string, string]> = {
    learn: [N("Learn"), N("Six lessons. Each one isolates a single rule; perform the action to continue.")],
    journey: [N("Journey"), N("Forty stages. The conservatory keeps its own ledger.")],
    daily: [N("Daily Challenge"), N("Seven days, one table each. The rules change with the moon.")],
    practice: [N("Practice"), N("Three tables. Undo and hints are on.")],
    challenge: [N("Challenge"), N("Six tables, each with its own rules and its own price.")],
  };
  const rows: { id: string; label: string; done: boolean; go: () => void }[] = [];
  if (mode === "learn") C.tutorialLessons().forEach((l, i) => rows.push({ id: l.id, label: `${i + 1}. ${tr(l.title)}`, done: !!p.learn[l.id], go: () => startPlay("learn", i) }));
  if (mode === "journey") C.JOURNEY.forEach((lv, i) => rows.push({ id: lv.id, label: `${i + 1}. ${tr(lv.name!)}`, done: !!p.journey[lv.id], go: () => startPlay("journey", i) }));
  if (mode === "daily") dailyDates().forEach((date, i) => {
    const cfg = C.dailyConfig(date);
    rows.push({ id: date, label: tr("{day} · {seats} seats · {pts} pts", { day: i === 0 ? tr("Today") : date, seats: cfg.players, pts: cfg.threshold }), done: !!p.daily[date], go: () => startPlay("daily", date) });
  });
  if (mode === "practice") C.PRACTICE.forEach((pr) => rows.push({ id: pr.id, label: tr(pr.name!), done: false, go: () => startPlay("practice", pr.id) }));
  if (mode === "challenge") C.CHALLENGES.forEach((c) => rows.push({ id: c.id, label: tr(c.name!), done: !!p.challenge[c.id], go: () => startPlay("challenge", c.id) }));
  const [title, lead] = heads[mode];
  page(L, tr(title), (w) => {
    ui.style("lead").paragraph(tr(lead), w);
    gap(12);
    ui.column("list", () => {
      for (const r of rows) {
        button({ id: `row-${r.id}`, text: r.label, style: ["list-row"], width: w, act: () => { audio.play("ui-click"); r.go(); },
          content: () => {
            ui.row(`row-${r.id}-face`, () => {
              ui.style("list-name").paragraph(r.label, w - 40);
              ui.spacer();
              ui.style("list-done").label(r.done ? "✓" : " ");
            }, { width: w - 8, align: "center" });
          } });
      }
    }, { width: w, spacing: 0 });
  });
}

function helpScreen(L: Layout): void {
  const keys = (a: string): string => bindingLabel(a, "keyboard") || "—";
  const lines = [
    tr("Heartfall is a trick-taking card game. Pass cards, follow suit, avoid penalty hearts and the Nightshade Queen (Q♠) — or capture every penalty for an Eclipse."),
    tr("Lowest match score wins once anyone reaches the threshold; full-penalty capture applies the declared room rule."),
    tr("Controls: click or tap a card to select or play it. In Practice and Learn, {hint} asks for a hint and {undo} undoes your last action. {pause} or the pause button opens the pause menu.",
      { hint: keys("hint"), undo: keys("undo"), pause: keys("pause") }),
    tr("Results show a component breakdown rather than one unexplained total. Ties use, in order: primary objective completion, fewer invalid actions, lower authoritative elapsed time, then stable session identifier."),
  ];
  page(L, tr("Help"), (w) => {
    lines.forEach((t, i) => { if (i) gap(16); ui.style("body").paragraph(t, w); });
  });
}

// ------------------------------------------------------------------ the play screen
let bandTop: table.Band | null = null;
let bandBottom: table.Band | null = null;
const toBand = (r: ui.Rect): table.Band => ({ l: r.x, t: r.y, r: r.x + r.width, b: r.y + r.height });

function playScreen(L: Layout): void {
  const s = sess!;
  const g = s.game;
  table.drawTableFront(g, bandTop, bandBottom,
    g.heartsBroken ? tr("Round {n} · hearts broken", { n: g.round }) : tr("Round {n}", { n: g.round }), seatLabel);
  const compact = L.shortLand;
  const live = !app.paused && !s.lessonDone && g.phase !== "done";
  // Top: the level, the objective and the scores.
  const topW = Math.min(compact ? L.lw * 0.46 : L.lw * 0.7, 560, L.lw - 120);
  bandTop = toBand(ui.place("hud-top", { anchor: "top", y: compact ? 4 : 8 }, () => {
    ui.column("hud-top-col", () => {
      para(levelTitle(), topW, ["obj-title", { text: { align: "center", ...(compact ? { size: 17 } : {}) } }], "obj-title");
      gap(2);
      para(objectiveText(), topW, ["objective", { text: { align: "center", ...(compact ? { size: 13 } : {}) } }], "objective");
      gap(compact ? 2 : 6);
      scores(topW, compact);
    }, { align: "center", spacing: 0, width: topW });
  }));
  // The pause button (top end).
  ui.place("hud-pause", { anchor: "top-end", x: 10, y: 8 }, () => {
    button({ id: "btn-pause", text: tr("Pause game"), style: ["btn-pause"], width: 44, height: 44, act: () => setPaused(true),
      content: () => pauseGlyph() });
  });
  // Bottom: the actions over the hand.
  bandBottom = toBand(ui.place("hud-bottom", { anchor: "bottom", y: compact ? 2 : 6 }, () => {
    ui.column("hud-bottom-col", () => {
      actions(compact, live);
      hand(L, live);
    }, { align: "center", spacing: compact ? 4 : 8 });
  }));
}

function scores(width: number, compact: boolean): void {
  const g = sess!.game;
  const items = g.matchScores.map((sc, p) => ({ text: `${seatLabel(p)}: ${sc}`, turn: p === g.actor && g.phase === "play" }));
  const style = (turn: boolean): (string | ui.Style)[] => [turn ? "score-turn" : "score", ...(compact ? [{ text: { size: 13 } }] : [])];
  const rows: typeof items[] = [[]];
  let used = 0;
  for (const it of items) {
    const w = textWidth(it.text, style(it.turn));
    if (rows[rows.length - 1]!.length && used + 16 + w > width) { rows.push([]); used = 0; }
    used += (rows[rows.length - 1]!.length ? 16 : 0) + w;
    rows[rows.length - 1]!.push(it);
  }
  ui.column("scores", () => {
    rows.forEach((row, ri) => ui.row(`srow-${ri}`, () => { row.forEach((it, i) => ui.style(...style(it.turn)).id(`score-${ri}-${i}`).label(it.text)); }, { spacing: 16, align: "center" }));
  }, { align: "center", spacing: 2 });
}

/** ❚❚ drawn as two bars (the glyph draws thin). */
function pauseGlyph(): void {
  ui.widget("", { role: "none", size: { width: 16, height: 16 }, draw: (r, st) => {
    const k = st.scale;
    draw.rect(r.x + 2 * k, r.y + 1 * k, 4 * k, 14 * k, st.colors.text);
    draw.rect(r.x + 10 * k, r.y + 1 * k, 4 * k, 14 * k, st.colors.text);
  } });
}

function actions(compact: boolean, live: boolean): void {
  const s = sess!, g = s.game;
  const list: Btn[] = [];
  const pad: ui.Style = compact ? { padding: { top: 7, bottom: 7, start: 14, end: 14 } } : {};
  if (g.phase === "pass" && !g.passes[0]) {
    list.push({ id: "btn-pass", text: tr("Pass {n}/{total}", { n: s.passSel.length, total: g.cfg.passCount }), style: ["btn-primary", pad], act: passSelected });
  }
  if (assistsOn()) {
    list.push({ id: "btn-hint", text: tr("Hint"), style: ["btn-act", pad], act: doHint });
    list.push({ id: "btn-undo", text: tr("Undo"), style: ["btn-act", pad], act: doUndo });
  }
  if (!list.length || !live) { if (!list.length) return; }
  ui.row("actions", () => { for (const b of list) button(b); }, { spacing: 10, align: "center" });
}

function hand(L: Layout, live: boolean): void {
  const s = sess!, g = s.game;
  const cards = g.hands[0]!;
  if (!cards.length) return;
  const small = L.lw <= 700;
  const cw = small ? 44 : 74, ch = small ? 62 : 98, overlap = small ? 16 : 18;
  const avail = L.lw - 16;
  const step = cards.length > 1 ? Math.max(8, Math.min(cw - overlap, (avail - cw) / (cards.length - 1))) : cw;
  const myTurn = g.phase === "play" && g.actor === 0;
  const legal = myTurn ? R.legalPlays(g, 0) : [];
  const hc = ui.preferences().highContrast;
  ui.row("hand", () => {
    cards.forEach((card, i) => {
      const last = i === cards.length - 1;
      const w = last ? cw : step;
      const sel = s.passSel.indexOf(card) >= 0;
      const dim = myTurn && legal.indexOf(card) < 0;
      const name = R.cardName(card);
      const res = ui.id(`card-${card}`).widget(name, {
        role: "button", size: { width: w, height: ch }, disabled: !live,
        description: sel ? tr("Selected") : dim ? tr("Not playable") : "",
        draw: (r, st) => {
          const k = st.scale;
          table.drawHandCard(r, cw * k, ch * k, w * k, { card, selected: sel, hint: s.hintCard === card, dim, hovered: st.hovered, small }, k, hc);
        },
      });
      if (res.activated) pressed.push(() => handCard(card));
    });
  }, { spacing: 0, align: "end", height: ch });
}

// ------------------------------------------------------------------ overlays
/** A full-window overlay (css .overlay) as a modal dialog: its heading at the top, the content centred under it. */
function overlay(id: string, L: Layout, open: boolean, background: ui.Fill | readonly ui.Fill[], heading: string, topFrac: number, body: (w: number) => void): boolean {
  const res = ui.dialog(id, "", open, () => {
    ui.style({ background: background as ui.Fill }).column(`${id}-full`, () => {
      const inner = (): void => {
        track(`${id}-inner`, ui.column(`${id}-inner`, () => {
          gap(Math.min(L.lh * topFrac, 120));
          para(heading, L.lw - 32, ["overlay-h2", { text: { align: "center" } }], `${id}-h2`);
          gap(16);
          body(Math.min(L.lw * 0.9, 520, L.lw - 32));
          gap(24);
        }, { align: "center", width: L.lw, spacing: 0 }));
      };
      if (H(`${id}-inner`, 0) > L.lh) ui.scrollArea(`${id}-scroll`, { width: L.lw, height: L.lh }, inner, frame().frame - app.openedFrame < 3 ? { scrollTo: { top: 0 } } : undefined);
      else inner();
    }, { width: L.lw, height: L.lh, spacing: 0 });
  });
  return res;
}
const SCRIM = "#080c18c7";
function menuButtons(L: Layout, list: (Btn & { big?: boolean })[]): void {
  const menuW = Math.min(L.lw * 0.62, 520, L.lw - 32);
  const bigW = Math.min(L.lw * 0.7, 480, L.lw - 32);
  ui.column("menu", () => {
    for (const b of list) button({ ...b, width: b.big ? bigW : menuW });
  }, { align: "center", spacing: 12 });
}

function pauseOverlay(L: Layout): void {
  const stillOpen = overlay("pause", L, true, SCRIM, tr("Paused"), 0.09, () => {
    menuButtons(L, [
      { id: "btn-resume", text: tr("Resume"), style: ["btn-big"], big: true, act: () => setPaused(false) },
      { id: "btn-pause-settings", text: tr("Settings"), style: ["btn"], act: () => { audio.play("ui-click"); openMenu(); } },
      { id: "btn-leave", text: tr("Leave to title"), style: ["btn"], act: leaveToTitle },
    ]);
  });
  // Back (Escape, East) closes it, except on the frame the same press opened it.
  if (!stillOpen && frame().frame > app.pausedFrame) pressed.push(() => setPaused(false));
}

function lessonOverlay(L: Layout): void {
  const s = sess!;
  const title = s.level.title as string;
  const next = hasNextLesson();
  overlay("lesson", L, true, SCRIM, tr("Lesson complete."), 0.09, (w) => {
    para(tr("{lesson} — done.", { lesson: tr(title) }), w, ["overlay-p", { text: { align: "center" } }], "lesson-done");
    gap(16);
    const list: (Btn & { big?: boolean })[] = [];
    if (next) list.push({ id: "btn-next-lesson", text: tr("Next lesson"), style: ["btn-big"], big: true, act: nextLesson });
    list.push({ id: "btn-exit-learn", text: tr("Back to lessons"), style: [next ? "btn" : "btn-big"], big: !next, act: exitLearn });
    menuButtons(L, list);
  });
}

function resultsOverlay(L: Layout): void {
  const s = sess!, g = s.game, t = g.terminal!;
  const head = t.winners.indexOf(0) >= 0 ? tr("You win the table.") : tr("{seat} takes the table.", { seat: seatLabel(t.winner) });
  const bg: ui.Fill[] = [
    { type: "linear", stops: [{ color: "#080c18db", at: 0 }, { color: "#080c18b8", at: 0.45 }, { color: "#080c18eb", at: 1 }] },
    { image: "assets/eclipse.webp", size: "cover" },
    SCRIM,
  ];
  overlay("results", L, true, bg, head, 0.14, (w) => {
    ui.column("result-rows", () => {
      t.scores.forEach((sc, p) => {
        ui.style(t.winners.indexOf(p) >= 0 ? "score-row-winner" : "score-row").id(`result-${p}`).label(tr("{seat}: {score}", { seat: seatLabel(p), score: sc }));
      });
      if (s.met !== null) {
        gap(10);
        para(tr(s.met ? "{goal} — achieved" : "{goal} — not met", { goal: goalText() }), w, [s.met ? "goal-done" : "goal-failed", { text: { align: "center" } }], "goal-line");
      }
      if (lbLine) {
        gap(10);
        para(lbLine(), w, ["goal-line", { text: { align: "center" } }], "results-lb");
      }
    }, { align: "center", width: w, spacing: 2 });
    gap(16);
    menuButtons(L, [
      { id: "btn-again", text: tr("Play again"), style: ["btn-big"], big: true, act: playAgain },
      { id: "btn-leave-results", text: tr("Leave to title"), style: ["btn"], act: leaveToTitle },
    ]);
  });
}

// ------------------------------------------------------------------ toasts
function toasts(L: Layout): void {
  const w = Math.min(560, L.lw - 32);
  const tt = toastState.text;
  if (tt && app.screen === "play") {
    const h = H("toast", 40);
    ui.place("toast", { anchor: "top", y: Math.max(0, L.lh * 0.46 - h / 2) }, () => {
      track("toast", ui.style("toast").column("toast-box", () => { para(tt(), w - 36, ["toast-text", { text: { align: "center" } }], "toast-text"); }, { align: "center" }));
    });
  }
  const at = accountToast.text;
  if (at && app.screen === "title") {
    ui.place("account-toast", { anchor: "bottom", y: 16 }, () => {
      ui.style("account-toast").column("account-toast-box", () => { para(at(), w - 36, ["toast-text", { text: { align: "center" } }], "account-toast-text"); }, { align: "center" });
    });
  }
}

export type { ScreenName };
