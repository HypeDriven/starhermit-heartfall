// The save model (js/store.js): the engine save's shape, the browser build's
// cloud save (save.json) migrated into it, and two devices' progress merged
// after a cloud conflict as the browser build's mergeConflictDoc did.
// Run: node --test tests/store.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = {};
new Function('self', 'globalThis', readFileSync(new URL('../js/store.js', import.meta.url), 'utf8')).call(root, root, root);
const S = root.HFStore;
const plain = (v) => JSON.parse(JSON.stringify(v));

test('a fresh progress record', () => {
  assert.deepEqual(plain(S.defaultProgress()), { learn: {}, journey: {}, challenge: {}, daily: {}, achievements: {}, stats: { played: 0, winStreak: 0 } });
});

test('the browser build\'s cloud save migrates; its settings are left to the runtime', () => {
  const old = JSON.stringify({
    v: 1,
    settings: { music: 40, sfx: 70, gfx: { preset: 'high' }, reducedMotion: true, largeText: false },
    progress: { learn: { t1: true }, journey: { j01: true, j02: true }, challenge: { c3: true }, daily: { '2026-10-20': true },
      achievements: { 'first-win': true }, stats: { played: 12, winStreak: 2 } },
    savedAt: '2026-10-20T10:00:00.000Z',
  });
  const doc = S.fromBrowserSave(old);
  assert.deepEqual(plain(doc), { v: 1, progress: { learn: { t1: true }, journey: { j01: true, j02: true }, challenge: { c3: true },
    daily: { '2026-10-20': true }, achievements: { 'first-win': true }, stats: { played: 12, winStreak: 2 } } });
  assert.equal(S.fromBrowserSave('not json'), null);
  assert.equal(S.fromBrowserSave(null), null);
  assert.equal(S.fromBrowserSave(JSON.stringify({ v: 1, settings: {} })), null);
});

test('an engine save is read back and junk is dropped', () => {
  assert.equal(S.docFromSave(null), null);
  assert.equal(S.docFromSave({ v: 2, progress: {} }), null);
  const d = S.docFromSave({ v: 1, progress: { journey: { j01: true, j02: false }, stats: { played: 'x', winStreak: 3 }, extra: 1 } });
  assert.deepEqual(plain(d.progress.journey), { j01: true });
  assert.deepEqual(plain(d.progress.stats), { played: 0, winStreak: 3 });
});

test('a conflict keeps both devices\' progress', () => {
  const a = { learn: { t1: true }, journey: { j01: true }, challenge: {}, daily: { '2026-10-20': true }, achievements: { 'first-win': true }, stats: { played: 5, winStreak: 1 } };
  const b = { learn: { t2: true }, journey: { j02: true }, challenge: { c1: true }, daily: {}, achievements: { 'queen-dodger': true }, stats: { played: 9, winStreak: 4 } };
  const m = S.mergeProgress(a, b);
  assert.deepEqual(plain(m), {
    learn: { t1: true, t2: true }, journey: { j01: true, j02: true }, challenge: { c1: true }, daily: { '2026-10-20': true },
    achievements: { 'first-win': true, 'queen-dodger': true }, stats: { played: 9, winStreak: 1 },
  });
  assert.deepEqual(plain(S.mergeDocs({ v: 1, progress: a }, null)).progress.journey, { j01: true });
  assert.deepEqual(plain(S.mergeDocs({ v: 1, progress: a }, { v: 1, progress: b })).progress.learn, { t1: true, t2: true });
});
