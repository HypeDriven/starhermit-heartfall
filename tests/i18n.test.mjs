// Localization coverage: every English key the markup, code and content use is
// translated in every locale (en-GB → en-US, es-ES → es-419, fr-CA → fr-FR
// inherit), placeholders survive, the language follows sh-language.js and
// switches live. Run: node --test tests/i18n.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadTables, codeKeys, htmlKeys, audit, bootI18n } from './i18n-common.mjs';

const ROOT = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');
// The game scripts are UMD; under "type": "module" evaluate them against a shared root.
const gameRoot = {};
for (const f of ['js/rng.js', 'js/content.js', 'js/gfx.js']) new Function('self', 'globalThis', read(f)).call(gameRoot, gameRoot, gameRoot);
const Content = gameRoot.HFContent;

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

function usedKeys() {
  const keys = new Set(contentKeys());
  htmlKeys(read('index.html')).forEach((k) => keys.add(k));
  codeKeys(read('js/game.js')).forEach((k) => keys.add(k));
  return [...keys].filter((k) => /[A-Za-z]/.test(k) && k !== 'HEARTFALL' && k !== 'Heartfall').sort();
}

test('every used key is translated in every locale; placeholders intact', () => {
  assert.deepEqual(audit(loadTables(ROOT, 'js/strings.js', 'HF_STRINGS'), usedKeys()), []);
});

test('the locale follows sh-language and switches live', () => {
  const { I18N, events, doc } = bootI18n(ROOT, { strings: 'js/strings.js', i18n: 'js/i18n.js', global: 'HFI18N', languages: ['de-DE'] });
  assert.equal(I18N.lang, 'de-DE');
  assert.equal(doc.documentElement.lang, 'de-DE');
  assert.equal(I18N.T('Play again'), 'Nochmal spielen');
  I18N.language.setChoice('fr-CA');
  assert.equal(I18N.lang, 'fr-CA');
  assert.equal(events.at(-1), 'fr-CA');
  assert.equal(I18N.T('Your turn — play a card.'), 'À vous — jouez une carte.');
  I18N.language.setChoice('it-IT');
  assert.equal(I18N.T('Round {n}', { n: 3 }), 'Mano 3');
});

test('the Graphics panel strings cover the nine locales', () => {
  const Gfx = gameRoot.HFGfx;
  for (const l of ['en-US', 'en-GB', 'es-419', 'es-ES', 'de-DE', 'fr-FR', 'fr-CA', 'pt-BR', 'it-IT']) assert.ok(Gfx.LOCALES.includes(l), l);
});
