/* Heartfall — the save model, pure: the engine client (native/platform.ts)
 * keeps the save in the runtime's save (starhermit:storage `saves`, on the
 * device and in the player's cloud slot); the Node tests run this file as is.
 *
 * - The engine save: { v: 1, progress } — completed lessons, Journey stages,
 *   challenges and dailies, achievements and the match stats (played, win
 *   streak), the browser build's hf-progress-v1 record unchanged.
 * - mergeProgress: two devices' progress after a cloud conflict, as the
 *   browser build's mergeConflictDoc kept both: completions and achievements
 *   are unions, matches played the larger count, this device's win streak.
 * - fromBrowserSave: the browser build's cloud save (the JS SDK's save.json:
 *   the JSON text of { v, settings, progress, savedAt }) → the engine save.
 *   Its settings (volumes, graphics, reduced motion, larger text) are the
 *   runtime's Options now and are not carried over.
 * Never stores credentials or tokens. Classic script / CommonJS: global HFStore.
 */
(function (root) {
  'use strict';

  var SAVE_VERSION = 1;
  var MODES = ['learn', 'journey', 'challenge', 'daily'];

  function defaultProgress() {
    return { learn: {}, journey: {}, challenge: {}, daily: {}, achievements: {}, stats: { played: 0, winStreak: 0 } };
  }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

  /** Any progress-shaped object → a clean progress record (the browser build's loadProgress). */
  function cleanProgress(q) {
    var p = defaultProgress();
    if (!isObj(q)) return p;
    MODES.concat(['achievements']).forEach(function (k) {
      if (!isObj(q[k])) return;
      Object.keys(q[k]).forEach(function (id) { if (q[k][id]) p[k][id] = true; });
    });
    if (isObj(q.stats)) {
      if (typeof q.stats.played === 'number' && isFinite(q.stats.played)) p.stats.played = Math.max(0, Math.floor(q.stats.played));
      if (typeof q.stats.winStreak === 'number' && isFinite(q.stats.winStreak)) p.stats.winStreak = Math.max(0, Math.floor(q.stats.winStreak));
    }
    return p;
  }

  /** The engine save's data → { v: 1, progress }, or null when it is not one. */
  function docFromSave(data) {
    if (!isObj(data) || !(data.v <= SAVE_VERSION) || !isObj(data.progress)) return null;
    return { v: SAVE_VERSION, progress: cleanProgress(data.progress) };
  }
  /** The browser build's cloud save text (save.json) → the engine save, or null when unreadable. */
  function fromBrowserSave(text) {
    if (typeof text !== 'string') return null;
    var d;
    try { d = JSON.parse(text); } catch (e) { return null; }
    if (!isObj(d) || !isObj(d.progress)) return null;
    return { v: SAVE_VERSION, progress: cleanProgress(d.progress) };
  }

  /** Both devices' progress kept: unions, the larger match count, `local`'s win streak. */
  function mergeProgress(local, remote) {
    var a = cleanProgress(local), b = cleanProgress(remote);
    MODES.concat(['achievements']).forEach(function (k) {
      Object.keys(b[k]).forEach(function (id) { a[k][id] = true; });
    });
    a.stats.played = Math.max(a.stats.played, b.stats.played);
    return a;
  }
  /** Two saves' data (engine format): progress merged; null when neither is one. */
  function mergeDocs(local, remote) {
    var x = docFromSave(local), y = docFromSave(remote);
    if (!x || !y) return x || y;
    return { v: SAVE_VERSION, progress: mergeProgress(x.progress, y.progress) };
  }

  var api = {
    SAVE_VERSION: SAVE_VERSION,
    defaultProgress: defaultProgress, cleanProgress: cleanProgress,
    docFromSave: docFromSave, fromBrowserSave: fromBrowserSave,
    mergeProgress: mergeProgress, mergeDocs: mergeDocs
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HFStore = api;
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this));
