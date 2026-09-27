/* Nikeverse Cartoons drive-in: pure logic (no DOM). UMD: window.DriveIn in the page, require() in tests. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DriveIn = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // prop: optional legacy metadata (defaults to 'car'); it has no effect on the reels or the layout.
  var PROP_TYPES = ['car', 'poster', 'snack', 'booth'], DEFAULT_PROP = 'car';
  var FORMATS = ['portrait', 'landscape'];
  var FIELDS = ['id', 'title', 'youtube', 'format', 'premiere']; // prop is optional
  // Episodes have no art of their own (user decision 2026-09-27): released ones show their YouTube thumbnail, coming-soon
  // ones (and any thumbnail that fails) the plain reel icon. Legacy `image` and `alt` fields are ignored and dropped.
  var LEGACY_FIELDS = ['image', 'alt'];
  var REEL_IMAGE = 'art/reel.svg';
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
      if (!ID_FORMAT.test(e.id)) throw new Error(where + ': bad id');
      if (Object.prototype.hasOwnProperty.call(seen, e.id)) throw new Error(where + ': duplicate id ' + e.id);
      seen[e.id] = true;
      if (!YT_ID.test(e.youtube)) throw new Error(where + ': bad youtube id');
      if (FORMATS.indexOf(e.format) < 0) throw new Error(where + ': bad format');
      if ('prop' in e && PROP_TYPES.indexOf(e.prop) < 0) throw new Error(where + ': bad prop');
      if (!PREMIERE_FORMAT.test(e.premiere)) throw new Error(where + ': premiere needs ISO datetime with offset');
      var t = Date.parse(e.premiere);
      if (isNaN(t)) throw new Error(where + ': bad premiere');
      var out = Object.assign({}, e, { prop: e.prop || DEFAULT_PROP, premiereMs: t });
      LEGACY_FIELDS.forEach(function (k) { delete out[k]; });
      return out;
    });
  }

  // Premiere gating is client-side only (the visitor's clock): it hides the player, not the video. Schedule the
  // premiere on YouTube too (or keep the video private/unlisted) so nobody can watch early via the YouTube id.
  function isComingSoon(ep, nowMs) { return nowMs < ep.premiereMs; }
  // The list / screen picture: the YouTube thumbnail once released; before the premiere the reel icon (no request to
  // YouTube, so the thumbnail can't spoil the episode).
  function episodeImage(ep, nowMs) { return isComingSoon(ep, nowMs) ? REEL_IMAGE : thumbUrl(ep.youtube); }

  // Measured from the barn background (barn-reels-4k.jpeg, 4096x2336) with `python tests/tools/process-art.py reels`.
  // x and y are % of the scene width / height; REEL_R is % of the scene WIDTH (painted radius incl. the dark outline,
  // 64 px of 4096; all 13 reels are the same size). The screen's top edge sits on the barn's horizontal board seam
  // (y 282 px). Blank barn wall: x 878-3214 px (21.4-78.5%), bottom seam line y 1444-1446 px; screen bottom at its lower edge y 1446 (61.90%).
  var SEAM = 282 / 2336 * 100;
  var REEL_R = 1.57;
  var HIT_PAD = 1.1; // hotspot diameter = 2 * REEL_R * HIT_PAD (the glow ring sits just outside the painted rim)
  var DEFAULT_LAYOUT = {
    aspect: 4096 / 2336,
    seam: SEAM,
    wall: { l: 21.4, r: 78.5, b: 1446 / 2336 * 100 },
    // The page applies this via --st/--sh in cartoons/index.html (a unit test keeps them in sync). Landscape: x 24.8-75.2%.
    screen: { x: 50, top: SEAM, height: (1446 - 282) / 2336 * 100 },  // top seam (y 282) to bottom seam (y 1446): full wall height
    reelR: REEL_R,
    hitPad: HIT_PAD,
    reels: [ // left to right along the fairy-light string
      { x: 6.36, y: 8.55 }, { x: 15.46, y: 8.76 }, { x: 22.97, y: 8.77 }, { x: 32.50, y: 8.76 }, { x: 40.09, y: 8.74 },
      { x: 46.55, y: 8.75 }, { x: 53.10, y: 8.71 }, { x: 59.92, y: 8.69 }, { x: 67.24, y: 8.72 }, { x: 75.35, y: 8.38 },
      { x: 81.57, y: 8.62 }, { x: 88.37, y: 10.28 }, { x: 95.61, y: 8.43 }
    ]
  };
  var REEL_COUNT = DEFAULT_LAYOUT.reels.length;

  // Newest first (premiere desc; ties: later in the catalogue = newer, since the catalogue is in release order): the newest REEL_COUNT episodes hang on the reels,
  // left to right = newest to oldest; the rest are archive-only (the "All episodes" list).
  function layoutReels(episodes, L) {
    var order = episodes.map(function (e, i) { return { e: e, i: i }; })
      .sort(function (a, b) { return (b.e.premiereMs - a.e.premiereMs) || (b.i - a.i); });
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

  return { validateEpisodes: validateEpisodes, isComingSoon: isComingSoon, episodeImage: episodeImage, layoutReels: layoutReels,
           DEFAULT_LAYOUT: DEFAULT_LAYOUT, REEL_COUNT: REEL_COUNT, REEL_IMAGE: REEL_IMAGE, INITIAL: INITIAL, reduce: reduce,
           embedUrl: embedUrl, thumbUrl: thumbUrl, watchUrl: watchUrl, parseHash: parseHash, formatHash: formatHash,
           formatPremiere: formatPremiere };
});
