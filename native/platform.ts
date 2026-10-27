// The game's data and the StarHermit platform, on the runtime's modules:
// - progress (completed lessons, Journey stages, challenges and dailies,
//   achievements, matches played and the win streak) is the game's save
//   (starhermit:storage `saves`): { v: 1, progress } on the device and in
//   the player's cloud slot, two devices' copies merged on a conflict
//   (js/store.js mergeProgress keeps both). The slot the browser build wrote
//   (the JS SDK's zipped save.json holding { v, settings, progress }) shows
//   as foreign and is merged in and replaced once;
// - the browser build's per-player settings (its music/sfx volumes, the
//   Graphics panel's `gfx`, reduced motion and larger text, game-options.js's
//   `audio.options` and `graphics.gpu.*`, sh-language.js's `ui.language`)
//   are the runtime's Options now: the legacy keys are removed. The game has
//   no options of its own;
// - the player's name, the invite link, and posting a finished match's
//   winning margin through score-script.js (a practice session whose socket
//   carries { type: 'result', scores }, as the JS SDK's submitScores did)
//   with the rank on the board.
import type { JsonValue } from "starhermit:engine";
import { connectGame, inviteLink as fetchInviteLink, leaderboards, onPlayerChange, player, serverNow, serverTime, sessions } from "starhermit:platform";
import { saves, settings as store, storage } from "starhermit:storage";
import { Store as S, type Doc } from "./classic.ts";

// --- the save ------------------------------------------------------------------------------
let doc: Doc = { v: 1, progress: S.defaultProgress() };
let lastSavedAt = 0;

export function getDoc(): Doc { return doc; }
/** Writes the save (device at once, the account debounced by the runtime). */
export function persist(): void {
  try { saves.save(doc as unknown as JsonValue, { schema: 1 }); }
  catch (e) { console.warn(`save: ${String(e)}`); }
}

/** Takes another document's progress in (merged with this device's); whether it changed. */
function adopt(other: Doc | null): boolean {
  if (!other) return false;
  const before = JSON.stringify(doc.progress);
  const next = S.mergeProgress(doc.progress, other.progress);
  if (JSON.stringify(next) === before) return false;
  doc = { v: 1, progress: next };
  return true;
}

saves.onConflict((local, remote) => ({
  merged: (S.mergeDocs(local?.data, remote.data) ?? { v: 1, progress: S.defaultProgress() }) as unknown as JsonValue,
}));
saves.onStatus((_status, state) => {
  if (state === "foreign") { migrateForeign(); return; }
  // The account's save replaced the device's (another device saved last): merge it in.
  const cur = saves.load();
  if (cur && cur.savedAt !== lastSavedAt) {
    lastSavedAt = cur.savedAt;
    if (adopt(S.docFromSave(cur.data))) persist();
  }
});

/** The browser build's cloud save: merged with this device's progress, saved over it once. */
function migrateForeign(): void {
  const old = saves.foreign();
  if (!old) return;
  adopt(S.fromBrowserSave(old.text));
  try { saves.save(doc as unknown as JsonValue, { schema: 1, replaceForeign: true }); }
  catch (e) { console.warn(`save migration: ${String(e)}`); }
}

/** For the title's account line: offline (a guest) | saving | synced | error. */
export function syncState(): "offline" | "saving" | "synced" | "error" {
  if (!player()) return "offline";
  const st = saves.state();
  if (st === "error" || st === "read-blocked") return "error";
  if (st === "loading" || st === "uploading" || st === "foreign" || saves.status() === "pending") return "saving";
  return "synced";
}
export function flush(): void { void saves.flush().catch(() => undefined); }

// --- the browser build's settings ----------------------------------------------------------
/** The browser build's per-player settings keys (all now the runtime's Options). */
const LEGACY = new Set(["music", "sfx", "gfx", "quality", "reducedMotion", "largeText", "graphics", "audio.options", "ui.language"]);
export function isBrowserSettingKey(key: string): boolean {
  return LEGACY.has(key) || key.startsWith("graphics.gpu.");
}
function dropLegacy(): void {
  const keys = store.legacyKeys();
  if (!keys) return;
  for (const key of keys) if (isBrowserSettingKey(key)) { try { store.removeLegacy(key); } catch { /* next start */ } }
}

/** Reads the device's save (from onStart). */
export function initPlatform(): void {
  const cur = saves.load();
  lastSavedAt = cur?.savedAt ?? 0;
  const d = S.docFromSave(cur?.data);
  if (d) doc = d;
  else if (!cur) persist();
  store.onLegacy(dropLegacy);
  dropLegacy();
  if (saves.state() === "foreign") migrateForeign();
  wasSignedIn = !!player();
  refreshPlayer();
}

// --- the player ----------------------------------------------------------------------------
export function signedIn(): boolean { return !!player(); }
export function displayName(): string { return player()?.displayName ?? ""; }
/** The first characters of the account id (the chip's fallback name). */
export function shortId(): string { return String(player()?.userId ?? "").slice(0, 6); }
let invite: string | null = null;
/** The invite link, fetched ahead so a button press can copy it at once. */
export function inviteLink(): string | null { return player() ? invite : null; }
function refreshPlayer(): void {
  invite = null;
  if (!player()) return;
  fetchInviteLink().then((u) => { invite = u; }, () => { invite = null; });
  void marginBoard().catch(() => null);
}
let wasSignedIn = false;
let signedOutCb: (() => void) | null = null;
/** fn() when the player signs out during the run (the title's account notice). */
export function onSignedOut(fn: () => void): void { signedOutCb = fn; }
onPlayerChange(() => {
  const now = !!player();
  if (wasSignedIn && !now && signedOutCb) signedOutCb();
  wasSignedIn = now;
  refreshPlayer();
});

// --- the StarHermit winning-margin board -------------------------------------------------------
const BOARD_KEY = "heartfall.board-id";
const SCORE_KEY = "margin";
let boardId: string | null = null;
/** The winning-margin board's id: listed signed in, then kept on the device. */
async function marginBoard(): Promise<string | null> {
  if (boardId) return boardId;
  if (player()) {
    try {
      const list = await leaderboards.list();
      const b = list.find((x) => x.key === SCORE_KEY) ?? list[0];
      if (b) { boardId = b.id; try { storage.set(BOARD_KEY, b.id); } catch { /* full */ } }
    } catch { /* offline */ }
  }
  if (!boardId) { try { boardId = storage.getText(BOARD_KEY); } catch { boardId = null; } }
  return boardId;
}

/** Signed in only: post a finished match's winning margin (may be negative) through score-script.js;
 * { posted, rank }. Never rejects. */
export async function postLeaderboard(margin: number): Promise<{ posted: boolean; rank: number | null }> {
  const me = player();
  if (!me) return { posted: false, rank: null };
  const score = Math.max(-500, Math.min(500, Math.round(margin)));
  let accepted: string[] = [];
  try {
    const sessionId = await sessions.practice();
    accepted = await new Promise<string[]>((resolve) => {
      const socket = connectGame(sessionId);
      let done = false;
      const finish = (list: string[]): void => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        socket.close();
        resolve(list);
      };
      const timer = setTimeout(() => finish([]), 15000);
      socket.on("open", () => { socket.sendCommand({ type: "result", scores: { [SCORE_KEY]: score } }); });
      socket.on("game", (data) => {
        const d = data as { type?: string; accepted?: string[] } | null;
        if (d && d.type === "result-ack") finish(Array.isArray(d.accepted) ? d.accepted : []);
      });
      socket.on("error", () => finish([]));
      socket.on("stopped", () => finish([]));
      socket.on("abandoned", () => finish([]));
    });
  } catch { return { posted: false, rank: null }; }
  if (!accepted.includes(SCORE_KEY)) return { posted: false, rank: null };
  try {
    const id = await marginBoard();
    if (!id) return { posted: true, rank: null };
    const r = await leaderboards.entries(id, { pageSize: 100 });
    const mine = r.items.find((e) => e.userId === me.userId);
    return { posted: true, rank: mine ? mine.rank : null };
  } catch { return { posted: true, rank: null }; }
}

// --- the platform's clock ------------------------------------------------------------------
/** The platform's time in ms (the Daily Challenge's shared day), else the device's clock offline. */
export function nowMs(): number {
  let t: number | null = null;
  try { t = serverNow(); } catch { t = null; }
  return t ?? Date.now();
}
/** Starts the first reading (from onStart). */
export function syncTime(): void { void serverTime().catch(() => undefined); }
