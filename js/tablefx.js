/* Heartfall — 2D canvas effect passes used by the table and title renderers:
 * GPU probe, lamp/moon lighting, glow sprites (bloom), firefly particles,
 * colour grade + vignette, and detailed card faces. Browser-only; every pass
 * takes a resolved graphics object from HFGfx.resolve(). */
(function () {
'use strict';

/** Unmasked GPU renderer string, or '' when WebGL is unavailable. */
function detectGpu() {
  try {
    var c = document.createElement('canvas');
    var gl = c.getContext('webgl') || c.getContext('experimental-webgl');
    if (!gl) return '';
    var s = '';
    // Firefox already unmasks RENDERER and warns when the debug extension is used.
    if (!/firefox/i.test(navigator.userAgent)) {
      var ext = gl.getExtension('WEBGL_debug_renderer_info');
      if (ext) s = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
    }
    if (!s) s = gl.getParameter(gl.RENDERER);
    return String(s || '');
  } catch (_) { return ''; }
}

function isMobile() {
  try {
    if (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) return true;
    return window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(any-pointer: fine)').matches;
  } catch (_) { return false; }
}

/** Does this browser's 2D canvas support ctx.filter (used by the colour grade)? */
function supportsFilter() {
  try {
    var ctx = document.createElement('canvas').getContext('2d');
    if (!ctx || !('filter' in ctx)) return false;
    ctx.filter = 'contrast(1.1)';
    return ctx.filter === 'contrast(1.1)';
  } catch (_) { return false; }
}

// ---------- glow sprites (cheap bloom: pre-blurred radial sprites drawn additively) ----------
var spriteCache = {};
function glowSprite(rgb) {
  if (spriteCache[rgb]) return spriteCache[rgb];
  var c = document.createElement('canvas');
  c.width = c.height = 64;
  var g = c.getContext('2d');
  var grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(' + rgb + ',1)');
  grd.addColorStop(0.18, 'rgba(' + rgb + ',0.75)');
  grd.addColorStop(0.45, 'rgba(' + rgb + ',0.22)');
  grd.addColorStop(1, 'rgba(' + rgb + ',0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  spriteCache[rgb] = c;
  return c;
}

// ---------- fireflies / moon motes ----------
// Deterministic (seeded) so a static frame and reduced motion look the same every time.
function makeParticles(n, seed) {
  var s = seed >>> 0 || 1;
  function rnd() { s = (s + 0x6D2B79F5) >>> 0; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  var out = [];
  for (var i = 0; i < n; i++) {
    var warm = rnd() < 0.6;
    out.push({
      x: rnd(), y: rnd(), vx: (rnd() - 0.5) * 0.012, vy: -0.004 - rnd() * 0.01,
      phase: rnd() * Math.PI * 2, speed: 0.6 + rnd() * 1.4, size: 1 + rnd() * 1.8,
      rgb: warm ? '255,208,120' : '190,215,255'
    });
  }
  return out;
}

function stepParticles(ps, dt) {
  for (var i = 0; i < ps.length; i++) {
    var p = ps[i];
    p.phase += dt * p.speed;
    p.x += (p.vx + Math.sin(p.phase * 0.7) * 0.006) * dt;
    p.y += p.vy * dt;
    if (p.y < -0.05) { p.y = 1.05; p.x = (p.x + 0.37) % 1; }
    if (p.x < -0.05) p.x = 1.05; else if (p.x > 1.05) p.x = -0.05;
  }
}

function drawParticles(ctx, ps, w, h, R) {
  if (!ps || !ps.length) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (var i = 0; i < ps.length; i++) {
    var p = ps[i];
    var a = 0.35 + 0.65 * Math.max(0, Math.sin(p.phase));   // slow blink
    var x = p.x * w, y = p.y * h;
    if (R.bloom === 'on') {
      var r = p.size * 7;
      ctx.globalAlpha = a * 0.55;
      ctx.drawImage(glowSprite(p.rgb), x - r, y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(' + p.rgb + ',0.95)';
    ctx.beginPath(); ctx.arc(x, y, p.size * 0.8, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ---------- lighting ----------
/** Warm lamp pool (additive) around (lx, ly) with radius r; flicker in [0,1].
 *  `flame` adds a bloom halo on the light source itself (title lamp only). */
function drawLampPool(ctx, lx, ly, r, flicker, R, flame) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  var k = 0.9 + 0.1 * flicker;
  var g = ctx.createRadialGradient(lx, ly, 0, lx, ly, r);
  g.addColorStop(0, 'rgba(255,196,120,' + (0.16 * k) + ')');
  g.addColorStop(0.45, 'rgba(255,170,90,' + (0.07 * k) + ')');
  g.addColorStop(1, 'rgba(255,160,80,0)');
  ctx.fillStyle = g;
  ctx.fillRect(lx - r, ly - r, r * 2, r * 2);
  if (flame && R.bloom === 'on') {
    var br = r * 0.16 * k;
    ctx.globalAlpha = 0.55 * k;
    ctx.drawImage(glowSprite('255,214,150'), lx - br, ly - br, br * 2, br * 2);
  }
  ctx.restore();
}

/** Cool moonlight falling from the upper left (a soft diagonal wash). */
function drawMoonWash(ctx, w, h, t) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  var drift = Math.sin((t || 0) * 0.05) * 0.04;
  var g = ctx.createLinearGradient(0, 0, w * (0.75 + drift), h);
  g.addColorStop(0, 'rgba(120,160,230,0.11)');
  g.addColorStop(0.4, 'rgba(120,160,230,0.03)');
  g.addColorStop(1, 'rgba(120,160,230,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawVignette(ctx, w, h, strength) {
  var r = Math.sqrt(w * w + h * h) / 2;
  var g = ctx.createRadialGradient(w / 2, h / 2, r * 0.45, w / 2, h / 2, r);
  g.addColorStop(0, 'rgba(4,7,16,0)');
  g.addColorStop(1, 'rgba(4,7,16,' + (strength || 0.5) + ')');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** Smooth, non-repeating lamp flicker in [0,1]. */
function flicker(t) {
  return 0.5 + 0.25 * Math.sin(t * 2.1) + 0.15 * Math.sin(t * 5.3 + 1.3) + 0.1 * Math.sin(t * 11.7 + 0.4);
}

// ---------- cards ----------
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * A played card centred on (cx, cy). Plain = the original flat rectangle;
 * detailed = paper gradient, gilt hairline, corner index, clear-coat sheen,
 * a small deterministic tilt. Shadow blur follows the shadows tier.
 */
function drawCard(ctx, cx, cy, label, ink, seedAngle, R) {
  var W = 48, H = 68;
  ctx.save();
  ctx.translate(cx, cy);
  if (R.detail === 'detailed') ctx.rotate(seedAngle);
  if (R.shadowBlur) {
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = R.shadowBlur;
    ctx.shadowOffsetY = Math.round(R.shadowBlur * 0.35);
  }
  if (R.detail === 'detailed') {
    var paper = ctx.createLinearGradient(-W / 2, -H / 2, W / 2, H / 2);
    paper.addColorStop(0, '#fdfbf4'); paper.addColorStop(0.6, '#f3eee2'); paper.addColorStop(1, '#e7e0cf');
    ctx.fillStyle = paper;
    roundRect(ctx, -W / 2, -H / 2, W, H, 5);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(26,35,64,0.35)'; ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(176,138,62,0.45)';
    roundRect(ctx, -W / 2 + 3, -H / 2 + 3, W - 6, H - 6, 3);
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.font = '600 10px system-ui, sans-serif';
    ctx.fillText(label, -W / 2 + 5, -H / 2 + 5);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '26px system-ui, sans-serif';
    ctx.fillText(label, 0, 2);
    // clear-coat sheen across the upper-left
    ctx.save();
    roundRect(ctx, -W / 2, -H / 2, W, H, 5); ctx.clip();
    var sheen = ctx.createLinearGradient(-W / 2, -H / 2, W * 0.1, H * 0.05);
    sheen.addColorStop(0, 'rgba(255,255,255,0.55)'); sheen.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(-W / 2, -H / 2, W, H);
    ctx.restore();
  } else {
    ctx.fillStyle = '#f4f1e8';
    ctx.fillRect(-W / 2, -H / 2, W, H);
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = ink;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '26px system-ui, sans-serif';
    ctx.fillText(label, 0, 0);
  }
  ctx.restore();
}

/** Seat name: pill backdrop when detailed, drop shadow when shadows are on, glow for the active seat with bloom. */
function drawLabel(ctx, text, x, y, active, R) {
  ctx.save();
  ctx.font = '15px system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (R.detail === 'detailed') {
    var tw = ctx.measureText(text).width;
    ctx.fillStyle = active ? 'rgba(40,30,8,0.62)' : 'rgba(8,12,24,0.55)';
    roundRect(ctx, x - tw / 2 - 9, y - 12, tw + 18, 24, 12);
    ctx.fill();
    if (active) { ctx.strokeStyle = 'rgba(247,201,72,0.7)'; ctx.lineWidth = 1; ctx.stroke(); }
  }
  if (active && R.bloom === 'on') {
    ctx.shadowColor = 'rgba(247,201,72,0.85)'; ctx.shadowBlur = 12;
  } else if (R.shadows !== 'off') {
    ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1;
  }
  ctx.fillStyle = active ? '#f7c948' : '#cfd8d2';
  ctx.fillText(text, x, y);
  ctx.restore();
}

window.HFTableFx = {
  detectGpu: detectGpu, isMobile: isMobile, supportsFilter: supportsFilter,
  glowSprite: glowSprite, makeParticles: makeParticles, stepParticles: stepParticles,
  drawParticles: drawParticles, drawLampPool: drawLampPool, drawMoonWash: drawMoonWash,
  drawVignette: drawVignette, flicker: flicker, drawCard: drawCard, drawLabel: drawLabel,
  roundRect: roundRect
};
})();
