// Failure-tolerant best-score store. Takes a Storage-like object (or null) so it can be tested.
// The key names a provisional ruleset: scores from the early prototype must not be mixed
// with scores from any future verified rules.
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SnakeStorage = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var BEST_KEY = 'classic-games.best.prototype-v1';

  function createBestStore(storage) {
    var best = 0;
    var persistent = false; // true only while reads/writes to storage are working

    function load() {
      try {
        var raw = storage && storage.getItem(BEST_KEY);
        persistent = !!storage;
        if (raw === null || raw === undefined) return best;
        var parsed = JSON.parse(raw);
        var n = parsed && parsed.v === 1 ? parsed.best : NaN;
        if (typeof n === 'number' && isFinite(n) && n >= 0 && Math.floor(n) === n) best = Math.max(best, n);
      } catch {
        persistent = false; // unavailable or corrupt: keep the in-memory value
      }
      return best;
    }

    // Returns the best score after considering `score`.
    function submit(score) {
      if (typeof score === 'number' && isFinite(score) && score > best) {
        best = Math.floor(score);
        try {
          if (!storage) throw new Error('no storage');
          storage.setItem(BEST_KEY, JSON.stringify({ v: 1, best: best }));
          persistent = true;
        } catch {
          persistent = false; // quota, private mode, disabled: session-only
        }
      }
      return best;
    }

    return {
      load: load,
      submit: submit,
      get: function () { return best; },
      isPersistent: function () { return persistent; }
    };
  }

  return { BEST_KEY: BEST_KEY, createBestStore: createBestStore };
});
