// HFPlatform over the shared StarHermit SDK: token, profile, cloud save,
// settings KV, bindings, invite link and the standalone no-network guarantee.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadScripts, makeBackend, makeToken, plain, settle } from './starhermit-harness.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FILES = [path.join(ROOT, 'starhermit-sdk.js'), path.join(ROOT, 'js/platform.js')];

test('launch token: profile, cloud save game:<slug>, settings, bindings, invite', async () => {
  const be = makeBackend();
  const w = loadScripts(FILES, { hash: '#game_token=' + makeToken(), fetch: be.fetch });
  const P = w.HFPlatform;
  let remote = null;
  P.onRemote((d) => { remote = d; });
  assert.equal(P.init(), true);
  assert.equal(P.isHosted(), true);
  assert.equal(P.slug, 'gid-1');
  assert.equal(w.__replaced, '/');
  await settle();
  assert.equal(P.nickname, 'Al');
  assert.equal(P.sync, 'synced');
  assert.equal(remote, null);                           // empty slot

  P.push({ v: 1, progress: { journey: { j01: true } } });
  await P.flush();
  const put = be.calls.find((c) => c.method === 'PUT');
  assert.equal(put.url, '/api/v1/me/cloud-saves/' + encodeURIComponent('game:gid-1'));
  assert.equal(put.auth, 'Bearer ' + w.StarHermit.token);

  // A fresh launch adopts the remote doc.
  const w2 = loadScripts(FILES, { hash: '#game_token=' + makeToken(), fetch: be.fetch });
  let got = null;
  w2.HFPlatform.onRemote((d) => { got = d; });
  w2.HFPlatform.init();
  await settle();
  assert.deepEqual(plain(got), { v: 1, progress: { journey: { j01: true } } });

  P.patchSettings({ music: 40, sfx: 70 });
  await settle();
  const patch = be.calls.find((c) => c.method === 'PATCH');
  assert.equal(patch.url, '/api/v1/games/gid-1/settings');
  assert.deepEqual(patch.body, { settings: { music: 40, sfx: 70 } });
  assert.equal((await P.getSettings()).music, 40);

  assert.deepEqual(plain(await P.loadBindings({ hint: ['KeyH'] })), { hint: ['KeyH'] });
  assert.ok(P.inviteLink().endsWith('/game-invite/user-123456789/gid-1'));
  assert.equal(await P.copyInvite(), true);
});

test('standalone: no token, no network', async () => {
  let fetched = 0;
  const w = loadScripts(FILES, { fetch: async () => { fetched++; throw new Error('no network'); } });
  const P = w.HFPlatform;
  assert.equal(P.init(), false);
  assert.equal(P.isHosted(), false);
  assert.equal(P.canSignIn(), false);
  P.push({ v: 1 });
  await P.flush();
  P.patchSettings({ music: 1 });
  assert.deepEqual(plain(await P.getSettings()), {});
  assert.deepEqual(plain(await P.loadBindings({ hint: ['KeyH'] })), { hint: ['KeyH'] });
  assert.equal(P.inviteLink(), null);
  await settle();
  assert.equal(fetched, 0);
});

test('hosted without token offers sign-in', () => {
  const w = loadScripts(FILES, { hostname: 'gid-1.starhermit.com' });
  w.HFPlatform.init();
  assert.equal(w.HFPlatform.canSignIn(), true);
});
