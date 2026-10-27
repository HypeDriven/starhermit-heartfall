// The browser build's pure game scripts, shared with the Node tests: the
// seeded random streams, the rules engine (dealing, passing, tricks, scoring,
// the AI seats and the hints), the content (Journey, challenges, practice,
// dailies, lessons, achievements), the save model and the string tables
// (js/*.js, UMD), evaluated as classic scripts so their globals are this
// module's exports.
import { loadClassic } from "starhermit:script";

for (const f of ["js/rng.js", "js/rules.js", "js/content.js", "js/store.js", "js/strings.js", "js/i18n.js", "js/platform-strings.js"]) loadClassic(f);

// -- The shapes this client reads -------------------------------------------------
export type Phase = "pass" | "play" | "done";
export interface Cfg {
  id?: string; name?: string; seed?: number; players: number; threshold: number; passCount: number;
  passCycle: string[]; eclipseRule: string; ai: { level: string }; [key: string]: unknown;
}
export interface Goal { type: string; value: number }
export interface Terminal { reason: string; winner: number; winners: number[]; scores: number[] }
export interface State {
  v: number; cfg: Cfg; players: number; phase: Phase; round: number; actor: number; leader: number;
  passDir: string; passes: (number[] | null)[]; hands: number[][]; trick: { p: number; card: number }[];
  taken: number[][]; heartsBroken: boolean; firstTrick: boolean; matchScores: number[];
  stats: { queensTaken: number[]; eclipses: number[]; [key: string]: unknown };
  roundSummaries: { hearts?: number[]; [key: string]: unknown }[];
  terminal: Terminal | null; events: GameEvent[]; tick: number;
}
export interface GameEvent { type: string; p?: number; winner?: number; [key: string]: unknown }
export type Command = { type: "pass"; p: number; cards: number[] } | { type: "play"; p: number; card: number };
export interface Outcome { ok: boolean; reason?: string; state: State; events: GameEvent[] }
export interface Hint { kind: "pass" | "play"; cards?: number[]; card?: number; why: string }

export interface Level {
  id: string; name?: string; title?: string; date?: string; goal?: Goal & { kind?: string };
  cfg?: Cfg; fixture?: (s: State) => void; [key: string]: unknown;
}
export interface Progress {
  learn: Record<string, boolean>; journey: Record<string, boolean>; challenge: Record<string, boolean>;
  daily: Record<string, boolean>; achievements: Record<string, boolean>;
  stats: { played: number; winStreak: number };
}
export interface Doc { v: number; progress: Progress }

interface RulesApi {
  createGame(cfg: Cfg): State;
  applyCommand(s: State, cmd: Command): Outcome;
  aiChoose(s: State, seat: number): Command | null;
  hint(s: State, seat: number): Hint | null;
  legalPlays(s: State, seat: number): number[];
  checkPlay(s: State, seat: number, card: number): string | null;
  checkPass(s: State, seat: number, cards: number[]): string | null;
  serialize(s: State): string;
  deserialize(json: string): State;
  cardName(id: number): string;
  cardSuit(id: number): number;
  isPenalty(id: number): boolean;
}
interface ContentApi {
  seatName(seat: number): string;
  GOAL_TEXT: Record<string, string>;
  JOURNEY: (Level & Cfg & { goal: Goal })[];
  CHALLENGES: (Level & Cfg & { goal: Goal })[];
  PRACTICE: (Level & Cfg)[];
  ACHIEVEMENTS: { key: string; name: string; desc: string }[];
  dailyConfig(date: string): Level & Cfg & { goal: Goal; date: string };
  utcDateString(nowMs?: number): string;
  tutorialLessons(): (Level & { title: string; text: string; goal: { kind: string }; cfg: Cfg })[];
}
interface RngApi { hashString(s: string): number }
interface StoreApi {
  defaultProgress(): Progress;
  docFromSave(data: unknown): Doc | null;
  fromBrowserSave(text: string | null | undefined): Doc | null;
  mergeProgress(a: Progress, b: Progress): Progress;
  mergeDocs(a: unknown, b: unknown): Doc | null;
}
interface I18nApi {
  T(key: string, vars?: Record<string, string | number> | null): string;
  setLocale(tag: string): string;
  readonly lang: string;
  locales: string[];
}
interface PlatformStringsApi {
  platformStrings(lang: string): Record<string, string>;
  fmtPlatform(s: string, vars?: Record<string, string | number>): string;
}

const g = globalThis as unknown as {
  HFRules: RulesApi; HFContent: ContentApi; HFRNG: RngApi; HFStore: StoreApi; HFI18N: I18nApi; HFPlatformStrings: PlatformStringsApi;
};
export const Rules = g.HFRules;
export const Content = g.HFContent;
export const RNG = g.HFRNG;
export const Store = g.HFStore;
export const I18n = g.HFI18N;
export const PlatformStrings = g.HFPlatformStrings;
