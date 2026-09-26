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
