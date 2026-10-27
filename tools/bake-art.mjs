// Bakes assets/table-graded.webp: the table plate (assets/table.webp) through
// the browser build's colour grade (canvas filter contrast(1.08) saturate(1.15)
// brightness(1.03), js/game.js paintBase), which the engine's canvas has no
// filter for. Runs once in Chrome on the GPU (~/games/tools/gpu-chrome.mjs);
// re-run only when the plate changes.
//   node tools/bake-art.mjs
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(join(root, 'package.json'))('playwright-core');
const { launchChrome } = await import(join(root, '..', 'tools', 'gpu-chrome.mjs'));
const { browser, close } = await launchChrome(chromium);
try {
  const page = await browser.newPage();
  const src = 'data:image/webp;base64,' + readFileSync(join(root, 'assets/table.webp')).toString('base64');
  const out = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d');
    ctx.filter = 'contrast(1.08) saturate(1.15) brightness(1.03)';
    ctx.drawImage(img, 0, 0);
    return c.toDataURL('image/webp', 0.9);
  }, src);
  writeFileSync(join(root, 'assets/table-graded.webp'), Buffer.from(out.split(',')[1], 'base64'));
  console.log('wrote assets/table-graded.webp');
} finally { await close(); }
