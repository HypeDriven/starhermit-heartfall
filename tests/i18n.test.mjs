// Localization coverage: every English key the engine client (native/*.ts),
// the content and the rules' hint lines show is translated in every locale
// (en-GB → en-US, es-ES → es-419, fr-CA → fr-FR inherit), placeholders
// survive, and no table in assets/strings.json keeps a key nothing shows.
// Run: node --test tests/i18n.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { codeKeys, audit, LOCALES } from './i18n-common.mjs';

const ROOT = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');
// The game scripts are UMD; under "type": "module" evaluate them against a shared root.
const gameRoot = {};
for (const f of ['js/rng.js', 'js/content.js']) new Function('self', 'globalThis', read(f)).call(gameRoot, gameRoot, gameRoot);
const Content = gameRoot.HFContent;
const TABLES = JSON.parse(read('assets/strings.json'));

/** Content shown in play (names, goals, achievements) and the rules' hint lines. */
function contentKeys() {
  const keys = ['You'];
  for (const c of Content.JOURNEY.concat(Content.CHALLENGES, Content.PRACTICE)) keys.push(c.name);
  for (const l of Content.tutorialLessons()) keys.push(l.title);
  keys.push(...Object.values(Content.GOAL_TEXT));
  for (const a of Content.ACHIEVEMENTS) keys.push(a.name);
  for (const line of read('js/rules.js').split('\n').filter((l) => /\bwhy2? = |^\s+: /.test(l))) {
    for (const m of line.matchAll(/'((?:[^'\\]|\\.)*)'/g)) if (/[A-Za-z] /.test(m[1])) keys.push(m[1]);
  }
  return keys;
}

export function usedKeys() {
  const keys = new Set(contentKeys());
  for (const f of readdirSync(new URL('native/', ROOT)).filter((n) => n.endsWith('.ts'))) {
    codeKeys(read('native/' + f), ['tr', 'N'], []).forEach((k) => keys.add(k));
  }
  return [...keys].filter((k) => /[A-Za-z]/.test(k) && k !== 'HEARTFALL' && k !== 'Heartfall').sort();
}

test('every used key is translated in every locale; placeholders intact; nothing stale', () => {
  assert.deepEqual(audit(TABLES, usedKeys()), []);
});

test('the tables hold every locale and the regional differences', () => {
  assert.deepEqual(Object.keys(TABLES).sort(), [...LOCALES].sort());
  assert.equal(TABLES['de-DE']['Play again'], 'Nochmal spielen');
  assert.equal(TABLES['it-IT']['Round {n}'], 'Mano {n}');
  assert.equal(TABLES['en-US']['Round {n}'], 'Round {n}');
});
