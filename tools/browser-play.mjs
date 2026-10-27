// Plays the web package in Chrome on the GPU (the loader index.html that
// `npm run package` writes), past ~/games/tools/engine-web-smoke.mjs's start:
// at a desktop viewport, a phone (DPR 3) and a phone held sideways, by
// keyboard (Enter on the focused Play, Learn and its first lesson), a click
// or tap on the lesson's card (its place worked out as native/screens.ts lays
// out the hand), Enter for the next lesson, H for the hint, Escape for the
// pause menu and Enter to resume; failing on console errors or warnings or
// the runtime's error screen.
//   node tools/browser-play.mjs [GAME_DIR] [--shots OUT_DIR]
// Serves GAME_DIR on loopback (never tests/, tools/ or dot-names), the engine
// itself from wiki.starhermit.com as the loader pins it. playwright-core is
// resolved from GAME_DIR's node_modules or any sibling game's.
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const args = process.argv.slice(2);
const dir = resolve(args[0] ?? '.');
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const shots = opt('--shots', null);
const waitMs = Number(opt('--wait', '8000'));

function findPlaywright() {
  const roots = [dir, resolve(dir, '..'), ...readdirSync(resolve(dir, '..')).map((d) => resolve(dir, '..', d))];
  for (const r of roots) {
    const p = join(r, 'node_modules', 'playwright-core');
    if (existsSync(p)) return createRequire(join(r, 'package.json'))('playwright-core');
  }
  throw new Error('playwright-core not found');
}
const { chromium } = findPlaywright();

const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.ts': 'text/plain',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.glb': 'model/gltf-binary', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };
const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^\/+/, '') || 'index.html';
  const parts = path.split('/');
  if (parts.some((p) => p.startsWith('.') || p === '..') || ['tests', 'tools', 'node_modules'].includes(parts[0])) { res.writeHead(404).end(); return; }
  const file = join(dir, path);
  if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/`;

// Headed Chrome on the machine's GPU (~/games/tools/gpu-chrome.mjs; GPU_ADAPTER=software: headless SwiftShader).
const { launchChrome } = await import(join(dir, '..', 'tools', 'gpu-chrome.mjs'));
const { browser, gpu, close } = await launchChrome(chromium);
console.log(`# chrome on ${gpu}`);
let failed = false;
/** Lesson 1's hand (7♦ 4♣ 6♥, as dealt by its fixture): where a card sits (native/screens.ts hand()). */
function card(vp, i, n) {
  const small = vp.width <= 700, short = vp.width > vp.height && vp.height <= 500;
  const cw = small ? 44 : 74, ch = small ? 62 : 98, overlap = small ? 16 : 18;
  const step = Math.max(8, Math.min(cw - overlap, (vp.width - 16 - cw) / (n - 1)));
  const total = step * (n - 1) + cw;
  return [vp.width / 2 - total / 2 + i * step + Math.min(step, cw) / 2, vp.height - (short ? 2 : 6) - ch / 2];
}
const lesson = (tap) => [['click', 4, 4], ['shot', 'title'], ['key', 'Enter'], ['shot', 'modes'], ['key', 'Enter'], ['shot', 'learn'], ['key', 'Enter'],
  ['wait', 1500], ['shot', 'lesson'], [tap ? 'tapcard' : 'clickcard', 0, 3], ['wait', 1500], ['shot', 'lesson-done'], ['key', 'Enter'], ['wait', 1500],
  ['key', 'KeyH'], ['shot', 'hint'], ['key', 'Escape'], ['shot', 'paused'], ['key', 'Enter'], ['shot', 'resumed']];
const views = [
  { name: 'desktop', viewport: { width: 1366, height: 768 }, steps: lesson(false) },
  { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3, steps: lesson(true) },
  { name: 'landscape', viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3, steps: lesson(true) },
];
for (const v of views) {
  const ctx = await browser.newContext({ viewport: v.viewport, isMobile: v.isMobile, hasTouch: v.hasTouch, deviceScaleFactor: v.deviceScaleFactor });
  const page = await ctx.newPage();
  const problems = [];
  const environment = /^No available adapters\.$|GL Driver Message/;
  page.on('console', (m) => {
    // The platform's clock (serverTime(): GET /api/v1/time on the game's origin)
    // is not served by this loopback host: its 404 is the environment's.
    const platformRoute = /\/api\//.test(m.location()?.url ?? '');
    if ((m.type() === 'error' || m.type() === 'warning') && !environment.test(m.text()) && !platformRoute) problems.push(`${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('response', (r) => { if (r.status() >= 400 && !/\/api\//.test(r.url())) problems.push(`http ${r.status()}: ${r.url()}`); });
  await page.goto(url, { waitUntil: 'load' });
  // The first start compiles shaders: wait for the runtime to run (up to 90 s), not a fixed delay.
  const started = await page.waitForFunction(() => {
    const st = document.documentElement.dataset.starhermit;
    return st === 'running' || st === 'error';
  }, null, { timeout: 90000 }).then(() => true, () => false);
  await page.waitForTimeout(3000); // a key press during start-up can be lost
  for (const [op, a, b] of v.steps) {
    if (op === 'key') { await page.keyboard.down(a); await page.waitForTimeout(120); await page.keyboard.up(a); }
    if (op === 'tap') await page.touchscreen.tap(v.viewport.width * a, v.viewport.height * b);
    if (op === 'click') await page.mouse.click(a, b);
    if (op === 'clickcard') { const [x, y] = card(v.viewport, a, b); await page.mouse.click(x, y); }
    if (op === 'tapcard') { const [x, y] = card(v.viewport, a, b); await page.touchscreen.tap(x, y); }
    if (op === 'wait') { await page.waitForTimeout(a); continue; }
    if (op === 'shot' && shots) { mkdirSync(shots, { recursive: true }); await page.screenshot({ path: join(shots, `${v.name}-${a}.png`) }); }
    await page.waitForTimeout(2500);
  }
  const state = await page.evaluate(() => document.documentElement.dataset.starhermit ?? '');
  const ok = started && state !== 'error' && problems.length === 0;
  failed ||= !ok;
  console.log(`${ok ? 'ok' : 'not ok'} - ${v.name} played: started=${started} state=${state || '-'}`);
  for (const p of problems) console.log(`  ${p}`);
  await ctx.close();
}
await close();
server.close();
process.exit(failed ? 1 : 0);
