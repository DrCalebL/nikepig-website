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
