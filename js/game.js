/* Heartfall — main client module (browser): UI, session, audio, 3D render. */
(function () {
'use strict';

var Rules = window.HFRules;
var Content = window.HFContent;
var THREE = window.THREE;

// ---------- settings ----------
function loadSettings() {
  var s = { music: 80, sfx: 80, quality: 'high', reducedMotion: false, largeText: false };
  try {
    var raw = localStorage.getItem('hf-settings-v1');
    if (raw) {
      var p = JSON.parse(raw);
      if (typeof p.music === 'number') s.music = p.music;
      if (typeof p.sfx === 'number') s.sfx = p.sfx;
      if (typeof p.quality === 'string' && ['low', 'medium', 'high'].indexOf(p.quality) >= 0) s.quality = p.quality;
      if (typeof p.reducedMotion === 'boolean') s.reducedMotion = p.reducedMotion;
      if (typeof p.largeText === 'boolean') s.largeText = p.largeText;
    }
  } catch (_) {}
  return s;
}
function saveSettings() {
  try { localStorage.setItem('hf-settings-v1', JSON.stringify(settings)); } catch (_) {}
}
var settings = loadSettings();

// ---------- audio (WebAudio): synthesized fallbacks + authored sample one-shots ----------
// Named sound events. Every key has a synthesized fallback below and may be backed
// by an authored clip at sfx/<name>.opus (see sfx/manifest.json).
var SFX_EVENTS = {
  'ui-click': 1, 'ui-back': 1, 'pause': 1,
  'card-select': 1, 'card-play': 1, 'card-pass': 1, 'cards-deal': 1,
  'invalid': 1, 'turn-prompt': 1, 'hint': 1, 'undo': 1,
  'trick-take': 1, 'heart-taken': 1, 'queen-taken': 1,
  'eclipse': 1, 'round-end': 1, 'match-win': 1, 'match-lose': 1
};

var actx = null;
var fxBus = null;          // effects bus: all SFX (samples and synth) route through here
var audioUnlocked = false; // set by the first user gesture
var sampleCache = {};      // name -> { state: 'loading'|'ready'|'failed', buffer: AudioBuffer|null }

function sfxGainValue() { return Math.max(0, Math.min(1, settings.sfx / 100)); }

function ensureCtx() {
  if (!actx) {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    actx = new AC();
    fxBus = actx.createGain();
    fxBus.gain.value = sfxGainValue();
    fxBus.connect(actx.destination);
  }
  return actx;
}

function unlockAudio() {
  var c = ensureCtx();
  if (!c) return;
  if (c.state === 'suspended') { try { c.resume(); } catch (_) {} }
  audioUnlocked = true;
}

function setSfxVolume(v) {
  settings.sfx = v;
  if (fxBus) fxBus.gain.value = sfxGainValue();
}

function beep(freq, dur, gain, type, delay) {
  try {
    var c = ensureCtx(); if (!c || !fxBus) return;
    var t = c.currentTime + (delay || 0);
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(fxBus);
    o.start(t); o.stop(t + dur);
  } catch (_) {}
}

function noiseBurst(dur, gain, freq, delay) {
  try {
    var c = ensureCtx(); if (!c || !fxBus) return;
    var t = c.currentTime + (delay || 0);
    var len = Math.max(1, Math.floor(c.sampleRate * dur));
    var buf = c.createBuffer(1, len, c.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = c.createBufferSource(); src.buffer = buf;
    var f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq;
    var g = c.createGain(); g.gain.value = gain;
    src.connect(f).connect(g).connect(fxBus);
    src.start(t);
  } catch (_) {}
}

// Synthesized fallback per event — plays while a sample is loading or if it is
// missing/undecodable, and always before the audio unlock.
function synthEvent(name) {
  switch (name) {
    case 'ui-click':   beep(660, 0.07, 0.18, 'triangle'); break;
    case 'ui-back':    beep(440, 0.08, 0.15, 'triangle'); beep(330, 0.09, 0.12, 'triangle', 0.07); break;
    case 'pause':      beep(220, 0.18, 0.16, 'sine'); break;
    case 'card-select': beep(880, 0.05, 0.14, 'triangle'); break;
    case 'card-play':  noiseBurst(0.06, 0.30, 2400); beep(160, 0.10, 0.14, 'sine', 0.01); break;
    case 'card-pass':  noiseBurst(0.22, 0.20, 1600); break;
    case 'cards-deal': for (var i = 0; i < 4; i++) noiseBurst(0.05, 0.22, 2600, i * 0.12); break;
    case 'invalid':    beep(180, 0.16, 0.20, 'square'); beep(150, 0.18, 0.16, 'square', 0.12); break;
    case 'turn-prompt': beep(740, 0.10, 0.13, 'sine'); beep(990, 0.14, 0.11, 'sine', 0.11); break;
    case 'hint':       beep(1180, 0.16, 0.10, 'sine'); beep(1560, 0.20, 0.08, 'sine', 0.10); break;
    case 'undo':       beep(520, 0.08, 0.13, 'triangle'); beep(390, 0.10, 0.11, 'triangle', 0.08); break;
    case 'trick-take': noiseBurst(0.14, 0.22, 1400); beep(330, 0.12, 0.13, 'triangle', 0.12); beep(262, 0.14, 0.12, 'triangle', 0.22); break;
    case 'heart-taken': beep(196, 0.20, 0.16, 'sine'); beep(147, 0.24, 0.12, 'sine', 0.10); break;
    case 'queen-taken': beep(110, 0.35, 0.18, 'sine'); beep(82, 0.45, 0.14, 'sine', 0.18); break;
    case 'eclipse':    beep(392, 0.14, 0.14, 'triangle'); beep(494, 0.14, 0.14, 'triangle', 0.12); beep(587, 0.14, 0.14, 'triangle', 0.24); beep(784, 0.30, 0.16, 'triangle', 0.36); break;
    case 'round-end':  beep(523, 0.12, 0.14, 'triangle'); beep(659, 0.12, 0.13, 'triangle', 0.12); beep(784, 0.22, 0.14, 'triangle', 0.24); break;
    case 'match-win':  beep(523, 0.14, 0.15, 'triangle'); beep(659, 0.14, 0.15, 'triangle', 0.13); beep(784, 0.14, 0.15, 'triangle', 0.26); beep(1047, 0.34, 0.16, 'triangle', 0.39); break;
    case 'match-lose': beep(392, 0.18, 0.14, 'sine'); beep(311, 0.20, 0.13, 'sine', 0.16); beep(233, 0.34, 0.13, 'sine', 0.34); break;
  }
}

function fetchSample(name) {
  var entry = sampleCache[name];
  if (entry) return entry;
  entry = sampleCache[name] = { state: 'loading', buffer: null };
  var c = ensureCtx();
  if (!c || typeof fetch !== 'function') { entry.state = 'failed'; return entry; }
  fetch('sfx/' + name + '.opus')
    .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.arrayBuffer(); })
    .then(function (ab) { return c.decodeAudioData(ab); })
    .then(function (buf) { entry.state = 'ready'; entry.buffer = buf; })
    .catch(function () { entry.state = 'failed'; });
  return entry;
}

function playSample(name) {
  var entry = sampleCache[name];
  if (!entry || entry.state !== 'ready' || !entry.buffer) return false;
  var c = ensureCtx(); if (!c || !fxBus) return false;
  try {
    var src = c.createBufferSource();
    src.buffer = entry.buffer;
    src.connect(fxBus);
    src.start();
    return true;
  } catch (_) { return false; }
}

// Public dispatcher: play the named event. Prefers the authored sample once it is
// decoded; otherwise kicks off a lazy load and runs the synthesized fallback.
function playSfx(name) {
  if (!SFX_EVENTS[name]) return;
  if (audioUnlocked) {
    if (playSample(name)) return;
    fetchSample(name);
  }
  synthEvent(name);
}

// ---------- DOM helpers ----------
function $(id) { return document.getElementById(id); }
function showScreen(name) {
  var screens = ['title', 'modes', 'learn', 'journey', 'daily', 'practice', 'challenge', 'settings', 'help', 'play'];
  for (var i = 0; i < screens.length; i++) {
    $('screen-' + screens[i]).classList.toggle('hidden', screens[i] !== name);
  }
}

// ---------- list rendering ----------
function renderLearn() {
  var ul = $('learn-list'); ul.innerHTML='';
  Content.tutorialLessons().forEach(function (l) {
    var li = document.createElement('li'); li.textContent=l.title; ul.appendChild(li);
  });
}
function stageStatus(level, doneIds) {
  if (!doneIds || !doneIds[level.id]) return '—';
  return level.mastery ? 'MASTERY' : (level.goal.type === 'score-under' ? 'SCORE UNDER' : '');
}
function renderJourney() {
  var ul = $('journey-list'); ul.innerHTML='';
  Content.JOURNEY.forEach(function (lv) {
    var li=document.createElement('li'); li.textContent=lv.name; ul.appendChild(li);
    if (!done || !done.journey || done.journey[lv.id]) return;
    var d=document.createElement('span'); d.className='dim'; d.textContent=stageStatus(lv,null); li.appendChild(d);
  });
}
function renderDaily() {
  var ul=$('daily-list'); ul.innerHTML='';
  for (var i=0;i<7;i++){ void Content.dailyConfig(Content.utcDateString(Date.now())); var li=document.createElement('li'); li.textContent='Daily'; ul.appendChild(li);}
}
function renderPractice() {
  var ul=$('practice-list'); ul.innerHTML='';
  Content.PRACTICE.forEach(function (p){ var li=document.createElement('li'); li.textContent=p.name; ul.appendChild(li);});
}
function renderChallenge() {
  var ul=$('challenge-list'); ul.innerHTML='';
  Content.CHALLENGES.forEach(function (c){ var li=document.createElement('li'); li.textContent=c.name; ul.appendChild(li);});
}

// ---------- help text ----------
var HELP_TEXT = [
  'Heartfall is a trick-taking card game. Pass cards, follow suit, avoid penalty hearts and the Nightshade Queen (Q♠) — or capture every penalty for an Eclipse.',
  '',
  'Lowest match score wins once anyone reaches the threshold; full-penalty capture applies the declared room rule.',
  '',
  'Results show a component breakdown rather than one unexplained total. Ties use, in order: primary objective completion, fewer invalid actions, lower authoritative elapsed time, then stable session identifier.'
];

// ---------- play / session state (populated by startPlay) ----------
var S = null; // { mode, id, level }
var sess = null; // { game, passSel:[], hintCard:null, undoStack:[] , resultsShown:false }

function seatLabel(seat){ return Content.seatName(seat); }
function cardLabel(id){ return Rules.cardName(id); }
function isPenaltyCard(id){ return Rules.isPenalty(id); }

// ---------- 3D scene (render.js provides; stub here if unavailable) ----------
var Render = window.HFRender || null;

function startPlay(mode, id) {
  var level=levelFor(mode,id); S={mode:mode,id:id,level:level}; sess={game:Rules.createGame(level.cfg),passSel:[],hintCard:null,undoStack:[]}; showScreen('play');
}
function levelFor(mode,id){
  if (mode==='learn') return Content.tutorialLessons()[id];
  if (mode==='journey') return Content.JOURNEY[id];
  if (mode==='daily') return Content.dailyConfig(Content.utcDateString(Date.now()));
  if (mode==='practice') return Content.PRACTICE.find(function(p){return p.id===id;});
  if (mode==='challenge') return Content.CHALLENGES.find(function(c){return c.id===id;});
  throw new Error('unknown mode '+mode);
}

// ---------- actions / HUD are wired in init() below ----------
function nav(target){ showScreen(target); }

// ---------- audio wiring for the existing UI ----------
// Gesture unlock: browsers require a user gesture before AudioContext output.
window.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('keydown', unlockAudio, { once: true });

function wireClick(sel, evt) {
  var els = document.querySelectorAll(sel);
  for (var i = 0; i < els.length; i++) {
    els[i].addEventListener('click', function () { playSfx(evt); });
  }
}
wireClick('#screen-title button, #screen-modes button, #pause-overlay button', 'ui-click');
wireClick('[data-nav="back"]', 'ui-back');

// Card selection feedback on the existing hand element (cards are added per game).
var handEl = $('hand');
if (handEl) {
  handEl.addEventListener('click', function (e) {
    if (e.target && e.target.closest && e.target.closest('li')) playSfx('card-select');
  });
}

// Settings sliders drive the live settings and the effects bus volume.
var sfxSlider = $('set-sfx');
if (sfxSlider) {
  sfxSlider.value = settings.sfx;
  sfxSlider.addEventListener('input', function () {
    setSfxVolume(Number(sfxSlider.value)); saveSettings();
  });
}
var musicSlider = $('set-music');
if (musicSlider) {
  musicSlider.value = settings.music;
  musicSlider.addEventListener('input', function () {
    settings.music = Number(musicSlider.value); saveSettings();
  });
}

window.HFGame = {
  settings: loadSettings,
  audio: {
    play: playSfx,
    unlock: unlockAudio,
    setSfxVolume: setSfxVolume,
    events: Object.keys(SFX_EVENTS)
  }
};

})();
