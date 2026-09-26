const { test, expect } = require('@playwright/test');

// Never hit YouTube from tests: thumbnails fall back to prop art, iframes stay blank.
test.beforeEach(async ({ page }) => {
  await page.route(/(youtube-nocookie\.com|ytimg\.com|youtube\.com)/, r => r.abort());
});

async function open(page, when = '2026-10-05T00:00:00Z') {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.clock.setFixedTime(new Date(when));
  await page.goto('/cartoons/');
  await expect(page.locator('.prop')).toHaveCount(14);
  return errors;
}

for (const [w, h] of [[375, 812], [768, 1024], [1440, 900], [2560, 1440]]) {
  test(`renders 14 props with no page errors at ${w}px`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    const errors = await open(page);
    expect(errors).toEqual([]);
    await expect(page.locator('#screen')).toHaveAttribute('data-mode', 'idle');
  });
}

test('hover previews and the screen changes shape by format', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  const screen = page.locator('#screen');
  await page.locator('.prop[data-id="c3"]').hover();
  await expect(screen).toHaveAttribute('data-mode', 'preview');
  await expect(screen).toHaveAttribute('data-format', 'portrait');
  await expect(page.locator('#screen-content strong')).toHaveText('45-Minute Diner Wait');
  await expect(page.locator('.prop[data-id="c3"]')).toHaveAttribute('aria-label', 'Play 45-Minute Diner Wait');
  await page.locator('.prop[data-id="pilot"]').hover();
  await expect(screen).toHaveAttribute('data-format', 'landscape');
  // width animates (.45s); poll until it settles wider than tall
  await expect.poll(async () => { const b = await screen.boundingBox(); return b.width > b.height; }).toBe(true);
});

test('mobile: screen sits above the lot', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  const s = await page.locator('#screen').boundingBox();
  const l = await page.locator('#lot').boundingBox();
  expect(s.y + s.height).toBeLessThanOrEqual(l.y + 1);
});

test('mobile: landscape screen never overflows into the lot on short viewports', async ({ page }) => {
  await page.setViewportSize({ width: 667, height: 375 });
  await open(page);
  await page.locator('.prop[data-id="pilot"]').focus();
  const s = await page.locator('#screen').boundingBox();
  const l = await page.locator('#lot').boundingBox();
  expect(s.y + s.height).toBeLessThanOrEqual(l.y + 1);
});

test('click plays the embed, and hovering elsewhere does not interrupt it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  await page.locator('.prop[data-id="c3"]').click();
  const frame = page.locator('#screen-content iframe');
  await expect(frame).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/rt7cQLtGyEE?autoplay=1&playsinline=1&rel=0');
  await expect(frame).toHaveAttribute('allow', /autoplay/);
  await expect(page.locator('#announce')).toHaveText('Now playing 45-Minute Diner Wait');
  await page.locator('.prop[data-id="c4"]').hover();
  await expect(frame).toHaveAttribute('src', /rt7cQLtGyEE/);
  await expect(page.locator('#watch-link')).toHaveAttribute('href', 'https://youtube.com/shorts/rt7cQLtGyEE');
  await page.keyboard.press('Escape');
  await expect(page.locator('#screen-content iframe')).toHaveCount(0);
  await expect(page.locator('#screen')).toHaveAttribute('data-mode', 'preview');
});

test('play button keeps focus in the page instead of dropping to body', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  await page.locator('.prop[data-id="c3"]').hover();
  await page.locator('.play').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#screen-content iframe')).toHaveCount(1);
  const isBody = await page.evaluate(() => document.activeElement === document.body);
  expect(isBody).toBe(false);
});

test('coming-soon flips at the premiere instant and never plays before it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.clock.install({ time: new Date('2026-09-26T16:59:30Z') });
  await page.goto('/cartoons/');
  await expect(page.locator('.prop')).toHaveCount(14);
  const c10 = page.locator('.prop[data-id="c10"]');
  await expect(c10).toHaveAttribute('data-soon', 'true');
  await expect(c10).toHaveAttribute('aria-label', /^Order in the Yard, premieres 27 Sept?$/);
  await c10.click();
  await expect(page.locator('#screen-content iframe')).toHaveCount(0);
  await expect(page.locator('#screen')).toHaveAttribute('data-mode', 'soon');
  await expect(page.locator('#screen-content')).toContainText(/Premieres 27 Sept?/);
  await expect(page.locator('#watch-link')).toBeHidden();

  await page.clock.runFor('01:00');
  await expect(c10).toHaveAttribute('data-soon', 'false');
});

test('touch: first tap previews, second tap plays', async ({ browser }, testInfo) => {
  const ctx = await browser.newContext({ baseURL: testInfo.project.use.baseURL, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.route(/(youtube-nocookie\.com|ytimg\.com|youtube\.com)/, r => r.abort());
  await open(page);
  const c5 = page.locator('.prop[data-id="c5"]');
  await c5.scrollIntoViewIfNeeded();
  await c5.tap();
  await expect(page.locator('#screen')).toHaveAttribute('data-mode', 'preview');
  await expect(page.locator('#screen-content iframe')).toHaveCount(0);
  await c5.tap();
  await expect(page.locator('#screen-content iframe')).toHaveAttribute('src', /wCXxBkEbMgI/);
  const hit = await c5.evaluate(el => {
    const s = getComputedStyle(el, '::before');
    return { w: parseFloat(s.width), h: parseFloat(s.height) };
  });
  expect(hit.w).toBeGreaterThanOrEqual(44);
  expect(hit.h).toBeGreaterThanOrEqual(44);
  const tb = await c5.boundingBox();
  const imgBox = await c5.locator('img').boundingBox();
  expect(imgBox.width).toBeCloseTo(tb.width, 0);
  await ctx.close();
});

test('renders 14 props with no page errors at deviceScaleFactor 2', async ({ browser }, testInfo) => {
  const ctx = await browser.newContext({ baseURL: testInfo.project.use.baseURL, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.route(/(youtube-nocookie\.com|ytimg\.com|youtube\.com)/, r => r.abort());
  const errors = await open(page);
  expect(errors).toEqual([]);
  await ctx.close();
});

test('keyboard: Tab reaches props, Enter plays', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  await page.locator('.prop[data-id="c6"]').focus();
  await expect(page.locator('#screen')).toHaveAttribute('data-mode', 'preview');
  await page.keyboard.press('Enter');
  await expect(page.locator('#screen-content iframe')).toHaveAttribute('src', /s4WUUF-3D_Y/);
});

test('falls back to the inline catalogue when episodes.json fails', async ({ page }) => {
  await page.route('**/cartoons/episodes.json', r => r.abort());
  const errors = await open(page);
  expect(errors).toEqual([]);
});

test('shows a friendly message when no catalogue is available', async ({ page }) => {
  await page.route('**/cartoons/episodes.json', r => r.fulfill({ status: 200, body: '{"bad":true}', contentType: 'application/json' }));
  await page.goto('/cartoons/');
  await expect(page.locator('#status')).toHaveText('Episodes are warming up, try again');
});

test('reduced motion disables the screen transition', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  const t = await page.locator('#screen').evaluate(e => getComputedStyle(e).transitionDuration);
  expect(t).toBe('0s');
});
