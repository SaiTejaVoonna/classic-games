// Failure-tolerant stores. They take a Storage-like object (or null) so they can be tested.
// Keys name a provisional ruleset: scores from the early prototype must not be mixed with
// scores from any future verified rules.
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SnakeStorage = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // v1 held one best score, all recorded at the original fixed 150 ms tick (the "fast"
  // prototype speed). It is read for migration and never modified or deleted.
  var BEST_KEY_V1 = 'classic-games.best.prototype-v1';
  // v2 holds one best score per prototype speed: {v:2, best:{slow:n, medium:n, fast:n}}.
  var BEST_KEY = 'classic-games.best.prototype-v2';
  var SPEED_KEY = 'classic-games.speed';

  function hasOwn(obj, k) { return Object.prototype.hasOwnProperty.call(obj, k); }

  function validScore(n) {
    return typeof n === 'number' && isFinite(n) && n >= 0 && Math.floor(n) === n;
  }

  // Returns { ok, value }: ok is false only when storage itself cannot be read; a corrupt
  // value is ok with value null.
  function readJson(storage, key) {
    var raw;
    try { raw = storage.getItem(key); } catch { return { ok: false, value: null }; }
    if (raw === null || raw === undefined) return { ok: true, value: null };
    try { return { ok: true, value: JSON.parse(raw) }; } catch { return { ok: true, value: null }; }
  }

  function createBestStore(storage, speeds, legacySpeed) {
    var best = {};
    speeds.forEach(function (s) { best[s] = 0; });
    var persistent = false; // true only while reads/writes to storage are working

    function load() {
      if (!storage) { persistent = false; return; }
      var r2 = readJson(storage, BEST_KEY);
      var r1 = readJson(storage, BEST_KEY_V1);
      persistent = r2.ok && r1.ok;
      var v2 = r2.value;
      if (v2 && v2.v === 2 && v2.best && typeof v2.best === 'object') {
        speeds.forEach(function (s) {
          if (validScore(v2.best[s])) best[s] = Math.max(best[s], v2.best[s]);
        });
      }
      var v1 = r1.value;
      if (v1 && v1.v === 1 && validScore(v1.best) && hasOwn(best, legacySpeed)) {
        best[legacySpeed] = Math.max(best[legacySpeed], v1.best);
      }
    }

    function get(speed) { return hasOwn(best, speed) ? best[speed] : 0; }

    // Returns the best score for `speed` after considering `score`.
    function submit(speed, score) {
      if (hasOwn(best, speed) && validScore(score) && score > best[speed]) {
        best[speed] = score;
        try {
          if (!storage) throw new Error('no storage');
          storage.setItem(BEST_KEY, JSON.stringify({ v: 2, best: best }));
          persistent = true;
        } catch {
          persistent = false; // quota, private mode, disabled: session-only
        }
      }
      return get(speed);
    }

    return { load: load, get: get, submit: submit, isPersistent: function () { return persistent; } };
  }

  // The selected prototype speed preference (a key such as "medium").
  function createSpeedPref(storage, allowed, fallback) {
    var value = fallback;
    var persistent = false;

    function load() {
      try {
        if (!storage) throw new Error('no storage');
        var raw = storage.getItem(SPEED_KEY);
        if (raw !== null && raw !== undefined && allowed.indexOf(raw) >= 0) value = raw;
        persistent = true;
      } catch {
        persistent = false;
      }
      return value;
    }

    function set(next) {
      if (allowed.indexOf(next) < 0) return value;
      value = next;
      try {
        if (!storage) throw new Error('no storage');
        storage.setItem(SPEED_KEY, next);
        persistent = true;
      } catch {
        persistent = false; // keep the choice for this session only
      }
      return value;
    }

    return { load: load, set: set, get: function () { return value; }, isPersistent: function () { return persistent; } };
  }

  return {
    BEST_KEY: BEST_KEY,
    BEST_KEY_V1: BEST_KEY_V1,
    SPEED_KEY: SPEED_KEY,
    createBestStore: createBestStore,
    createSpeedPref: createSpeedPref
  };
});
