const { test, expect } = require('@playwright/test');

test('main site links to the cartoons page from nav and the Nikeverse grid', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/index.html');
  await expect(page.locator('#navbar a[href="cartoons/"]')).toHaveText('Cartoons');
  const card = page.locator('.nikeverse-grid .verse-card', { has: page.locator('img[alt="Nikeverse Cartoons"]') });
  await expect(card).toHaveCount(1);
  await expect(card.locator('a.verse-card-btn')).toHaveAttribute('href', 'cartoons/');
  expect(errors).toEqual([]);
});

test('title sticker obeys the verse-title-img cap', async ({ page }) => {
  await page.goto('/index.html');
  const img = page.locator('img[alt="Nikeverse Cartoons"]');
  await img.scrollIntoViewIfNeeded();
  const h = await img.evaluate(e => e.getBoundingClientRect().height);
  expect(h).toBeLessThanOrEqual(115.5);
});

for (const w of [1024, 1152, 1200, 1280, 1281, 1366]) {
  test(`nav fits without collapsing the logo at ${w}px`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 800 });
    await page.goto('/index.html');
    const m = await page.evaluate(() => {
      const logo = document.querySelector('.nav-logo').getBoundingClientRect();
      const links = [...document.querySelectorAll('#navLinks a')].map(a => a.getBoundingClientRect());
      const visible = links.filter(r => r.width > 0);
      const toggle = document.getElementById('navToggle');
      const drawer = getComputedStyle(toggle).display !== 'none';
      return { logoW: logo.width, drawer, vw: document.documentElement.clientWidth, docW: document.documentElement.scrollWidth,
        // desktop row: every link incl. the CTA must be on screen; drawer mode: the toggle must be
        maxRight: drawer ? toggle.getBoundingClientRect().right : Math.max(...visible.map(r => r.right)),
        rows: new Set(visible.map(r => Math.round(r.top + r.height / 2))).size };
    });
    expect(m.logoW).toBeGreaterThan(0);
    expect(m.maxRight).toBeLessThanOrEqual(m.vw);
    expect(m.docW).toBeLessThanOrEqual(m.vw);
    if (!m.drawer) expect(m.rows).toBe(1);
  });
}

const gridGeom = page => page.evaluate(() => {
  const g = document.querySelector('.nikeverse-grid').getBoundingClientRect();
  const cards = [...document.querySelectorAll('.nikeverse-grid > .verse-card')].map(c => c.getBoundingClientRect());
  return { g: { l: g.left, r: g.right }, cards: cards.map(c => ({ l: c.left, r: c.right, t: Math.round(c.top), w: c.width })) };
});

test('3-column Nikeverse grid centres the trailing pair', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/index.html');
  const { g, cards } = await gridGeom(page);
  const [a, b] = cards.slice(-2);
  expect(a.t).toBe(b.t);
  expect(Math.abs((a.l + b.r) / 2 - (g.l + g.r) / 2)).toBeLessThanOrEqual(5);
  expect(Math.abs(a.w - cards[0].w)).toBeLessThanOrEqual(1);
  expect(new Set(cards.slice(0, 9).map(c => c.t)).size).toBe(3);
});

test('2-column Nikeverse grid centres an odd last card', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 900 });
  await page.goto('/index.html');
  const { g, cards } = await gridGeom(page);
  const last = cards[cards.length - 1];
  expect(Math.abs((last.l + last.r) / 2 - (g.l + g.r) / 2)).toBeLessThanOrEqual(5);
  expect(Math.abs(last.w - cards[0].w)).toBeLessThanOrEqual(1);
  expect(new Set(cards.slice(0, 10).map(c => c.t)).size).toBe(5);
});

test('1-column Nikeverse grid keeps full-width cards', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/index.html');
  const { g, cards } = await gridGeom(page);
  for (const c of cards) expect(Math.abs(c.w - (g.r - g.l))).toBeLessThanOrEqual(1);
});

test('fixed background and reveal still work with the Cartoons card', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/index.html');
  expect(await page.evaluate(() => getComputedStyle(document.body, '::before').position)).toBe('fixed');
  const card = page.locator('.nikeverse-grid .verse-card').last();
  await card.scrollIntoViewIfNeeded();
  await expect(card).toHaveClass(/\bactive\b/);
  await expect.poll(() => card.evaluate(e => getComputedStyle(e).opacity)).toBe('1');
});
