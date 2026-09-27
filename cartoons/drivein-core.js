/* Nikeverse Cartoons drive-in: pure logic (no DOM). UMD: window.DriveIn in the page, require() in tests. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DriveIn = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var PROP_TYPES = ['car', 'poster', 'snack', 'booth'];
  var FORMATS = ['portrait', 'landscape'];
  var FIELDS = ['id', 'title', 'youtube', 'format', 'premiere', 'prop', 'alt']; // image is optional
  var REEL_IMAGE = 'props/placeholder-reel.svg'; // last-resort onerror fallback
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
  // Episodes without their own art borrow a generic seat-saver, picked by a stable hash of the id (FNV-1a).
  var GENERIC_COUNT = 12;
  function hashId(id) {
    var h = 2166136261;
    for (var i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h;
  }
  function propImage(ep) { return ep.image || 'props/generic-' + (hashId(ep.id) % GENERIC_COUNT + 1) + '.webp'; }

  var PROP_W = 14; // % of base-scene width at scale 1
  var LOT_SIZE = 12; // max row props on the lot; older episodes are archive-only

  // Measured from the barn background (barn-cinema-bg-B-0936-4k-gflegs.jpeg, 4096x2336) with ?debug=layout.
  // All values are % of the scene; y is the prop's bottom edge (props stand on it). Painted cast (keep clear):
  // GF Princess x 8-20, Poppy x 22-38 / y 68-94, Nike x 61.5-77 / y 62-93, Charles x 77-89. Barn wall x 21-79, y 0-62.
  var DEFAULT_LAYOUT = {
    aspect: 4096 / 2336,
    // The page applies this via --st/--sh in cartoons/index.html (kept in sync by hand). Landscape: x 26.7-73.3%.
    screen: { x: 50, top: 10, height: 46 },
    special: {
      poster: [{ x: 5.5, y: 100, scale: 0.7 }, { x: 93.5, y: 100, scale: 0.72 }], // boards at the scene edges, below the faces
      snack: [{ x: 5.5, y: 64, scale: 0.38 }],  // on the snack-stand counter
      booth: [{ x: 92, y: 80, scale: 0.5 }]     // against the projector shed's crates
    },
    crate: { x: 15, y: 99, scale: 0.5 }, // reel crate on the ground below GF Princess, only when the archive is non-empty
    rows: [
      { y: 67, scale: 0.34, xs: [22.5, 28, 33.5, 39, 44.5, 57] }, // back: on the hay bales, above Poppy
      { y: 80, scale: 0.44, xs: [43, 50, 57] },                   // middle: at the foot of the bales, between Poppy and Nike
      { y: 97, scale: 0.52, xs: [42, 49.5, 57] }                  // front: on the dirt, between Poppy and Nike
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
           DEFAULT_LAYOUT: DEFAULT_LAYOUT, GENERIC_COUNT: GENERIC_COUNT, REEL_IMAGE: REEL_IMAGE, PROP_W: PROP_W, LOT_SIZE: LOT_SIZE, INITIAL: INITIAL, reduce: reduce,
           embedUrl: embedUrl, thumbUrl: thumbUrl, watchUrl: watchUrl, parseHash: parseHash, formatHash: formatHash,
           formatPremiere: formatPremiere };
});
