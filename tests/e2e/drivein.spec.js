const { test, expect } = require('@playwright/test');
const GENERIC_E27 = require('../../cartoons/drivein-core.js').propImage({ id: 'e27' });

// Never hit YouTube from tests: thumbnails fall back to prop art, iframes stay blank.
test.beforeEach(async ({ page }) => {
  await page.route(/(youtube-nocookie\.com|ytimg\.com|youtube\.com)/, r => r.abort());
});

async function open(page, when = '2026-10-05T00:00:00Z') {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.clock.setFixedTime(new Date(when));
  await page.goto('/cartoons/');
  await expect(page.locator('.reel[data-id]')).toHaveCount(13);
  return errors;
}

// Synthetic catalogue, one day apart, oldest first. Odd ids ship without an image (generic seat-saver in the list).
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
  await expect(page.locator('.reel[data-id]')).toHaveCount(Math.min(n, 13));
  return errors;
}

for (const [w, h] of [[375, 812], [768, 1024], [1366, 768], [1440, 900], [1920, 1080], [2560, 1440]]) {
  test(`renders 13 reels with no page errors at ${w}px`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    const errors = await open(page);
    expect(errors).toEqual([]);
    await expect(page.locator('#screen')).toHaveAttribute('data-mode', 'idle');
    await expect(page.locator('#screen-content')).toContainText('Pick a reel to preview');
    await expect(page).toHaveTitle(/barn/i);
    await expect(page).not.toHaveTitle(/drive-in/i);
    expect(await page.locator('meta[name="description"]').getAttribute('content')).not.toMatch(/drive-in/i);
    await expect(page.locator('.prop, .crate')).toHaveCount(0);
    await expect(page.locator('#all-btn')).toBeVisible();
    // left to right = newest to oldest; the pilot (first of the equal 1 Sept premieres in the catalogue, so the oldest) is list-only
    expect(await page.locator('.reel').evaluateAll(bs => bs.map(b => b.dataset.id))).toEqual(
      ['c14', 'c13', 'c12', 'c11', 'c10', 'c9', 'c8', 'c7', 'c6', 'c5', 'c4', 'c3', 'c2']);
    expect(await page.evaluate(() => Math.max(document.documentElement.scrollWidth - innerWidth, 0))).toBe(0);
  });

  test(`a 30-episode catalogue fills the 13 reels and the list holds all 30 at ${w}px`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    const errors = await openSynth(page);
    await expect(page.locator('.reel[data-slot="0"]')).toHaveAttribute('data-id', 'e29');
    await expect(page.locator('.reel[data-slot="12"]')).toHaveAttribute('data-id', 'e17');
    await page.locator('#all-btn').click();
    await expect(page.locator('#all-eps')).toHaveJSProperty('open', true);
    await expect(page.locator('#all-list .ep-item')).toHaveCount(30);
    expect(await page.evaluate(() => Math.max(document.documentElement.scrollWidth - innerWidth, 0))).toBe(0);
    expect(errors).toEqual([]);
  });

  // Hotspot hit test: the centre of every reel (the painted reel) hits that reel's button, not the topbar or the screen.
  test(`every reel hotspot is hit at its centre at ${w}px`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await open(page);
    const bad = await page.evaluate(() => [...document.querySelectorAll('.reel[data-id]')].filter(p => {
      p.scrollIntoView({ inline: 'center', block: 'nearest' });
      const r = p.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !hit || hit.closest('.reel') !== p;
    }).map(p => p.dataset.id));
    expect(bad).toEqual([]);
  });
}

test('reel hotspots sit on the painted reels, are at least 44 px and clear the screen at 1440', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  const m = await page.evaluate(() => {
    const L = window.DriveIn.DEFAULT_LAYOUT, sc = document.getElementById('scene').getBoundingClientRect();
    const scr = document.getElementById('screen').getBoundingClientRect();
    return { seamY: sc.top + sc.height * L.seam / 100, scrTop: scr.top, reels: [...document.querySelectorAll('.reel')].map(b => {
      const r = b.getBoundingClientRect(), s = L.reels[+b.dataset.slot];
      return { w: r.width, h: r.height, b: r.bottom, dx: r.left + r.width / 2 - (sc.left + sc.width * s.x / 100),
               dy: r.top + r.height / 2 - (sc.top + sc.height * s.y / 100), x: s.x };
    }) };
  });
  expect(Math.abs(m.scrTop - m.seamY)).toBeLessThanOrEqual(1); // screen top edge on the barn seam
  for (const r of m.reels) {
    expect(r.w).toBeGreaterThanOrEqual(44);
    expect(Math.abs(r.w - r.h)).toBeLessThan(1);
    expect(Math.abs(r.dx)).toBeLessThan(1);
    expect(Math.abs(r.dy)).toBeLessThan(1);
    if (r.x > 21.4 && r.x < 78.5) expect(r.b).toBeLessThanOrEqual(m.seamY);
  }
});

test('edge reels keep their title tag inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  for (const slot of [0, 12]) {
    const reel = page.locator(`.reel[data-slot="${slot}"]`);
    await reel.hover();
    const t = await reel.locator('.tag').boundingBox();
    expect(t.x).toBeGreaterThanOrEqual(0);
    expect(t.x + t.width).toBeLessThanOrEqual(1440);
  }
});

test('hover previews and the screen changes shape by format', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  const screen = page.locator('#screen');
  await page.locator('.reel[data-id="c3"]').hover();
  await expect(screen).toHaveAttribute('data-mode', 'preview');
  await expect(screen).toHaveAttribute('data-format', 'portrait');
  await expect(page.locator('#screen-content strong')).toHaveText('45-Minute Diner Wait');
  await expect(page.locator('.reel[data-id="c3"]')).toHaveAttribute('aria-label', 'Play 45-Minute Diner Wait');
  await page.locator('.reel[data-id="c2"]').hover();
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

test('landscape phone uses the desktop layout; the reels clear the topbar and each is hit at its centre', async ({ page }) => {
  await page.setViewportSize({ width: 667, height: 375 });
  await open(page);
  const sc = await page.locator('#scene').boundingBox();
  expect(sc.width).toBeLessThanOrEqual(667);
  expect(sc.width).toBeGreaterThan(500);
  const tb = await page.locator('.all-btn').boundingBox();
  const firstReelTop = await page.evaluate(() => Math.min(...[...document.querySelectorAll('.reel')].map(b => b.getBoundingClientRect().top)));
  expect(firstReelTop).toBeGreaterThanOrEqual(tb.y + tb.height);
  const wrong = await page.evaluate(() => [...document.querySelectorAll('.reel')].filter(p => {
    const r = p.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !hit || hit.closest('.reel') !== p;
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
  test(`watch link never overlaps reels or the player at ${w}px`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await open(page);
    for (const id of ['c3', 'c2']) {
      await page.locator(`.reel[data-id="${id}"]`).focus();
      for (const mode of ['preview', 'playing']) {
        if (mode === 'playing') await page.keyboard.press('Enter');
        await expect(page.locator('#screen')).toHaveAttribute('data-mode', mode);
        await settled(page);
        await page.waitForTimeout(500);
        const res = await page.evaluate(({ src, fn }) => {
          const rectOf = eval(src), overlap = eval(fn);
          const link = rectOf(document.getElementById('watch-link'));
          const hits = [...document.querySelectorAll('.reel')].map(rectOf).filter(p => overlap(p, link) > 0).map(p => p.id);
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

  test(`reel hotspots do not overlap each other at ${w}px`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await open(page);
    const rects = await page.evaluate(src => [...document.querySelectorAll('.reel')].map(eval(src)), rectOf.toString());
    const bad = [];
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) {
        const o = overlap(rects[i], rects[j]) / Math.min(area(rects[i]), area(rects[j]));
        if (o > 0.05) bad.push(`${rects[i].id}/${rects[j].id} ${(o * 100).toFixed(1)}%`);
      }
    expect(bad).toEqual([]);
  });
}

test('landscape preview does not cover any reel', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  await page.locator('.reel[data-id="c3"]').hover();
  await page.locator('.reel[data-id="c2"]').hover();
  await expect(page.locator('#screen')).toHaveAttribute('data-format', 'landscape');
  await settled(page);
  const covered = await page.evaluate(() => {
    const s = document.getElementById('screen').getBoundingClientRect();
    return [...document.querySelectorAll('.reel')].filter(p => {
      const r = p.getBoundingClientRect();
      return r.left < s.right && s.left < r.right && r.top < s.bottom && s.top < r.bottom;
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

test('a hovered reel glows and its title tag paints above the screen', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  const c6 = page.locator('.reel[data-id="c6"]');
  expect(await c6.evaluate(e => getComputedStyle(e).boxShadow)).toBe('none');
  await c6.hover();
  await expect.poll(() => c6.evaluate(e => getComputedStyle(e).boxShadow)).not.toBe('none');
  await expect.poll(() => c6.locator('.tag').evaluate(e => getComputedStyle(e).opacity)).toBe('1');
  // the reels share the root stacking context with the screen layer (z 10) and sit above it
  expect(await page.locator('#lot').evaluate(e => getComputedStyle(e).zIndex)).toBe('auto');
  expect(+await c6.evaluate(e => getComputedStyle(e).zIndex)).toBeGreaterThan(10);
  const tag = await c6.locator('.tag').boundingBox(), scr = await page.locator('#screen').boundingBox();
  expect(tag.y + tag.height).toBeGreaterThan(scr.y); // it does reach down over the screen's top edge
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

test('choosing an episode on a reel previews it, scrolls to it and focuses it; Enter plays', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await open(page);
  await page.locator('#all-btn').click();
  await page.locator('.ep-item[data-id="c2"]').click();
  await expect(page.locator('#all-eps')).toHaveJSProperty('open', false);
  await expect(page.locator('#screen')).toHaveAttribute('data-mode', 'preview');
  await expect(page.locator('#screen-content strong')).toHaveText('Do Your Cutest Thing');
  const c2 = page.locator('.reel[data-id="c2"]');
  await expect(c2).toBeFocused();
  await expect(c2).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page.locator('#screen-content iframe')).toHaveAttribute('src', /NR6ogdyPKVI/);
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

test('the launch catalogue\'s oldest episode (pilot) is list-only and still plays from the list', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  await expect(page.locator('.reel[data-id="pilot"]')).toHaveCount(0);
  await page.locator('#all-btn').click();
  await page.locator('.ep-item[data-id="pilot"]').click();
  await expect(page.locator('#screen-content strong')).toHaveText('The Apple Chip Ledger');
  await expect(page.locator('#screen')).toBeFocused();
  await page.locator('.play').click();
  await expect(page.locator('#screen-content iframe')).toHaveAttribute('src', /KCV8nHowlpo/);
});

test('list thumbnails: prop art, a generic seat-saver when there is none, the reel icon when an image fails', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route(/props\/generic-\d+\.webp$/, r => r.request().url().endsWith(GENERIC_E27) ? r.fulfill({ status: 404, body: '' }) : r.fallback());
  await openSynth(page);
  const expected = await page.evaluate(() => window.DriveIn.propImage({ id: 'e5' }));
  await page.locator('#all-btn').click();
  await expect(page.locator('.ep-item[data-id="e5"] img')).toHaveAttribute('src', expected);
  await expect(page.locator('.ep-item[data-id="e28"] img')).toHaveAttribute('src', 'props/placeholder-car.svg');
  await page.locator('.ep-item[data-id="e27"]').scrollIntoViewIfNeeded();
  await expect(page.locator('.ep-item[data-id="e27"] img')).toHaveAttribute('src', 'props/placeholder-reel.svg');
});

test('Esc closes the list without stopping playback', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  await page.locator('.reel[data-id="c3"]').click();
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
  await page.locator('.reel[data-id="c4"]').hover();
  await expect.poll(() => page.evaluate(() => location.hash)).toBe('#ep=c4');
  await page.locator('.reel[data-id="c5"]').click();
  await expect.poll(() => page.evaluate(() => location.hash)).toBe('#ep=c5');
  expect(await page.evaluate(() => history.length)).toBe(before);
});

test('click plays the embed, and hovering elsewhere does not interrupt it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  await page.locator('.reel[data-id="c3"]').click();
  const frame = page.locator('#screen-content iframe');
  await expect(frame).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/rt7cQLtGyEE?autoplay=1&playsinline=1&rel=0');
  await expect(frame).toHaveAttribute('allow', /autoplay/);
  await expect(page.locator('#announce')).toHaveText('Now playing 45-Minute Diner Wait');
  await page.locator('.reel[data-id="c4"]').hover();
  await expect(frame).toHaveAttribute('src', /rt7cQLtGyEE/);
  await expect(page.locator('#watch-link')).toHaveAttribute('href', 'https://youtube.com/shorts/rt7cQLtGyEE');
  await page.keyboard.press('Escape');
  await expect(page.locator('#screen-content iframe')).toHaveCount(0);
  await expect(page.locator('#screen')).toHaveAttribute('data-mode', 'preview');
});

test('play button keeps focus in the page instead of dropping to body', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  await page.locator('.reel[data-id="c3"]').hover();
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
  await expect(page.locator('.reel[data-id]')).toHaveCount(13);
  const c10 = page.locator('.reel[data-id="c10"]');
  await expect(c10).toHaveAttribute('data-soon', 'true');
  await expect(c10).toHaveAttribute('aria-label', /^Order in the Yard, premieres 27 Sept?$/);
  await expect(c10.locator('.soon')).toHaveText(/^Premieres 27 Sept?$/);
  await c10.hover();
  await expect(c10.locator('.soon')).toBeVisible();
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
  const c5 = page.locator('.reel[data-id="c5"]');
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
  await expect(c5.locator('.tag')).toBeVisible(); // touch has no hover: the current reel keeps its tag
  await ctx.close();
});

test('renders 13 reels with no page errors at deviceScaleFactor 2', async ({ browser }, testInfo) => {
  const ctx = await browser.newContext({ baseURL: testInfo.project.use.baseURL, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.route(/(youtube-nocookie\.com|ytimg\.com|youtube\.com)/, r => r.abort());
  const errors = await open(page);
  expect(errors).toEqual([]);
  await ctx.close();
});

test('keyboard: Tab reaches reels, Enter plays', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  await page.locator('.reel[data-id="c6"]').focus();
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

test('reduced motion also disables the reel glow transition', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  const c3 = page.locator('.reel[data-id="c3"]');
  await c3.focus();
  await expect(c3).toHaveAttribute('aria-current', 'true');
  expect(await c3.evaluate(e => getComputedStyle(e).transitionDuration)).toBe('0s');
});

test('phone: the reel strip shows under the sticky screen, newest on the left, and the lot scrolls sideways', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await open(page);
  const scr = await page.locator('#screen').boundingBox();
  const first = await page.locator('.reel[data-slot="0"]').boundingBox();
  expect(first.y).toBeGreaterThanOrEqual(scr.y + scr.height);
  expect(first.y + first.height).toBeLessThanOrEqual(812);
  expect(first.x).toBeGreaterThanOrEqual(0);
  expect(await page.locator('#lot').evaluate(e => e.scrollWidth > e.clientWidth)).toBe(true);
  expect(await page.locator('#lot').evaluate(e => getComputedStyle(e).zIndex)).toBe('1'); // reels scroll under the screen
  await page.mouse.move(180, 700);
  await page.mouse.wheel(0, 300);
  await expect.poll(() => page.locator('.screen-wrap').evaluate(e => e.getBoundingClientRect().top)).toBeLessThanOrEqual(0.5);
});

test('the UI marks which end is latest: Latest under the first reel, NEW on the newest released, Older opens the list', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, '2026-09-28T06:00:00Z'); // c10 and c11 are out; c12-c14 are still coming soon
  const latest = page.locator('.end-mark.latest'), older = page.locator('.end-mark.older');
  await expect(latest).toBeVisible();
  await expect(latest).toContainText('Latest');
  const first = await page.locator('.reel').first().boundingBox(), lb = await latest.boundingBox();
  expect(Math.abs(lb.x - first.x)).toBeLessThan(first.width); // sits under the leftmost (newest) reel
  await expect(page.locator('.reel .new')).toHaveCount(1);
  await expect(page.locator('.reel[data-id="c11"] .new')).toHaveText('NEW');
  await expect(page.locator('.reel[data-id="c11"]')).toHaveAttribute('aria-label', /latest release/);
  const last = await page.locator('.reel').last().boundingBox(), ob = await older.boundingBox();
  expect(Math.abs(ob.x + ob.width - (last.x + last.width))).toBeLessThan(last.width);
  await older.click();
  await expect(page.locator('#all-eps')).toHaveJSProperty('open', true);
});

test('the premiere refresh does not restart a playing video, but still moves the NEW badge', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.clock.install({ time: new Date('2026-09-27T16:59:30Z') }); // c11 premieres at 17:00Z
  await page.goto('/cartoons/');
  await expect(page.locator('.reel[data-id="c10"] .new')).toHaveCount(1);
  await page.locator('.reel[data-id="c3"]').click();
  await expect(page.locator('#screen-content iframe')).toHaveCount(1);
  await page.locator('#screen-content iframe').evaluate(f => { f.dataset.marker = 'same'; });
  await page.clock.runFor('01:00');
  await expect(page.locator('.reel[data-id="c11"]')).toHaveAttribute('data-soon', 'false');
  await expect(page.locator('.reel[data-id="c11"] .new')).toHaveCount(1);
  await expect(page.locator('.reel[data-id="c10"] .new')).toHaveCount(0);
  await expect(page.locator('#screen-content iframe[data-marker="same"]')).toHaveCount(1);
  await expect(page.locator('.reel[data-id="c3"]')).toHaveAttribute('aria-current', 'true');
  expect(errors).toEqual([]);
});

test('the premiere refresh turns a previewed coming-soon card into a playable preview', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.clock.install({ time: new Date('2026-09-27T16:59:30Z') });
  await page.goto('/cartoons/#ep=c11');
  await expect(page.locator('#screen')).toHaveAttribute('data-mode', 'soon');
  await page.clock.runFor('01:00');
  await expect(page.locator('#screen')).toHaveAttribute('data-mode', 'preview');
  await expect(page.locator('#screen-content .play')).toHaveCount(1);
});

test('keyboard: after the play button, focus stays on the page so Esc stops playback', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  await page.locator('.reel[data-id="c3"]').hover();
  await page.locator('.play').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#screen-content iframe')).toHaveCount(1);
  await expect(page.locator('#screen')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#screen-content iframe')).toHaveCount(0);
  await expect(page.locator('#screen')).toHaveAttribute('data-mode', 'preview');
});

test('phone: the focused skip link paints above the sticky screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await open(page);
  const skip = page.locator('.skip-link');
  await skip.focus();
  const hit = await skip.evaluate(el => {
    document.querySelector('.screen-wrap').style.pointerEvents = 'auto'; // so the hit test sees the whole sticky layer
    const r = el.getBoundingClientRect();
    return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === el;
  });
  expect(hit).toBe(true);
});

test('coming-soon art and a failed thumbnail fall back to the reel icon when the prop image fails', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route(/props\/c1[01]\.webp$/, r => r.fulfill({ status: 404, body: '' }));
  await open(page, '2026-09-27T12:00:00Z'); // c10 is out, c11 is coming soon
  await page.locator('.reel[data-id="c11"]').hover();
  await expect(page.locator('#screen')).toHaveAttribute('data-mode', 'soon');
  await expect(page.locator('#screen-content .soon-art')).toHaveAttribute('src', 'props/placeholder-reel.svg');
  await page.locator('.reel[data-id="c10"]').hover(); // YouTube thumbnail aborted, then the prop art 404s
  await expect(page.locator('#screen-content .thumb')).toHaveAttribute('src', 'props/placeholder-reel.svg');
});

for (const [w, h] of [[375, 812], [390, 844]]) {
  test(`phone dialog: no list row is clipped at ${w}px`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await open(page, '2026-09-27T12:00:00Z'); // four premiere badges
    await page.locator('#all-btn').click();
    await expect(page.locator('#all-list .ep-item')).toHaveCount(14);
    const bad = await page.evaluate(() => {
      const ul = document.getElementById('all-list'), u = ul.getBoundingClientRect();
      const out = [];
      if (ul.scrollWidth > ul.clientWidth) out.push('list scrolls sideways');
      document.querySelectorAll('#all-list .ep-item').forEach(b => {
        const r = b.getBoundingClientRect();
        if (b.scrollWidth > b.clientWidth) out.push(b.dataset.id + ' overflows');
        if (r.right > u.right + 0.5) out.push(b.dataset.id + ' wider than the list');
        b.querySelectorAll('.t,.d,.badge').forEach(s => { if (s.getBoundingClientRect().right > r.right + 0.5) out.push(b.dataset.id + ' ' + s.className + ' clipped'); });
      });
      return out;
    });
    expect(bad).toEqual([]);
    await expect(page.locator('.ep-item[data-id="c14"] .badge')).toHaveText('Premieres 1 Oct');
  });
}

const boxHit = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

for (const [w, h] of [[1366, 768], [1440, 900], [667, 375]]) {
  test(`landscape episode on the last reel: watch link, title tag and Older never overlap at ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await open(page);
    const c2 = page.locator('.reel[data-id="c2"]');
    await c2.focus();
    await expect(page.locator('#screen')).toHaveAttribute('data-format', 'landscape');
    await settled(page);
    const tag = await c2.locator('.tag').boundingBox(), link = await page.locator('#watch-link').boundingBox();
    const older = await page.locator('.end-mark.older').boundingBox(), scr = await page.locator('#screen').boundingBox();
    expect(boxHit(tag, link), 'tag / watch link').toBe(false);
    expect(boxHit(tag, older), 'tag / Older').toBe(false);
    expect(boxHit(link, older), 'watch link / Older').toBe(false);
    expect(boxHit(link, scr), 'watch link / screen').toBe(false);
    expect(link.y + link.height).toBeLessThanOrEqual(h);
    expect(Math.abs(link.x + link.width / 2 - (scr.x + scr.width / 2))).toBeLessThan(2); // centred under the screen
    expect(older.x + older.width).toBeLessThanOrEqual(w);
  });
}

test('landscape phone 667x375: reel hit areas are at least 36 px and never overlap; portrait watch link sits under the screen', async ({ page }) => {
  await page.setViewportSize({ width: 667, height: 375 });
  await open(page);
  const hs = await page.evaluate(() => [...document.querySelectorAll('.reel')].map(b => {
    const r = b.getBoundingClientRect(), s = getComputedStyle(b, '::before');
    const d = Math.max(r.width, parseFloat(s.width));
    return { id: b.dataset.id, x: r.left + r.width / 2, y: r.top + r.height / 2, d };
  }));
  const bad = [];
  for (const a of hs) {
    if (a.d < 36) bad.push(a.id + ' ' + a.d.toFixed(1) + ' px');
    for (const b of hs) if (a !== b && Math.abs(a.x - b.x) < (a.d + b.d) / 2 && Math.abs(a.y - b.y) < (a.d + b.d) / 2) bad.push(a.id + '/' + b.id);
  }
  expect(bad).toEqual([]);
  const scene = await page.locator('#scene').boundingBox();
  expect(scene.height).toBeGreaterThanOrEqual(345);
  await page.locator('.reel[data-id="c3"]').focus();
  await settled(page);
  const link = await page.locator('#watch-link').boundingBox(), scr = await page.locator('#screen').boundingBox();
  expect(link.y).toBeGreaterThanOrEqual(scr.y + scr.height);
  expect(link.y + link.height).toBeLessThanOrEqual(375);
});

for (const [w, h] of [[390, 844], [768, 1024]]) {
  test(`watch link is at least 32 px tall at ${w}px`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await open(page);
    for (const id of ['c3', 'c2']) {
      await page.locator(`.reel[data-id="${id}"]`).focus();
      await expect(page.locator('#watch-link')).toBeVisible();
      expect((await page.locator('#watch-link').boundingBox()).height, id).toBeGreaterThanOrEqual(32);
    }
  });
}

test('stacked phone: a landscape episode shrinks the sticky screen area to the screen and its link', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  const wrap = page.locator('.screen-wrap');
  const idle = (await wrap.boundingBox()).height;
  await page.locator('.reel[data-id="c2"]').focus();
  await expect(page.locator('#screen')).toHaveAttribute('data-format', 'landscape');
  const w = await wrap.boundingBox(), link = await page.locator('#watch-link').boundingBox();
  expect(w.height).toBeLessThan(idle - 40);
  expect(w.y + w.height - (link.y + link.height)).toBeLessThanOrEqual(20);
  expect(w.y + w.height).toBeGreaterThanOrEqual(link.y + link.height);
  const first = await page.locator('.reel[data-slot="0"]').boundingBox();
  expect(first.y).toBeGreaterThanOrEqual(w.y + w.height);
});

test('phone: back link and All episodes have 44 px tap targets; small labels stay readable', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await open(page, '2026-09-28T06:00:00Z');
  for (const sel of ['.topbar a', '#all-btn']) {
    const ok = await page.locator(sel).evaluate(el => {
      const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      return [[cx, cy - 21], [cx, cy + 21], [cx - 21, cy], [cx + 21, cy]].every(([x, y]) => {
        const hit = document.elementFromPoint(x, Math.max(y, 0));
        return !!hit && (hit === el || el.contains(hit));
      });
    });
    expect(ok, sel).toBe(true);
  }
  const px = sel => page.locator(sel).first().evaluate(e => parseFloat(getComputedStyle(e).fontSize));
  expect(await px('.reel .new')).toBeGreaterThanOrEqual(0.62 * 16 - 0.01);
  expect(await px('.end-mark.latest')).toBeGreaterThanOrEqual(0.75 * 16 - 0.01);
  expect(await px('.end-mark.older')).toBeGreaterThanOrEqual(0.75 * 16 - 0.01);
  expect(await page.locator('.reel[data-id="c12"]').evaluate(e => getComputedStyle(e).backgroundColor)).toBe('rgba(11, 16, 38, 0.5)');
});

test('narrow portrait screen: the title wraps balanced and stays inside the screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await open(page);
  await page.locator('.reel[data-id="c8"]').focus(); // "The 6 AM Negotiation"
  const m = await page.evaluate(() => {
    const s = document.querySelector('#screen-content strong'), r = s.getBoundingClientRect();
    const scr = document.getElementById('screen').getBoundingClientRect(), cs = getComputedStyle(s);
    return { wrap: cs.textWrap || cs.textWrapStyle, l: r.left, r: r.right, sl: scr.left, sr: scr.right };
  });
  expect(m.wrap).toMatch(/balance/);
  expect(m.l).toBeGreaterThanOrEqual(m.sl);
  expect(m.r).toBeLessThanOrEqual(m.sr);
});

test('1024x768: the spare band above the scene fades to night', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await open(page);
  const bg = await page.locator('#theatre').evaluate(e => getComputedStyle(e, '::before').backgroundImage);
  expect(bg).toMatch(/^linear-gradient\(rgb\(11, 16, 38\)/);
});
