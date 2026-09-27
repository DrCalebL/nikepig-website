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

test('image is optional; propImage falls back to the reel icon', () => {
  const e = ep(); delete e.image;
  const [v] = D.validateEpisodes([e]);
  assert.equal(D.propImage(v), 'props/placeholder-reel.svg');
  assert.equal(D.propImage(D.validateEpisodes([ep()])[0]), 'props/placeholder-car.svg');
  assert.throws(() => D.validateEpisodes([ep({ image: '' })]), /bad image/);
  assert.throws(() => D.validateEpisodes([ep({ image: 5 })]), /bad image/);
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
const mk = (n, prop = 'car') => D.validateEpisodes(Array.from({ length: n }, (_, i) =>
  ep({ id: prop + i, youtube: ('x' + String(i).padStart(10, '0')).slice(0, 11), prop })));

test('special props fill their spots in order, then fall back to row slots', () => {
  const eps = mk(3, 'poster');
  const { props } = D.layoutProps(eps, L);
  assert.equal(props[0].slot, 'poster-1');
  assert.equal(props[1].slot, 'poster-2');
  assert.equal(props[2].slot, 'r2-0'); // overflow poster becomes the first front-row slot
});

test('row props fill front row first, then middle, then back; 12 on the lot', () => {
  const { props, segments, archive, crate } = D.layoutProps(mk(12), L);
  assert.equal(segments, 1);
  assert.deepEqual(archive, []);
  assert.equal(crate, null);
  assert.deepEqual(props.slice(0, 3).map(p => p.slot), ['r2-0', 'r2-1', 'r2-2']);
  assert.equal(props[3].slot, 'r1-0');
  assert.equal(props[7].slot, 'r0-0');
});

// Synthetic catalogues: first four are 2 posters, 1 snack, 1 booth; premieres one day apart, oldest first
const day = i => new Date(Date.parse('2026-01-01T00:00:00+08:00') + i * 864e5).toISOString().replace('.000Z', 'Z');
const synth = (n, special = ['poster', 'poster', 'snack', 'booth']) => D.validateEpisodes(Array.from({ length: n }, (_, i) =>
  ep({ id: 'e' + i, youtube: ('y' + String(i).padStart(10, '0')).slice(0, 11), prop: special[i] || 'car', premiere: day(i) })));

test('row props are newest first; specials keep catalogue order', () => {
  const { props } = D.layoutProps(synth(8), L);
  assert.deepEqual(props.slice(0, 4).map(p => p.id + ':' + p.slot), ['e0:poster-1', 'e1:poster-2', 'e2:snack-1', 'e3:booth-1']);
  assert.deepEqual(props.slice(4).map(p => p.id + ':' + p.slot), ['e7:r2-0', 'e6:r2-1', 'e5:r2-2', 'e4:r1-0']);
});

test('equal premieres keep catalogue order', () => {
  const { props } = D.layoutProps(mk(3), L);
  assert.deepEqual(props.map(p => p.id), ['car0', 'car1', 'car2']);
});

test('the lot is capped at LOT_SIZE; older episodes go to the archive with a crate', () => {
  assert.equal(D.LOT_SIZE, 12);
  const { props, segments, archive, crate } = D.layoutProps(synth(30), L);
  assert.equal(segments, 1);
  const rows = props.filter(p => /^r\d/.test(p.slot));
  assert.equal(rows.length, 12);
  assert.equal(props.length, 16);
  assert.equal(archive.length, 14);
  assert.deepEqual(archive, Array.from({ length: 14 }, (_, i) => 'e' + (17 - i))); // newest-first
  assert.deepEqual(rows.filter(p => p.slot.startsWith('r2-')).map(p => p.id), ['e29', 'e28', 'e27']);
  assert.ok(crate && crate.slot === 'crate');
  assert.ok(props.every(p => p.x <= 100), 'no extension segments');
});

// Conservative box: width PROP_W*scale (% of width), square in pixels (16:9 scene), anchored bottom-centre.
const box = p => { const w = D.PROP_W * p.scale, h = w * 16 / 9; return { l: p.x - w / 2, r: p.x + w / 2, t: p.y - h, b: p.y }; };
const hits = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;

test('no two props share a slot; the crate clears every spot and the screen', () => {
  const { props, crate } = D.layoutProps(synth(30), L);
  assert.equal(new Set(props.map(p => p.slot)).size, props.length);
  for (const row of L.rows)
    for (let i = 1; i < row.xs.length; i++)
      assert.ok(row.xs[i] - row.xs[i - 1] >= D.PROP_W * row.scale, 'row too tight');
  const others = [].concat(...Object.values(L.special), ...L.rows.map(r => r.xs.map(x => ({ x, y: r.y, scale: r.scale }))));
  for (const o of others) assert.ok(!hits(box(crate), box(o)), 'crate overlaps ' + JSON.stringify(o));
  const scr = { l: 21, r: 79, t: L.screen.top, b: L.screen.top + L.screen.height };
  assert.ok(!hits(box(crate), scr), 'crate under the screen');
});

test('specials do not move when a newer poster episode is added', () => {
  const a = D.layoutProps(synth(6), L).props;
  const b = D.layoutProps(synth(7, ['poster', 'poster', 'snack', 'booth', 'car', 'car', 'poster']), L).props;
  const slot = (ps, id) => ps.find(p => p.id === id).slot;
  for (const id of ['e0', 'e1', 'e2', 'e3']) assert.equal(slot(b, id), slot(a, id));
  assert.equal(slot(b, 'e6'), 'r2-0');
});

test('rows stack front over back; everything stays under the hover lift', () => {
  const { props, crate } = D.layoutProps(synth(30), L);
  const z = s => props.find(p => p.slot === s).z;
  assert.ok(z('r2-0') > z('r1-0') && z('r1-0') > z('r0-0'));
  assert.ok(z('r0-0') >= 1 && crate.z >= 1);
  assert.ok(Math.max(crate.z, ...props.map(p => p.z)) < 5, 'hover/focus lift (z 5) stays on top');
});

test('empty catalogue still yields one segment and no crate', () => {
  const r = D.layoutProps([], L);
  assert.equal(r.segments, 1);
  assert.equal(r.crate, null);
});

test('layoutProps throws when fillOrder does not cover all rows', () => {
  const L2 = {
    special: {},
    rows: [
      { y: 10, scale: 1, xs: [1, 2] },
      { y: 20, scale: 1, xs: [1, 2] },
      { y: 30, scale: 1, xs: [1, 2, 3] },
    ],
    fillOrder: [2], // rows 0 and 1 are never reachable
  };
  assert.throws(() => D.layoutProps(mk(4), L2), /layout: fillOrder does not cover all rows/);
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

test('launch catalogue is valid, has 14 episodes, fills all four special spots and needs no archive', () => {
  const eps = D.validateEpisodes(JSON.parse(fs.readFileSync(CAT, 'utf8')));
  assert.equal(eps.length, 14);
  const { props, segments, archive, crate } = D.layoutProps(eps, D.DEFAULT_LAYOUT);
  assert.equal(segments, 1);
  assert.deepEqual(archive, []);
  assert.equal(crate, null);
  assert.equal(props.filter(p => /^r\d/.test(p.slot)).length, 10);
  for (const s of ['poster-1', 'poster-2', 'snack-1', 'booth-1'])
    assert.ok(props.some(p => p.slot === s), s + ' unused');
  for (const e of eps) assert.ok(fs.existsSync(path.join(__dirname, '../../cartoons', D.propImage(e))), D.propImage(e) + ' missing');
  for (const f of ['props/placeholder-reel.svg', 'props/placeholder-crate.svg'])
    assert.ok(fs.existsSync(path.join(__dirname, '../../cartoons', f)), f + ' missing');
});
