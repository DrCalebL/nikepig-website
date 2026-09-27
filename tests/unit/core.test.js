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
  assert.throws(() => D.validateEpisodes([ep({ premiere: 'soon' })]), /premiere needs ISO/);
  assert.throws(() => D.validateEpisodes([ep(), ep()]), /duplicate id/);
});

test('image is optional; propImage falls back to a generic seat-saver', () => {
  const e = ep(); delete e.image;
  const [v] = D.validateEpisodes([e]);
  assert.match(D.propImage(v), /^props\/generic-(\d|1[0-2])\.webp$/);
  assert.equal(D.propImage(D.validateEpisodes([ep()])[0]), 'props/placeholder-car.svg');
  assert.throws(() => D.validateEpisodes([ep({ image: '' })]), /bad image/);
  assert.throws(() => D.validateEpisodes([ep({ image: 5 })]), /bad image/);
});

test('generic seat-saver is stable per id, spread over all 12, and an explicit image wins', () => {
  assert.equal(D.GENERIC_COUNT, 12);
  assert.equal(D.REEL_IMAGE, 'props/placeholder-reel.svg');
  const g = id => D.propImage({ id });
  assert.equal(g('c15'), g('c15'));
  assert.equal(g('c15'), D.propImage({ id: 'c15', image: undefined }));
  const seen = new Set(Array.from({ length: 200 }, (_, i) => g('c' + i)));
  assert.equal(seen.size, 12);
  for (const f of seen) assert.match(f, /^props\/generic-(\d|1[0-2])\.webp$/);
  assert.equal(D.propImage({ id: 'c15', image: 'props/c15.webp' }), 'props/c15.webp');
  for (let k = 1; k <= 12; k++)
    assert.ok(require('node:fs').existsSync(require('node:path').join(__dirname, '../../cartoons/props/generic-' + k + '.webp')), 'generic-' + k + ' missing');
});

test('validateEpisodes rejects a premiere without an explicit UTC offset', () => {
  assert.throws(() => D.validateEpisodes([ep({ premiere: '2026-10-02T01:00:00' })]), /premiere needs ISO/);
});

test('validateEpisodes rejects malformed ids, including prototype-pollution attempts', () => {
  assert.throws(() => D.validateEpisodes([ep({ id: 'Bad_ID' })]), /bad id/);
  assert.throws(() => D.validateEpisodes([ep({ id: '__proto__' })]), /bad id/);
});

test('validateEpisodes rejects non-object entries', () => {
  assert.throws(() => D.validateEpisodes([null]), /not an object/);
});

test('isComingSoon flips exactly at the premiere instant', () => {
  const [e] = D.validateEpisodes([ep({ id: 'c10', premiere: '2026-09-27T01:00:00+08:00' })]);
  assert.equal(D.isComingSoon(e, Date.parse('2026-09-26T16:59:00Z')), true);
  assert.equal(D.isComingSoon(e, Date.parse('2026-09-26T17:00:00Z')), false);
  assert.equal(D.isComingSoon(e, Date.parse('2026-09-26T17:01:00Z')), false);
});

const L = D.DEFAULT_LAYOUT;
// Synthetic catalogue: premieres one day apart, oldest first
const day = i => new Date(Date.parse('2026-01-01T00:00:00+08:00') + i * 864e5).toISOString().replace('.000Z', 'Z');
const synth = n => D.validateEpisodes(Array.from({ length: n }, (_, i) =>
  ep({ id: 'e' + i, youtube: ('y' + String(i).padStart(10, '0')).slice(0, 11), premiere: day(i) })));
const mk = n => D.validateEpisodes(Array.from({ length: n }, (_, i) =>
  ep({ id: 'car' + i, youtube: ('x' + String(i).padStart(10, '0')).slice(0, 11) })));

test('13 reels; the newest 13 episodes hang on them left to right, newest first; the rest are archive-only', () => {
  assert.equal(D.REEL_COUNT, 13);
  assert.equal(L.reels.length, 13);
  const { reels, archive } = D.layoutReels(synth(30), L);
  assert.equal(reels.length, 13);
  assert.deepEqual(reels.map(r => r.id), Array.from({ length: 13 }, (_, i) => 'e' + (29 - i)));
  assert.deepEqual(reels.map(r => r.slot), Array.from({ length: 13 }, (_, i) => i));
  assert.deepEqual(archive, Array.from({ length: 17 }, (_, i) => 'e' + (16 - i)));
  for (let i = 1; i < reels.length; i++) assert.ok(reels[i].x > reels[i - 1].x, 'reels run left to right');
});

test('equal premieres: later in the catalogue counts as newer; a short catalogue leaves the right-hand reels empty', () => {
  const { reels, archive } = D.layoutReels(mk(3), L);
  assert.deepEqual(reels.map(r => r.id), ['car2', 'car1', 'car0']);
  assert.deepEqual(reels.map(r => r.x), L.reels.slice(0, 3).map(s => s.x));
  assert.deepEqual(archive, []);
  assert.deepEqual(D.layoutReels([], L), { reels: [], archive: [] });
});

// Hotspot geometry in scene %: centre (x, y), half-size hx (% of width) / hy (% of height), at a given scene width in
// px. The button is 2 * reelR * hitPad wide and square; its ::before pads the hit area to at least 44 px.
const hot = (s, wPx) => {
  const d = Math.max(2 * L.reelR * L.hitPad * wPx / 100, 44), hx = d / 2 / wPx * 100;
  return { x: s.x, y: s.y, l: s.x - hx, r: s.x + hx, t: s.y - hx * L.aspect, b: s.y + hx * L.aspect, d };
};
const screenBox = f => { const { x, top, height } = L.screen, hw = height * f / L.aspect / 2; return { l: x - hw, r: x + hw, t: top, b: top + height }; };
const hits = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;

test('the screen top sits on the barn seam and both formats fit the blank wall', () => {
  assert.ok(Math.abs(L.aspect - 4096 / 2336) < 1e-9);
  assert.ok(Math.abs(L.seam - 282 / 2336 * 100) < 1e-9);
  assert.equal(L.screen.top, L.seam);
  for (const f of [9 / 16, 16 / 9]) {
    const b = screenBox(f);
    assert.ok(b.l >= L.wall.l && b.r <= L.wall.r, 'screen wider than the wall');
    assert.ok(b.b <= L.wall.b, 'screen below the wall');
  }
});

test('reel hotspots: at least 44 px at 1440, no overlaps, all above the seam, clear of both screen formats', () => {
  const W = 1440, hs = L.reels.map(s => hot(s, W));
  for (const h of hs) {
    assert.ok(h.d >= 44, 'hit area under 44 px');
    assert.ok(2 * L.reelR * L.hitPad * W / 100 >= 44, 'the button itself is 44 px at 1440 (no padding needed)');
    assert.ok(h.t >= 0 && h.l >= 0 && h.r <= 100, 'hotspot outside the scene');
  }
  for (const [i, s] of L.reels.entries()) {
    const h = hs[i];
    // only reels over the barn wall must clear the seam; every reel must clear the screen
    if (s.x > L.wall.l && s.x < L.wall.r) assert.ok(h.b < L.seam, 'reel ' + i + ' hangs below the seam');
    for (const f of [9 / 16, 16 / 9]) assert.ok(!hits(h, screenBox(f)), 'reel ' + i + ' under the screen');
  }
  for (let i = 0; i < hs.length; i++)
    for (let j = i + 1; j < hs.length; j++) assert.ok(!hits(hs[i], hs[j]), 'reels ' + i + '/' + j + ' overlap');
});

test('reel hit areas stay apart on a phone-sized scene (430 px tall)', () => {
  const W = 430 * L.aspect, hs = L.reels.map(s => hot(s, W));
  for (let i = 1; i < hs.length; i++) assert.ok(!hits(hs[i - 1], hs[i]), 'reels ' + (i - 1) + '/' + i + ' overlap');
});

test('the page CSS matches DEFAULT_LAYOUT (screen top/height, reel size)', () => {
  const html = require('node:fs').readFileSync(require('node:path').join(__dirname, '../../cartoons/index.html'), 'utf8');
  const num = re => { const m = re.exec(html); assert.ok(m, 'missing ' + re); return parseFloat(m[1]); };
  assert.ok(Math.abs(num(/--st:calc\(var\(--top\) \+ var\(--sch\)\*([\d.]+)\)/) * 100 - L.screen.top) < 0.01, '--st');
  assert.ok(Math.abs(num(/--sh:calc\(var\(--sch\)\*([\d.]+)\)/) * 100 - L.screen.height) < 0.01, '--sh');
});

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

test('touch tap on a different prop while playing previews that prop instead', () => {
  const s = R({ mode: 'playing', id: 'c3' }, { type: 'activate', id: 'c4', pointer: 'touch' });
  assert.deepEqual(s, { mode: 'preview', id: 'c4' });
});

test('activating a coming-soon episode while something is playing previews it, not the playing one', () => {
  const s = R({ mode: 'playing', id: 'c3' }, { type: 'activate', id: 'c10', pointer: 'mouse' });
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

test('select previews any episode, but keeps a playing one', () => {
  assert.deepEqual(R(D.INITIAL, { type: 'select', id: 'c3' }), { mode: 'preview', id: 'c3' });
  assert.deepEqual(R({ mode: 'playing', id: 'c3' }, { type: 'select', id: 'c4' }), { mode: 'preview', id: 'c4' });
  const p = { mode: 'playing', id: 'c3' };
  assert.equal(R(p, { type: 'select', id: 'c3' }), p);
});

test('hash helpers', () => {
  assert.equal(D.parseHash('#ep=c10'), 'c10');
  assert.equal(D.formatHash('c10'), '#ep=c10');
  assert.equal(D.parseHash('#ep=c10', ['c3', 'c10']), 'c10');
  assert.equal(D.parseHash('#ep=zz', ['c3', 'c10']), null);
  assert.equal(D.parseHash('#ep=__proto__'), null);
  assert.equal(D.parseHash('#other'), null);
  assert.equal(D.parseHash(''), null);
  assert.equal(D.parseHash('#ep='), null);
});

const fs = require('node:fs');
const path = require('node:path');
const CAT = path.join(__dirname, '../../cartoons/episodes.json');

test('launch catalogue is valid, has 14 episodes: 13 on the reels, the oldest in the archive', () => {
  const eps = D.validateEpisodes(JSON.parse(fs.readFileSync(CAT, 'utf8')));
  assert.equal(eps.length, 14);
  const { reels, archive } = D.layoutReels(eps, D.DEFAULT_LAYOUT);
  assert.equal(reels.length, 13);
  assert.equal(reels[0].id, 'c14');
  assert.deepEqual(archive, ['pilot']); // pilot..c9 share a premiere; later in the catalogue = newer, so the pilot is oldest
  for (const e of eps) assert.ok(fs.existsSync(path.join(__dirname, '../../cartoons', D.propImage(e))), D.propImage(e) + ' missing');
  for (const e of eps) assert.doesNotMatch(e.alt, /\bcar\b|drive-in|poster board|projector-booth|pickup|sedan/i, e.id + ' alt still describes the drive-in');
  assert.ok(fs.existsSync(path.join(__dirname, '../../cartoons', D.REEL_IMAGE)), D.REEL_IMAGE + ' missing');
});
