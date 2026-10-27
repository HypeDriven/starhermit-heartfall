/* Heartfall — the account and leaderboard lines (Sign in, Invite, the copy
 * confirmations, the signed-out notice and the results card's leaderboard
 * line) in the nine locales, as the browser build's js/gfx.js held them.
 * Classic script / CommonJS: global HFPlatformStrings = { platformStrings(lang), fmtPlatform(s, vars) }.
 */
(function (root) {
  'use strict';
  var TABLE = {
    "en-US": {
      "sh.signIn": "Sign in with StarHermit",
      "sh.invite": "Invite a friend",
      "sh.copied": "Invite link copied to clipboard.",
      "sh.copyFailed": "Could not copy the invite link: {link}",
      "sh.signedOut": "Signed out of StarHermit. Progress keeps saving on this device.",
      "lb.posting": "Posting score to the leaderboard…",
      "lb.rank": "Leaderboard rank: #{rank}",
      "lb.posted": "Score posted to the leaderboard.",
      "lb.notPosted": "Score not posted to the leaderboard."
    },
    "en-GB": {
      "sh.signIn": "Sign in with StarHermit",
      "sh.invite": "Invite a friend",
      "sh.copied": "Invite link copied to clipboard.",
      "sh.copyFailed": "Could not copy the invite link: {link}",
      "sh.signedOut": "Signed out of StarHermit. Progress keeps saving on this device.",
      "lb.posting": "Posting score to the leaderboard…",
      "lb.rank": "Leaderboard rank: #{rank}",
      "lb.posted": "Score posted to the leaderboard.",
      "lb.notPosted": "Score not posted to the leaderboard."
    },
    "es-419": {
      "sh.signIn": "Iniciar sesión con StarHermit",
      "sh.invite": "Invitar a un amigo",
      "sh.copied": "Enlace de invitación copiado al portapapeles.",
      "sh.copyFailed": "No se pudo copiar el enlace de invitación: {link}",
      "sh.signedOut": "Sesión de StarHermit cerrada. El progreso se sigue guardando en este dispositivo.",
      "lb.posting": "Enviando la puntuación a la clasificación…",
      "lb.rank": "Puesto en la clasificación: #{rank}",
      "lb.posted": "Puntuación enviada a la clasificación.",
      "lb.notPosted": "La puntuación no se envió a la clasificación."
    },
    "es-ES": {
      "sh.signIn": "Iniciar sesión con StarHermit",
      "sh.invite": "Invitar a un amigo",
      "sh.copied": "Enlace de invitación copiado al portapapeles.",
      "sh.copyFailed": "No se ha podido copiar el enlace de invitación: {link}",
      "sh.signedOut": "Se ha cerrado la sesión de StarHermit. El progreso se sigue guardando en este dispositivo.",
      "lb.posting": "Enviando la puntuación a la clasificación…",
      "lb.rank": "Puesto en la clasificación: #{rank}",
      "lb.posted": "Puntuación enviada a la clasificación.",
      "lb.notPosted": "La puntuación no se envió a la clasificación."
    },
    "de-DE": {
      "sh.signIn": "Mit StarHermit anmelden",
      "sh.invite": "Freund einladen",
      "sh.copied": "Einladungslink in die Zwischenablage kopiert.",
      "sh.copyFailed": "Einladungslink konnte nicht kopiert werden: {link}",
      "sh.signedOut": "Von StarHermit abgemeldet. Der Fortschritt wird weiter auf diesem Gerät gespeichert.",
      "lb.posting": "Punktzahl wird an die Bestenliste gesendet …",
      "lb.rank": "Platz in der Bestenliste: #{rank}",
      "lb.posted": "Punktzahl an die Bestenliste gesendet.",
      "lb.notPosted": "Punktzahl wurde nicht an die Bestenliste gesendet."
    },
    "fr-FR": {
      "sh.signIn": "Se connecter avec StarHermit",
      "sh.invite": "Inviter un ami",
      "sh.copied": "Lien d’invitation copié dans le presse-papiers.",
      "sh.copyFailed": "Impossible de copier le lien d’invitation : {link}",
      "sh.signedOut": "Déconnecté de StarHermit. La progression reste enregistrée sur cet appareil.",
      "lb.posting": "Envoi du score au classement…",
      "lb.rank": "Rang au classement : #{rank}",
      "lb.posted": "Score envoyé au classement.",
      "lb.notPosted": "Score non envoyé au classement."
    },
    "fr-CA": {
      "sh.signIn": "Se connecter avec StarHermit",
      "sh.invite": "Inviter un ami",
      "sh.copied": "Lien d’invitation copié dans le presse-papiers.",
      "sh.copyFailed": "Impossible de copier le lien d’invitation : {link}",
      "sh.signedOut": "Déconnecté de StarHermit. La progression reste enregistrée sur cet appareil.",
      "lb.posting": "Envoi du score au classement…",
      "lb.rank": "Rang au classement : #{rank}",
      "lb.posted": "Score envoyé au classement.",
      "lb.notPosted": "Score non envoyé au classement."
    },
    "pt-BR": {
      "sh.signIn": "Entrar com StarHermit",
      "sh.invite": "Convidar um amigo",
      "sh.copied": "Link de convite copiado para a área de transferência.",
      "sh.copyFailed": "Não foi possível copiar o link de convite: {link}",
      "sh.signedOut": "Você saiu do StarHermit. O progresso continua salvo neste dispositivo.",
      "lb.posting": "Enviando a pontuação para o ranking…",
      "lb.rank": "Posição no ranking: #{rank}",
      "lb.posted": "Pontuação enviada para o ranking.",
      "lb.notPosted": "A pontuação não foi enviada para o ranking."
    },
    "it-IT": {
      "sh.signIn": "Accedi con StarHermit",
      "sh.invite": "Invita un amico",
      "sh.copied": "Link di invito copiato negli appunti.",
      "sh.copyFailed": "Impossibile copiare il link di invito: {link}",
      "sh.signedOut": "Disconnesso da StarHermit. I progressi restano salvati su questo dispositivo.",
      "lb.posting": "Invio del punteggio alla classifica…",
      "lb.rank": "Posizione in classifica: #{rank}",
      "lb.posted": "Punteggio inviato alla classifica.",
      "lb.notPosted": "Punteggio non inviato alla classifica."
    }
  };
  var PARENT = { 'en-GB': 'en-US', 'es-ES': 'es-419', 'fr-CA': 'fr-FR' };
  function platformStrings(lang) {
    var out = {}, chain = [];
    for (var l = TABLE[lang] ? lang : 'en-US'; l; l = PARENT[l]) chain.unshift(l);
    if (chain[0] !== 'en-US') chain.unshift('en-US');
    chain.forEach(function (l) { var t = TABLE[l] || {}; for (var k in t) out[k] = t[k]; });
    return out;
  }
  function fmtPlatform(s, vars) {
    return String(s).replace(/\{(\w+)\}/g, function (m, k) { return vars && Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m; });
  }
  var api = { platformStrings: platformStrings, fmtPlatform: fmtPlatform, TABLE: TABLE };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HFPlatformStrings = api;
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this));
