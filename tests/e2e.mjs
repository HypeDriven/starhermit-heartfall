/**
 * Heartfall — end-to-end QA playthrough (dev only, not shipped).
 *
 * Drives the real visible UI in headless Chrome (playwright-core + system
 * Chrome) through the full product flow, twice: desktop 1280x800 and mobile
 * 390x844 (touch). The game is fully playable offline/solo (practice AI), so
 * no StarHermit backend is required and the whole loop is covered:
 *
 *   load → title → Play → Modes → Journey (40 stages) → stage 1 match:
 *     pass-phase card selection + Pass button → play-phase card clicks
 *     (only non-dimmed/legal cards) → pause via Escape → Resume → pause →
 *     Settings (quality change persisted) → back → play to the results
 *     overlay with score breakdown → Play again restarts → pause → Leave
 *     to title.
 *   Then Practice (Casual): Hint toast, pass, Undo (restores pre-pass
 *   state), re-pass, play a card, pause → Leave.
 *   Then title sub-menus: Daily Challenge list and Journey list, back.
 *   Then Learn: lesson 1 applies its fixture (3-card hand, one legal
 *   card), completes on the forced play, persists progress, and the
 *   Next lesson button starts lesson 2.
 *
 * Game state is read only through the visible DOM (#objective live text,
 * hand item .dim/.sel classes, overlay visibility) for synchronization;
 * every action is a real click/key press on visible elements.
 *
 * Run: npm run test:e2e
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SHOT = (stage, vp) => `/tmp/heartfall-e2e-${stage}-${vp}.png`;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.glb': 'model/gltf-binary',
  '.woff2': 'font/woff2',
  '.ts': 'video/mp2t',
};

const browserNoise = /GL Driver Message|GPU stall due to ReadPixels|Automatic fallback to software WebGL|EnableWebGLDeveloperExtensions/i;

const server = createServer(async (req, res) => {
  try {
    let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    if (urlPath === '/') urlPath = '/index.html';
    const filePath = join(ROOT, normalize(urlPath));
    if (!filePath.startsWith(ROOT)) throw new Error('bad path');
    const data = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const BASE = `http://127.0.0.1:${server.address().port}`;

const step = async (name, fn) => {
  await fn();
  console.log(`ok - ${name}`);
};

// Snapshot of the visible play state, read from the DOM the player sees.
function readPlayState(page) {
  return page.evaluate(() => {
    const obj = document.getElementById('objective')?.textContent || '';
    const passBtn = [...document.querySelectorAll('#actions button')]
      .find((b) => /^Pass /.test(b.textContent));
    return {
      obj,
      passLabel: passBtn ? passBtn.textContent.trim() : null,
      resultsVisible: !document.getElementById('results-overlay').classList.contains('hidden'),
      playScreenVisible: !document.getElementById('screen-play').classList.contains('hidden'),
      handSize: document.querySelectorAll('#hand li.card').length,
    };
  });
}

async function runPass(vpName, contextOptions) {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !browserNoise.test(m.text())) errors.push(`console: ${m.text()}`);
  });

  try {
    await step(`${vpName}: load + title visible`, async () => {
      await page.goto(BASE, { waitUntil: 'load' });
      await page.waitForSelector('#screen-title:not(.hidden)', { timeout: 10000 });
      const title = await page.textContent('.game-title');
      if (!/HEARTFALL/.test(title)) throw new Error('title missing: ' + title);
      await page.screenshot({ path: SHOT('title', vpName) });
    });

    await step(`${vpName}: modes → journey list of 40 stages`, async () => {
      await page.click('#btn-play');
      await page.waitForSelector('#screen-modes:not(.hidden)');
      await page.click('[data-mode="journey"]');
      await page.waitForSelector('#screen-journey:not(.hidden)');
      const stages = await page.locator('#journey-list li').count();
      if (stages !== 40) throw new Error(`expected 40 journey stages, got ${stages}`);
      await page.screenshot({ path: SHOT('journey', vpName) });
    });

    await step(`${vpName}: journey stage 1 starts a match`, async () => {
      await page.locator('#journey-list li').first().click();
      await page.waitForSelector('#screen-play:not(.hidden)');
      await page.waitForSelector('#hud-bottom:not(.hidden)');
      await page.waitForFunction(() => document.querySelectorAll('#hand li.card').length > 0);
      await page.screenshot({ path: SHOT('match-start', vpName) });
    });

    await step(`${vpName}: play full match via pass/play UI until results`, async () => {
      let didPauseTest = false;
      let shotPass = false;
      let shotPlay = false;
      const deadline = Date.now() + 300000;
      for (;;) {
        const st = await readPlayState(page);
        if (st.resultsVisible) break;
        if (Date.now() > deadline) throw new Error('match did not finish within 5 minutes; last objective: ' + st.obj);

        if (st.passLabel) {
          // pass phase: select cards until the Pass button reads full, then commit
          const m = st.passLabel.match(/Pass (\d+)\/(\d+)/);
          if (!shotPass) { await page.screenshot({ path: SHOT('pass-phase', vpName) }); shotPass = true; }
          if (m && m[1] === m[2]) {
            await page.locator('#actions button', { hasText: /^Pass / }).click();
          } else {
            await page.locator('#hand li.card:not(.sel)').first().click();
          }
          continue;
        }

        if (st.obj.includes('Your turn')) {
          if (!didPauseTest) {
            didPauseTest = true;
            // pause → resume, then pause → settings → back, all through visible UI
            await page.keyboard.press('Escape');
            await page.waitForSelector('#pause-overlay:not(.hidden)');
            await page.screenshot({ path: SHOT('pause', vpName) });
            await page.click('#pause-overlay [data-act="resume"]');
            await page.waitForSelector('#pause-overlay.hidden', { state: 'attached' });
            await page.keyboard.press('Escape');
            await page.waitForSelector('#pause-overlay:not(.hidden)');
            await page.click('#pause-overlay [data-act="settings"]');
            await page.waitForSelector('#screen-settings:not(.hidden)');
            await page.click('[data-q="low"]');
            const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('hf-settings-v1') || '{}'));
            if (saved.quality !== 'low') throw new Error('quality setting not persisted');
            await page.screenshot({ path: SHOT('settings', vpName) });
            await page.click('#screen-settings [data-nav="back"]');
            await page.waitForSelector('#screen-play:not(.hidden)');
            console.log('ok - ' + vpName + ': pause/resume + settings open/close mid-match');
          }
          if (!shotPlay) { await page.screenshot({ path: SHOT('play-turn', vpName) }); shotPlay = true; }
          await page.locator('#hand li.card:not(.dim)').first().click();
          continue;
        }

        await page.waitForTimeout(300); // AI seats are thinking
      }
      if (!didPauseTest) throw new Error('never got a human turn to run the pause test');
    });

    await step(`${vpName}: results overlay with score breakdown`, async () => {
      await page.waitForSelector('#results-overlay:not(.hidden)');
      const head = await page.textContent('#results-overlay h2');
      const rows = await page.locator('#results-overlay .score-row').count();
      if (!head || rows < 2) throw new Error(`bad results: head="${head}" rows=${rows}`);
      console.log(`  headline: ${head.trim()} (${rows} score rows)`);
      await page.screenshot({ path: SHOT('results', vpName) });
      // "Play again" must restart the same level; then leave via pause.
      await page.click('#results-overlay [data-act="again"]');
      await page.waitForSelector('#results-overlay.hidden', { state: 'attached' });
      await page.waitForFunction(() => document.querySelectorAll('#hand li.card').length > 0);
      await page.keyboard.press('Escape');
      await page.waitForSelector('#pause-overlay:not(.hidden)');
      await page.click('#pause-overlay [data-act="leave"]');
      await page.waitForSelector('#screen-title:not(.hidden)');
    });

    await step(`${vpName}: practice — hint, pass, undo, re-pass, play`, async () => {
      await page.click('#btn-play');
      await page.click('[data-mode="practice"]');
      await page.waitForSelector('#screen-practice:not(.hidden)');
      const presets = await page.locator('#practice-list li').count();
      if (presets !== 3) throw new Error(`expected 3 practice presets, got ${presets}`);
      await page.locator('#practice-list li').first().click();
      await page.waitForSelector('#screen-play:not(.hidden)');
      await page.waitForFunction(() => document.querySelectorAll('#hand li.card').length > 0);

      // hint shows an explanatory toast
      await page.locator('#actions button', { hasText: 'Hint' }).click();
      await page.waitForSelector('#toast:not(.hidden)');
      const hintText = (await page.textContent('#toast')).trim();
      if (!hintText) throw new Error('hint produced no toast text');
      console.log('  hint:', hintText);

      // pass three cards, then undo restores the pre-pass state
      const handBefore = (await readPlayState(page)).handSize;
      for (let i = 0; i < 3; i++) await page.locator('#hand li.card:not(.sel)').first().click();
      await page.locator('#actions button', { hasText: /^Pass 3\/3$/ }).click();
      await page.waitForFunction(() => {
        const b = [...document.querySelectorAll('#actions button')].find((x) => /^Pass /.test(x.textContent));
        return !b; // pass committed: pass button gone
      });
      await page.locator('#actions button', { hasText: 'Undo' }).click();
      await page.waitForFunction(() => {
        const b = [...document.querySelectorAll('#actions button')].find((x) => /^Pass /.test(x.textContent));
        return b && /Pass 0\/3/.test(b.textContent);
      });
      const handAfterUndo = (await readPlayState(page)).handSize;
      if (handAfterUndo !== handBefore) throw new Error(`undo did not restore hand (${handBefore} -> ${handAfterUndo})`);

      // re-pass for real and play one card on our turn
      for (let i = 0; i < 3; i++) await page.locator('#hand li.card:not(.sel)').first().click();
      await page.locator('#actions button', { hasText: /^Pass 3\/3$/ }).click();
      await page.waitForFunction(
        () => (document.getElementById('objective')?.textContent || '').includes('Your turn'),
        null, { timeout: 30000 }
      );
      await page.locator('#hand li.card:not(.dim)').first().click();
      await page.screenshot({ path: SHOT('practice', vpName) });
    });

    await step(`${vpName}: pause → leave to title`, async () => {
      await page.keyboard.press('Escape');
      await page.waitForSelector('#pause-overlay:not(.hidden)');
      await page.click('#pause-overlay [data-act="leave"]');
      await page.waitForSelector('#screen-title:not(.hidden)');
    });

    await step(`${vpName}: title sub-menus (daily, journey) open and close`, async () => {
      await page.click('#screen-title [data-nav="daily"]');
      await page.waitForSelector('#screen-daily:not(.hidden)');
      const days = await page.locator('#daily-list li').count();
      if (days !== 7) throw new Error(`expected 7 daily entries, got ${days}`);
      await page.screenshot({ path: SHOT('daily', vpName) });
      await page.click('#screen-daily [data-nav="back"]');
      await page.waitForSelector('#screen-title:not(.hidden)');
      await page.click('#screen-title [data-nav="journey"]');
      await page.waitForSelector('#screen-journey:not(.hidden)');
      await page.click('#screen-journey [data-nav="back"]');
      await page.waitForSelector('#screen-title:not(.hidden)');
    });

    await step(`${vpName}: learn lesson 1 applies fixture, completes, persists`, async () => {
      await page.click('#btn-play');
      await page.click('[data-mode="learn"]');
      await page.waitForSelector('#screen-learn:not(.hidden)');
      const lessons = await page.locator('#learn-list li').count();
      if (lessons !== 6) throw new Error(`expected 6 lessons, got ${lessons}`);
      await page.locator('#learn-list li').first().click();
      await page.waitForSelector('#screen-play:not(.hidden)');
      await page.waitForFunction(() => document.querySelectorAll('#hand li.card').length > 0);
      // fixture: 3-card hand; only the 7♦ is legal (must follow diamonds)
      const handSize = await page.locator('#hand li.card').count();
      if (handSize !== 3) throw new Error('lesson fixture not applied; hand size ' + handSize);
      const legal = await page.locator('#hand li.card:not(.dim)').count();
      if (legal !== 1) throw new Error('expected exactly 1 legal card, got ' + legal);
      await page.locator('#hand li.card:not(.dim)').first().click();
      await page.waitForSelector('#results-overlay:not(.hidden)', { timeout: 15000 });
      const head = await page.textContent('#results-overlay h2');
      if (!/Lesson complete/.test(head)) throw new Error('no lesson completion overlay: ' + head);
      const prog = await page.evaluate(() => JSON.parse(localStorage.getItem('hf-progress-v1') || '{}'));
      if (!prog.learn || !prog.learn.t1) throw new Error('lesson completion not persisted');
      await page.screenshot({ path: SHOT('lesson-done', vpName) });
      await page.click('#results-overlay [data-act="next-lesson"]');
      await page.waitForSelector('#results-overlay.hidden', { state: 'attached' });
      await page.waitForFunction(() => document.querySelectorAll('#hand li.card').length > 0);
      await page.keyboard.press('Escape');
      await page.waitForSelector('#pause-overlay:not(.hidden)');
      await page.click('#pause-overlay [data-act="leave"]');
      await page.waitForSelector('#screen-title:not(.hidden)');
    });
  } finally {
    await context.close();
  }

  if (errors.length) {
    throw new Error(`${vpName} pass had page errors:\n` + errors.join('\n'));
  }
  console.log(`ok - ${vpName}: no page errors`);
}

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
});

try {
  await runPass('desktop', { viewport: { width: 1280, height: 800 } });
  await runPass('mobile', { viewport: { width: 390, height: 844 }, hasTouch: true });
  console.log('\nE2E PASS — heartfall, desktop + mobile, no page errors');
} finally {
  await browser.close();
  server.close();
}
