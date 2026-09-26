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
