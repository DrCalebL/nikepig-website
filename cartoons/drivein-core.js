/* Nikeverse Cartoons drive-in: pure logic (no DOM). UMD: window.DriveIn in the page, require() in tests. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DriveIn = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var PROP_TYPES = ['car', 'poster', 'snack', 'booth']; // legacy placement key; kept as catalogue metadata, not used for layout
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

  // Measured from the barn background (barn-reels-4k.jpeg, 4096x2336) with `python tests/tools/process-art.py reels`.
  // x and y are % of the scene width / height; REEL_R is % of the scene WIDTH (painted radius incl. the dark outline,
  // 64 px of 4096; all 13 reels are the same size). The screen's top edge sits on the barn's horizontal board seam
  // (y 282 px). Blank barn wall: x 878-3214 px (21.4-78.5%), bottom y 1445 px (61.9%).
  var SEAM = 282 / 2336 * 100;
  var REEL_R = 1.57;
  var HIT_PAD = 1.1; // hotspot diameter = 2 * REEL_R * HIT_PAD (the glow ring sits just outside the painted rim)
  var DEFAULT_LAYOUT = {
    aspect: 4096 / 2336,
    seam: SEAM,
    wall: { l: 21.4, r: 78.5, b: 61.9 },
    // The page applies this via --st/--sh in cartoons/index.html (a unit test keeps them in sync). Landscape: x 25.7-74.3%.
    screen: { x: 50, top: SEAM, height: 48 },
    reelR: REEL_R,
    hitPad: HIT_PAD,
    reels: [ // left to right along the fairy-light string
      { x: 6.36, y: 8.55 }, { x: 15.46, y: 8.76 }, { x: 22.97, y: 8.77 }, { x: 32.50, y: 8.76 }, { x: 40.09, y: 8.74 },
      { x: 46.55, y: 8.75 }, { x: 53.10, y: 8.71 }, { x: 59.92, y: 8.69 }, { x: 67.24, y: 8.72 }, { x: 75.35, y: 8.38 },
      { x: 81.57, y: 8.62 }, { x: 88.37, y: 10.28 }, { x: 95.61, y: 8.43 }
    ]
  };
  var REEL_COUNT = DEFAULT_LAYOUT.reels.length;

  // Newest first (premiere desc, catalogue order as tie-break): the newest REEL_COUNT episodes hang on the reels,
  // left to right = newest to oldest; the rest are archive-only (the "All episodes" list).
  function layoutReels(episodes, L) {
    var order = episodes.map(function (e, i) { return { e: e, i: i }; })
      .sort(function (a, b) { return (b.e.premiereMs - a.e.premiereMs) || (a.i - b.i); });
    var reels = [], archive = [];
    order.forEach(function (o, n) {
      if (n >= L.reels.length) { archive.push(o.e.id); return; }
      var s = L.reels[n];
      reels.push({ id: o.e.id, slot: n, x: s.x, y: s.y, r: L.reelR });
    });
    return { reels: reels, archive: archive };
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

  return { validateEpisodes: validateEpisodes, isComingSoon: isComingSoon, propImage: propImage, layoutReels: layoutReels,
           DEFAULT_LAYOUT: DEFAULT_LAYOUT, REEL_COUNT: REEL_COUNT, GENERIC_COUNT: GENERIC_COUNT, REEL_IMAGE: REEL_IMAGE, INITIAL: INITIAL, reduce: reduce,
           embedUrl: embedUrl, thumbUrl: thumbUrl, watchUrl: watchUrl, parseHash: parseHash, formatHash: formatHash,
           formatPremiere: formatPremiere };
});
