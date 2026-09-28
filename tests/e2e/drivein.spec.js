const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
// A 1x1 PNG standing in for a YouTube thumbnail where a test needs one to load.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

// Never hit YouTube from tests: thumbnails fall back to the reel icon, iframes stay blank.
test.beforeEach(async ({ page }) => {
  await page.route(/(youtube-nocookie\.com|ytimg\.com|youtube\.com)/, r => r.abort());
});

// Layout tests run on a frozen 14-episode catalogue (pilot..c14, c2 landscape on the last reel), so adding a new
// episode to cartoons/episodes.json never shifts the reels under them. The live catalogue has its own test below.
const FIXTURE = fs.readFileSync(path.join(__dirname, 'fixtures/episodes-14.json'), 'utf8');

async function open(page, when = '2026-10-05T00:00:00Z') {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/cartoons/episodes.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: FIXTURE }));
  await page.clock.setFixedTime(new Date(when));
  await page.goto('/cartoons/');
  await expect(page.locator('.reel[data-id]')).toHaveCount(13);
  return errors;
}

// Synthetic catalogue, one day apart, oldest first. Even ids carry a legacy `image` field, which the page ignores.
const day = i => new Date(Date.parse('2026-01-01T00:00:00+08:00') + i * 864e5).toISOString().replace('.000Z', 'Z');
const synthCat = n => Array.from({ length: n }, (_, i) => Object.assign({
  id: 'e' + i, title: 'Episode ' + i, youtube: ('y' + String(i).padStart(10, '0')).slice(0, 11), format: 'portrait',
  premiere: day(i), prop: ['poster', 'poster', 'snack', 'booth'][i] || 'car',
}, i % 2 ? {} : { image: 'props/e' + i + '.webp', alt: 'Prop ' + i }));

async function openSynth(page, n = 30, hash = '') {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/cartoons/episodes.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(synthCat(n)) }));
  await page.clock.setFixedTime(new Date('2026-10-05T00:00:00Z'));
  await page.goto('/cartoons/' + hash);
  await expect(page.locator('.reel[data-id]')).toHaveCount(Math.min(n, 13));
  return errors;
}

// Portrait layout geometry: scene size/position and where the seam, the wall bottom and the screen land (viewport px).
function portraitGeometry() {
  const L = window.DriveIn.DEFAULT_LAYOUT, sc = document.getElementById('scene').getBoundingClientRect();
  const s = document.getElementById('screen').getBoundingClientRect(), lot = document.getElementById('lot');
  return { scH: sc.height, scW: sc.width, scTop: sc.top, seam: sc.top + sc.height * L.seam / 100, wall: sc.top + sc.height * L.wall.b / 100,
           sTop: s.top, sBot: s.bottom, sL: s.left, sW: s.width, sH: s.height, scrollLeft: lot.scrollLeft, maxScroll: lot.scrollWidth - lot.clientWidth,
           pageX: document.documentElement.scrollWidth - innerWidth, pageY: document.documentElement.scrollHeight - innerHeight };
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

test('tablet portrait uses the portrait layout: the scene fills the height and the screen sits on the seam', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await open(page);
  const m = await page.evaluate(portraitGeometry);
  expect(Math.abs(m.scH - 1024)).toBeLessThanOrEqual(1);
  expect(Math.abs(m.sTop - m.seam)).toBeLessThanOrEqual(1);
  expect(Math.abs(m.sBot - m.wall)).toBeLessThanOrEqual(1);
  expect(m.scW).toBeGreaterThan(768);
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
  await open(page, '2026-09-27T12:00:00Z');
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

test('list thumbnails: YouTube thumbnails for released episodes, the reel icon when one fails', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const failId = synthCat(30)[27].youtube;
  await page.route(/i\.ytimg\.com/, r => r.request().url().includes(failId) ? r.abort() : r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  const errors = await openSynth(page);
  await page.locator('#all-btn').click();
  const e5 = page.locator('.ep-item[data-id="e5"] img');
  await expect(e5).toHaveAttribute('src', 'https://i.ytimg.com/vi/' + synthCat(30)[5].youtube + '/hqdefault.jpg');
  await expect(e5).toHaveClass('yt');
  expect(await e5.evaluate(i => getComputedStyle(i).objectFit)).toBe('cover');
  await page.locator('.ep-item[data-id="e27"]').scrollIntoViewIfNeeded();
  const e27 = page.locator('.ep-item[data-id="e27"] img');
  await expect(e27).toHaveAttribute('src', 'art/reel.svg');
  await expect(e27).not.toHaveClass('yt');
  expect(errors).toEqual([]);
});

test('list thumbnails: coming-soon episodes show the reel icon and never request their YouTube thumbnail', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const ytRequests = [];
  page.on('request', r => { if (/ytimg\.com/.test(r.url())) ytRequests.push(r.url()); });
  await open(page, '2026-09-27T12:00:00Z'); // c10 is out; c11..c14 are coming soon
  await page.locator('#all-btn').click();
  for (const id of ['c11', 'c12', 'c13', 'c14'])
    await expect(page.locator(`.ep-item[data-id="${id}"] img`)).toHaveAttribute('src', 'art/reel.svg');
  await expect(page.locator('.ep-item[data-id="c10"] img')).toHaveAttribute('src', /i\.ytimg\.com\/vi\/sbbO2273RNc\/hqdefault\.jpg$|art\/reel\.svg$/);
  for (const yt of ['0tqDl-UKomE', 'fTT7cx6ap8s', 'vIue1jLRDuw', '4COtDWxmMLQ'])
    expect(ytRequests.filter(u => u.includes(yt))).toEqual([]);
});

test('no prop art anywhere: no img points at props/ and nothing requests it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const propRequests = [];
  page.on('request', r => { if (/\/cartoons\/props\//.test(r.url())) propRequests.push(r.url()); });
  const errors = await openSynth(page); // even ids carry a legacy image: props/eN.webp
  await page.locator('.reel[data-id="e29"]').hover();
  await page.locator('#all-btn').click();
  await page.locator('.ep-item[data-id="e0"]').scrollIntoViewIfNeeded();
  await page.locator('.ep-item[data-id="e0"]').click(); // archive-only: previews on the screen
  await expect(page.locator('#screen')).toHaveAttribute('data-mode', 'preview');
  expect(await page.locator('img').evaluateAll(is => is.map(i => i.getAttribute('src')).filter(s => /props\//.test(s || '')))).toEqual([]);
  expect(propRequests).toEqual([]);
  expect(errors).toEqual([]);
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
  await page.route('**/cartoons/episodes.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: FIXTURE }));
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
  await page.route('**/cartoons/episodes.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: FIXTURE }));
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
  await page.route('**/cartoons/episodes.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: FIXTURE }));
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
  await page.route('**/cartoons/episodes.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: FIXTURE }));
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
  await page.route('**/cartoons/episodes.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: FIXTURE }));
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

test('phone: the focused skip link paints above the screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await open(page);
  const skip = page.locator('.skip-link');
  await skip.focus();
  const hit = await skip.evaluate(el => {
    document.querySelector('.screen-wrap').style.pointerEvents = 'auto'; // so the hit test sees the whole screen layer
    const r = el.getBoundingClientRect();
    return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === el;
  });
  expect(hit).toBe(true);
});

test('coming-soon card shows the reel icon (no YouTube request); a failed thumbnail falls back to the reel icon', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const ytRequests = [];
  page.on('request', r => { if (/ytimg\.com/.test(r.url())) ytRequests.push(r.url()); });
  await open(page, '2026-09-27T12:00:00Z'); // c10 is out, c11 is coming soon
  await page.locator('.reel[data-id="c11"]').hover();
  await expect(page.locator('#screen')).toHaveAttribute('data-mode', 'soon');
  await expect(page.locator('#screen-content .soon-art')).toHaveAttribute('src', 'art/reel.svg');
  expect(ytRequests.filter(u => u.includes('0tqDl-UKomE'))).toEqual([]);
  await page.locator('.reel[data-id="c10"]').hover(); // YouTube thumbnail aborted (beforeEach)
  await expect(page.locator('#screen-content .thumb')).toHaveAttribute('src', 'art/reel.svg');
});

test('released preview shows the YouTube thumbnail when it loads', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route(/i\.ytimg\.com/, r => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await open(page, '2026-09-27T12:00:00Z');
  await page.locator('.reel[data-id="c10"]').hover();
  const t = page.locator('#screen-content .thumb');
  await expect(t).toHaveAttribute('src', 'https://i.ytimg.com/vi/sbbO2273RNc/hqdefault.jpg');
  expect(await t.evaluate(i => i.complete && i.naturalWidth > 0)).toBe(true);
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

// Portrait phones: the whole scene fills the viewport height and scrolls sideways behind a screen that stays put.
async function phone(browser, testInfo, w, h) {
  const ctx = await browser.newContext({ baseURL: testInfo.project.use.baseURL, viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.route(/(youtube-nocookie\.com|ytimg\.com|youtube\.com)/, r => r.abort());
  const errors = await open(page, '2026-09-28T06:00:00Z');
  return { ctx, page, errors };
}
// every reel's hit area (the button or its padded ::before) in viewport px
const reelsNow = page => page.evaluate(() => [...document.querySelectorAll('.reel')].map(b => {
  const r = b.getBoundingClientRect(), s = getComputedStyle(b, '::before');
  const d = Math.max(r.width, parseFloat(s.width)), x = r.left + r.width / 2, y = r.top + r.height / 2;
  return { id: b.dataset.id, x, y, d, l: x - d / 2, r: x + d / 2, t: y - d / 2, b: y + d / 2 };
}));

for (const [w, h] of [[375, 812], [390, 844], [412, 915]]) {
  test(`phone ${w}x${h}: the scene fills the viewport, the screen spans seam to wall bottom and stays put while the lot scrolls`, async ({ browser }, testInfo) => {
    const { ctx, page, errors } = await phone(browser, testInfo, w, h);
    const m = await page.evaluate(portraitGeometry);
    expect(Math.abs(m.scH - h), 'scene fills the height').toBeLessThanOrEqual(1);
    expect(m.scTop).toBeGreaterThanOrEqual(-0.5);
    expect(m.scW).toBeGreaterThan(3 * w); // much wider than the phone: it scrolls sideways
    expect(Math.abs(m.sTop - m.seam), 'screen top on the seam').toBeLessThanOrEqual(1);
    expect(Math.abs(m.sBot - m.wall), 'screen bottom on the wall bottom').toBeLessThanOrEqual(1);
    expect(Math.abs(m.sW - m.sH * 9 / 16)).toBeLessThanOrEqual(1);
    expect(Math.abs(m.sL + m.sW / 2 - w / 2), 'screen centred').toBeLessThanOrEqual(1);
    expect(m.pageX, 'no horizontal page scroll').toBe(0);
    expect(m.pageY, 'no vertical page scroll').toBe(0);
    // the lot starts with the barn wall centred under the screen
    expect(Math.abs(m.scrollLeft - m.maxScroll / 2)).toBeLessThanOrEqual(1);
    const before = await reelsNow(page);
    await page.locator('#lot').evaluate(e => { e.scrollLeft = 0; });
    const left = await page.evaluate(portraitGeometry), atLeft = await reelsNow(page);
    expect(left.scrollLeft).toBe(0);
    expect(Math.abs(left.sL - m.sL), 'screen x unchanged').toBeLessThanOrEqual(0.5);
    expect(Math.abs(left.sTop - m.sTop)).toBeLessThanOrEqual(0.5);
    for (const [i, r] of atLeft.entries()) expect(Math.abs(r.x - before[i].x - m.scrollLeft), r.id + ' moves with the scene').toBeLessThanOrEqual(1);
    await page.locator('#lot').evaluate(e => { e.scrollLeft = e.scrollWidth; });
    const right = await page.evaluate(portraitGeometry);
    expect(right.scrollLeft).toBeGreaterThan(m.scrollLeft);
    expect(Math.abs(right.sL - m.sL), 'screen x unchanged').toBeLessThanOrEqual(0.5);
    expect(right.pageX).toBe(0);
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test(`phone ${w}x${h}: a horizontal swipe on the scene scrolls the lot, not the page`, async ({ browser }, testInfo) => {
    const { ctx, page, errors } = await phone(browser, testInfo, w, h);
    const start = await page.locator('#lot').evaluate(e => e.scrollLeft);
    const cdp = await ctx.newCDPSession(page);
    const drag = async (x, y, dx) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (let i = 1; i <= 10; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * i / 10, y }] });
        await page.waitForTimeout(16);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    // a finger drag right-to-left across the hay bales below the screen
    await drag(Math.round(w * 0.8), Math.round(h * 0.8), -Math.round(w * 0.5));
    await expect.poll(() => page.locator('#lot').evaluate(e => e.scrollLeft)).toBeGreaterThan(start + 20);
    expect(await page.evaluate(() => [scrollX, scrollY])).toEqual([0, 0]);
    // and over the idle screen too (it lets swipes through to the scene)
    await page.waitForTimeout(400); // let the fling settle
    const mid = await page.locator('#lot').evaluate(e => e.scrollLeft);
    await drag(Math.round(w * 0.3), Math.round(h * 0.4), Math.round(w * 0.4));
    await expect.poll(() => page.locator('#lot').evaluate(e => e.scrollLeft)).toBeLessThan(mid - 20);
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test(`phone ${w}x${h}: reel hit areas are at least 44 px, never overlap, clear the topbar and are never covered by the screen`, async ({ browser }, testInfo) => {
    const { ctx, page, errors } = await phone(browser, testInfo, w, h);
    const hs = await reelsNow(page), bad = [];
    for (const a of hs) {
      if (a.d < 44) bad.push(a.id + ' ' + a.d.toFixed(1) + ' px');
      for (const b of hs) if (a !== b && Math.abs(a.x - b.x) < (a.d + b.d) / 2 && Math.abs(a.y - b.y) < (a.d + b.d) / 2) bad.push(a.id + '/' + b.id);
    }
    expect(bad).toEqual([]);
    const bb = await page.locator('#all-btn').boundingBox();
    expect(Math.min(...hs.map(r => r.t)), 'reels clear the All episodes tap target').toBeGreaterThanOrEqual(bb.y + bb.height / 2 + 22);
    const scr = await page.locator('#screen').boundingBox();
    for (const r of hs) expect(r.y, r.id + ' centre above the screen').toBeLessThan(scr.y);
    // at every scroll position the reel's centre hits the reel, never the screen
    const covered = await page.evaluate(() => [...document.querySelectorAll('.reel')].filter(p => {
      p.scrollIntoView({ inline: 'center', block: 'nearest' });
      const r = p.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !hit || hit.closest('.reel') !== p;
    }).map(p => p.dataset.id));
    expect(covered).toEqual([]);
    // with the barn wall centred, the reels over the screen sit wholly above it
    await page.locator('#lot').evaluate(e => { e.scrollLeft = (e.scrollWidth - e.clientWidth) / 2; });
    const over = (await reelsNow(page)).filter(r => r.r > scr.x && r.l < scr.x + scr.width);
    expect(over.length).toBeGreaterThan(0);
    for (const r of over) expect(r.b, r.id).toBeLessThanOrEqual(scr.y);
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test(`phone ${w}x${h}: a landscape episode fits the width with its top on the seam; the link sits under it`, async ({ browser }, testInfo) => {
    const { ctx, page, errors } = await phone(browser, testInfo, w, h);
    await page.locator('.reel[data-id="c2"]').tap();
    await expect(page.locator('#screen')).toHaveAttribute('data-format', 'landscape');
    await settled(page);
    const m = await page.evaluate(portraitGeometry);
    expect(m.sW).toBeLessThanOrEqual(w);
    expect(m.sL).toBeGreaterThanOrEqual(0);
    expect(Math.abs(m.sTop - m.seam)).toBeLessThanOrEqual(1);
    expect(Math.abs(m.sW / m.sH - 16 / 9)).toBeLessThan(0.02);
    expect(m.sBot).toBeLessThanOrEqual(m.wall + 1);
    const link = await page.locator('#watch-link').boundingBox();
    expect(link.y).toBeGreaterThanOrEqual(m.sBot);
    expect(link.height).toBeGreaterThanOrEqual(32);
    expect(link.x + link.width).toBeLessThanOrEqual(w);
    // Older / Latest scroll behind the wide picture instead of covering it (title tags still paint above)
    const z = sel => page.locator(sel).evaluate(e => +getComputedStyle(e).zIndex);
    expect(await z('.end-mark.older')).toBeLessThan(await z('.screen-wrap'));
    expect(await z('.reel[data-id="c2"]')).toBeGreaterThan(await z('.screen-wrap'));
    expect(m.pageX).toBe(0);
    expect(errors).toEqual([]);
    await ctx.close();
  });
}

test('phone: tapping a reel previews it, a second tap plays; the title tag paints above the screen and the watch link sits under it', async ({ browser }, testInfo) => {
  const { ctx, page, errors } = await phone(browser, testInfo, 390, 844);
  const c9 = page.locator('.reel[data-id="c9"]'); // over the screen at the initial (wall-centred) scroll
  await c9.tap();
  await expect(page.locator('#screen')).toHaveAttribute('data-mode', 'preview');
  await expect(c9.locator('.tag')).toBeVisible();
  const scr = await page.locator('#screen').boundingBox();
  const t = await c9.locator('.tag .t').boundingBox();
  expect(t.x + t.width / 2).toBeGreaterThan(scr.x);
  expect(t.x + t.width / 2).toBeLessThan(scr.x + scr.width);
  expect(t.y + t.height, 'the title tag reaches over the screen').toBeGreaterThan(scr.y);
  // and draws above it: the lot is no stacking context, so the reel (z 12) paints over the screen layer (z 10)
  expect(await page.locator('#lot').evaluate(e => getComputedStyle(e).zIndex)).toBe('auto');
  expect(+await c9.evaluate(e => getComputedStyle(e).zIndex)).toBeGreaterThan(+await page.locator('.screen-wrap').evaluate(e => getComputedStyle(e).zIndex));
  const link = await page.locator('#watch-link').boundingBox();
  expect(link.height).toBeGreaterThanOrEqual(32);
  expect(link.y).toBeGreaterThanOrEqual(scr.y + scr.height);
  expect(link.y + link.height).toBeLessThanOrEqual(844);
  expect(Math.abs(link.x + link.width / 2 - 195)).toBeLessThanOrEqual(1);
  for (const r of await reelsNow(page)) expect(boxHit(link, { x: r.l, y: r.t, width: r.d, height: r.d }), r.id).toBe(false);
  await page.locator('#lot').evaluate(e => { e.scrollLeft = 0; }); // the link stays put when the lot scrolls
  expect(Math.abs((await page.locator('#watch-link').boundingBox()).x - link.x)).toBeLessThanOrEqual(0.5);
  await c9.tap();
  await expect(page.locator('#screen-content iframe')).toHaveAttribute('src', /3mm3QSeXjo8/);
  expect(errors).toEqual([]);
  await ctx.close();
});

test('phones show a swipe hint on the idle screen; desktop keeps "Pick a reel to preview"', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await open(page);
  await expect(page.locator('#screen-content .hint-touch.swipe')).toBeVisible();
  await expect(page.locator('#screen-content .hint-touch.swipe')).toContainText('Swipe left or right');
  await expect(page.locator('#screen-content .hint-desk')).toBeHidden();
  await ctx.close();
  const desk = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await open(desk);
  await expect(desk.locator('#screen-content .hint-desk')).toBeVisible();
  await expect(desk.locator('#screen-content .hint-touch').first()).toBeHidden();
  await desk.close();
});

test('live catalogue: newest episode hangs on the first reel, the 13 newest fill the reels', async ({ page }) => {
  const live = JSON.parse(fs.readFileSync(path.join(__dirname, '../../cartoons/episodes.json'), 'utf8'));
  const newest = live.map((e, i) => ({ e, i })).sort((a, b) => (Date.parse(b.e.premiere) - Date.parse(a.e.premiere)) || (b.i - a.i))
    .slice(0, 13).map(x => x.e.id);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.clock.setFixedTime(new Date('2026-10-05T00:00:00Z'));
  await page.goto('/cartoons/');
  await expect(page.locator('.reel[data-id]')).toHaveCount(Math.min(live.length, 13));
  expect(await page.locator('.reel[data-id]').evaluateAll(els => els.map(e => e.dataset.id))).toEqual(newest);
  expect(errors).toEqual([]);
});
