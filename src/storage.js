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

  // Older best-score data is read for migration and never modified or deleted.
  // v1: one best score, recorded at the original fixed 150 ms tick (the "fast" speed).
  var BEST_KEY_V1 = 'classic-games.best.prototype-v1';
  // v2: one best score per prototype speed: {v:2, best:{slow:n, medium:n, fast:n}}.
  var BEST_KEY_V2 = 'classic-games.best.prototype-v2';
  // v3: one best score per rules profile: {v:3, best:{"slow|classic|clear|walls|bonus":n}}.
  var BEST_KEY = 'classic-games.best.prototype-v3';
  var SPEED_KEY = 'classic-games.speed';
  var RULES_KEY = 'classic-games.rules';

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

  // Best scores are separate for every rules profile so unlike runs are never compared.
  // opts.isKey validates a profile key; opts.legacyKey(speed) names the profile that the
  // pre-v3 games corresponded to (classic lives, clear field, solid walls, no bonus).
  function createBestStore(storage, opts) {
    var best = {};
    var persistent = false; // true only while reads/writes to storage are working

    function merge(k, n) {
      if (opts.isKey(k) && validScore(n)) best[k] = Math.max(best[k] || 0, n);
    }

    function load() {
      if (!storage) { persistent = false; return; }
      var r3 = readJson(storage, BEST_KEY);
      var r2 = readJson(storage, BEST_KEY_V2);
      var r1 = readJson(storage, BEST_KEY_V1);
      persistent = r3.ok && r2.ok && r1.ok;
      var v3 = r3.value;
      if (v3 && v3.v === 3 && v3.best && typeof v3.best === 'object') {
        Object.keys(v3.best).forEach(function (k) { merge(k, v3.best[k]); });
      }
      var v2 = r2.value;
      if (v2 && v2.v === 2 && v2.best && typeof v2.best === 'object') {
        Object.keys(v2.best).forEach(function (sp) { merge(opts.legacyKey(sp), v2.best[sp]); });
      }
      var v1 = r1.value;
      if (v1 && v1.v === 1) merge(opts.legacyKey('fast'), v1.best);
    }

    function get(k) { return hasOwn(best, k) ? best[k] : 0; }

    // Returns the best score for profile `k` after considering `score`.
    function submit(k, score) {
      if (opts.isKey(k) && validScore(score) && score > get(k)) {
        best[k] = score;
        try {
          if (!storage) throw new Error('no storage');
          storage.setItem(BEST_KEY, JSON.stringify({ v: 3, best: best }));
          persistent = true;
        } catch {
          persistent = false; // quota, private mode, disabled: session-only
        }
      }
      return get(k);
    }

    // Recorded scores above zero, highest first.
    function entries() {
      return Object.keys(best).filter(function (k) { return best[k] > 0; })
        .sort(function (a, b) { return best[b] - best[a] || (a < b ? -1 : 1); })
        .map(function (k) { return [k, best[k]]; });
    }

    return { load: load, get: get, submit: submit, entries: entries, isPersistent: function () { return persistent; } };
  }

  // Rules preferences (board, edges, lives, bonus). Each field is validated on its own
  // against schema {field: [allowed values]}; unknown or invalid values fall back to the
  // defaults. Nothing is written until the user changes a field.
  function createRulesPref(storage, schema, defaults) {
    var value = {};
    Object.keys(schema).forEach(function (f) { value[f] = defaults[f]; });
    var persistent = false;

    function load() {
      if (!storage) { persistent = false; return; }
      var r = readJson(storage, RULES_KEY);
      persistent = r.ok;
      var v = r.value;
      if (v && v.v === 1 && typeof v === 'object') {
        Object.keys(schema).forEach(function (f) {
          if (typeof v[f] === 'string' && schema[f].indexOf(v[f]) >= 0) value[f] = v[f];
        });
      }
    }

    function set(field, next) {
      if (!hasOwn(schema, field) || schema[field].indexOf(next) < 0) return;
      value[field] = next;
      try {
        if (!storage) throw new Error('no storage');
        var out = { v: 1 };
        Object.keys(schema).forEach(function (f) { out[f] = value[f]; });
        storage.setItem(RULES_KEY, JSON.stringify(out));
        persistent = true;
      } catch {
        persistent = false; // keep the choice for this session only
      }
    }

    function get() {
      var out = {};
      Object.keys(schema).forEach(function (f) { out[f] = value[f]; });
      return out;
    }

    return { load: load, set: set, get: get, isPersistent: function () { return persistent; } };
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
    BEST_KEY_V2: BEST_KEY_V2,
    BEST_KEY_V1: BEST_KEY_V1,
    SPEED_KEY: SPEED_KEY,
    RULES_KEY: RULES_KEY,
    createBestStore: createBestStore,
    createSpeedPref: createSpeedPref,
    createRulesPref: createRulesPref
  };
});
