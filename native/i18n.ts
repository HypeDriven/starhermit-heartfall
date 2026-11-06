// Localization: the engine's string tables (assets/strings.json, generated from
// the browser build's tables: English text as the key, the nine StarHermit
// locales; en-GB, es-ES and fr-CA hold their differences, the chain reads the
// rest) in the interface language the runtime reports (the player's choice in
// Options › Language, else the account's preferred language or the device's).
// The runtime's Options replaced the game's own Language menu (sh-language.js).
// The account lines are the engine's `starhermit.*` keys.
import { strings } from "starhermit:engine";
import * as ui from "starhermit:ui";

strings.load("assets/strings.json");
strings.defaultLocale = "en-US";
ui.setLanguage(strings.locale);
strings.onChange((locale) => ui.setLanguage(locale));

export type Vars = Record<string, string | number>;
/** A game string by its English key in the player's language; `{name}` placeholders from vars. Text with no entry (a persona's name) passes through. */
export function tr(key: string, vars?: Vars | null): string {
  if (strings.has(key)) return strings.t(key, vars ?? undefined);
  return key.replace(/\{(\w+)\}/g, (m, k: string) => (vars && vars[k] != null ? String(vars[k]) : m));
}
/** Marks an English key translated with tr() where it is shown. */
export const N = (s: string): string => s;

export type PlatformKey = "signIn" | "invite" | "inviteCopied" | "inviteLink" | "signedOut" | "leaderboardPosting" | "leaderboardRank" | "leaderboardPosted" | "leaderboardNotPosted";
/** An account or leaderboard line (the engine's `starhermit.*` strings) in the player's language. */
export function pt(key: PlatformKey, vars?: Vars): string { return strings.t(`starhermit.${key}`, vars); }
