/* Heartfall — StarHermit platform adapter.
 * Identity, cloud save and sync status for the hosted mode at
 * <slug>.starhermit.com; fully inert offline (no token read → no network,
 * no UI). Browser (window.HFPlatform) / Node (require, for tests).
 *
 * Contract: launch token arrives in the URL fragment #game_token=<jwt>,
 * read once and stripped; JWT payload carries sub (user id) and game_scope
 * (slug — never hard-coded here). Every REST call sends Authorization:
 * Bearer; the scoped token is re-minted every 45 min. The player name comes
 * from GET /api/v1/users/{sub}/profile (never /api/v1/me, never usernames).
 * Progress is mirrored to the single cloud-save slot as a stored zip with a
 * base64 body; the remote copy wins on load, localStorage stays the offline
 * cache. No presence/telemetry/leaderboard-submit calls: the wiki documents
 * none reachable by launch tokens.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root);
  else root.HFPlatform = factory(root);
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
  'use strict';

  // ---------- minimal ZIP (stored entries only, no compression) ----------
  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    var c = 0xffffffff;
    for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function zipStore(name, dataBytes) {
    var enc = new TextEncoder();
    var nameB = enc.encode(name);
    var crc = crc32(dataBytes);
    var out = [];
    var u16 = function (v) { out.push(v & 0xff, (v >> 8) & 0xff); };
    var u32 = function (v) { out.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff); };
    u32(0x04034b50); u16(20); u16(0); u16(0); u16(0); u16(0);
    u32(crc); u32(dataBytes.length); u32(dataBytes.length);
    u16(nameB.length); u16(0);
    var head = new Uint8Array(out);
    var cd = [];
    var c16 = function (v) { cd.push(v & 0xff, (v >> 8) & 0xff); };
    var c32 = function (v) { cd.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff); };
    c32(0x02014b50); c16(20); c16(20); c16(0); c16(0); c16(0); c16(0);
    c32(crc); c32(dataBytes.length); c32(dataBytes.length);
    c16(nameB.length); c16(0); c16(0); c16(0); c16(0); c32(0); c32(0);
    var cdHead = new Uint8Array(cd);
    var cdOff = head.length + nameB.length + dataBytes.length;
    var parts = [head, nameB, dataBytes, cdHead, nameB];
    var eocd = [];
    var e32 = function (v) { eocd.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff); };
    var e16 = function (v) { eocd.push(v & 0xff, (v >> 8) & 0xff); };
    e32(0x06054b50); e16(0); e16(0); e16(1); e16(1);
    e32(cdHead.length + nameB.length); e32(cdOff); e16(0);
    parts.push(new Uint8Array(eocd));
    var total = parts.reduce(function (n, p) { return n + p.length; }, 0);
    var buf = new Uint8Array(total);
    var o = 0;
    for (var i = 0; i < parts.length; i++) { buf.set(parts[i], o); o += parts[i].length; }
    return buf;
  }
  function unzipFirstEntry(zipBytes) {
    var dv = new DataView(zipBytes.buffer, zipBytes.byteOffset, zipBytes.byteLength);
    var off = 0;
    while (off + 30 <= zipBytes.length && dv.getUint32(off, true) === 0x04034b50) {
      var method = dv.getUint16(off + 8, true);
      var size = dv.getUint32(off + 18, true);
      var nameLen = dv.getUint16(off + 26, true);
      var extraLen = dv.getUint16(off + 28, true);
      var dataOff = off + 30 + nameLen + extraLen;
      if (method !== 0) throw new Error('unsupported zip entry');
      return zipBytes.slice(dataOff, dataOff + size);
    }
    throw new Error('bad zip');
  }
  function bytesToBase64(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i += 0x8000) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(s);
  }
  function base64ToBytes(b64) {
    var s = atob(b64);
    var b = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return b;
  }

  // ---------- launch token ----------
  // Fragment read wins; query-param fallbacks exist for local dev only.
  function readLaunchToken(win) {
    var frag = (win.location.hash || '').replace(/^#/, '');
    if (frag) {
      var params = new URLSearchParams(frag);
      var t = params.get('game_token');
      if (t) {
        params.delete('game_token');
        var rest = params.toString();
        var url = win.location.pathname + win.location.search + (rest ? '#' + rest : '');
        try { win.history.replaceState(null, '', url); } catch (_) {}
        return t;
      }
    }
    var q = new URLSearchParams(win.location.search || '');
    return q.get('game_token') || q.get('token') || q.get('launch');
  }

  function decodeJwtPayload(token) {
    var parts = String(token).split('.');
    if (parts.length !== 3) return null;
    try {
      var b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      return JSON.parse(new TextDecoder().decode(base64ToBytes(b64)));
    } catch (_) { return null; }
  }

  // ---------- adapter ----------
  var win = root.window || (typeof window !== 'undefined' ? window : null);
  var REFRESH_MS = 45 * 60 * 1000;
  var RETRY_MS = 60 * 1000;
  var PUSH_DEBOUNCE_MS = 2000;

  var P = {
    hosted: false,          // a launch token was read
    token: null,
    sub: null,
    slug: null,
    nickname: null,
    sync: 'offline',        // offline | syncing | saving | synced | error
    _remoteCb: null,
    _statusCbs: [],
    _latestDoc: null,
    _latestJson: null,
    _pushTimer: null,
    _pushing: null
  };

  function emitStatus() {
    for (var i = 0; i < P._statusCbs.length; i++) {
      try { P._statusCbs[i](P); } catch (_) {}
    }
  }
  function setSync(s) { if (P.sync !== s) { P.sync = s; emitStatus(); } }

  function authHeaders(extra) {
    var h = { 'Content-Type': 'application/json' };
    if (extra) for (var k in extra) h[k] = extra[k];
    if (P.token) h['Authorization'] = 'Bearer ' + P.token;
    return h;
  }

  function fetchProfile() {
    return fetch('/api/v1/users/' + encodeURIComponent(P.sub) + '/profile', { headers: authHeaders() })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (p) {
        if (p && typeof p.nickname === 'string' && p.nickname) P.nickname = p.nickname;
      })
      .catch(function () {})
      .then(function () {
        if (!P.nickname) P.nickname = 'Player ' + String(P.sub).slice(0, 8);
        emitStatus();
      });
  }

  function refreshToken() {
    return fetch('/api/v1/games/' + encodeURIComponent(P.slug) + '/launch-token', {
      method: 'POST',
      headers: authHeaders()
    }).then(function (r) {
      if (!r.ok) throw new Error('refresh http ' + r.status);
      return r.json();
    }).then(function (body) {
      var t = body && (body.token || body.launchToken || body.launch_token);
      if (!t) throw new Error('refresh: no token in body');
      var payload = decodeJwtPayload(t);
      if (!payload || !payload.sub) throw new Error('refresh: bad token');
      P.token = t;
      setSync('synced');
      setTimeout(scheduleRefreshTick, REFRESH_MS);
    }).catch(function () {
      setSync('error');
      setTimeout(refreshToken, RETRY_MS);
    });
  }
  function scheduleRefreshTick() { refreshToken(); }

  function loadRemote() {
    setSync('syncing');
    return fetch('/api/v1/me/cloud-saves/' + encodeURIComponent(P.slug), { headers: authHeaders() })
      .then(function (r) {
        if (r.status === 404) { setSync('synced'); return null; }
        if (!r.ok) throw new Error('load http ' + r.status);
        return r.arrayBuffer();
      })
      .then(function (buf) {
        if (!buf) return null;
        var doc = JSON.parse(new TextDecoder().decode(unzipFirstEntry(new Uint8Array(buf))));
        P._latestDoc = doc;
        P._latestJson = JSON.stringify(doc || null);
        if (P._remoteCb) { try { P._remoteCb(doc); } catch (_) {} }
        setSync('synced');
        return doc;
      })
      .catch(function () { setSync('error'); return null; });
  }

  function putRemote(keepalive) {
    if (!P.hosted || !P.token || P._latestDoc === null || P._latestDoc === undefined) return Promise.resolve(false);
    if (P._pushing) return P._pushing;
    var doc = P._latestDoc;
    var json = P._latestJson;
    var body = JSON.stringify({ dataBase64: bytesToBase64(zipStore('save.json', new TextEncoder().encode(json))) });
    setSync('saving');
    P._pushing = fetch('/api/v1/me/cloud-saves/' + encodeURIComponent(P.slug), {
      method: 'PUT',
      headers: authHeaders(),
      body: body,
      keepalive: !!keepalive
    }).then(function (r) {
      if (!r.ok) throw new Error('put http ' + r.status);
      if (P._latestJson === json) setSync('synced');
      return true;
    }).catch(function () {
      setSync('error');
      return false;
    }).then(function (ok) {
      P._pushing = null;
      return ok;
    });
    return P._pushing;
  }

  function debouncedPush() {
    if (!P.hosted) return;
    clearTimeout(P._pushTimer);
    P._pushTimer = setTimeout(function () { putRemote(false); }, PUSH_DEBOUNCE_MS);
  }

  // Boot: parse the token once, then profile → remote load → refresh loop.
  // Safe to call again (dev console); extra calls are no-ops once hosted.
  P.init = function () {
    if (P.hosted || !win || typeof fetch !== 'function') return P.hosted;
    var token = readLaunchToken(win);
    if (!token) return false;
    var payload = decodeJwtPayload(token);
    if (!payload || !payload.sub) return false;
    P.token = token;
    P.sub = String(payload.sub);
    P.slug = payload.game_scope ? String(payload.game_scope) : null;
    if (!P.slug) return false;
    P.hosted = true;
    P.sync = 'syncing';
    if (typeof win.addEventListener === 'function') {
      var flush = function () { clearTimeout(P._pushTimer); putRemote(true); };
      win.addEventListener('pagehide', flush);
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') flush();
      });
    }
    fetchProfile().then(loadRemote);
    setTimeout(refreshToken, REFRESH_MS);
    emitStatus();
    return true;
  };

  P.onRemote = function (cb) { P._remoteCb = cb; };
  P.onStatus = function (cb) { P._statusCbs.push(cb); };
  // Queue the latest doc; localStorage was already written by the caller.
  P.push = function (doc) {
    P._latestDoc = doc;
    P._latestJson = JSON.stringify(doc || null);
    debouncedPush();
  };
  P.flush = function () { clearTimeout(P._pushTimer); return putRemote(true); };
  P.isHosted = function () { return P.hosted; };

  // Test hooks (Node harness only; not used by the game).
  P._test = {
    zipStore: zipStore,
    unzipFirstEntry: unzipFirstEntry,
    bytesToBase64: bytesToBase64,
    base64ToBytes: base64ToBytes,
    readLaunchToken: readLaunchToken,
    decodeJwtPayload: decodeJwtPayload
  };

  return P;
});
