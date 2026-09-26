# Nikeverse Cartoons Drive-In Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `nikepig.com/cartoons/`, an illustrated night drive-in where each Nikeverse episode is a prop. Hovering (or tapping) a prop previews that episode on a shape-shifting screen, and a click plays the embedded YouTube video. The main site links to it.

**Architecture:**
- **Static files only.** No build step, the same as the main site.
- **Pure logic in `cartoons/drivein-core.js`:** validation, premiere gating, the layout engine, the interaction reducer and URL helpers. It's written as a UMD script, so the page loads it with a plain `<script>` and Node unit tests `require()` it.
- **The page (`cartoons/index.html`)** holds markup, CSS and a small boot script that renders and wires events.
- **The catalogue** is `cartoons/episodes.json`, mirrored into an inline JSON fallback.
- **Art:** placeholder SVGs first. The final Tripo3D art is swapped in at the end (spec, "Build order").

> Deviation from the spec's single-file house style: the pure logic lives in one extra file (`drivein-core.js`) so it can be unit-tested with no dependencies. It's still static, with no build step.

**Tech Stack:**
- The page: HTML, CSS and vanilla JS (ES2020).
- Unit tests: Node 22 `node:test`.
- End-to-end tests: `@playwright/test`, pinned to 1.56.1 to match the Chromium 1194 build already installed at `%LOCALAPPDATA%\ms-playwright`.
- Local server: `python -m http.server`.

**Spec:** `docs/superpowers/specs/2026-09-26-nikeverse-cartoons-drive-in-design.md`
**Branch:** `claude/paddle-payments-setup-0h567q`. Commit and push there only. **Never push `main`**, because that publishes the site. Merging needs the user's explicit go.

---

## File map

| File | Responsibility |
|---|---|
| `cartoons/drivein-core.js` (create) | Pure functions: `validateEpisodes`, `isComingSoon`, `layoutProps`, `reduce`, URL helpers, `DEFAULT_LAYOUT` |
| `cartoons/episodes.json` (create) | Launch catalogue, 14 entries |
| `cartoons/index.html` (create) | Page markup, CSS, boot script, inline `episodes-fallback` JSON |
| `cartoons/art/*.svg` (create) | Placeholder background, lot extension and screen frame |
| `cartoons/props/placeholder-{car,poster,snack,booth}.svg` (create) | Placeholder props |
| `assets/art/title-cartoons.svg` (create; replaced by `.webp` in Task 11) | Main-site card title sticker |
| `index.html` (modify: line 535 nav, grid block ending line 647) | "Cartoons" nav link and Nikeverse grid card |
| `tests/package.json` (create) | Dev-only test dependencies |
| `tests/playwright.config.js` (create) | E2E config plus a static server |
| `tests/unit/core.test.js` (create) | Unit tests for `drivein-core.js` |
| `tests/tools/sync-fallback.js` (create) | Copies `episodes.json` into the inline fallback |
| `tests/e2e/drivein.spec.js` (create) | Page behaviour tests |
| `tests/e2e/mainsite.spec.js` (create) | Main-site link and card regression tests |
| `docs/branch-log.md`, `CLAUDE.md` (modify) | Docs step |

All commands run from the repo root `C:\Users\loopy\nikepig-website` in Git Bash unless noted.

---

### Task 1: Test harness

**Files:**
- Create: `tests/package.json`, `tests/playwright.config.js`, `tests/.gitignore`

- [ ] **Step 1: Create `tests/package.json`**

```json
{
  "name": "nikepig-website-tests",
  "private": true,
  "scripts": {
    "unit": "node --test unit/",
    "e2e": "playwright test",
    "sync": "node tools/sync-fallback.js"
  },
  "devDependencies": {
    "@playwright/test": "1.56.1"
  }
}
```

- [ ] **Step 2: Create `tests/.gitignore`**

```
node_modules/
test-results/
playwright-report/
```

- [ ] **Step 3: Create `tests/playwright.config.js`**

```js
const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './e2e',
  timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:8123' },
  webServer: {
    command: 'python -m http.server 8123 --bind 127.0.0.1',
    cwd: '..',
    url: 'http://127.0.0.1:8123/index.html',
    reuseExistingServer: true,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
```

- [ ] **Step 4: Install and verify the browser binary is found**

Run: `cd tests && npm install && npx playwright --version`
Expected: `Version 1.56.1`. If Playwright reports a missing Chromium, run `npx playwright install chromium` (downloads ~150 MB) and note it in the branch log.

- [ ] **Step 5: Commit**

```bash
git add tests/package.json tests/package-lock.json tests/playwright.config.js tests/.gitignore docs/superpowers/plans/2026-09-26-nikeverse-cartoons-drive-in.md
git commit -m "test: add node:test + Playwright harness for the cartoons page"
```

---

### Task 2: Core: episode validation and premiere gating

**Files:**
- Create: `cartoons/drivein-core.js`
- Test: `tests/unit/core.test.js`

- [ ] **Step 1: Write the failing tests**

`tests/unit/core.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../../cartoons/drivein-core.js');

const ep = (o = {}) => Object.assign({
  id: 'c3', title: '45-Minute Diner Wait', youtube: 'rt7cQLtGyEE', format: 'portrait',
  premiere: '2026-09-01T00:00:00+08:00', prop: 'car', image: 'props/placeholder-car.svg', alt: 'A car',
}, o);

test('validateEpisodes accepts a good entry and adds premiereMs', () => {
  const [e] = D.validateEpisodes([ep()]);
  assert.equal(e.premiereMs, Date.parse('2026-09-01T00:00:00+08:00'));
});

test('validateEpisodes rejects bad input', () => {
  assert.throws(() => D.validateEpisodes({}), /array/);
  assert.throws(() => D.validateEpisodes([ep({ title: '' })]), /missing title/);
  assert.throws(() => D.validateEpisodes([ep({ youtube: 'short' })]), /bad youtube/);
  assert.throws(() => D.validateEpisodes([ep({ format: 'square' })]), /bad format/);
  assert.throws(() => D.validateEpisodes([ep({ prop: 'boat' })]), /bad prop/);
  assert.throws(() => D.validateEpisodes([ep({ premiere: 'soon' })]), /bad premiere/);
  assert.throws(() => D.validateEpisodes([ep(), ep()]), /duplicate id/);
});

test('isComingSoon flips exactly at the premiere instant', () => {
  const [e] = D.validateEpisodes([ep({ id: 'c10', premiere: '2026-09-27T01:00:00+08:00' })]);
  assert.equal(D.isComingSoon(e, Date.parse('2026-09-26T16:59:00Z')), true);
  assert.equal(D.isComingSoon(e, Date.parse('2026-09-26T17:00:00Z')), false);
  assert.equal(D.isComingSoon(e, Date.parse('2026-09-26T17:01:00Z')), false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd tests && npm run unit`
Expected: FAIL with `Cannot find module '../../cartoons/drivein-core.js'`

- [ ] **Step 3: Write the minimal implementation**

`cartoons/drivein-core.js`:

```js
/* Nikeverse Cartoons drive-in: pure logic (no DOM). UMD: window.DriveIn in the page, require() in tests. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DriveIn = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var PROP_TYPES = ['car', 'poster', 'snack', 'booth'];
  var FORMATS = ['portrait', 'landscape'];
  var FIELDS = ['id', 'title', 'youtube', 'format', 'premiere', 'prop', 'image', 'alt'];
  var YT_ID = /^[A-Za-z0-9_-]{11}$/;

  function validateEpisodes(list) {
    if (!Array.isArray(list)) throw new Error('episodes must be an array');
    var seen = {};
    return list.map(function (e, i) {
      var where = 'episode[' + i + ']';
      FIELDS.forEach(function (k) {
        if (typeof e[k] !== 'string' || !e[k]) throw new Error(where + ': missing ' + k);
      });
      if (seen[e.id]) throw new Error(where + ': duplicate id ' + e.id);
      seen[e.id] = true;
      if (!YT_ID.test(e.youtube)) throw new Error(where + ': bad youtube id');
      if (FORMATS.indexOf(e.format) < 0) throw new Error(where + ': bad format');
      if (PROP_TYPES.indexOf(e.prop) < 0) throw new Error(where + ': bad prop');
      var t = Date.parse(e.premiere);
      if (isNaN(t)) throw new Error(where + ': bad premiere');
      return Object.assign({}, e, { premiereMs: t });
    });
  }

  function isComingSoon(ep, nowMs) { return nowMs < ep.premiereMs; }

  return { validateEpisodes: validateEpisodes, isComingSoon: isComingSoon };
});
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd tests && npm run unit`
Expected: `# pass 3`, `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add cartoons/drivein-core.js tests/unit/core.test.js
git commit -m "feat(cartoons): episode validation and premiere gating"
```

---

### Task 3: Core: layout engine

**Files:**
- Modify: `cartoons/drivein-core.js`
- Test: `tests/unit/core.test.js`

Coordinates are percentages of the **base-scene** width (x) and height (y). A prop's anchor is its bottom-centre. Prop width at scale 1 is `PROP_W` = 14% of base width. `DEFAULT_LAYOUT` holds placeholder values; Task 12 replaces them with measurements from the real art.

- [ ] **Step 1: Write the failing tests (append to `tests/unit/core.test.js`)**

```js
const L = D.DEFAULT_LAYOUT;
const mk = (n, prop = 'car') => D.validateEpisodes(Array.from({ length: n }, (_, i) =>
  ep({ id: prop + i, youtube: ('x' + String(i).padStart(10, '0')).slice(0, 11), prop })));

test('special props fill their spots in order, then fall back to car rows', () => {
  const eps = mk(3, 'poster');
  const { props } = D.layoutProps(eps, L);
  assert.equal(props[0].slot, 'poster-1');
  assert.equal(props[1].slot, 'poster-2');
  assert.match(props[2].slot, /^s0-r2-0$/); // overflow poster becomes first front-row car slot
});

test('cars fill front row first, then middle, then back; 12 per segment', () => {
  const { props, segments } = D.layoutProps(mk(12), L);
  assert.equal(segments, 1);
  assert.deepEqual(props.slice(0, 3).map(p => p.slot), ['s0-r2-0', 's0-r2-1', 's0-r2-2']);
  assert.equal(props[3].slot, 's0-r1-0');
  assert.equal(props[7].slot, 's0-r0-0');
});

test('overflow adds lot segments, offset by 100% each', () => {
  const { props, segments } = D.layoutProps(mk(30), L);
  assert.equal(segments, 3);
  assert.equal(props[12].slot, 's1-r2-0');
  assert.equal(props[12].x, 100 + L.rows[2].xs[0]);
});

test('no two props share a slot and row spacing fits the props', () => {
  const { props } = D.layoutProps(mk(30), L);
  assert.equal(new Set(props.map(p => p.slot)).size, props.length);
  for (const row of L.rows)
    for (let i = 1; i < row.xs.length; i++)
      assert.ok(row.xs[i] - row.xs[i - 1] >= D.PROP_W * row.scale, 'row too tight');
});

test('empty catalogue still yields one segment', () => {
  assert.equal(D.layoutProps([], L).segments, 1);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd tests && npm run unit`
Expected: FAIL with `D.layoutProps is not a function` (or `Cannot read properties of undefined` for `DEFAULT_LAYOUT`)

- [ ] **Step 3: Implement (add inside the factory, before `return`, and extend the returned object)**

```js
  var PROP_W = 14; // % of base-scene width at scale 1

  // Placeholder geometry; Task 12 replaces these with values measured from the final background.
  var DEFAULT_LAYOUT = {
    screen: { x: 50, top: 6, height: 58 },
    special: {
      poster: [{ x: 11, y: 74, scale: 1 }, { x: 89, y: 74, scale: 1 }],
      snack: [{ x: 21, y: 70, scale: 0.9 }],
      booth: [{ x: 79, y: 62, scale: 0.8 }]
    },
    rows: [
      { y: 72, scale: 0.55, xs: [31, 40.5, 50, 59.5, 69] },   // back
      { y: 84, scale: 0.75, xs: [30, 43.3, 56.6, 70] },       // middle
      { y: 98, scale: 1, xs: [30, 50, 70] }                   // front
    ],
    fillOrder: [2, 1, 0]
  };

  function layoutProps(episodes, L) {
    var used = {}, out = [], car = 0;
    var perSeg = L.rows.reduce(function (n, r) { return n + r.xs.length; }, 0);
    episodes.forEach(function (e) {
      var spots = L.special[e.prop];
      used[e.prop] = used[e.prop] || 0;
      if (spots && used[e.prop] < spots.length) {
        var s = spots[used[e.prop]++];
        out.push({ id: e.id, x: s.x, y: s.y, scale: s.scale, slot: e.prop + '-' + used[e.prop] });
        return;
      }
      var seg = Math.floor(car / perSeg), k = car % perSeg;
      car++;
      for (var j = 0; j < L.fillOrder.length; j++) {
        var ri = L.fillOrder[j], row = L.rows[ri];
        if (k < row.xs.length) {
          out.push({ id: e.id, x: seg * 100 + row.xs[k], y: row.y, scale: row.scale, slot: 's' + seg + '-r' + ri + '-' + k });
          return;
        }
        k -= row.xs.length;
      }
    });
    return { props: out, segments: Math.max(1, Math.ceil(car / perSeg)) };
  }
```

Returned object becomes:

```js
  return { validateEpisodes: validateEpisodes, isComingSoon: isComingSoon, layoutProps: layoutProps,
           DEFAULT_LAYOUT: DEFAULT_LAYOUT, PROP_W: PROP_W };
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd tests && npm run unit`
Expected: `# pass 8`, `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add cartoons/drivein-core.js tests/unit/core.test.js
git commit -m "feat(cartoons): layout engine with special spots, perspective rows and lot overflow"
```

---

### Task 4: Core: interaction reducer and URL helpers

**Files:**
- Modify: `cartoons/drivein-core.js`
- Test: `tests/unit/core.test.js`

Rules (spec, "Interaction" and "Clarifications"):
- `hover` previews an episode unless something is playing.
- `activate` on a coming-soon episode only previews it.
- A touch `activate` plays only if that same episode is already previewed; otherwise it previews.
- A mouse or keyboard `activate` plays.
- `escape` goes from playing back to preview.

- [ ] **Step 1: Write the failing tests (append)**

```js
const soon = new Set(['c10']);
const ctx = { comingSoon: id => soon.has(id) };
const R = (s, e) => D.reduce(s, e, ctx);

test('hover previews, but never interrupts playback', () => {
  let s = R(D.INITIAL, { type: 'hover', id: 'c3' });
  assert.deepEqual(s, { mode: 'preview', id: 'c3' });
  s = R(s, { type: 'activate', id: 'c3', pointer: 'mouse' });
  assert.deepEqual(s, { mode: 'playing', id: 'c3' });
  assert.equal(R(s, { type: 'hover', id: 'c4' }), s);
});

test('mouse/keyboard click plays directly, and switches episodes while playing', () => {
  let s = R(D.INITIAL, { type: 'activate', id: 'c5', pointer: 'keyboard' });
  assert.deepEqual(s, { mode: 'playing', id: 'c5' });
  s = R(s, { type: 'activate', id: 'c6', pointer: 'mouse' });
  assert.deepEqual(s, { mode: 'playing', id: 'c6' });
});

test('touch: first tap previews, second tap on the same prop plays', () => {
  let s = R(D.INITIAL, { type: 'activate', id: 'c7', pointer: 'touch' });
  assert.deepEqual(s, { mode: 'preview', id: 'c7' });
  s = R(s, { type: 'activate', id: 'c8', pointer: 'touch' });
  assert.deepEqual(s, { mode: 'preview', id: 'c8' });
  s = R(s, { type: 'activate', id: 'c8', pointer: 'touch' });
  assert.deepEqual(s, { mode: 'playing', id: 'c8' });
});

test('coming-soon episodes never play', () => {
  const s = R(D.INITIAL, { type: 'activate', id: 'c10', pointer: 'mouse' });
  assert.deepEqual(s, { mode: 'preview', id: 'c10' });
});

test('escape stops playback back to preview', () => {
  const s = R({ mode: 'playing', id: 'c3' }, { type: 'escape' });
  assert.deepEqual(s, { mode: 'preview', id: 'c3' });
  assert.equal(R(D.INITIAL, { type: 'escape' }), D.INITIAL);
});

test('URL helpers', () => {
  assert.equal(D.embedUrl('rt7cQLtGyEE'), 'https://www.youtube-nocookie.com/embed/rt7cQLtGyEE?autoplay=1&playsinline=1&rel=0');
  assert.equal(D.thumbUrl('rt7cQLtGyEE'), 'https://i.ytimg.com/vi/rt7cQLtGyEE/hqdefault.jpg');
  assert.equal(D.watchUrl({ youtube: 'rt7cQLtGyEE', format: 'portrait' }), 'https://youtube.com/shorts/rt7cQLtGyEE');
  assert.equal(D.watchUrl({ youtube: 'KCV8nHowlpo', format: 'landscape' }), 'https://www.youtube.com/watch?v=KCV8nHowlpo');
  assert.equal(D.formatPremiere(Date.parse('2026-10-01T01:00:00+08:00')), '1 Oct');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd tests && npm run unit`
Expected: FAIL with `D.reduce is not a function`

- [ ] **Step 3: Implement (add inside the factory and extend the returned object)**

```js
  var INITIAL = Object.freeze({ mode: 'idle', id: null });

  function reduce(state, ev, ctx) {
    switch (ev.type) {
      case 'hover':
        if (state.mode === 'playing') return state;
        if (state.mode === 'preview' && state.id === ev.id) return state;
        return { mode: 'preview', id: ev.id };
      case 'activate':
        if (ctx.comingSoon(ev.id)) return { mode: 'preview', id: ev.id };
        if (ev.pointer === 'touch' && !(state.mode === 'preview' && state.id === ev.id))
          return { mode: 'preview', id: ev.id };
        if (state.mode === 'playing' && state.id === ev.id) return state;
        return { mode: 'playing', id: ev.id };
      case 'escape':
        return state.mode === 'playing' ? { mode: 'preview', id: state.id } : state;
      default:
        return state;
    }
  }

  function embedUrl(id) { return 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&playsinline=1&rel=0'; }
  function thumbUrl(id) { return 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg'; }
  function watchUrl(ep) {
    return ep.format === 'landscape' ? 'https://www.youtube.com/watch?v=' + ep.youtube : 'https://youtube.com/shorts/' + ep.youtube;
  }
  function formatPremiere(ms) {
    return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Singapore' });
  }
```

Returned object:

```js
  return { validateEpisodes: validateEpisodes, isComingSoon: isComingSoon, layoutProps: layoutProps,
           DEFAULT_LAYOUT: DEFAULT_LAYOUT, PROP_W: PROP_W, INITIAL: INITIAL, reduce: reduce,
           embedUrl: embedUrl, thumbUrl: thumbUrl, watchUrl: watchUrl, formatPremiere: formatPremiere };
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd tests && npm run unit`
Expected: `# pass 14`, `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add cartoons/drivein-core.js tests/unit/core.test.js
git commit -m "feat(cartoons): interaction reducer (hover/touch/escape rules) and URL helpers"
```

---

### Task 5: Catalogue, placeholder art and the fallback sync tool

**Files:**
- Create: `cartoons/episodes.json`, `cartoons/art/bg-placeholder.svg`, `cartoons/art/lot-extension-placeholder.svg`, `cartoons/art/screen-frame-placeholder.svg`, `cartoons/props/placeholder-car.svg`, `cartoons/props/placeholder-poster.svg`, `cartoons/props/placeholder-snack.svg`, `cartoons/props/placeholder-booth.svg`, `tests/tools/sync-fallback.js`
- Test: `tests/unit/core.test.js`

- [ ] **Step 1: Write the failing test (append)**

```js
const fs = require('node:fs');
const path = require('node:path');
const CAT = path.join(__dirname, '../../cartoons/episodes.json');

test('launch catalogue is valid, has 14 episodes and fills all four special spots', () => {
  const eps = D.validateEpisodes(JSON.parse(fs.readFileSync(CAT, 'utf8')));
  assert.equal(eps.length, 14);
  const { props, segments } = D.layoutProps(eps, D.DEFAULT_LAYOUT);
  assert.equal(segments, 1);
  for (const s of ['poster-1', 'poster-2', 'snack-1', 'booth-1'])
    assert.ok(props.some(p => p.slot === s), s + ' unused');
  for (const e of eps) assert.ok(fs.existsSync(path.join(__dirname, '../../cartoons', e.image)), e.image + ' missing');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd tests && npm run unit`
Expected: FAIL with `ENOENT ... episodes.json`

- [ ] **Step 3: Create `cartoons/episodes.json`**

Use the IDs from the spec's launch catalogue exactly.

```json
[
  {"id":"pilot","title":"The Apple Chip Ledger","youtube":"KCV8nHowlpo","format":"landscape","premiere":"2026-09-01T00:00:00+08:00","prop":"poster","image":"props/placeholder-poster.svg","alt":"Poster board: Charles holding the apple-chip ledger"},
  {"id":"c2","title":"Do Your Cutest Thing","youtube":"NR6ogdyPKVI","format":"landscape","premiere":"2026-09-01T00:00:00+08:00","prop":"poster","image":"props/placeholder-poster.svg","alt":"Poster board: Poppy doing her cutest face"},
  {"id":"c3","title":"45-Minute Diner Wait","youtube":"rt7cQLtGyEE","format":"portrait","premiere":"2026-09-01T00:00:00+08:00","prop":"car","image":"props/placeholder-car.svg","alt":"1950s diner-style car with a 45 min wait sign on the roof"},
  {"id":"c4","title":"Apple Chip Intervention","youtube":"irGVaTJJyb4","format":"portrait","premiere":"2026-09-01T00:00:00+08:00","prop":"car","image":"props/placeholder-car.svg","alt":"Station wagon stuffed with apple-chip bags"},
  {"id":"c5","title":"Time for chores!","youtube":"wCXxBkEbMgI","format":"portrait","premiere":"2026-09-01T00:00:00+08:00","prop":"car","image":"props/placeholder-car.svg","alt":"Car draped in a bedsheet with a pig trotter sticking out"},
  {"id":"c6","title":"Moral Support","youtube":"s4WUUF-3D_Y","format":"portrait","premiere":"2026-09-01T00:00:00+08:00","prop":"car","image":"props/placeholder-car.svg","alt":"Small hatchback with a mattress strapped to the roof"},
  {"id":"c7","title":"Father-in-Law Chat","youtube":"P4_XraZPen0","format":"portrait","premiere":"2026-09-01T00:00:00+08:00","prop":"car","image":"props/placeholder-car.svg","alt":"Family sedan with Nike asleep on the back seat"},
  {"id":"c8","title":"The 6 AM Negotiation","youtube":"aTbG9rtgaa8","format":"portrait","premiere":"2026-09-01T00:00:00+08:00","prop":"car","image":"props/placeholder-car.svg","alt":"Pickup with a giant alarm clock showing 6:00"},
  {"id":"c9","title":"The Void","youtube":"3mm3QSeXjo8","format":"portrait","premiere":"2026-09-01T00:00:00+08:00","prop":"booth","image":"props/placeholder-booth.svg","alt":"Projector-booth window with an empty chip bag"},
  {"id":"c10","title":"Order in the Yard","youtube":"sbbO2273RNc","format":"portrait","premiere":"2026-09-27T01:00:00+08:00","prop":"car","image":"props/placeholder-car.svg","alt":"Car with a judge's gavel and an apple chip on the hood"},
  {"id":"c11","title":"The Coat Rack","youtube":"0tqDl-UKomE","format":"portrait","premiere":"2026-09-28T01:00:00+08:00","prop":"car","image":"props/placeholder-car.svg","alt":"Car with a coat rack and a grocery bag on the roof"},
  {"id":"c12","title":"Low-Maintenance","youtube":"fTT7cx6ap8s","format":"portrait","premiere":"2026-09-29T01:00:00+08:00","prop":"car","image":"props/placeholder-car.svg","alt":"Ranch pickup with a hay bale and a butterfly"},
  {"id":"c13","title":"Worth It","youtube":"vIue1jLRDuw","format":"portrait","premiere":"2026-09-30T01:00:00+08:00","prop":"snack","image":"props/placeholder-snack.svg","alt":"Snack-bar sign: HUGS 4 CHIPS"},
  {"id":"c14","title":"Forever Hungry","youtube":"4COtDWxmMLQ","format":"portrait","premiere":"2026-10-01T01:00:00+08:00","prop":"car","image":"props/placeholder-car.svg","alt":"Pickup with a white daisy on the antenna"}
]
```

- [ ] **Step 4: Create the placeholder SVGs**

`cartoons/art/bg-placeholder.svg` (16:9 night scene. Its row lines and spot boxes follow `DEFAULT_LAYOUT`, so misplaced props are obvious):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="none">
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1026"/><stop offset=".55" stop-color="#27204a"/><stop offset="1" stop-color="#1a1a1a"/></linearGradient></defs>
  <rect width="1600" height="900" fill="url(#sky)"/>
  <path d="M0 520 Q300 430 620 500 T1600 480 V900 H0Z" fill="#1f2d24"/>
  <rect x="0" y="580" width="1600" height="320" fill="#2a2a2e"/>
  <g stroke="#555" stroke-dasharray="12 10" stroke-width="3"><line x1="0" y1="648" x2="1600" y2="648"/><line x1="0" y1="756" x2="1600" y2="756"/><line x1="0" y1="882" x2="1600" y2="882"/></g>
  <rect x="120" y="520" width="230" height="110" fill="#5a3b2b"/><text x="235" y="585" fill="#ffd36e" font-size="28" text-anchor="middle" font-family="sans-serif">SNACK BAR</text>
  <rect x="1180" y="430" width="170" height="130" fill="#3b3b52"/><text x="1265" y="505" fill="#aac" font-size="22" text-anchor="middle" font-family="sans-serif">BOOTH</text>
  <rect x="770" y="580" width="60" height="80" fill="#333"/>
</svg>
```

`cartoons/art/lot-extension-placeholder.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="none">
  <rect width="1600" height="900" fill="#0b1026"/><path d="M0 500 Q400 460 800 500 T1600 500 V900 H0Z" fill="#1f2d24"/>
  <rect x="0" y="580" width="1600" height="320" fill="#2a2a2e"/>
  <g stroke="#555" stroke-dasharray="12 10" stroke-width="3"><line x1="0" y1="648" x2="1600" y2="648"/><line x1="0" y1="756" x2="1600" y2="756"/><line x1="0" y1="882" x2="1600" y2="882"/></g>
</svg>
```

`cartoons/art/screen-frame-placeholder.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none"><rect x="1" y="1" width="98" height="98" fill="none" stroke="#e8e0d0" stroke-width="2"/></svg>
```

`cartoons/props/placeholder-car.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 110"><path d="M20 70 L45 35 H140 L175 70 H190 V92 H10 V70Z" fill="#c0392b" stroke="#111" stroke-width="5"/><circle cx="55" cy="95" r="14" fill="#111"/><circle cx="150" cy="95" r="14" fill="#111"/><rect x="60" y="42" width="70" height="26" fill="#9fd3ff" stroke="#111" stroke-width="4"/></svg>
```

`cartoons/props/placeholder-poster.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 200"><rect x="70" y="120" width="20" height="80" fill="#5a3b2b"/><rect x="10" y="10" width="140" height="120" fill="#f5deb3" stroke="#111" stroke-width="6"/><text x="80" y="78" font-size="26" text-anchor="middle" font-family="sans-serif">POSTER</text></svg>
```

`cartoons/props/placeholder-snack.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120"><rect x="10" y="30" width="180" height="80" fill="#ff8c42" stroke="#111" stroke-width="6"/><text x="100" y="80" font-size="30" text-anchor="middle" font-family="sans-serif">SNACK</text></svg>
```

`cartoons/props/placeholder-booth.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120"><rect x="10" y="10" width="140" height="100" fill="#3b3b52" stroke="#111" stroke-width="6"/><rect x="40" y="35" width="80" height="45" fill="#ffd36e"/></svg>
```

- [ ] **Step 5: Create `tests/tools/sync-fallback.js`**

```js
// Copies cartoons/episodes.json into the inline <script id="episodes-fallback"> of cartoons/index.html.
// Usage: node tests/tools/sync-fallback.js [--check]   (--check exits 1 if out of sync)
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '../..');
const json = JSON.stringify(JSON.parse(fs.readFileSync(path.join(root, 'cartoons/episodes.json'), 'utf8')));
const htmlPath = path.join(root, 'cartoons/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const re = /(<script type="application\/json" id="episodes-fallback">)([\s\S]*?)(<\/script>)/;
if (!re.test(html)) { console.error('episodes-fallback block not found'); process.exit(1); }
const current = html.match(re)[2];
if (process.argv.includes('--check')) {
  if (current !== json) { console.error('fallback out of sync: run npm run sync'); process.exit(1); }
  console.log('fallback in sync'); process.exit(0);
}
fs.writeFileSync(htmlPath, html.replace(re, (_, a, _b, c) => a + json + c));
console.log('fallback updated');
```

- [ ] **Step 6: Run to verify it passes**

Run: `cd tests && npm run unit`
Expected: `# pass 15`, `# fail 0`

- [ ] **Step 7: Commit**

```bash
git add cartoons/episodes.json cartoons/art cartoons/props tests/tools/sync-fallback.js tests/unit/core.test.js
git commit -m "feat(cartoons): launch catalogue, placeholder art, fallback sync tool"
```

---

### Task 6: The page

**Files:**
- Create: `cartoons/index.html`
- Test: `tests/e2e/drivein.spec.js`

- [ ] **Step 1: Write the failing E2E smoke test**

`tests/e2e/drivein.spec.js`:

```js
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd tests && npx playwright test drivein.spec.js`
Expected: FAIL. The props count is 0 (a 404 for `/cartoons/`).

- [ ] **Step 3: Create `cartoons/index.html`**

Copy the two font `<link>` lines exactly from `index.html` lines 18–19 into the marked spot: More Sugar loads from `fonts.cdnfonts.com` (line 18) and Nunito from `fonts.googleapis.com` (line 19). Check with `sed -n 18,19p index.html`.

Note the DOM order: `.screen-wrap` comes **before** `.lot`. On desktop both are absolutely positioned, so the order doesn't change the layout. On mobile it puts the sticky screen above the lot.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Nikeverse Cartoons — the $NIKEPIG Drive-In</title>
<meta name="description" content="Watch every Nikeverse cartoon at the $NIKEPIG drive-in.">
<link rel="icon" href="../icons/pig.png">
<!-- FONTS: paste index.html lines 18-19 here (More Sugar via cdnfonts + Nunito via googleapis) -->
<style>
:root{--night:#0b1026;--wheat:#f5deb3;--glow:#ffd36e;--prop-w:14}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--night);color:#fff;font-family:'Nunito',sans-serif;min-height:100vh;overflow-x:hidden}
.topbar{position:fixed;top:0;left:0;right:0;z-index:30;display:flex;gap:1rem;align-items:center;justify-content:space-between;padding:.6rem 1rem;background:linear-gradient(rgba(0,0,0,.65),transparent);pointer-events:none}
.topbar a,.topbar h1{pointer-events:auto}
.topbar a{color:var(--wheat);text-decoration:none;font-weight:800}
.topbar h1{font-family:'More Sugar',cursive;font-size:clamp(1.1rem,2.6vw,1.9rem);color:var(--glow);text-shadow:0 2px 10px rgba(0,0,0,.6)}
.theatre{position:relative;width:100vw;height:min(100vh,56.25vw);--th:min(100vh,56.25vw)}
.lot{position:absolute;inset:0;overflow-x:auto;overflow-y:hidden;scrollbar-width:thin}
.scene{position:relative;height:100%;width:calc(var(--segments,1)*100%);
  background:url(art/bg-placeholder.svg) left top/calc(100%/var(--segments,1)) 100% no-repeat,
             url(art/lot-extension-placeholder.svg) left top/calc(100%/var(--segments,1)) 100% repeat-x}
.prop{position:absolute;left:calc(var(--x)*1%/var(--segments,1));top:calc(var(--y)*1%);
  width:calc(var(--s)*var(--prop-w)*1%/var(--segments,1));min-width:44px;min-height:44px;
  transform:translate(-50%,-100%);background:none;border:0;padding:0;cursor:pointer;display:flex;align-items:flex-end;justify-content:center;
  transition:transform .2s,filter .2s;scroll-snap-align:center}
.prop img{width:100%;height:auto;display:block;pointer-events:none;filter:drop-shadow(0 6px 10px rgba(0,0,0,.6))}
.prop:hover,.prop:focus-visible,.prop[aria-current="true"]{transform:translate(-50%,-104%) scale(1.06);filter:drop-shadow(0 0 14px var(--glow))}
.prop:focus-visible{outline:3px solid var(--glow);outline-offset:4px}
.prop .tag{position:absolute;bottom:100%;left:50%;transform:translateX(-50%);white-space:nowrap;background:rgba(0,0,0,.8);color:#fff;font-weight:800;font-size:clamp(.7rem,1vw,.95rem);padding:.2rem .55rem;border-radius:.5rem;opacity:0;pointer-events:none;transition:opacity .15s}
.prop:hover .tag,.prop:focus-visible .tag{opacity:1}
.prop[data-soon="true"] img{filter:brightness(.55) saturate(.6)}
.prop .soon{position:absolute;top:0;left:50%;transform:translate(-50%,-30%);background:var(--glow);color:#111;font-weight:800;font-size:.7rem;padding:.1rem .45rem;border-radius:.4rem;white-space:nowrap}
.screen-wrap{position:absolute;inset:0;pointer-events:none;z-index:10}
.lot{z-index:1}
.screen{--h:calc(var(--th)*.58);position:absolute;left:50%;top:6%;height:var(--h);width:calc(var(--h)*9/16);transform:translateX(-50%);
  background:#05060c;border-radius:.4rem;box-shadow:0 0 60px rgba(255,211,110,.25);pointer-events:auto;overflow:hidden;transition:width .45s ease}
.screen[data-format="landscape"]{width:min(calc(var(--h)*16/9),96vw)}
.screen-frame{position:absolute;inset:0;background:url(art/screen-frame-placeholder.svg) center/100% 100% no-repeat;pointer-events:none;z-index:2}
.screen-content{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:.5rem;padding:.6rem}
.screen-content iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.screen-content .thumb{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.9}
.screen-content strong{position:relative;font-family:'More Sugar',cursive;font-size:clamp(1rem,2vw,1.6rem);color:var(--glow);text-shadow:0 2px 8px #000}
.screen-content em{position:relative;font-style:normal;color:var(--wheat)}
.screen-content .play{position:relative;width:64px;height:64px;border-radius:50%;border:0;background:rgba(255,211,110,.92);color:#111;font-size:1.6rem;cursor:pointer}
.screen-content .soon-art{max-width:70%;max-height:45%;filter:brightness(.7)}
.watch-link{position:absolute;left:50%;top:calc(6% + var(--th)*.58 + .4rem);transform:translateX(-50%);color:var(--wheat);font-weight:800;font-size:.85rem;pointer-events:auto;text-shadow:0 1px 4px #000}
.status{position:absolute;left:50%;bottom:8%;transform:translateX(-50%);background:rgba(0,0,0,.75);padding:.6rem 1rem;border-radius:.6rem;z-index:20}
@media (max-width:767px){
  .theatre{height:auto;--th:45vh}
  .screen-wrap{position:sticky;inset:auto;top:0;height:45vh;z-index:10;background:linear-gradient(var(--night),rgba(11,16,38,.85))}
  .screen{--h:calc(45vh - 3.2rem);top:2.6rem}
  .screen[data-format="landscape"]{width:92vw;height:calc(92vw*9/16)}
  .watch-link{top:auto;bottom:.3rem}
  .lot{position:relative;height:55vh;scroll-snap-type:x proximity}
  .scene{height:100%;width:calc(55vh*16/9*var(--segments,1))}
}
@media (prefers-reduced-motion:reduce){.screen,.prop,.prop .tag{transition:none}}
</style>
</head>
<body>
<header class="topbar"><a href="../">← nikepig.com</a><h1>Nikeverse Cartoons</h1><span></span></header>
<main class="theatre" id="theatre">
  <div class="screen-wrap">
    <div class="screen" id="screen" data-format="portrait" data-mode="idle" aria-live="polite">
      <div class="screen-content" id="screen-content"></div><div class="screen-frame"></div>
    </div>
    <a class="watch-link" id="watch-link" target="_blank" rel="noopener" hidden>Watch on YouTube ↗</a>
  </div>
  <div class="lot" id="lot"><div class="scene" id="scene"></div></div>
  <p class="status" id="status" role="status" hidden></p>
</main>
<script type="application/json" id="episodes-fallback">[]</script>
<script src="drivein-core.js"></script>
<script>
(async function () {
  'use strict';
  var D = window.DriveIn, $ = function (id) { return document.getElementById(id); };
  var state = D.INITIAL, byId = {}, lastTouch = 0, eps = [];
  function now() { return Date.now(); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }

  function renderScreen() {
    var scr = $('screen'), c = $('screen-content'), link = $('watch-link');
    var ep = state.id ? byId[state.id] : null;
    scr.dataset.format = ep ? ep.format : 'portrait';
    scr.dataset.mode = state.mode;
    c.textContent = ''; link.hidden = true;
    document.querySelectorAll('.prop').forEach(function (b) { b.setAttribute('aria-current', String(!!ep && b.dataset.id === ep.id)); });
    if (!ep) {
      c.append(el('em', '', 'Now showing'), el('strong', '', 'Nikeverse Cartoons'), el('em', '', 'Pick a car to preview'));
      return;
    }
    if (D.isComingSoon(ep, now())) {
      var art = el('img', 'soon-art'); art.src = ep.image; art.alt = ep.alt;
      c.append(art, el('strong', '', ep.title), el('em', 'soon-label', 'Premieres ' + D.formatPremiere(ep.premiereMs)));
      scr.dataset.mode = 'soon';
      return;
    }
    link.href = D.watchUrl(ep); link.hidden = false;
    if (state.mode === 'playing') {
      var f = document.createElement('iframe');
      f.src = D.embedUrl(ep.youtube); f.title = ep.title;
      f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'; f.allowFullscreen = true;
      f.referrerPolicy = 'strict-origin-when-cross-origin';
      c.append(f);
      return;
    }
    var t = el('img', 'thumb'); t.alt = ep.title + ' thumbnail'; t.src = D.thumbUrl(ep.youtube);
    t.onerror = function () { t.onerror = null; t.src = ep.image; };
    var play = el('button', 'play', '▶'); play.type = 'button'; play.setAttribute('aria-label', 'Play ' + ep.title);
    play.onclick = function () { dispatch({ type: 'activate', id: ep.id, pointer: 'mouse' }); };
    c.append(t, el('strong', '', ep.title), play);
  }

  function dispatch(ev) {
    var next = D.reduce(state, ev, { comingSoon: function (id) { return D.isComingSoon(byId[id], now()); } });
    if (next.mode === state.mode && next.id === state.id) return;
    state = next; renderScreen();
  }

  function renderProps() {
    var lay = D.layoutProps(eps, D.DEFAULT_LAYOUT), scene = $('scene');
    document.documentElement.style.setProperty('--segments', lay.segments);
    lay.props.forEach(function (p) {
      var ep = byId[p.id], soon = D.isComingSoon(ep, now());
      var b = el('button', 'prop'); b.type = 'button'; b.dataset.id = ep.id; b.dataset.soon = String(soon);
      b.style.setProperty('--x', p.x); b.style.setProperty('--y', p.y); b.style.setProperty('--s', p.scale);
      b.setAttribute('aria-label', soon ? ep.title + ', premieres ' + D.formatPremiere(ep.premiereMs) : 'Play ' + ep.title);
      var img = el('img'); img.src = ep.image; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
      img.onerror = function () { img.onerror = null; img.src = 'props/placeholder-' + ep.prop + '.svg'; };
      b.append(img, el('span', 'tag', ep.title));
      if (soon) b.append(el('span', 'soon', 'Premieres ' + D.formatPremiere(ep.premiereMs)));
      b.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'touch') dispatch({ type: 'hover', id: ep.id }); });
      b.addEventListener('pointerdown', function (e) { if (e.pointerType === 'touch') lastTouch = now(); });
      b.addEventListener('focus', function () { if (now() - lastTouch > 800) dispatch({ type: 'hover', id: ep.id }); });
      b.addEventListener('click', function (e) {
        var p = now() - lastTouch < 800 ? 'touch' : (e.detail === 0 ? 'keyboard' : 'mouse');
        dispatch({ type: 'activate', id: ep.id, pointer: p });
      });
      scene.append(b);
    });
  }

  var list = null;
  try { var r = await fetch('episodes.json', { cache: 'no-cache' }); if (!r.ok) throw new Error(r.status); list = await r.json(); }
  catch (e) { try { list = JSON.parse($('episodes-fallback').textContent); } catch (_) { list = null; } }
  try { eps = D.validateEpisodes(list); if (!eps.length) throw new Error('empty'); }
  catch (e) { var s = $('status'); s.textContent = 'Episodes are warming up, try again'; s.hidden = false; renderScreen(); return; }
  eps.forEach(function (e) { byId[e.id] = e; });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') dispatch({ type: 'escape' }); });
  renderProps(); renderScreen();
  if (matchMedia('(max-width: 767px)').matches) {
    var lot = $('lot'); lot.scrollLeft = (lot.scrollWidth / (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--segments')) || 1) - lot.clientWidth) / 2;
  }
})();
</script>
</body>
</html>
```

- [ ] **Step 4: Sync the inline fallback**

Run: `cd tests && npm run sync && node tools/sync-fallback.js --check`
Expected: `fallback updated`, then `fallback in sync`

- [ ] **Step 5: Run the smoke test to verify it passes**

Run: `cd tests && npx playwright test drivein.spec.js`
Expected: 4 passed

- [ ] **Step 6: Commit**

```bash
git add cartoons/index.html
git commit -m "feat(cartoons): drive-in page with screen, props and boot script"
```

---

### Task 7: E2E behaviour tests

**Files:**
- Test: `tests/e2e/drivein.spec.js`

- [ ] **Step 1: Append the behaviour tests**

```js
test('hover previews and the screen changes shape by format', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  const screen = page.locator('#screen');
  await page.locator('.prop[data-id="c3"]').hover();
  await expect(screen).toHaveAttribute('data-mode', 'preview');
  await expect(screen).toHaveAttribute('data-format', 'portrait');
  await expect(page.locator('#screen-content strong')).toHaveText('45-Minute Diner Wait');
  await page.locator('.prop[data-id="pilot"]').hover();
  await expect(screen).toHaveAttribute('data-format', 'landscape');
  // width animates (.45s); poll until it settles wider than tall
  await expect.poll(async () => { const b = await screen.boundingBox(); return b.width > b.height; }).toBe(true);
});

test('mobile: screen sits above the lot and stays pinned while the page scrolls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
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
  await page.locator('.prop[data-id="c4"]').hover();
  await expect(frame).toHaveAttribute('src', /rt7cQLtGyEE/);
  await expect(page.locator('#watch-link')).toHaveAttribute('href', 'https://youtube.com/shorts/rt7cQLtGyEE');
  await page.keyboard.press('Escape');
  await expect(page.locator('#screen-content iframe')).toHaveCount(0);
  await expect(page.locator('#screen')).toHaveAttribute('data-mode', 'preview');
});

test('coming-soon flips at the premiere instant and never plays before it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, '2026-09-26T16:59:00Z');
  const c10 = page.locator('.prop[data-id="c10"]');
  await expect(c10).toHaveAttribute('data-soon', 'true');
  await c10.click();
  await expect(page.locator('#screen-content iframe')).toHaveCount(0);
  await expect(page.locator('#screen')).toHaveAttribute('data-mode', 'soon');
  await expect(page.locator('#screen-content')).toContainText('Premieres 27 Sept');
  await expect(page.locator('#watch-link')).toBeHidden();

  await open(page, '2026-09-26T17:01:00Z');
  await expect(page.locator('.prop[data-id="c10"]')).toHaveAttribute('data-soon', 'false');
});

test('touch: first tap previews, second tap plays', async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: 'http://127.0.0.1:8123', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
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
  const tb = await c5.boundingBox();
  expect(Math.min(tb.width, tb.height)).toBeGreaterThanOrEqual(44);
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
```

> Note: the premiere label is en-GB formatted. Node and Chromium on this machine print September as `Sept` (verified), so the assertion expects `Premieres 27 Sept`. If another ICU prints `Sep`, update this assertion to the observed value and note it in the branch log.

- [ ] **Step 2: Run**

Run: `cd tests && npx playwright test drivein.spec.js`
Expected: 13 passed. If any fail, fix `cartoons/index.html`, not the tests, unless the test contradicts the spec.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/drivein.spec.js cartoons/index.html
git commit -m "test(cartoons): E2E coverage for preview, playback, coming-soon, touch, keyboard, fallback"
```

---

### Task 8: Main site: nav link and Nikeverse card

**Files:**
- Create: `assets/art/title-cartoons.svg` (placeholder sticker)
- Modify: `index.html:535` (nav), `index.html:647` (the last `.verse-card` in `.nikeverse-grid`)
- Test: `tests/e2e/mainsite.spec.js`

- [ ] **Step 1: Write the failing test**

`tests/e2e/mainsite.spec.js`:

```js
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd tests && npx playwright test mainsite.spec.js`
Expected: FAIL. The locator finds 0 elements.

- [ ] **Step 3: Create `assets/art/title-cartoons.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 300"><g font-family="Arial Black,Impact,sans-serif" text-anchor="middle" stroke="#111" stroke-width="14" paint-order="stroke"><text x="380" y="130" font-size="110" fill="#ffd36e">NIKEVERSE</text><text x="380" y="255" font-size="110" fill="#ff8c42">CARTOONS</text></g></svg>
```

- [ ] **Step 4: Edit `index.html`**

Nav (line 535): insert `<a href="cartoons/">Cartoons</a>` directly after `<a href="#nikeverse-cards">Nikeverse</a>`.

Grid: insert this card as the **last** child of `<div class="nikeverse-grid">`, after the Dimensional Collectors card (line 646), so the existing cards' order and `reveal-delay` pattern don't change. This makes 11 cards, so the final row is a left-aligned pair; that's accepted. Don't add any grid rules. The existing `:last-child:nth-child(3n+1)` rule simply stops matching, and its 2- and 1-column resets stay harmless.

```html
      <div class="verse-card reveal" style="background:linear-gradient(to bottom,rgba(0,0,0,0.75) 0%,rgba(0,0,0,0.6) 50%,rgba(0,0,0,0.45) 100%),url('cartoons/art/bg-placeholder.svg') center center/cover"><img src="assets/art/title-cartoons.svg" alt="Nikeverse Cartoons" class="verse-title-img" loading="lazy" decoding="async" width="760" height="300"><div class="verse-desc" style="color:#fff">Pull into the $NIKEPIG drive-in. Every Nikeverse cartoon parked in one lot: hover a car, catch the episode on the big screen.</div><a href="cartoons/" class="verse-card-btn">Watch Cartoons</a></div>
```

- [ ] **Step 5: Run to verify it passes, including mobile nav wrap**

Run: `cd tests && npx playwright test mainsite.spec.js`
Expected: 2 passed.
Then check the nav doesn't overflow at 375 px:
Run: `cd tests && node -e "const {chromium}=require('@playwright/test');(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:375,height:800}});await p.goto('http://127.0.0.1:8123/index.html').catch(()=>{});console.log(await p.evaluate(()=>document.documentElement.scrollWidth<=375));await b.close()})()"` (with `python -m http.server 8123 --bind 127.0.0.1` running from the repo root)
Expected: `true`

- [ ] **Step 6: Commit**

```bash
git add index.html assets/art/title-cartoons.svg tests/e2e/mainsite.spec.js
git commit -m "feat: link the Nikeverse Cartoons drive-in from nav and the Nikeverse grid"
```

---

### Task 9: Reviewer wave and orchestrator QC (placeholder art)

Per `CLAUDE.md`, the pipeline is: reviewers on distinct lenses, then the orchestrator fixes every finding, including nits.

- [ ] **Step 1: Dispatch three reviewers in parallel** (read-only), each given the spec path, this plan path and `git diff main...HEAD`:
  1. **Contract/regression:** the spec vs the implementation, main-page regressions (bg, reveal, sticker sizing), and the no-`main`-push rule.
  2. **Visual/mobile:** 375 / 768 / 1440 / 2560 px, `deviceScaleFactor: 2` screenshots, tap targets, sticky screen and lot scrolling, landscape screen width on mobile.
  3. **Cross-file:** `drivein-core.js` vs `index.html` usage, fallback sync, and catalogue IDs vs `docs/superpowers/specs/...` table.
- [ ] **Step 2: Fix all findings.** Re-run `cd tests && npm run unit && node tools/sync-fallback.js --check && npx playwright test`.
  Expected: all unit and E2E tests pass, and the fallback is in sync.
- [ ] **Step 3: Commit and push the branch**

```bash
git add -A cartoons tests index.html assets/art
git commit -m "fix(cartoons): reviewer-wave findings"
git push origin claude/paddle-payments-setup-0h567q
```

- [ ] **Step 4: Checkpoint with the user.** Share the branch and the placeholder-art state, then ask the user to be at the computer with the Tripo3D extension for Task 10.

---

### Task 10: Art generation in Tripo3D (user present)

**Tool:** the user's Tripo3D Chrome extension, model **GPT Image 2.5**, **4K** output. It's driven through the claude-in-chrome browser tools with the user watching.
- Nothing is uploaded to blocked hosts.
- If the extension needs a login or payment, the user does it.
- Generate **one image at a time** and show each to the user before continuing, since the user reviews each asset.

Shared style block, used as the prefix of every prompt:
> Nikeverse Meme Machine 2D cartoon style: bold clean black outlines, flat vivid cel colours with soft painted shading, warm glowing night lighting, playful and cosy, high detail, no text, no letters, no logos, no watermark.

- [ ] **Step 1: Background (16:9, 4K).** Prompt: *[style] A wide panoramic night-time drive-in cinema on a ranch. Starry purple-blue sky, rolling dark hills and a wooden ranch fence far behind. In the upper centre, a tall wooden screen support structure with an EMPTY blank dark rectangle where a tall portrait movie screen will be placed (leave it plain). On the left, a cosy snack-bar hut with a counter and warm light. On the right, a small projector booth with one glowing window. Two empty poster boards on posts, one near each side edge. The foreground is an empty asphalt parking lot with three faint curved parking row lines receding into the distance. Absolutely no cars and no characters.* Save as `C:/Users/loopy/Nikeverse-cartoons/outputs/nikepig-website-cartoons-art-src/bg-4k.png` (outside the website repo; the repo is Pages-served, so 4K sources stay out of it).
- [ ] **Step 2: Lot extension (16:9, 4K).** Prompt: *[style] The same night drive-in parking lot continuing sideways: starry sky, dark hills, the same three faint parking row lines, empty asphalt, seamless left and right edges for tiling, no buildings, no cars, no characters.* Save as `C:/Users/loopy/Nikeverse-cartoons/outputs/nikepig-website-cartoons-art-src/lot-extension-4k.png`.
- [ ] **Step 3: Screen frame (portrait, transparent).** Prompt: *[style] A front-on wooden drive-in movie-screen frame with small marquee bulbs around the edge; the inside of the frame is completely empty and transparent; isolated on a plain white background.* Save as `C:/Users/loopy/Nikeverse-cartoons/outputs/nikepig-website-cartoons-art-src/screen-frame-src.png`.
- [ ] **Step 4: Props (one per episode, isolated on plain white).** Use the prop concept from the spec's catalogue table for each of the 14 episodes. Prompt template: *[style] A single [prop concept], three-quarter front view, isolated on a plain white background, soft shadow underneath.* Character rules:
  - Nike is a round dark-grey pig with a beige belly and very short thick stump legs, with an innocent, sweet expression.
  - GF Princess is a cream pig with black spots and a floral wreath.
  - Poppy is a small reddish-brown baby bison.
  - Save each as `C:/Users/loopy/Nikeverse-cartoons/outputs/nikepig-website-cartoons-art-src/props/<id>.png`.
- [ ] **Step 5: Main-site sticker.** Prompt: *[style] Die-cut sticker logo reading "NIKEVERSE CARTOONS" in chunky playful display letters, thick white sticker border, hard offset shadow, isolated on plain white.* This is the one asset that may contain text. Save as `C:/Users/loopy/Nikeverse-cartoons/outputs/nikepig-website-cartoons-art-src/title-cartoons-src.png`.
- [ ] **Step 6: Commit the source images in the cartoons repo** (not the website repo)

```bash
cd /c/Users/loopy/Nikeverse-cartoons && git add outputs/nikepig-website-cartoons-art-src && git commit -m "art: Tripo3D GPT Image 2.5 sources for the nikepig.com drive-in" && git push
```

---

### Task 11: Process art (cut-outs, WebP, sizes)

**Files:**
- Create: `tests/tools/process-art.py`, `cartoons/art/bg.webp`, `cartoons/art/lot-extension.webp`, `cartoons/art/screen-frame.webp`, `cartoons/props/<id>.webp` ×14, `assets/art/title-cartoons.webp`

- [ ] **Step 1: Write `tests/tools/process-art.py`**

It uses `rembg` (already installed; `~/.rembg` models exist) and Pillow.

```python
"""Cut out and encode Tripo3D renders for the cartoons page. Usage: python tests/tools/process-art.py"""
import os
from pathlib import Path
os.environ.setdefault('U2NET_HOME', str(Path.home() / '.rembg' / 'models' / 'isnet-general-use'))  # local models; avoids a 170 MB u2net download
from PIL import Image
from rembg import remove as _remove, new_session

SESSION = new_session('isnet-general-use')
def remove(img): return _remove(img, session=SESSION)

ROOT = Path(__file__).resolve().parents[2]
C = ROOT / 'cartoons'
SRC = Path(os.environ.get('CARTOONS_ART_SRC', r'C:\Users\loopy\Nikeverse-cartoons\outputs\nikepig-website-cartoons-art-src'))

def webp(img, out, max_w, q):
    if img.width > max_w:
        img = img.resize((max_w, round(img.height * max_w / img.width)), Image.LANCZOS)
    img.save(out, 'WEBP', quality=q, method=6)
    print(out.relative_to(ROOT), img.size, out.stat().st_size // 1024, 'KB')

webp(Image.open(SRC / 'bg-4k.png').convert('RGB'), C / 'art/bg.webp', 2560, 80)
webp(Image.open(SRC / 'lot-extension-4k.png').convert('RGB'), C / 'art/lot-extension.webp', 2560, 78)
webp(remove(Image.open(SRC / 'screen-frame-src.png')), C / 'art/screen-frame.webp', 900, 85)
for src in sorted((SRC / 'props').glob('*.png')):
    cut = remove(Image.open(src))
    cut = cut.crop(cut.getbbox())
    webp(cut, C / 'props' / (src.stem + '.webp'), 640, 82)
title = remove(Image.open(SRC / 'title-cartoons-src.png'))
webp(title.crop(title.getbbox()), ROOT / 'assets/art/title-cartoons.webp', 760, 88)
```

- [ ] **Step 2: Run it and check sizes**

Run: `python tests/tools/process-art.py`
Expected: `bg.webp` ≤ 600 KB and each prop ≤ 120 KB. If one is over, lower its `q` by 5 and re-run.

- [ ] **Step 3: Point everything at the real art**
  - In `cartoons/index.html`, set the `.scene` background URLs to `art/bg.webp` and `art/lot-extension.webp`, and `.screen-frame` to `art/screen-frame.webp`.
  - In `cartoons/episodes.json`, set each `"image"` to `"props/<id>.webp"`, then run `cd tests && npm run sync`.
  - In `index.html`, change the card to `assets/art/title-cartoons.webp` (with the real `width`/`height` from the script output) and its background to `cartoons/art/bg.webp`. Delete `assets/art/title-cartoons.svg`.
- [ ] **Step 4: Run all tests**

Run: `cd tests && npm run unit && node tools/sync-fallback.js --check && npx playwright test`
Expected: all pass. The catalogue test checks every prop image exists.

- [ ] **Step 5: Commit**

```bash
git add -A tests/tools/process-art.py cartoons assets/art index.html   # -A also stages the deleted title-cartoons.svg
git commit -m "art(cartoons): cut-outs, WebP encodes, swap in final art"
```

---

### Task 12: Measure the layout from the real background

**Files:**
- Modify: `cartoons/drivein-core.js` (`DEFAULT_LAYOUT`), `cartoons/index.html` (debug overlay)

- [ ] **Step 1: Add a debug overlay** at the end of the boot script in `cartoons/index.html`:

```js
  if (/[?&]debug=layout\b/.test(location.search)) {
    var L = D.DEFAULT_LAYOUT, dots = [];
    Object.keys(L.special).forEach(function (k) { L.special[k].forEach(function (s) { dots.push([s.x, s.y, k]); }); });
    L.rows.forEach(function (r, i) { r.xs.forEach(function (x) { dots.push([x, r.y, 'r' + i]); }); });
    dots.forEach(function (d) {
      var m = el('div', '', d[2]);
      m.style.cssText = 'position:absolute;z-index:5;left:calc(' + d[0] + '%/var(--segments,1));top:' + d[1] + '%;transform:translate(-50%,-50%);background:#f0f;color:#fff;font:10px monospace;padding:1px 3px';
      $('scene').append(m);
    });
  }
```

- [ ] **Step 2: Measure.** Open `http://127.0.0.1:8123/cartoons/?debug=layout` at 1440×810 and compare the magenta dots with the painted snack-bar counter, booth window, poster boards, the three row lines and the screen support. Adjust `DEFAULT_LAYOUT` (`screen.top` and `screen.height` too, applied via the `.screen` CSS `top`/`--h` factor) until every dot sits on its painted spot. Keep each row's spacing ≥ `PROP_W × scale`; the unit test enforces it.
   Screen geometry isn't read from `DEFAULT_LAYOUT.screen` by the page. It lives in three CSS spots in `cartoons/index.html`: `.screen{top:6%}`, the `--h` factor `.58`, and the `.watch-link` `top` calc. Edit all three together, and keep `DEFAULT_LAYOUT.screen` in sync as documentation.
   Also check that no clickable prop sits under the screen (in both portrait and landscape width) or under the watch link. If one does, move that spot or row.

- [ ] **Step 3: Run all tests**

Run: `cd tests && npm run unit && npx playwright test`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add cartoons/drivein-core.js cartoons/index.html
git commit -m "feat(cartoons): layout measured from the final background; ?debug=layout overlay"
```

---

### Task 13: Final QC, docs and ship to the branch

- [ ] **Step 1: Re-run the reviewer wave (Task 9, Step 1) on the final art state.** Fix everything, then re-run all tests.
- [ ] **Step 2: Docs.**
  - Append a dated narrative to `docs/branch-log.md`: what shipped, the corrected-reupload IDs, the Sept/Sep ICU note if it arose, and the art sources.
  - In `CLAUDE.md`:
    - Add `cartoons/` to "Layout" as a separate page.
    - Fix the stale line that calls the `#nft` grid JS-rendered (it's static markup).
    - Add "Tests: `cd tests && npm install && npm run unit && npx playwright test`".
    - Add "Add an episode: drop `cartoons/props/<id>.webp`, append to `cartoons/episodes.json`, `npm run sync`".
- [ ] **Step 3: Commit and push the branch**

```bash
git add docs/branch-log.md CLAUDE.md
git commit -m "docs: cartoons drive-in in CLAUDE.md and branch log"
git push origin claude/paddle-payments-setup-0h567q
```

- [ ] **Step 4: Hand off to the user for go-live.** Report the branch, the test results and phone screenshots. **Do not merge or push to `main`.** Pushing `main` publishes nikepig.com, so only do it after the user explicitly says so.
