// Localization coverage: every English key the engine client (native/*.ts),
// the content and the rules' hint lines show is translated in every locale
// (en-GB → en-US, es-ES → es-419, fr-CA → fr-FR inherit), placeholders
// survive, no table keeps a key nothing shows, the account lines exist in
// every locale, and js/i18n.js switches locale as native/i18n.ts drives it.
// Run: node --test tests/i18n.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import { loadTables, codeKeys, audit, bootI18n, LOCALES } from './i18n-common.mjs';

const ROOT = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');
// The game scripts are UMD; under "type": "module" evaluate them against a shared root.
const gameRoot = {};
for (const f of ['js/rng.js', 'js/content.js', 'js/platform-strings.js']) new Function('self', 'globalThis', read(f)).call(gameRoot, gameRoot, gameRoot);
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

export function usedKeys() {
  const keys = new Set(contentKeys());
  for (const f of readdirSync(new URL('native/', ROOT)).filter((n) => n.endsWith('.ts'))) {
    codeKeys(read('native/' + f), ['tr', 'N'], []).forEach((k) => keys.add(k));
  }
  return [...keys].filter((k) => /[A-Za-z]/.test(k) && k !== 'HEARTFALL' && k !== 'Heartfall').sort();
}

test('every used key is translated in every locale; placeholders intact; nothing stale', () => {
  assert.deepEqual(audit(loadTables(ROOT, 'js/strings.js', 'HF_STRINGS'), usedKeys()), []);
});

test('the account and leaderboard lines exist in every locale with their placeholders', () => {
  const P = gameRoot.HFPlatformStrings;
  const en = P.platformStrings('en-US');
  for (const loc of LOCALES) {
    const t = P.platformStrings(loc);
    assert.deepEqual(Object.keys(t).sort(), Object.keys(en).sort(), loc);
    for (const k of Object.keys(en)) {
      assert.deepEqual((t[k].match(/\{\w+\}/g) || []).sort(), (en[k].match(/\{\w+\}/g) || []).sort(), `${loc} ${k}`);
    }
  }
  assert.equal(P.fmtPlatform(P.platformStrings('de-DE')['lb.rank'], { rank: 4 }), 'Platz in der Bestenliste: #4');
});

test('the locale switches as the engine client sets it', () => {
  const { I18N } = bootI18n(ROOT, { strings: 'js/strings.js', i18n: 'js/i18n.js', global: 'HFI18N' });
  assert.equal(I18N.lang, 'en-US');
  assert.equal(I18N.setLocale('de-DE'), 'de-DE');
  assert.equal(I18N.T('Play again'), 'Nochmal spielen');
  I18N.setLocale('fr-CA');
  assert.equal(I18N.T('Your turn — play a card.'), 'À vous — jouez une carte.');
  I18N.setLocale('it-IT');
  assert.equal(I18N.T('Round {n}', { n: 3 }), 'Mano 3');
  assert.equal(I18N.setLocale('xx-YY'), 'en-US');
  assert.equal(I18N.T('Round {n}', { n: 2 }), 'Round 2');
});
void vm;
