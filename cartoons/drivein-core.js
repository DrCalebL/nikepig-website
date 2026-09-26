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

  return { validateEpisodes: validateEpisodes, isComingSoon: isComingSoon, layoutProps: layoutProps,
           DEFAULT_LAYOUT: DEFAULT_LAYOUT, PROP_W: PROP_W };
});
