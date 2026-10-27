// The look of the menus, the play screen's HUD and the overlays: the
// browser build's css/style.css, rewritten class-based in tools/ui-style.css
// and converted once with `starhermit css` into assets/ui-style.json (`npm
// run css`), registered at start. The graphics categories the old sheet
// keyed on body.gfx-* follow the graphics level (applyLook): Bloom gives
// the wordmark its warm halo and the active seat's score its gold glow.
// High contrast, larger text and reduced motion are the runtime's (it
// forces the UI's colours, scales its text and stills its motion).
import { files } from "starhermit:engine";
import * as ui from "starhermit:ui";
import type { Look } from "./quality.ts";

export const COLORS = {
  bg: "#0d1526", panel: "#141f38", line: "#2a3c5e", text: "#dbe7ff", dim: "#9fb0cc",
};

let css: ui.CssStyles | null = null;
let look: Look | null = null;

function styles(): { [key: string]: ui.Style } {
  const s = { ...(css!.styles as { [key: string]: ui.Style }) };
  if (look?.bloom) {
    const t = s[".game-title"] ?? {};
    // CSS: 0 3px 18px rgba(0,0,0,.85), 0 0 26px rgba(255,210,140,.38): one text shadow, the warm halo.
    s[".game-title"] = { ...t, text: { ...(t.text ?? {}), shadow: { blur: 26, color: "#ffd28c61" } } };
    const st = s[".score-turn"] ?? {};
    s[".score-turn"] = { ...st, text: { ...(st.text ?? {}), shadow: { blur: 10, color: "#f7c948a6" } } };
  }
  return {
    ...s,
    label: { text: { color: "$text" } },
    paragraph: { text: { color: "$text" } },
    heading: { text: { color: "$text" } },
    widget: { focusRing: { color: "#8fb4ff", width: 2, offset: 0 } },
    button: { focusRing: { color: "#8fb4ff", width: 2, offset: 0 } },
    dialog: { background: "transparent", padding: 0, parts: { backdrop: { background: "#00000000" } } },
    scrollArea: { parts: { bar: { background: "$dim", radius: 4 } } },
  };
}

export function initStyles(): void {
  css = files.readJson("assets/ui-style.json") as unknown as ui.CssStyles;
  ui.setTheme({
    fontSize: 16, smallSize: 13, headingSize: 24, padding: 8, spacing: 8, radius: 0,
    text: COLORS.text, muted: COLORS.dim, panel: COLORS.panel, control: "#233a6b", hovered: "#2b4680",
    pressed: "#1d3159", field: "#233a6b", accent: "#2f6fd0", focus: "#8fb4ff", outline: COLORS.line,
  });
  ui.setTokens(css.tokens);
  ui.setAnimations(css.animations);
  if (look) ui.setStyles(styles());
}

/** The graphics categories on the graphics level (quality.ts). */
export function applyLook(l: Look): void {
  look = l;
  if (css) ui.setStyles(styles());
}
