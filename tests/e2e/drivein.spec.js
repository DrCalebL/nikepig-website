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
  await expect(page.locator('.prop[data-id]')).toHaveCount(14);
  return errors;
}

// Synthetic catalogue: e0/e1 posters, e2 snack, e3 booth, the rest row props; one day apart, oldest first.
// Odd ids ship without an image (generic reel icon).
const day = i => new Date(Date.parse('2026-01-01T00:00:00+08:00') + i * 864e5).toISOString().replace('.000Z', 'Z');
const synthCat = n => Array.from({ length: n }, (_, i) => Object.assign({
  id: 'e' + i, title: 'Episode ' + i, youtube: ('y' + String(i).padStart(10, '0')).slice(0, 11), format: 'portrait',
  premiere: day(i), prop: ['poster', 'poster', 'snack', 'booth'][i] || 'car', alt: 'Prop ' + i,
}, i % 2 ? {} : { image: 'props/placeholder-car.svg' }));

async function openSynth(page, n = 30, hash = '') {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/cartoons/episodes.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(synthCat(n)) }));
  await page.clock.setFixedTime(new Date('2026-10-05T00:00:00Z'));
  await page.goto('/cartoons/' + hash);
  await expect(page.locator('.prop[data-id]')).toHaveCount(Math.min(n, 16));
  return errors;
}

for (const [w, h] of [[375, 812], [768, 1024], [1440, 900], [2560, 1440]]) {
  test(`renders 14 props with no page errors at ${w}px`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    const errors = await open(page);
    expect(errors).toEqual([]);
    await expect(page.locator('#screen')).toHaveAttribute('data-mode', 'idle');
    await expect(page.locator('.crate')).toHaveCount(0);
    await expect(page.locator('#all-btn')).toBeVisible();
  });

  test(`a 30-episode catalogue caps the lot and the crate opens the list at ${w}px`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    const errors = await openSynth(page);
    const crate = page.locator('.crate');
    await expect(crate).toHaveCount(1);
    await crate.scrollIntoViewIfNeeded();
    await crate.click();
    await expect(page.locator('#all-eps')).toHaveJSProperty('open', true);
    await expect(page.locator('#all-list .ep-item')).toHaveCount(30);
    expect(await page.evaluate(() => Math.max(document.documentElement.scrollWidth - innerWidth, 0))).toBe(0);
    expect(errors).toEqual([]);
  });

  test(`every prop is clickable just below its top edge at ${w}px`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await open(page);
    const bad = await page.evaluate(() => [...document.querySelectorAll('.prop[data-id]')].filter(p => {
      p.scrollIntoView({ inline: 'center', block: 'nearest' });
      const r = p.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + 3);
      return !hit || hit.closest('.prop') !== p;
    }).map(p => p.dataset.id));
    expect(bad).toEqual([]);
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

test('landscape phone uses the full-width desktop layout with no prop hiding another', async ({ page }) => {
  await page.setViewportSize({ width: 667, height: 375 });
  await open(page);
  const sceneW = (await page.locator('#scene').boundingBox()).width;
  expect(Math.abs(sceneW - 667)).toBeLessThanOrEqual(2);
  const wrong = await page.evaluate(() => [...document.querySelectorAll('.prop')].filter(p => {
    const r = p.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !hit || hit.closest('.prop') !== p;
  }).map(p => p.dataset.id));
  expect(wrong).toEqual([]);
});

test('tablet portrait uses the stacked layout', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await open(page);
  const s = await page.locator('#screen').boundingBox();
  const l = await page.locator('#lot').boundingBox();
  expect(s.y + s.height).toBeLessThanOrEqual(l.y + 1);
});

const rectOf = el => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, id: el.dataset && el.dataset.id }; };
const overlap = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
const area = a => (a.r - a.l) * (a.b - a.t);

async function settled(page) {
  // screen width animates .45s; wait until two reads agree
  await expect.poll(async () => {
    const a = await page.locator('#screen').boundingBox();
    await page.waitForTimeout(60);
    const b = await page.locator('#screen').boundingBox();
    return Math.abs(a.width - b.width) < 0.5;
  }).toBe(true);
}

for (const [w, h] of [[1440, 900], [390, 844]]) {
  test(`watch link never overlaps props or the player at ${w}px`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await open(page);
    for (const id of ['c3', 'pilot']) {
      await page.locator(`.prop[data-id="${id}"]`).focus();
      for (const mode of ['preview', 'playing']) {
        if (mode === 'playing') await page.keyboard.press('Enter');
        await expect(page.locator('#screen')).toHaveAttribute('data-mode', mode);
        await settled(page);
        await page.waitForTimeout(500);
        const res = await page.evaluate(({ src, fn }) => {
          const rectOf = eval(src), overlap = eval(fn);
          const link = rectOf(document.getElementById('watch-link'));
          const hits = [...document.querySelectorAll('.prop')].map(rectOf).filter(p => overlap(p, link) > 0).map(p => p.id);
          const f = document.querySelector('#screen-content iframe');
          return { link, hits, frame: f ? overlap(rectOf(f), link) : 0, vw: innerWidth };
        }, { src: rectOf.toString(), fn: overlap.toString() });
        expect(res.link.r - res.link.l, `${id} ${mode} link visible`).toBeGreaterThan(0);
        expect(res.link.r, `${id} ${mode} link inside viewport`).toBeLessThanOrEqual(res.vw);
        expect(res.hits, `${id} ${mode}`).toEqual([]);
        expect(res.frame, `${id} ${mode} iframe`).toBe(0);
      }
      await page.keyboard.press('Escape');
    }
  });

  test(`props do not overlap each other at ${w}px`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await open(page);
    const rects = await page.evaluate(src => [...document.querySelectorAll('.prop')].map(eval(src)), rectOf.toString());
    const bad = [];
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) {
        const o = overlap(rects[i], rects[j]) / Math.min(area(rects[i]), area(rects[j]));
        if (o > 0.05) bad.push(`${rects[i].id}/${rects[j].id} ${(o * 100).toFixed(1)}%`);
      }
    expect(bad).toEqual([]);
  });
}

test('landscape preview does not cover any prop centre', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  await page.locator('.prop[data-id="c3"]').hover();
  await page.locator('.prop[data-id="pilot"]').hover();
  await expect(page.locator('#screen')).toHaveAttribute('data-format', 'landscape');
  await settled(page);
  const covered = await page.evaluate(() => {
    const s = document.getElementById('screen').getBoundingClientRect();
    return [...document.querySelectorAll('.prop')].filter(p => {
      const r = p.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      return x > s.left && x < s.right && y > s.top && y < s.bottom;
    }).map(p => p.dataset.id);
  });
  expect(covered).toEqual([]);
});

test('topbar title never overlaps the screen', async ({ page }) => {
  for (const [w, h] of [[375, 812], [1024, 768], [1440, 900], [2560, 1440], [900, 1200]]) {
    await page.setViewportSize({ width: w, height: h });
    await open(page);
    const t = await page.locator('.topbar h1').boundingBox();
    const s = await page.locator('#screen').boundingBox();
    expect(t.y + t.height, `${w}px`).toBeLessThanOrEqual(s.y);
    const bb = await page.locator('#all-btn').boundingBox();
    expect(bb.y + bb.height, `${w}px button`).toBeLessThanOrEqual(s.y);
    expect(bb.x + bb.width, `${w}px button`).toBeLessThanOrEqual(w);
  }
});

test('hovered prop rises above neighbours', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  const c6 = page.locator('.prop[data-id="c6"]');
  await c6.hover();
  expect(await c6.evaluate(e => getComputedStyle(e).zIndex)).toBe('5');
  expect(await page.locator('.prop[data-id="c8"]').evaluate(e => getComputedStyle(e).zIndex)).toBe('1');
  // rows stack front over back: newest (c14) is on the front row; c6-c8 (same premiere, later in the catalogue) on the back row
  expect(await page.locator('.prop[data-id="c14"]').evaluate(e => +getComputedStyle(e).zIndex)).toBeGreaterThan(1);
});

test('All episodes button lists every episode newest first with premiere badges', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.clock.setFixedTime(new Date('2026-09-27T12:00:00Z'));
  await page.goto('/cartoons/');
  await page.locator('#all-btn').click();
  const items = page.locator('#all-list .ep-item');
  await expect(items).toHaveCount(14);
  await expect(items.first()).toContainText('Forever Hungry');
  await expect(items.first().locator('.badge')).toHaveText(/^Premieres 1 Oct$/);
  await expect(page.locator('.ep-item[data-id="c10"] .badge')).toHaveCount(0);
  await expect(page.locator('#all-search')).toBeFocused();
});

test('search filters the list by title or id', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  await page.locator('#all-btn').click();
  await page.locator('#all-search').fill('coat');
  await expect(page.locator('#all-list .ep-item:visible')).toHaveCount(1);
  await expect(page.locator('#all-list .ep-item:visible')).toContainText('The Coat Rack');
  await page.locator('#all-search').fill('c2');
  await expect(page.locator('#all-list .ep-item:visible')).toHaveCount(1);
  await page.locator('#all-search').fill('zzzz');
  await expect(page.locator('#all-list .ep-item:visible')).toHaveCount(0);
  await expect(page.locator('#all-empty')).toBeVisible();
});

test('choosing an episode with a prop previews it, scrolls to it and focuses it; Enter plays', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await open(page);
  await page.locator('#all-btn').click();
  await page.locator('.ep-item[data-id="pilot"]').click();
  await expect(page.locator('#all-eps')).toHaveJSProperty('open', false);
  await expect(page.locator('#screen')).toHaveAttribute('data-mode', 'preview');
  await expect(page.locator('#screen-content strong')).toHaveText('The Apple Chip Ledger');
  const pilot = page.locator('.prop[data-id="pilot"]');
  await expect(pilot).toBeFocused();
  await expect(pilot).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page.locator('#screen-content iframe')).toHaveAttribute('src', /KCV8nHowlpo/);
});

test('choosing an archived episode previews it and focuses the screen', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openSynth(page);
  await page.locator('#all-btn').click();
  await page.locator('#all-search').fill('Episode 5');
  await page.locator('.ep-item[data-id="e5"]').click();
  await expect(page.locator('#screen')).toHaveAttribute('data-mode', 'preview');
  await expect(page.locator('#screen-content strong')).toHaveText('Episode 5');
  await expect(page.locator('#screen')).toBeFocused();
  expect(await page.evaluate(() => location.hash)).toBe('#ep=e5');
});

test('list item and prop fall back to the reel icon when an episode has no image', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openSynth(page);
  await expect(page.locator('.prop[data-id="e29"] img')).toHaveAttribute('src', 'props/placeholder-reel.svg');
  await expect(page.locator('.prop[data-id="e28"] img')).toHaveAttribute('src', 'props/placeholder-car.svg');
  await page.locator('#all-btn').click();
  await expect(page.locator('.ep-item[data-id="e5"] img')).toHaveAttribute('src', 'props/placeholder-reel.svg');
});

test('Esc closes the list without stopping playback', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  await page.locator('.prop[data-id="c3"]').click();
  await expect(page.locator('#screen-content iframe')).toHaveCount(1);
  await page.locator('#all-btn').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#all-eps')).toHaveJSProperty('open', false);
  await expect(page.locator('#screen-content iframe')).toHaveCount(1);
});

test('skip link opens the list', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  const skip = page.locator('.skip-link');
  await skip.focus();
  await expect(skip).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page.locator('#all-eps')).toHaveJSProperty('open', true);
  expect(await page.evaluate(() => location.hash)).toBe('');
});

test('#ep=<id> deep link preselects that episode, and hashchange follows', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.clock.setFixedTime(new Date('2026-10-05T00:00:00Z'));
  await page.goto('/cartoons/#ep=c10');
  await expect(page.locator('#screen')).toHaveAttribute('data-mode', 'preview');
  await expect(page.locator('#screen-content strong')).toHaveText('Order in the Yard');
  await expect(page.locator('#screen-content iframe')).toHaveCount(0);
  await page.evaluate(() => { location.hash = '#ep=c3'; });
  await expect(page.locator('#screen-content strong')).toHaveText('45-Minute Diner Wait');
  await page.evaluate(() => { location.hash = '#ep=nope'; });
  await expect(page.locator('#screen-content strong')).toHaveText('45-Minute Diner Wait');
  expect(errors).toEqual([]);
});

test('deep link to a coming-soon episode shows its premiere card', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.clock.setFixedTime(new Date('2026-09-26T12:00:00Z'));
  await page.goto('/cartoons/#ep=c10');
  await expect(page.locator('#screen')).toHaveAttribute('data-mode', 'soon');
});

test('selecting an episode updates the hash without adding history', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  const before = await page.evaluate(() => history.length);
  await page.locator('.prop[data-id="c4"]').hover();
  await expect.poll(() => page.evaluate(() => location.hash)).toBe('#ep=c4');
  await page.locator('.prop[data-id="c5"]').click();
  await expect.poll(() => page.evaluate(() => location.hash)).toBe('#ep=c5');
  expect(await page.evaluate(() => history.length)).toBe(before);
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
  await expect(page.locator('.prop[data-id]')).toHaveCount(14);
  const c10 = page.locator('.prop[data-id="c10"]');
  await expect(c10).toHaveAttribute('data-soon', 'true');
  await expect(c10).toHaveAttribute('aria-label', /^Order in the Yard, premieres 27 Sept?$/);
  await expect(c10.locator('.soon')).toHaveText(/^27 Sept?$/);
  const fit = await c10.evaluate(b => { const s = b.querySelector('.soon'); return s.getBoundingClientRect().width <= b.getBoundingClientRect().width + 0.5; });
  expect(fit).toBe(true);
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

test('reduced motion also disables the lift on focus', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  const c3 = page.locator('.prop[data-id="c3"]');
  await c3.focus();
  await expect(c3).toHaveAttribute('aria-current', 'true');
  const m = await c3.evaluate(e => { const t = new DOMMatrix(getComputedStyle(e).transform); return { a: t.a, f: t.f, h: e.offsetHeight }; });
  expect(m.a).toBe(1);
  expect(m.f).toBeCloseTo(-m.h, 0);
});
