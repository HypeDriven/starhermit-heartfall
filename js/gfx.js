/* Heartfall — graphics quality model: presets, per-category overrides, GPU
 * detection, cost summary and the Graphics panel strings. Pure (no DOM, no
 * canvas), UMD so tests run it under Node and the browser gets window.HFGfx. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.HFGfx = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
'use strict';

var PRESETS = ['low', 'balanced', 'high', 'ultra'];

// Category -> allowed tiers, cheapest first. Only effects this 2D table has.
var CATEGORIES = {
  shadows: ['off', 'low', 'medium', 'high'],   // card and label drop shadows
  lighting: ['flat', 'lamp'],                  // warm lamp pool + moonlight wash
  bloom: ['off', 'on'],                        // glow on lamp, active seat, fireflies
  grade: ['off', 'on'],                        // contrast/saturation grade + vignette
  particles: ['off', 'low', 'high'],           // drifting fireflies / moon motes
  background: ['static', 'animated'],          // lamp flicker, drifting motes (rAF loop)
  detail: ['plain', 'detailed']                // card faces: paper, corner index, sheen
};

// Each preset is a row of tiers, a render scale and a device-pixel-ratio cap.
var TABLE = {
  low:      { scale: 1,    dprCap: 1,   shadows: 'off',    lighting: 'flat', bloom: 'off', grade: 'off', particles: 'off',  background: 'static',   detail: 'plain' },
  balanced: { scale: 1,    dprCap: 1.5, shadows: 'low',    lighting: 'lamp', bloom: 'off', grade: 'on',  particles: 'low',  background: 'static',   detail: 'detailed' },
  high:     { scale: 1,    dprCap: 2,   shadows: 'medium', lighting: 'lamp', bloom: 'on',  grade: 'on',  particles: 'low',  background: 'animated', detail: 'detailed' },
  ultra:    { scale: 1.25, dprCap: 2,   shadows: 'high',   lighting: 'lamp', bloom: 'on',  grade: 'on',  particles: 'high', background: 'animated', detail: 'detailed' }
};

// Blur radius (CSS px) of card shadows per tier.
var SHADOW_BLUR = { off: 0, low: 4, medium: 9, high: 16 };
var PARTICLE_COUNT = { off: 0, low: 18, high: 48 };

function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

/** Best preset for this GPU, from the unmasked renderer string. */
function detectPreset(gpu, opts) {
  var g = String(gpu || '').toLowerCase();
  var mobile = !!(opts && opts.mobile);
  var tier;
  if (!g || /swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/.test(g)) tier = 'low';
  else if (/nvidia|geforce|rtx|gtx|quadro|radeon rx|radeon pro|amd radeon(?!.*graphics)|apple m\d/.test(g)) tier = 'high';
  else tier = 'balanced';
  if (mobile && tier === 'high') tier = 'balanced';
  return tier;
}

/**
 * Resolve saved settings into concrete tiers.
 * saved: { preset: 'auto'|preset, render_scale, adaptive, show_fps, <category>: 'preset'|tier }
 */
function resolve(saved, detected) {
  var s = saved || {};
  var auto = PRESETS.indexOf(s.preset) < 0;
  var preset = auto ? (PRESETS.indexOf(detected) >= 0 ? detected : 'balanced') : s.preset;
  var row = TABLE[preset];
  var out = {
    preset: preset,
    auto: auto,
    renderScale: clamp(Number(s.render_scale) || 1, 0.5, 2),
    dprCap: row.dprCap
  };
  out.scale = row.scale * out.renderScale;
  Object.keys(CATEGORIES).forEach(function (cat) {
    out[cat] = CATEGORIES[cat].indexOf(s[cat]) >= 0 ? s[cat] : row[cat];
  });
  out.adaptive = s.adaptive !== false;
  out.showFps = !!s.show_fps;
  out.shadowBlur = SHADOW_BLUR[out.shadows];
  out.particleCount = PARTICLE_COUNT[out.particles];
  // Effects that need the per-frame loop; with none of them the table repaints only on change.
  out.animated = out.background === 'animated' || out.particles !== 'off';
  return out;
}

/** Choosing a preset clears every per-category override. */
function choosePreset(saved, preset) {
  var s = Object.assign({}, saved || {});
  Object.keys(CATEGORIES).forEach(function (cat) { delete s[cat]; });
  s.preset = PRESETS.indexOf(preset) >= 0 ? preset : 'auto';
  return s;
}

/** The preset's own tier for a category (for "From preset (…)" labels). */
function presetTier(preset, cat) {
  return TABLE[preset] ? TABLE[preset][cat] : undefined;
}

/** Old Low/Medium/High quality setting -> preset (migration). 'high' was the
 *  untouched default, so it becomes Auto rather than pinning High. */
function fromLegacyQuality(q) {
  return q === 'low' ? 'low' : q === 'medium' ? 'balanced' : 'auto';
}

// ---------- strings (the game has no i18n system; this panel is localized) ----------
var LOCALES = ['en-US', 'en-GB', 'es-419', 'es-ES', 'de-DE', 'fr-FR', 'fr-CA', 'pt-BR', 'it-IT'];

var S = {
  'en-US': {
    'sh.signIn': "Sign in with StarHermit", 'sh.invite': "Invite a friend", 'sh.copied': "Invite link copied to clipboard.", 'sh.copyFailed': "Could not copy the invite link: {link}", 'sh.signedOut': "Signed out of StarHermit. Progress keeps saving on this device.",
    'lb.posting': "Posting score to the leaderboard…", 'lb.rank': "Leaderboard rank: #{rank}", 'lb.posted': "Score posted to the leaderboard.", 'lb.notPosted': "Score not posted to the leaderboard.",
    graphics: 'Graphics', quality: 'Quality', auto: 'Auto (detected: {tier})',
    low: 'Low', balanced: 'Balanced', high: 'High', ultra: 'Ultra',
    renderScale: 'Render scale', fromPreset: 'From preset ({tier})',
    adaptive: 'Adaptive resolution', showFps: 'Show frame rate',
    'cat.shadows': 'Shadows', 'cat.lighting': 'Lighting', 'cat.bloom': 'Bloom',
    'cat.grade': 'Color grade & vignette', 'cat.particles': 'Fireflies',
    'cat.background': 'Ambient motion', 'cat.detail': 'Card detail',
    'tier.off': 'Off', 'tier.on': 'On', 'tier.low': 'Low', 'tier.medium': 'Medium', 'tier.high': 'High',
    'tier.flat': 'Flat', 'tier.lamp': 'Lamplight', 'tier.static': 'Still', 'tier.animated': 'Animated',
    'tier.plain': 'Plain', 'tier.detailed': 'Detailed',
    'sum.noShadows': 'no shadows', 'sum.shadows': '{tier} shadows', 'sum.lamp': 'lamplight',
    'sum.bloom': 'bloom', 'sum.grade': 'grade', 'sum.particles': '{n} fireflies',
    'sum.animated': 'animated', 'sum.still': 'still',
    gpuUnknown: 'Unknown GPU', postNote: 'Some effects are unavailable in this browser; the table is drawn without them.',
    fps: '{n} fps', fpsStatic: 'still'
  },
  'en-GB': {
    'sh.signIn': "Sign in with StarHermit", 'sh.invite': "Invite a friend", 'sh.copied': "Invite link copied to clipboard.", 'sh.copyFailed': "Could not copy the invite link: {link}", 'sh.signedOut': "Signed out of StarHermit. Progress keeps saving on this device.",
    'lb.posting': "Posting score to the leaderboard…", 'lb.rank': "Leaderboard rank: #{rank}", 'lb.posted': "Score posted to the leaderboard.", 'lb.notPosted': "Score not posted to the leaderboard.",
    'cat.grade': 'Colour grade & vignette'
  },
  'es-419': {
    'sh.signIn': "Iniciar sesión con StarHermit", 'sh.invite': "Invitar a un amigo", 'sh.copied': "Enlace de invitación copiado al portapapeles.", 'sh.copyFailed': "No se pudo copiar el enlace de invitación: {link}", 'sh.signedOut': "Sesión de StarHermit cerrada. El progreso se sigue guardando en este dispositivo.",
    'lb.posting': "Enviando la puntuación a la clasificación…", 'lb.rank': "Puesto en la clasificación: #{rank}", 'lb.posted': "Puntuación enviada a la clasificación.", 'lb.notPosted': "La puntuación no se envió a la clasificación.",
    graphics: 'Gráficos', quality: 'Calidad', auto: 'Automática (detectada: {tier})',
    low: 'Baja', balanced: 'Equilibrada', high: 'Alta', ultra: 'Ultra',
    renderScale: 'Escala de renderizado', fromPreset: 'Del ajuste ({tier})',
    adaptive: 'Resolución adaptativa', showFps: 'Mostrar fotogramas por segundo',
    'cat.shadows': 'Sombras', 'cat.lighting': 'Iluminación', 'cat.bloom': 'Resplandor',
    'cat.grade': 'Corrección de color y viñeta', 'cat.particles': 'Luciérnagas',
    'cat.background': 'Movimiento ambiental', 'cat.detail': 'Detalle de cartas',
    'tier.off': 'No', 'tier.on': 'Sí', 'tier.low': 'Bajas', 'tier.medium': 'Medias', 'tier.high': 'Altas',
    'tier.flat': 'Plana', 'tier.lamp': 'Luz de lámpara', 'tier.static': 'Quieto', 'tier.animated': 'Animado',
    'tier.plain': 'Simple', 'tier.detailed': 'Detallado',
    'sum.noShadows': 'sin sombras', 'sum.shadows': 'sombras {tier}', 'sum.lamp': 'luz de lámpara',
    'sum.bloom': 'resplandor', 'sum.grade': 'color', 'sum.particles': '{n} luciérnagas',
    'sum.animated': 'animado', 'sum.still': 'quieto',
    gpuUnknown: 'GPU desconocida', postNote: 'Algunos efectos no están disponibles en este navegador; la mesa se dibuja sin ellos.',
    fps: '{n} fps', fpsStatic: 'quieto'
  },
  'es-ES': {
    'sh.signIn': "Iniciar sesión con StarHermit", 'sh.invite': "Invitar a un amigo", 'sh.copied': "Enlace de invitación copiado al portapapeles.", 'sh.copyFailed': "No se ha podido copiar el enlace de invitación: {link}", 'sh.signedOut': "Se ha cerrado la sesión de StarHermit. El progreso se sigue guardando en este dispositivo.",
    'lb.posting': "Enviando la puntuación a la clasificación…", 'lb.rank': "Puesto en la clasificación: #{rank}", 'lb.posted': "Puntuación enviada a la clasificación.", 'lb.notPosted': "La puntuación no se envió a la clasificación.",
    'cat.detail': 'Detalle de las cartas', showFps: 'Mostrar imágenes por segundo'
  },
  'de-DE': {
    'sh.signIn': "Mit StarHermit anmelden", 'sh.invite': "Freund einladen", 'sh.copied': "Einladungslink in die Zwischenablage kopiert.", 'sh.copyFailed': "Einladungslink konnte nicht kopiert werden: {link}", 'sh.signedOut': "Von StarHermit abgemeldet. Der Fortschritt wird weiter auf diesem Gerät gespeichert.",
    'lb.posting': "Punktzahl wird an die Bestenliste gesendet …", 'lb.rank': "Platz in der Bestenliste: #{rank}", 'lb.posted': "Punktzahl an die Bestenliste gesendet.", 'lb.notPosted': "Punktzahl wurde nicht an die Bestenliste gesendet.",
    graphics: 'Grafik', quality: 'Qualität', auto: 'Automatisch (erkannt: {tier})',
    low: 'Niedrig', balanced: 'Ausgewogen', high: 'Hoch', ultra: 'Ultra',
    renderScale: 'Renderskalierung', fromPreset: 'Aus Voreinstellung ({tier})',
    adaptive: 'Adaptive Auflösung', showFps: 'Bildrate anzeigen',
    'cat.shadows': 'Schatten', 'cat.lighting': 'Beleuchtung', 'cat.bloom': 'Leuchten',
    'cat.grade': 'Farbkorrektur & Vignette', 'cat.particles': 'Glühwürmchen',
    'cat.background': 'Umgebungsbewegung', 'cat.detail': 'Kartendetails',
    'tier.off': 'Aus', 'tier.on': 'An', 'tier.low': 'Niedrig', 'tier.medium': 'Mittel', 'tier.high': 'Hoch',
    'tier.flat': 'Flach', 'tier.lamp': 'Lampenlicht', 'tier.static': 'Ruhig', 'tier.animated': 'Animiert',
    'tier.plain': 'Schlicht', 'tier.detailed': 'Detailliert',
    'sum.noShadows': 'keine Schatten', 'sum.shadows': 'Schatten {tier}', 'sum.lamp': 'Lampenlicht',
    'sum.bloom': 'Leuchten', 'sum.grade': 'Farbkorrektur', 'sum.particles': '{n} Glühwürmchen',
    'sum.animated': 'animiert', 'sum.still': 'ruhig',
    gpuUnknown: 'Unbekannte GPU', postNote: 'Einige Effekte sind in diesem Browser nicht verfügbar; der Tisch wird ohne sie gezeichnet.',
    fps: '{n} fps', fpsStatic: 'ruhig'
  },
  'fr-FR': {
    'sh.signIn': "Se connecter avec StarHermit", 'sh.invite': "Inviter un ami", 'sh.copied': "Lien d’invitation copié dans le presse-papiers.", 'sh.copyFailed': "Impossible de copier le lien d’invitation : {link}", 'sh.signedOut': "Déconnecté de StarHermit. La progression reste enregistrée sur cet appareil.",
    'lb.posting': "Envoi du score au classement…", 'lb.rank': "Rang au classement : #{rank}", 'lb.posted': "Score envoyé au classement.", 'lb.notPosted': "Score non envoyé au classement.",
    graphics: 'Graphismes', quality: 'Qualité', auto: 'Auto (détectée : {tier})',
    low: 'Basse', balanced: 'Équilibrée', high: 'Haute', ultra: 'Ultra',
    renderScale: 'Échelle de rendu', fromPreset: 'Selon le préréglage ({tier})',
    adaptive: 'Résolution adaptative', showFps: 'Afficher les images par seconde',
    'cat.shadows': 'Ombres', 'cat.lighting': 'Éclairage', 'cat.bloom': 'Halo lumineux',
    'cat.grade': 'Étalonnage et vignette', 'cat.particles': 'Lucioles',
    'cat.background': 'Mouvement d’ambiance', 'cat.detail': 'Détail des cartes',
    'tier.off': 'Non', 'tier.on': 'Oui', 'tier.low': 'Basses', 'tier.medium': 'Moyennes', 'tier.high': 'Hautes',
    'tier.flat': 'Uniforme', 'tier.lamp': 'Lumière de lampe', 'tier.static': 'Immobile', 'tier.animated': 'Animé',
    'tier.plain': 'Simple', 'tier.detailed': 'Détaillé',
    'sum.noShadows': 'sans ombres', 'sum.shadows': 'ombres {tier}', 'sum.lamp': 'lumière de lampe',
    'sum.bloom': 'halo', 'sum.grade': 'étalonnage', 'sum.particles': '{n} lucioles',
    'sum.animated': 'animé', 'sum.still': 'immobile',
    gpuUnknown: 'GPU inconnu', postNote: 'Certains effets ne sont pas disponibles dans ce navigateur ; la table est dessinée sans eux.',
    fps: '{n} i/s', fpsStatic: 'immobile'
  },
  'fr-CA': {
    'sh.signIn': "Se connecter avec StarHermit", 'sh.invite': "Inviter un ami", 'sh.copied': "Lien d’invitation copié dans le presse-papiers.", 'sh.copyFailed': "Impossible de copier le lien d’invitation : {link}", 'sh.signedOut': "Déconnecté de StarHermit. La progression reste enregistrée sur cet appareil.",
    'lb.posting': "Envoi du score au classement…", 'lb.rank': "Rang au classement : #{rank}", 'lb.posted': "Score envoyé au classement.", 'lb.notPosted': "Score non envoyé au classement.",
    'cat.detail': 'Détail des cartes à jouer'
  },
  'pt-BR': {
    'sh.signIn': "Entrar com StarHermit", 'sh.invite': "Convidar um amigo", 'sh.copied': "Link de convite copiado para a área de transferência.", 'sh.copyFailed': "Não foi possível copiar o link de convite: {link}", 'sh.signedOut': "Você saiu do StarHermit. O progresso continua salvo neste dispositivo.",
    'lb.posting': "Enviando a pontuação para o ranking…", 'lb.rank': "Posição no ranking: #{rank}", 'lb.posted': "Pontuação enviada para o ranking.", 'lb.notPosted': "A pontuação não foi enviada para o ranking.",
    graphics: 'Gráficos', quality: 'Qualidade', auto: 'Automática (detectada: {tier})',
    low: 'Baixa', balanced: 'Equilibrada', high: 'Alta', ultra: 'Ultra',
    renderScale: 'Escala de renderização', fromPreset: 'Da predefinição ({tier})',
    adaptive: 'Resolução adaptável', showFps: 'Mostrar taxa de quadros',
    'cat.shadows': 'Sombras', 'cat.lighting': 'Iluminação', 'cat.bloom': 'Brilho',
    'cat.grade': 'Correção de cor e vinheta', 'cat.particles': 'Vaga-lumes',
    'cat.background': 'Movimento ambiente', 'cat.detail': 'Detalhe das cartas',
    'tier.off': 'Não', 'tier.on': 'Sim', 'tier.low': 'Baixas', 'tier.medium': 'Médias', 'tier.high': 'Altas',
    'tier.flat': 'Plana', 'tier.lamp': 'Luz do lampião', 'tier.static': 'Parado', 'tier.animated': 'Animado',
    'tier.plain': 'Simples', 'tier.detailed': 'Detalhado',
    'sum.noShadows': 'sem sombras', 'sum.shadows': 'sombras {tier}', 'sum.lamp': 'luz do lampião',
    'sum.bloom': 'brilho', 'sum.grade': 'cor', 'sum.particles': '{n} vaga-lumes',
    'sum.animated': 'animado', 'sum.still': 'parado',
    gpuUnknown: 'GPU desconhecida', postNote: 'Alguns efeitos não estão disponíveis neste navegador; a mesa é desenhada sem eles.',
    fps: '{n} fps', fpsStatic: 'parado'
  },
  'it-IT': {
    'sh.signIn': "Accedi con StarHermit", 'sh.invite': "Invita un amico", 'sh.copied': "Link di invito copiato negli appunti.", 'sh.copyFailed': "Impossibile copiare il link di invito: {link}", 'sh.signedOut': "Disconnesso da StarHermit. I progressi restano salvati su questo dispositivo.",
    'lb.posting': "Invio del punteggio alla classifica…", 'lb.rank': "Posizione in classifica: #{rank}", 'lb.posted': "Punteggio inviato alla classifica.", 'lb.notPosted': "Punteggio non inviato alla classifica.",
    graphics: 'Grafica', quality: 'Qualità', auto: 'Automatica (rilevata: {tier})',
    low: 'Bassa', balanced: 'Bilanciata', high: 'Alta', ultra: 'Ultra',
    renderScale: 'Scala di rendering', fromPreset: 'Dal preset ({tier})',
    adaptive: 'Risoluzione adattiva', showFps: 'Mostra frequenza fotogrammi',
    'cat.shadows': 'Ombre', 'cat.lighting': 'Illuminazione', 'cat.bloom': 'Bagliore',
    'cat.grade': 'Correzione colore e vignettatura', 'cat.particles': 'Lucciole',
    'cat.background': 'Movimento ambientale', 'cat.detail': 'Dettaglio carte',
    'tier.off': 'No', 'tier.on': 'Sì', 'tier.low': 'Basse', 'tier.medium': 'Medie', 'tier.high': 'Alte',
    'tier.flat': 'Piatta', 'tier.lamp': 'Luce di lampada', 'tier.static': 'Fermo', 'tier.animated': 'Animato',
    'tier.plain': 'Semplice', 'tier.detailed': 'Dettagliato',
    'sum.noShadows': 'senza ombre', 'sum.shadows': 'ombre {tier}', 'sum.lamp': 'luce di lampada',
    'sum.bloom': 'bagliore', 'sum.grade': 'colore', 'sum.particles': '{n} lucciole',
    'sum.animated': 'animato', 'sum.still': 'fermo',
    gpuUnknown: 'GPU sconosciuta', postNote: 'Alcuni effetti non sono disponibili in questo browser; il tavolo viene disegnato senza di essi.',
    fps: '{n} fps', fpsStatic: 'fermo'
  }
};
// Regional variants inherit their base locale.
var PARENT = { 'en-GB': 'en-US', 'es-ES': 'es-419', 'fr-CA': 'fr-FR' };

/** Pick a supported locale from a list of BCP-47 tags (first match wins). */
function pickLocale(tags) {
  var list = [].concat(tags || []).filter(Boolean).map(String);
  for (var i = 0; i < list.length; i++) {
    var tag = list[i].replace('_', '-');
    var exact = LOCALES.filter(function (l) { return l.toLowerCase() === tag.toLowerCase(); })[0];
    if (exact) return exact;
    var lang = tag.split('-')[0].toLowerCase();
    var region = (tag.split('-')[1] || '').toUpperCase();
    if (lang === 'en') return region === 'GB' || region === 'UK' || region === 'IE' || region === 'AU' || region === 'NZ' ? 'en-GB' : 'en-US';
    if (lang === 'es') return region === 'ES' ? 'es-ES' : 'es-419';
    if (lang === 'fr') return region === 'CA' ? 'fr-CA' : 'fr-FR';
    if (lang === 'de') return 'de-DE';
    if (lang === 'pt') return 'pt-BR';
    if (lang === 'it') return 'it-IT';
  }
  return 'en-US';
}

function t(locale, key, vars) {
  var loc = LOCALES.indexOf(locale) >= 0 ? locale : 'en-US';
  var chain = [loc, PARENT[loc], 'en-US'];
  var str;
  for (var i = 0; i < chain.length && str === undefined; i++) str = chain[i] && S[chain[i]][key];
  if (str === undefined) str = key;
  return str.replace(/\{(\w+)\}/g, function (_, k) { return vars && vars[k] !== undefined ? vars[k] : ''; });
}

/** Cost summary, e.g. "medium shadows · lamplight · bloom · grade · 18 fireflies · animated · 1280×800 px". */
function describe(r, pixels, locale) {
  var L = function (k, v) { return t(locale, k, v); };
  var parts = [
    r.shadows === 'off' ? L('sum.noShadows') : L('sum.shadows', { tier: L('tier.' + r.shadows).toLowerCase() }),
    r.lighting === 'lamp' ? L('sum.lamp') : null,
    r.bloom === 'on' ? L('sum.bloom') : null,
    r.grade === 'on' ? L('sum.grade') : null,
    r.particleCount ? L('sum.particles', { n: r.particleCount }) : null,
    r.animated ? L('sum.animated') : L('sum.still'),
    pixels ? pixels[0] + '×' + pixels[1] + ' px' : null
  ];
  return parts.filter(Boolean).join(' · ');
}

/**
 * Adaptive resolution step: feed the average frame time (ms) over ~90 frames,
 * get the new adaptive multiplier. Slow (>26 ms) steps down 0.1 to 0.6; fast (<14 ms) up 0.05 to 1.
 */
function adaptStep(current, avgMs) {
  var c = current || 1;
  if (avgMs > 26) return Math.max(0.6, Math.round((c - 0.1) * 100) / 100);
  if (avgMs < 14) return Math.min(1, Math.round((c + 0.05) * 100) / 100);
  return c;
}

/** Backing-store pixel ratio: min(dpr, preset cap) × preset scale × adaptive. */
function pixelRatio(r, dpr, adaptive) {
  return Math.min(dpr || 1, r.dprCap) * r.scale * (r.adaptive ? (adaptive || 1) : 1);
}

return {
  PRESETS: PRESETS, CATEGORIES: CATEGORIES, LOCALES: LOCALES, STRINGS: S,
  detectPreset: detectPreset, resolve: resolve, choosePreset: choosePreset,
  presetTier: presetTier, fromLegacyQuality: fromLegacyQuality,
  describe: describe, adaptStep: adaptStep, pixelRatio: pixelRatio,
  pickLocale: pickLocale, t: t
};
});
