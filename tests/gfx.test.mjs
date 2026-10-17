// Unit tests for the pure graphics quality model (js/gfx.js). Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// js/gpu-level.js is a classic script in the page (window.StarHermitGpu); evaluate it the same way here.
new Function('window', readFileSync(new URL('../js/gpu-level.js', import.meta.url), 'utf8'))(globalThis);
await import('../js/gfx.js');
const G = globalThis.HFGfx;

const DESK = { cores: 8, memoryGb: 8 };
const PHONE = { mobile: true, cores: 8, memoryGb: 8 };

test('hardware level picks the Auto preset (Low 0, Balanced 4, High 10, Ultra 17)', () => {
  assert.equal(G.detectPreset('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)', DESK), 'low');
  assert.equal(G.detectLevel('llvmpipe (LLVM 15.0.7, 256 bits)', DESK), 0);
  assert.equal(G.detectPreset('', DESK), 'low', 'no WebGL');
  assert.equal(G.detectPreset('ANGLE (AMD, AMD Radeon(TM) Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)', DESK), 'low');
  assert.equal(G.detectPreset('ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11)', DESK), 'low');
  assert.equal(G.detectPreset('ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11)', DESK), 'balanced');
  assert.equal(G.detectPreset('ANGLE (NVIDIA, NVIDIA GeForce GTX 1070 Direct3D11 vs_5_0 ps_5_0)', DESK), 'high');
  assert.equal(G.detectPreset('ANGLE (NVIDIA, NVIDIA GeForce RTX 4080 Direct3D11 vs_5_0 ps_5_0)', DESK), 'ultra');
  assert.equal(G.detectLevel('ANGLE (NVIDIA, NVIDIA GeForce RTX 5090 Direct3D11 vs_5_0 ps_5_0)', DESK), 20);
  assert.equal(G.detectPreset('ANGLE (NVIDIA, NVIDIA GeForce RTX 5090 Direct3D11 vs_5_0 ps_5_0)', DESK), 'ultra');
  for (const [p, lv] of Object.entries(G.LEVELS)) assert.equal(G.presetForLevel(lv), p);
  assert.equal(G.presetForLevel(3), 'low');
  assert.equal(G.presetForLevel(16), 'high');
});

test('phones and tablets are Balanced at most; software GPUs stay Low', () => {
  assert.equal(G.detectPreset('Adreno (TM) 740', PHONE), 'balanced');
  assert.ok(G.detectLevel('Adreno (TM) 740', PHONE) <= 9);
  assert.equal(G.detectPreset('NVIDIA GeForce RTX 5090', PHONE), 'balanced');
  assert.equal(G.detectPreset('SwiftShader', PHONE), 'low');
});

test('per-preset budgets are explicit, grow from Low to Ultra and scale with the level', () => {
  const P = G.PRESETS, B = G.BUDGETS;
  const keys = ['fireflies', 'glowSprite', 'labelGlow', 'cardShadow', 'bakeLight'];
  for (const p of P) for (const k of keys) assert.ok(B[p][k] != null, `${p}.${k}`);
  for (let i = 1; i < P.length; i++) for (const k of keys) if (typeof B.low[k] === 'number') assert.ok(B[P[i]][k] >= B[P[i - 1]][k], `${P[i]}.${k}`);
  assert.deepEqual(P.map((p) => B[p].bakeLight), [true, true, false, false]);
  assert.deepEqual(G.resolve({ preset: 'high' }, 'low', 10).budget, B.high, 'floor level = the tuned budget');
  assert.deepEqual(G.resolve({ preset: 'ultra' }, 'low', 0).budget, G.resolve({ preset: 'ultra' }, 'ultra', 17).budget, 'manual Ultra on a weak GPU keeps the Ultra floor budget');
  assert.ok(G.budgetFor('balanced', 9).fireflies > G.budgetFor('balanced', 4).fireflies, 'counts scale up within the preset');
  assert.equal(G.resolve({ preset: 'ultra' }, 'ultra', 17).particleCount, B.ultra.fireflies);
  assert.equal(G.resolve({ preset: 'low', shadows: 'high' }, 'low', 0).shadowBlur, B.low.cardShadow, 'card shadow blur capped by the budget');
});

test('resolve: auto uses detected preset, explicit preset wins', () => {
  const a = G.resolve({}, 'high');
  assert.equal(a.preset, 'high'); assert.equal(a.auto, true);
  assert.equal(a.shadows, 'medium'); assert.equal(a.adaptive, true); assert.equal(a.showFps, false);
  const b = G.resolve({ preset: 'low' }, 'high');
  assert.equal(b.preset, 'low'); assert.equal(b.auto, false);
  assert.equal(b.animated, false, 'Low repaints only on change');
  assert.equal(b.dprCap, 1);
});

test('resolve: overrides apply per category, invalid tiers fall back', () => {
  const r = G.resolve({ preset: 'high', shadows: 'off', bloom: 'bogus', particles: 'preset' }, 'low');
  assert.equal(r.shadows, 'off');
  assert.equal(r.bloom, G.presetTier('high', 'bloom'));
  assert.equal(r.particles, G.presetTier('high', 'particles'));
});

test('resolve: render scale clamps to 50–200 %', () => {
  assert.equal(G.resolve({ preset: 'high', render_scale: 5 }).renderScale, 2);
  assert.equal(G.resolve({ preset: 'high', render_scale: 0.1 }).renderScale, 0.5);
  assert.equal(G.resolve({ preset: 'ultra', render_scale: 1 }).scale, 1.25);
});

test('choosePreset clears overrides and keeps other fields', () => {
  const s = G.choosePreset({ preset: 'high', shadows: 'off', detail: 'plain', render_scale: 1.5, show_fps: true }, 'ultra');
  assert.deepEqual(s, { preset: 'ultra', render_scale: 1.5, show_fps: true });
  assert.equal(G.choosePreset({}, 'nonsense').preset, 'auto');
});

test('adaptive step and pixel ratio', () => {
  assert.equal(G.adaptStep(1, 30), 0.9);
  assert.equal(G.adaptStep(0.6, 40), 0.6);
  assert.equal(G.adaptStep(0.9, 10), 0.95);
  assert.equal(G.adaptStep(1, 10), 1);
  assert.equal(G.adaptStep(0.8, 20), 0.8);
  const low = G.resolve({ preset: 'low' });
  assert.equal(G.pixelRatio(low, 3, 1), 1);
  assert.equal(G.pixelRatio(G.resolve({ preset: 'high' }), 3, 0.5), 1);
});

test('describe and strings in every locale', () => {
  const r = G.resolve({ preset: 'high' });
  assert.match(G.describe(r, [1280, 800], 'en-US'), /medium shadows · lamplight · bloom · grade · 18 fireflies · animated · 1280×800 px/);
  assert.match(G.describe(G.resolve({ preset: 'low' }), null, 'en-US'), /^no shadows · still$/);
  const keys = Object.keys(G.STRINGS['en-US']);
  for (const loc of G.LOCALES) {
    for (const k of keys) assert.notEqual(G.t(loc, k), k, `${loc} missing ${k}`);
  }
  for (const base of ['es-419', 'de-DE', 'fr-FR', 'pt-BR', 'it-IT']) {
    assert.deepEqual(Object.keys(G.STRINGS[base]).sort(), keys.slice().sort(), `${base} key set`);
  }
  assert.equal(G.t('en-GB', 'cat.grade'), 'Colour grade & vignette');
  assert.equal(G.t('fr-CA', 'quality'), 'Qualité');
  assert.equal(G.t('de-DE', 'auto', { tier: 'Hoch' }), 'Automatisch (erkannt: Hoch)');
  assert.equal(G.pickLocale(['pt-PT']), 'pt-BR');
  assert.equal(G.pickLocale(['es-MX']), 'es-419');
  assert.equal(G.pickLocale(['fr-CA']), 'fr-CA');
  assert.equal(G.pickLocale(['ja-JP']), 'en-US');
});
