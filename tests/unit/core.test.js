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
