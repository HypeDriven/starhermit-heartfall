// The browser build's canvases (js/game.js drawTable / drawTitleFx with
// js/tablefx.js) as starhermit:draw, drawn each frame behind the UI:
// - the play table: the painted plate (assets/table.webp, cover-fitted as
//   a square 1.06 × the window's longer side; the colour-graded copy
//   tools/bake-art.mjs baked when Colour grade is on) under its scrim, the
//   lamp pool and moonlight (Lighting), fireflies (Particles, glowing with
//   Bloom), the vignette (Grade), the seat labels (a pill with Card detail,
//   the active seat gold, glowing with Bloom), the current trick around the
//   centre (card faces painted once per card and size into canvases, plain
//   or detailed with a small tilt, shadowed by the Shadows tier) and the
//   round line;
// - the title's atmosphere over the key art: the lamp's glow and flame, the
//   moon's halo, fireflies and the vignette;
// - the hand's cards (drawn by the hand widgets, see screens.ts).
// The lamp flickers with Ambient motion; fireflies drift unless motion is
// reduced (the runtime's setting). Coordinates are the old logical pixels
// times the UI scale.
import { frame } from "starhermit:engine";
import * as draw from "starhermit:draw";
import * as ui from "starhermit:ui";
import { OffscreenCanvas, type OffscreenCanvasRenderingContext2D } from "starhermit:canvas";
import { Rules as R, type GameEvent, type State } from "./classic.ts";
import type { Look } from "./quality.ts";

let look: Look | null = null;
export function setLook(l: Look): void {
  look = l;
  tableFlies = makeParticles(l.fireflies, 0x4ea7f1);
  titleFlies = makeParticles(l.fireflies, 0x1c3d9);
  faces.clear();
}
/** A new match or an undo (nothing to reset: the table is drawn from the state). */
export function reset(): void { /* stateless */ }
/** Rules events of a command (the table shows the state that follows them). */
export function onEvents(_events: GameEvent[]): void { /* stateless */ }
export function loadArt(): void { glow = glowSprite(); lampSprite = lampPoolSprite(); }

const motion = (): boolean => !ui.preferences().reducedMotion;

// ------------------------------------------------------------------ sprites
let glow: OffscreenCanvas | null = null;
let lampSprite: OffscreenCanvas | null = null;
/** The pre-blurred white glow (tablefx.js glowSprite), tinted per use. */
function glowSprite(): OffscreenCanvas {
  const c = new OffscreenCanvas(128, 128);
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.18, "rgba(255,255,255,0.75)");
  grd.addColorStop(0.45, "rgba(255,255,255,0.22)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  return c;
}
/** The warm lamp pool at full strength (tablefx.js drawLampPool, k = 1), drawn additively. */
function lampPoolSprite(): OffscreenCanvas {
  const c = new OffscreenCanvas(256, 256);
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, "rgba(255,196,120,0.16)");
  grd.addColorStop(0.45, "rgba(255,170,90,0.07)");
  grd.addColorStop(1, "rgba(255,160,80,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  return c;
}
function rgba(rgb: readonly number[], a: number): [number, number, number, number] {
  return [rgb[0]! / 255, rgb[1]! / 255, rgb[2]! / 255, Math.max(0, Math.min(1, a))];
}
function glowAt(x: number, y: number, r: number, rgb: readonly number[], a: number): void {
  if (glow) draw.image(glow, x - r, y - r, r * 2, r * 2, { blend: "add", tint: rgba(rgb, a) });
}

// ------------------------------------------------------------------ lighting
/** Smooth, non-repeating lamp flicker in [0,1]. */
function flicker(t: number): number {
  return 0.5 + 0.25 * Math.sin(t * 2.1) + 0.15 * Math.sin(t * 5.3 + 1.3) + 0.1 * Math.sin(t * 11.7 + 0.4);
}
function lampPool(lx: number, ly: number, r: number, fl: number, flame: boolean): void {
  const k = 0.9 + 0.1 * fl;
  if (lampSprite) draw.image(lampSprite, lx - r, ly - r, r * 2, r * 2, { blend: "add", tint: [1, 1, 1, k] });
  if (flame && look?.bloom) glowAt(lx, ly, r * 0.16 * k, [255, 214, 150], 0.55 * k);
}
/** Cool moonlight falling from the upper left. */
function moonWash(W: number, H: number): void {
  draw.box(0, 0, W, H, { background: { type: "linear", angle: 180 - (Math.atan2(W * 0.75, H) * 180) / Math.PI, stops: [
    { color: "#78a0e61c", at: 0 }, { color: "#78a0e608", at: 0.4 }, { color: "#78a0e600", at: 1 },
  ] } });
}
function vignette(W: number, H: number, strength: number): void {
  const a = Math.round(strength * 255).toString(16).padStart(2, "0");
  draw.box(0, 0, W, H, { background: { type: "radial", radius: "farthest-corner", stops: [
    { color: "#04071000", at: 0.45 }, { color: "#040710" + a, at: 1 },
  ] } });
}

// ------------------------------------------------------------------ fireflies
interface Fly { x: number; y: number; vx: number; vy: number; phase: number; speed: number; size: number; rgb: number[] }
let tableFlies: Fly[] = [];
let titleFlies: Fly[] = [];
/** Seeded, so a still frame looks the same every time (tablefx.js makeParticles). */
function makeParticles(n: number, seed: number): Fly[] {
  let s = seed >>> 0 || 1;
  const rnd = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out: Fly[] = [];
  for (let i = 0; i < n; i++) {
    const warm = rnd() < 0.6;
    out.push({
      x: rnd(), y: rnd(), vx: (rnd() - 0.5) * 0.012, vy: -0.004 - rnd() * 0.01,
      phase: rnd() * Math.PI * 2, speed: 0.6 + rnd() * 1.4, size: 1 + rnd() * 1.8,
      rgb: warm ? [255, 208, 120] : [190, 215, 255],
    });
  }
  return out;
}
function stepParticles(ps: Fly[], dt: number): void {
  for (const p of ps) {
    p.phase += dt * p.speed;
    p.x += (p.vx + Math.sin(p.phase * 0.7) * 0.006) * dt;
    p.y += p.vy * dt;
    if (p.y < -0.05) { p.y = 1.05; p.x = (p.x + 0.37) % 1; }
    if (p.x < -0.05) p.x = 1.05; else if (p.x > 1.05) p.x = -0.05;
  }
}
function drawParticles(ps: Fly[], W: number, H: number, k: number): void {
  for (const p of ps) {
    const a = 0.35 + 0.65 * Math.max(0, Math.sin(p.phase)); // slow blink
    const x = p.x * W, y = p.y * H;
    if (look?.bloom) glowAt(x, y, p.size * 7 * k, p.rgb, a * 0.55);
    draw.circle(x, y, p.size * 0.8 * k, rgba(p.rgb, a * 0.95), { blend: "add" });
  }
}
let lastT = -1;
/** Fireflies drift (each frame once) while motion is allowed. */
function advance(ps: Fly[]): void {
  const t = frame().time;
  const dt = lastT < 0 ? 0 : Math.min(0.1, Math.max(0, t - lastT));
  lastT = t;
  if (motion()) stepParticles(ps, dt);
}

// ------------------------------------------------------------------ the title
const KEYART = { w: 1536, h: 864, lamp: [910, 451], moon: [768, 272] };
/** The key art (cover) under its gradient, and the atmosphere over it. */
export function drawTitle(): void {
  const f = frame();
  const W = f.width, H = f.height, k = ui.preferences().scale;
  draw.box(0, 0, W, H, { background: [
    { type: "linear", stops: [{ color: "#0d1526b8", at: 0 }, { color: "#0d15266b", at: 0.42 }, { color: "#0d1526e0", at: 1 }] },
    { image: "assets/keyart.webp", size: "cover" },
    "#0d1526",
  ] });
  if (!look) return;
  const s = Math.max(W / KEYART.w, H / KEYART.h);
  const ox = (W - KEYART.w * s) / 2, oy = (H - KEYART.h * s) / 2;
  const t = f.time;
  const anim = look.animated && motion();
  if (look.bloom) glowAt(ox + KEYART.moon[0]! * s, oy + KEYART.moon[1]! * s, 150 * s, [200, 220, 255], 0.28);
  if (look.lamp) lampPool(ox + KEYART.lamp[0]! * s, oy + KEYART.lamp[1]! * s, Math.max(W, H) * 0.32, anim ? flicker(t) : 0.6, true);
  advance(titleFlies);
  drawParticles(titleFlies, W, H, k);
  if (look.grade) vignette(W, H, 0.45);
}

// ------------------------------------------------------------------ the play table
/** Seat 0 at the bottom centre; the others spread around the table (fractions of the window). */
export function seatPos(i: number, n: number): [number, number] {
  const spots: Record<number, [number, number][]> = {
    2: [[0.5, 0.86], [0.5, 0.24]],
    3: [[0.5, 0.86], [0.12, 0.32], [0.88, 0.32]],
    4: [[0.5, 0.86], [0.1, 0.45], [0.5, 0.22], [0.9, 0.45]],
  };
  return (spots[n] ?? spots[4]!)[i]!;
}

/** The plate, its light and the fireflies (behind the HUD). */
export function drawTableBack(): void {
  const f = frame();
  const W = f.width, H = f.height, k = ui.preferences().scale;
  const L = look;
  draw.rect(0, 0, W, H, "#17251d");
  // The plate: cover, no letterbox at any aspect; the scrim keeps HUD text above 4.5:1.
  const side = Math.max(W, H) * 1.06;
  draw.box((W - side) / 2, (H - side) / 2, side, side, { background: [
    "#090e1a61",
    { image: L?.grade ? "assets/table-graded.webp" : "assets/table.webp", size: "cover" },
    "#17251d",
  ] });
  if (!L) return;
  const t = f.time;
  const anim = L.animated && motion();
  if (L.lamp) {
    moonWash(W, H);
    lampPool(W / 2, H * 0.47, Math.max(W, H) * 0.55, anim ? flicker(t) : 0.6, false);
  }
  advance(tableFlies);
  drawParticles(tableFlies, W, H, k);
  if (L.grade) vignette(W, H, 0.5);
}

/** HUD bands (window pixels) the seat labels keep clear of. */
export interface Band { l: number; t: number; r: number; b: number }
/** Seat labels, the current trick and the round line, over the plate. */
export function drawTableFront(g: State, top: Band | null, bottom: Band | null, roundLine: string, seatLabel: (p: number) => string): void {
  const f = frame();
  const W = f.width, H = f.height, k = ui.preferences().scale;
  const L = look;
  const detailed = !!L?.detailed;
  const pad = (detailed ? 15 : 6) * k;
  const size = 15 * k;
  for (let p = 0; p < g.players; p++) {
    const [fx, fy] = seatPos(p, g.players);
    const label = `${seatLabel(p)} (${g.hands[p]!.length})`;
    const tw = draw.measureText(label, { size }).width;
    const half = tw / 2 + pad;
    const lx = Math.max(half, Math.min(W - half, fx * W));
    let ly = fy * H - 24 * k;
    const pillH = (detailed ? 12 : 8) * k;
    if (top && ly - pillH < top.b + 4 * k && lx + half > top.l && lx - half < top.r) ly = top.b + pillH + 6 * k;
    if (bottom && ly > bottom.t - 12 * k && lx + half > bottom.l && lx - half < bottom.r) ly = bottom.t - 16 * k;
    seatName(label, lx, ly, tw, g.phase === "play" && g.actor === p, k);
    ui.target(label, { x: lx - tw / 2, y: ly - size / 2, width: tw, height: size }, { role: "label" });
  }
  // The current trick around the centre.
  for (const e of g.trick) {
    const [fx, fy] = seatPos(e.p, g.players);
    const cx = W / 2 + (fx * W - W / 2) * 0.35, cy = H / 2 + (fy * H - H / 2) * 0.35;
    const tilt = detailed ? ((((e.card * 37) % 9) - 4) * Math.PI) / 180 : 0;
    trickCard(e.card, cx, cy, tilt, k);
  }
  draw.text(roundLine, 12 * k, 12 * k, { size: 13 * k, color: "#cfe0ff" });
}

/** A seat's name: a pill with Card detail, gold when active (glowing with Bloom), else a drop shadow. */
function seatName(text: string, x: number, y: number, tw: number, active: boolean, k: number): void {
  const L = look;
  const size = 15 * k;
  if (L?.detailed) {
    draw.box(x - tw / 2 - 9 * k, y - 12 * k, tw + 18 * k, 24 * k, {
      background: active ? "#281e089e" : "#080c188c", radius: 12,
      ...(active ? { border: { width: 1, color: "#f7c948b3" } } : {}),
    });
  }
  const glowOn = active && L?.bloom && L.labelGlow;
  if (glowOn) glowAt(x, y, Math.max(tw * 0.6, 18 * k), [247, 201, 72], 0.35);
  const opts: draw.TextOptions = { size, color: active ? "#f7c948" : "#cfd8d2", align: "center" };
  if (!glowOn && L && L.shadows !== "off") opts.shadow = { color: "#000000d9", x: 0, y: Math.max(1, k) };
  draw.text(text, x, y - draw.measureText(text, { size }).height / 2, opts);
}

// -- trick cards: painted once per card, look and scale (tablefx.js drawCard) --------------------
const CW = 48, CH = 68;
const faces = new Map<string, { canvas: OffscreenCanvas; margin: number }>();
function roundRect(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function cardFace(card: number, k: number): { canvas: OffscreenCanvas; margin: number } {
  const L = look;
  const detailed = !!L?.detailed;
  const blur = L?.shadowBlur ?? 0;
  const key = `${card}:${detailed ? 1 : 0}:${blur}:${k.toFixed(3)}`;
  const hit = faces.get(key);
  if (hit) return hit;
  if (faces.size > 160) faces.clear();
  const margin = Math.ceil(blur * 1.6 + 4);
  const s = Math.max(1, k);
  const c = new OffscreenCanvas(Math.ceil((CW + margin * 2) * s), Math.ceil((CH + margin * 2) * s));
  const ctx = c.getContext("2d")!;
  ctx.scale(s, s);
  ctx.translate(margin + CW / 2, margin + CH / 2);
  const suit = R.cardSuit(card);
  const ink = suit === 1 || suit === 2 ? "#b3372c" : "#222831";
  const label = R.cardName(card);
  if (blur) {
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = blur * s;
    ctx.shadowOffsetY = Math.round(blur * 0.35) * s;
  }
  if (detailed) {
    const paper = ctx.createLinearGradient(-CW / 2, -CH / 2, CW / 2, CH / 2);
    paper.addColorStop(0, "#fdfbf4"); paper.addColorStop(0.6, "#f3eee2"); paper.addColorStop(1, "#e7e0cf");
    ctx.fillStyle = paper;
    roundRect(ctx, -CW / 2, -CH / 2, CW, CH, 5);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "rgba(26,35,64,0.35)"; ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeStyle = "rgba(176,138,62,0.45)";
    roundRect(ctx, -CW / 2 + 3, -CH / 2 + 3, CW - 6, CH - 6, 3);
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.font = "600 10px system-ui, sans-serif";
    ctx.fillText(label, -CW / 2 + 5, -CH / 2 + 5);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = "26px system-ui, sans-serif";
    ctx.fillText(label, 0, 2);
    // Clear-coat sheen across the upper left.
    ctx.save();
    roundRect(ctx, -CW / 2, -CH / 2, CW, CH, 5); ctx.clip();
    const sheen = ctx.createLinearGradient(-CW / 2, -CH / 2, CW * 0.1, CH * 0.05);
    sheen.addColorStop(0, "rgba(255,255,255,0.55)"); sheen.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sheen;
    ctx.fillRect(-CW / 2, -CH / 2, CW, CH);
    ctx.restore();
  } else {
    ctx.fillStyle = "#f4f1e8";
    ctx.fillRect(-CW / 2, -CH / 2, CW, CH);
    ctx.shadowColor = "transparent";
    ctx.fillStyle = ink;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = "26px system-ui, sans-serif";
    ctx.fillText(label, 0, 0);
  }
  const out = { canvas: c, margin };
  faces.set(key, out);
  return out;
}
function trickCard(card: number, cx: number, cy: number, tilt: number, k: number): void {
  const { canvas, margin } = cardFace(card, k);
  const w = (CW + margin * 2) * k, h = (CH + margin * 2) * k;
  draw.image(canvas, cx - w / 2, cy - h / 2, w, h, tilt ? { rotation: tilt, origin: { x: cx, y: cy } } : undefined);
  ui.target(R.cardName(card), { x: cx - (CW * k) / 2, y: cy - (CH * k) / 2, width: CW * k, height: CH * k }, { role: "label" });
}

// ------------------------------------------------------------------ the hand
/** One hand card (css/style.css .card, gfx detailed faces): drawn in its widget's rectangle. */
export interface HandCard { card: number; selected: boolean; hint: boolean; dim: boolean; hovered: boolean; small: boolean }
export function drawHandCard(r: { x: number; y: number }, w: number, h: number, labelW: number, c: HandCard, k: number, highContrast: boolean): void {
  const L = look;
  const detailed = !!L?.detailed;
  const lift = detailed && motion() ? (c.selected ? 10 : c.hint ? 6 : c.hovered && !c.dim ? 6 : 0) * k : 0;
  const x = r.x, y = r.y - lift;
  const shadows: Record<string, { y: number; blur: number; color: string }[]> = {
    off: [{ y: 1, blur: 2, color: "#00000073" }],
    low: [{ y: 2, blur: 6, color: "#00000066" }],
    medium: [{ y: 4, blur: 10, color: "#00000073" }, { y: 1, blur: 2, color: "#00000059" }],
    high: [{ y: 7, blur: 18, color: "#00000080" }, { y: 1, blur: 3, color: "#00000066" }],
  };
  const shadow = shadows[L?.shadows ?? "low"]!;
  const opacity = c.dim ? 0.5 : 1;
  const outline = c.selected ? "#ffd54a" : c.hint ? "#7fd4ff" : null;
  draw.box(x, y, w, h, {
    background: detailed && !highContrast
      ? { type: "linear", angle: 160, stops: [{ color: "#fefcf6", at: 0 }, { color: "#f4efe3", at: 0.58 }, { color: "#e8e1d0", at: 1 }] }
      : "#f2f5fa",
    radius: 6, shadow, opacity,
    ...(detailed ? { border: { width: 1, color: "#1a234047" } } : {}),
  });
  if (detailed && !highContrast) {
    // Inset gilt hairline and the clear-coat sheen.
    draw.box(x + 3 * k, y + 3 * k, w - 6 * k, h - 6 * k, { border: { width: 1, color: "#b08a3e61" }, radius: 3, opacity });
    draw.box(x, y, w, h, { radius: 6, opacity, background: { type: "linear", angle: 135, stops: [{ color: "#ffffff99", at: 0 }, { color: "#ffffff00", at: 0.38 }] } });
  }
  if (outline) draw.box(x - 3 * k, y - 3 * k, w + 6 * k, h + 6 * k, { border: { width: 3, color: outline }, radius: 8 });
  const size = (c.small ? 14 : 20) * k;
  const ink = R.isPenalty(c.card) ? "#b3372c" : "#1a2340";
  const inkA = c.dim ? ink + "80" : ink;
  draw.text(R.cardName(c.card), x + Math.min(w, labelW) / 2, y + (c.small ? 4 : 8) * k, { size, color: inkA, align: "center" });
}
