/* Heartfall — StarHermit platform adapter (window.HFPlatform).
 * A thin layer over the shared SDK (starhermit-sdk.js, window.StarHermit):
 * launch token + renewal, sign-in, nickname/avatar, the cloud-save slot
 * (remote wins on load), the per-player settings KV, keyboard bindings and
 * the invite link. Fully inert without a token: no network, no account UI.
 * See spec.md §12.
 */
(function (root) {
  'use strict';
  var SH = root.StarHermit || null;

  var P = {
    hosted: false,          // signed in (launch token or sign-in return)
    sub: null,
    slug: null,
    nickname: null,
    avatar: null,           // object URL of the account avatar
    sync: 'offline',        // offline | syncing | saving | synced | error
    _remoteCb: null,
    _statusCbs: [],
    _inited: false
  };

  function emitStatus() {
    for (var i = 0; i < P._statusCbs.length; i++) {
      try { P._statusCbs[i](P); } catch (_) {}
    }
  }
  function setSync(s) { if (P.sync !== s) { P.sync = s; emitStatus(); } }

  function adopt() {
    P.hosted = !!(SH && SH.signedIn);
    P.sub = P.hosted ? String(SH.userId) : null;
    P.slug = SH ? SH.slug : null;
    if (!P.hosted) { P.nickname = null; P.avatar = null; P.sync = 'offline'; }
  }

  // Boot: read the token once, then profile → remote load. Idempotent.
  P.init = function () {
    if (P._inited || !SH) return P.hosted;
    P._inited = true;
    SH.init();
    adopt();
    SH.on('auth', function () { var was = P.hosted; adopt(); if (was !== P.hosted) emitStatus(); });
    SH.on('saved', function (ok) { setSync(ok ? 'synced' : 'error'); });
    if (!P.hosted) return false;
    P.sync = 'syncing';
    root.addEventListener('pagehide', function () { P.flush(); });
    root.document.addEventListener('visibilitychange', function () {
      if (root.document.visibilityState === 'hidden') P.flush();
    });
    SH.profile().then(function (p) { P.nickname = p ? p.displayName : null; emitStatus(); });
    SH.avatarUrl().then(function (url) { if (url) { P.avatar = url; emitStatus(); } });
    P._loading = true;
    SH.loadJSON().then(function (doc) {
      P._loading = false;
      var held = P._held; P._held = null;
      if (doc && P._remoteCb) { try { P._remoteCb(doc); } catch (_) {} }
      setSync('synced');
      // A doc held during the load is stale once the remote one is adopted.
      if (held && !doc) P.push(held);
    });
    emitStatus();
    return true;
  };

  P.onRemote = function (cb) { P._remoteCb = cb; };
  P.onStatus = function (cb) { P._statusCbs.push(cb); };
  // Queue the latest doc; localStorage was already written by the caller.
  // Held while the start-up load runs: a doc queued then would still be PUT
  // after the remote one is adopted, over the newer cloud save.
  P.push = function (doc) {
    if (!P.hosted) return;
    if (P._loading) { P._held = doc; return; }
    setSync('saving');
    SH.saveJSON(doc);
  };
  P.flush = function () { return P.hosted ? SH.flushSave(true) : Promise.resolve(false); };
  P.isHosted = function () { return P.hosted; };

  P.canSignIn = function () { return !!(SH && SH.canSignIn()); };
  P.signIn = function () { return !!(SH && SH.signIn()); };
  P.getSettings = function () { return P.hosted ? SH.getSettings() : Promise.resolve({}); };
  P.patchSettings = function (obj) { if (P.hosted) SH.patchSettings(obj); };
  P.loadBindings = function (defaults) {
    return P.hosted ? SH.loadBindings(defaults) : Promise.resolve(JSON.parse(JSON.stringify(defaults)));
  };
  P.inviteLink = function () { return P.hosted ? SH.inviteLink() : null; };
  P.copyInvite = function () {
    var link = P.inviteLink();
    if (!link) return Promise.resolve(false);
    try {
      return root.navigator.clipboard.writeText(link).then(function () { return true; }, function () { return false; });
    } catch (_) { return Promise.resolve(false); }
  };

  root.HFPlatform = P;
})(typeof self !== 'undefined' ? self : this);
