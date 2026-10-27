// The look per graphics level: the browser build's four presets (js/gfx.js
// TABLE: card and label shadows, the lamp pool and moonlight, bloom, the
// colour grade and vignette, fireflies, ambient motion and card detail)
// keyed by the runtime's quality tier (frame().quality), with the firefly
// count scaled within the tier by the level (frame().levelIndex) as the
// browser build scaled its budgets by the hardware level (js/gfx.js
// BUDGETS, FIREFLY_MAX). The runtime owns the rest of the old Graphics
// panel: Auto and the level choice, render scale and the pixel-ratio cap,
// adaptive resolution, the frame-rate limit and readout. The per-category
// overrides of the old panel are not offered (the runtime's Options choose
// a level).
import type { QualityTier } from "starhermit:engine";

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
/** The first level index of each tier. */
const TIER_FLOOR: Record<Preset, number> = { low: 0, balanced: 2, high: 4, ultra: 7 };

/** The look for a quality tier at a level index (0 … 9). */
export function lookFor(preset: Preset, levelIndex: number): Look {
  const row = TABLE[preset] ?? TABLE.balanced;
  const b = BUDGETS[preset] ?? BUDGETS.balanced;
  // Levels are about 1.64× apart in GPU throughput: the firefly budget grows
  // with the level above the tier's first, at most four times the tier's own.
  const k = Math.min(4, Math.pow(1.64, Math.max(0, levelIndex - (TIER_FLOOR[preset] ?? 0))));
  const budget = Math.min(FIREFLY_MAX, Math.round(b.fireflies * k));
  return {
    preset, ...row,
    shadowBlur: Math.min(SHADOW_BLUR[row.shadows], b.cardShadow),
    labelGlow: b.labelGlow,
    fireflies: Math.round(budget * PARTICLE_SHARE[row.particles]),
  };
}
