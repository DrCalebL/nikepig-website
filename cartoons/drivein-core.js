/* Nikeverse Cartoons drive-in: pure logic (no DOM). UMD: window.DriveIn in the page, require() in tests. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DriveIn = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var PROP_TYPES = ['car', 'poster', 'snack', 'booth'];
  var FORMATS = ['portrait', 'landscape'];
  var FIELDS = ['id', 'title', 'youtube', 'format', 'premiere', 'prop', 'alt']; // image is optional
  var REEL_IMAGE = 'props/placeholder-reel.svg';
  var YT_ID = /^[A-Za-z0-9_-]{11}$/;
  var ID_FORMAT = /^[a-z0-9-]+$/;
  var PREMIERE_FORMAT = /^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d)?(Z|[+-]\d\d:\d\d)$/;

  function validateEpisodes(list) {
    if (!Array.isArray(list)) throw new Error('episodes must be an array');
    var seen = Object.create(null);
    return list.map(function (e, i) {
      var where = 'episode[' + i + ']';
      if (!e || typeof e !== 'object') throw new Error(where + ': not an object');
      FIELDS.forEach(function (k) {
        if (typeof e[k] !== 'string' || !e[k]) throw new Error(where + ': missing ' + k);
      });
      if ('image' in e && (typeof e.image !== 'string' || !e.image)) throw new Error(where + ': bad image');
      if (!ID_FORMAT.test(e.id)) throw new Error(where + ': bad id');
      if (Object.prototype.hasOwnProperty.call(seen, e.id)) throw new Error(where + ': duplicate id ' + e.id);
      seen[e.id] = true;
      if (!YT_ID.test(e.youtube)) throw new Error(where + ': bad youtube id');
      if (FORMATS.indexOf(e.format) < 0) throw new Error(where + ': bad format');
      if (PROP_TYPES.indexOf(e.prop) < 0) throw new Error(where + ': bad prop');
      if (!PREMIERE_FORMAT.test(e.premiere)) throw new Error(where + ': premiere needs ISO datetime with offset');
      var t = Date.parse(e.premiere);
      if (isNaN(t)) throw new Error(where + ': bad premiere');
      return Object.assign({}, e, { premiereMs: t });
    });
  }

  function isComingSoon(ep, nowMs) { return nowMs < ep.premiereMs; }
  function propImage(ep) { return ep.image || REEL_IMAGE; }

  var PROP_W = 14; // % of base-scene width at scale 1
  var LOT_SIZE = 12; // max row props on the lot; older episodes are archive-only

  // Placeholder geometry; Task 12 replaces these with values measured from the final background.
  var DEFAULT_LAYOUT = {
    // Special spots sit outside the landscape screen footprint (x 21-79%, y 8-66%) and clear of each other.
    screen: { x: 50, top: 8, height: 58 },
    special: {
      poster: [{ x: 9, y: 74, scale: 1 }, { x: 91, y: 74, scale: 1 }],
      snack: [{ x: 16, y: 90, scale: 0.9 }],
      booth: [{ x: 84, y: 90, scale: 0.8 }]
    },
    crate: { x: 95, y: 98, scale: 0.6 }, // reel crate, only when the archive is non-empty
    rows: [
      { y: 73.5, scale: 0.55, xs: [31, 40.5, 50, 59.5, 69] }, // back
      { y: 84, scale: 0.75, xs: [30, 43.3, 56.6, 70] },       // middle
      { y: 98, scale: 1, xs: [30, 50, 70] }                   // front
    ],
    fillOrder: [2, 1, 0]
  };

  // Specials fill their spots in catalogue order; the rest go newest-first into at most LOT_SIZE row slots.
  function layoutProps(episodes, L) {
    var used = {}, out = [], rest = [];
    var zOf = function (y) { return 1 + L.rows.filter(function (r) { return r.y < y; }).length; }; // front rows on top
    episodes.forEach(function (e, i) {
      var spots = L.special[e.prop];
      used[e.prop] = used[e.prop] || 0;
      if (spots && used[e.prop] < spots.length) {
        var s = spots[used[e.prop]++];
        out.push({ id: e.id, x: s.x, y: s.y, scale: s.scale, z: zOf(s.y), slot: e.prop + '-' + used[e.prop] });
      } else rest.push({ e: e, i: i });
    });
    rest.sort(function (a, b) { return (b.e.premiereMs - a.e.premiereMs) || (a.i - b.i); });
    var slots = [];
    L.fillOrder.forEach(function (ri) { L.rows[ri].xs.forEach(function (x, k) { slots.push({ row: L.rows[ri], ri: ri, x: x, k: k }); }); });
    if (L.fillOrder.length !== L.rows.length) throw new Error('layout: fillOrder does not cover all rows');
    var cap = Math.min(LOT_SIZE, slots.length), archive = [];
    rest.forEach(function (r, n) {
      if (n >= cap) { archive.push(r.e.id); return; }
      var s = slots[n];
      out.push({ id: r.e.id, x: s.x, y: s.row.y, scale: s.row.scale, z: zOf(s.row.y), slot: 'r' + s.ri + '-' + s.k });
    });
    var c = archive.length && L.crate ? L.crate : null;
    return { props: out, archive: archive, segments: 1,
             crate: c && { x: c.x, y: c.y, scale: c.scale, z: zOf(c.y), slot: 'crate' } };
  }

  var INITIAL = Object.freeze({ mode: 'idle', id: null });

  function reduce(state, ev, ctx) {
    switch (ev.type) {
      case 'hover':
        if (state.mode === 'playing') return state;
        if (state.mode === 'preview' && state.id === ev.id) return state;
        return { mode: 'preview', id: ev.id };
      case 'select': // list or deep link: preview, unless it's already playing
        if (state.mode === 'playing' && state.id === ev.id) return state;
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
  function parseHash(hash, ids) {
    var m = /^#ep=([a-z0-9-]+)$/.exec(hash || '');
    return m && (!ids || ids.indexOf(m[1]) >= 0) ? m[1] : null;
  }
  function formatHash(id) { return '#ep=' + id; }
  function formatPremiere(ms) {
    return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Singapore' });
  }

  return { validateEpisodes: validateEpisodes, isComingSoon: isComingSoon, propImage: propImage, layoutProps: layoutProps,
           DEFAULT_LAYOUT: DEFAULT_LAYOUT, PROP_W: PROP_W, LOT_SIZE: LOT_SIZE, INITIAL: INITIAL, reduce: reduce,
           embedUrl: embedUrl, thumbUrl: thumbUrl, watchUrl: watchUrl, parseHash: parseHash, formatHash: formatHash,
           formatPremiere: formatPremiere };
});
