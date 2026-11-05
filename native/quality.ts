// The look per graphics level: the browser build's four presets (js/gfx.js
// TABLE: card and label shadows, the lamp pool and moonlight, bloom, the
// colour grade and vignette, fireflies, ambient motion and card detail)
// keyed by the runtime's quality tier (frame().quality). This is a 2D game
// drawn with starhermit:draw: its shadows, lamp, glow and grade are its own
// art, not the engine renderer's, so they stay keyed by the tier. The
// firefly count scales with the level's particle budget
// (levelSettings().particles) against the tier's anchor level (quantum,
// molecular, terrestrial, galactic), at most four times the tier's own and
// within the browser build's FIREFLY_MAX. The runtime owns the rest of the old Graphics
// panel: Auto and the level choice, render scale and the pixel-ratio cap,
// adaptive resolution, the frame-rate limit and readout. The per-category
// overrides of the old panel are not offered (the runtime's Options choose
// a level).
import { levelSettings, type GraphicsLevel, type LevelSettings, type QualityTier } from "starhermit:engine";

export type Preset = QualityTier;
export interface Look {
  preset: Preset;
  shadows: "off" | "low" | "medium" | "high";
  /** Warm lamp pool and cool moonlight over the table and the title art. */
  lamp: boolean;
  /** Glow on the lamp, the moon, the fireflies and the active seat. */
  bloom: boolean;
  /** Contrast/saturation grade on the table plate and the vignette. */
  grade: boolean;
  particles: "off" | "low" | "high";
  /** Lamp flicker and drifting fireflies. */
  animated: boolean;
  /** Card faces: paper gradient, gilt hairline, corner index, sheen, tilt. */
  detailed: boolean;
  /** Card drop-shadow blur (logical px). */
  shadowBlur: number;
  /** The active seat's gold glow (else a plain drop shadow). */
  labelGlow: boolean;
  /** Fireflies drawn. */
  fireflies: number;
}

const TABLE: Record<Preset, Omit<Look, "preset" | "shadowBlur" | "labelGlow" | "fireflies">> = {
  low: { shadows: "off", lamp: false, bloom: false, grade: false, particles: "off", animated: false, detailed: false },
  balanced: { shadows: "low", lamp: true, bloom: false, grade: true, particles: "low", animated: false, detailed: true },
  high: { shadows: "medium", lamp: true, bloom: true, grade: true, particles: "low", animated: true, detailed: true },
  ultra: { shadows: "high", lamp: true, bloom: true, grade: true, particles: "high", animated: true, detailed: true },
};
const BUDGETS: Record<Preset, { fireflies: number; labelGlow: boolean; cardShadow: number }> = {
  low: { fireflies: 24, labelGlow: false, cardShadow: 4 },
  balanced: { fireflies: 36, labelGlow: false, cardShadow: 6 },
  high: { fireflies: 48, labelGlow: true, cardShadow: 12 },
  ultra: { fireflies: 64, labelGlow: true, cardShadow: 16 },
};
const SHADOW_BLUR = { off: 0, low: 4, medium: 9, high: 16 };
const PARTICLE_SHARE = { off: 0, low: 0.375, high: 1 };
const FIREFLY_MAX = 160;
/** Each tier's anchor level: its budgets are tuned for it. */
const ANCHOR: Record<Preset, GraphicsLevel> = { low: "quantum", balanced: "molecular", high: "terrestrial", ultra: "galactic" };

/** The look for a graphics level (default: this frame's). */
export function lookFor(s: LevelSettings = levelSettings()): Look {
  const preset = s.quality;
  const row = TABLE[preset] ?? TABLE.balanced;
  const b = BUDGETS[preset] ?? BUDGETS.balanced;
  // The level's particle budget doubles a level: the firefly budget grows
  // with it above the tier's anchor, at most four times the tier's own.
  const k = Math.min(4, Math.max(1, s.particles / levelSettings(ANCHOR[preset] ?? "molecular").particles));
  const budget = Math.min(FIREFLY_MAX, Math.round(b.fireflies * k));
  return {
    preset, ...row,
    shadowBlur: Math.min(SHADOW_BLUR[row.shadows], b.cardShadow),
    labelGlow: b.labelGlow,
    fireflies: Math.round(budget * PARTICLE_SHARE[row.particles]),
  };
}
