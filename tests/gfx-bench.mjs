// Graphics benchmark hook for tools/gfx-bench.mjs (dev-only): picks a preset in Settings → Graphics,
// starts a Practice match and keeps playing it through the visible hand and action buttons (passing,
// legal plays, AI tricks), pressing Play again at the results — the table canvas, lamp, fireflies,
// cards and labels redraw every frame on the presets that animate.
export const presets = ['low', 'balanced', 'high', 'ultra'];
export const levels = { low: 0, balanced: 4, high: 10, ultra: 17 };

export async function setPreset(page, preset) {
  await page.waitForSelector('#screen-title:not(.hidden)', { timeout: 20000 });
  await page.click('#screen-title [data-nav="settings"]');
  await page.waitForSelector('#screen-settings:not(.hidden)');
  await page.locator('#gfx-preset').scrollIntoViewIfNeeded();
  await page.selectOption('#gfx-preset', preset);
  await page.waitForFunction((p) => document.body.getAttribute('data-gfx-preset') === p, preset);
  await page.click('#screen-settings [data-nav="back"]');
  await page.waitForSelector('#screen-title:not(.hidden)');
}

const state = (page) => page.evaluate(() => {
  const passBtn = [...document.querySelectorAll('#actions button')].find((b) => /^Pass /.test(b.textContent));
  return {
    obj: document.getElementById('objective')?.textContent || '',
    pass: passBtn ? passBtn.textContent.trim() : null,
    results: !document.getElementById('results-overlay').classList.contains('hidden'),
  };
});

async function step(page) {
  const st = await state(page);
  if (st.results) return page.click('#results-overlay [data-act="again"]', { timeout: 5000 });
  if (st.pass) {
    const m = st.pass.match(/Pass (\d+)\/(\d+)/);
    if (m && m[1] === m[2]) return page.locator('#actions button', { hasText: /^Pass / }).click({ timeout: 5000 });
    return page.locator('#hand li.card:not(.sel)').first().click({ timeout: 5000 });
  }
  if (st.obj.includes('Your turn')) return page.locator('#hand li.card:not(.dim)').first().click({ timeout: 5000 });
}

export async function start(page) {
  await page.click('#btn-play');
  await page.click('[data-mode="practice"]');
  await page.locator('#practice-list li').first().click();
  await page.waitForFunction(() => document.querySelectorAll('#hand li.card').length > 0, null, { timeout: 15000 });
  let open = true;
  page.once('close', () => { open = false; });
  (async () => {
    while (open) {
      try { await step(page); } catch (e) { if (!open) return; if (process.env.BENCH_DEBUG) console.error(e.message); }
      await page.waitForTimeout(300).catch(() => {});
    }
  })();
  await page.waitForTimeout(1500);
}
