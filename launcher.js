// Classic Games launcher: the landing page, the menu drawer, awards and best scores.
// It only reads what the games save on this device. No network, no accounts.
(function () {
  'use strict';

  var S = window.SnakeStorage;
  var $ = function (id) { return document.getElementById(id); };
  var root = document.documentElement;

  function safeStorage() { try { return window.localStorage; } catch (e) { return null; } }
  var storage = safeStorage();
  function readJson(key) {
    try { var raw = storage && storage.getItem(key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }

  // ---------- saved choices (same format the games use) ----------
  var lookPref = S.createChoicePref(storage, 'classic-games.launcher', { theme: ['auto', 'light', 'dark'] }, { theme: 'auto' });
  lookPref.load();
  var appPref = S.createChoicePref(storage, S.APP_KEY, { sound: ['on', 'off'], haptics: ['on', 'off'] }, { sound: 'on', haptics: 'on' });
  appPref.load();
  var PREFS = { theme: lookPref, sound: appPref, haptics: appPref };

  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
  function applyTheme() {
    var t = lookPref.get().theme;
    var eff = t === 'auto' ? (mq && mq.matches ? 'light' : 'dark') : t;
    root.setAttribute('data-theme', eff);
  }
  if (mq && mq.addEventListener) mq.addEventListener('change', applyTheme);

  function renderSeg() {
    Array.prototype.forEach.call(document.querySelectorAll('.seg'), function (seg) {
      var name = seg.getAttribute('data-pref');
      var cur = PREFS[name].get()[name];
      Array.prototype.forEach.call(seg.querySelectorAll('button'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-val') === cur)); });
    });
  }
  Array.prototype.forEach.call(document.querySelectorAll('.seg button'), function (b) {
    b.addEventListener('click', function () {
      var name = b.parentNode.getAttribute('data-pref');
      PREFS[name].set(name, b.getAttribute('data-val'));
      renderSeg(); applyTheme();
    });
  });

  // ---------- what the games have saved ----------
  var STATS_KEY = 'classic-games.racer.stats';
  var BESTS_KEY = 'classic-games.racer.bests';
  var CHECK_KEY = 'classic-games.racer.checkpoint';

  function racerStats() {
    var s = readJson(STATS_KEY) || {};
    var o = {};
    ['runs', 'near', 'nearBest', 'coins', 'journeys', 'noHitJourneys', 'maxChapter', 'bestDistance'].forEach(function (k) { o[k] = typeof s[k] === 'number' && isFinite(s[k]) ? s[k] : 0; });
    return o;
  }
  function snakeBest() {
    var v3 = readJson(S.BEST_KEY); var best = 0;
    if (v3 && v3.v === 3 && v3.best && typeof v3.best === 'object') Object.keys(v3.best).forEach(function (k) { if (typeof v3.best[k] === 'number') best = Math.max(best, v3.best[k]); });
    return best;
  }

  // Awards are computed from the saved stats, so nothing extra is stored.
  var AWARDS = [
    { id: 'first-drive', name: 'First drive', text: 'Play Racer once', get: function (r) { return [r.runs, 1]; } },
    { id: 'close-10', name: 'Close calls', text: 'Pass 10 cars close by', get: function (r) { return [r.near, 10]; } },
    { id: 'combo-5', name: 'In the flow', text: 'Chain 5 close calls', get: function (r) { return [r.nearBest, 5]; } },
    { id: 'coins-100', name: 'Coin collector', text: 'Collect 100 coins', get: function (r) { return [r.coins, 100]; } },
    { id: 'first-night', name: 'First night', text: 'Reach the Neon Quarter', get: function (r) { return [r.maxChapter, 6]; } },
    { id: 'storm', name: 'Storm chaser', text: 'Reach Storm Pass', get: function (r) { return [r.maxChapter, 7]; } },
    { id: 'coast', name: 'Coast to coast', text: 'Finish a Journey', get: function (r) { return [r.journeys, 1]; } },
    { id: 'perfect', name: 'Perfect journey', text: 'Finish a Journey without a bump', get: function (r) { return [r.noHitJourneys, 1]; } },
    { id: 'snake-10', name: 'Snake: 10', text: 'Score 10 in Snake', get: function (r, sn) { return [sn, 10]; } },
    { id: 'snake-50', name: 'Snake: 50', text: 'Score 50 in Snake', get: function (r, sn) { return [sn, 50]; } }
  ];
  function computeAwards() {
    var r = racerStats(); var sn = snakeBest();
    return AWARDS.map(function (a) { var v = a.get(r, sn); return { id: a.id, name: a.name, text: a.text, have: Math.min(v[0], v[1]), need: v[1], done: v[0] >= v[1] }; });
  }

  function prettyProfile(k) { return k.split('|').map(function (p) { return p.charAt(0).toUpperCase() + p.slice(1); }).join(', '); }

  function renderAwards() {
    var list = computeAwards(); var done = list.filter(function (a) { return a.done; }).length;
    $('award-count').textContent = done + ' of ' + list.length;
    var box = $('award-list'); box.textContent = '';
    list.forEach(function (a) {
      var d = document.createElement('div'); d.className = 'aw';
      var b = document.createElement('b'); b.textContent = a.name; d.appendChild(b);
      var em = document.createElement('em'); em.textContent = a.done ? 'Earned' : a.have + ' / ' + a.need; d.appendChild(em);
      var sm = document.createElement('small'); sm.textContent = a.text; d.appendChild(sm);
      var bar = document.createElement('div'); bar.className = 'bar'; var i = document.createElement('i'); i.style.width = Math.round(a.have / a.need * 100) + '%'; bar.appendChild(i); d.appendChild(bar);
      box.appendChild(d);
    });
  }

  function renderScores() {
    var box = $('score-list'); box.textContent = '';
    function row(a, b) { var d = document.createElement('div'); d.className = 'sc'; var x = document.createElement('span'); x.textContent = a; var y = document.createElement('b'); y.textContent = b; d.appendChild(x); d.appendChild(y); box.appendChild(d); }
    function head(t) { var h = document.createElement('h3'); h.textContent = t; h.style.cssText = 'margin:14px 0 4px;font-size:.75rem;letter-spacing:2px;text-transform:uppercase;color:var(--muted)'; box.appendChild(h); }
    head('Racer');
    var bests = readJson(BESTS_KEY) || {}; var keys = Object.keys(bests).filter(function (k) { return typeof bests[k] === 'number' && bests[k] > 0; }).sort(function (a, b) { return bests[b] - bests[a]; });
    if (!keys.length) row('No score yet.', ''); else keys.slice(0, 8).forEach(function (k) { row(prettyProfile(k), String(bests[k])); });
    head('Snake');
    var v3 = readJson(S.BEST_KEY); var entries = [];
    if (v3 && v3.v === 3 && v3.best) Object.keys(v3.best).forEach(function (k) { if (v3.best[k] > 0) entries.push([k, v3.best[k]]); });
    entries.sort(function (a, b) { return b[1] - a[1]; });
    if (!entries.length) row('No score yet.', ''); else entries.slice(0, 8).forEach(function (e) { row(prettyProfile(e[0]), String(e[1])); });
  }

  function renderCards() {
    var r = racerStats(); var sn = snakeBest();
    if (r.runs > 0) { $('racer-badge').textContent = 'Played'; $('racer-meta').textContent = 'Best distance ' + Math.floor(r.bestDistance) + ' m'; }
    if (sn > 0) { $('snake-badge').textContent = 'Best ' + sn; }
    var c = readJson(CHECK_KEY);
    if (c && typeof c.chapter === 'number' && c.chapter >= 0) {
      var hearts = typeof c.lives === 'number' ? new Array(Math.max(0, c.lives) + 1).join('♥') : '';
      $('resume').hidden = false; $('resume-text').textContent = 'Racer, chapter ' + (c.chapter + 1) + (hearts ? '  ' + hearts : '');
    }
  }

  // ---------- drawer and dialogs ----------
  var drawer = $('drawer'); var scrim = $('scrim'); var menu = $('menu'); var lastFocus = null; var closing = 0;
  function openDrawer() {
    window.clearTimeout(closing); lastFocus = document.activeElement;
    drawer.hidden = false; scrim.hidden = false; drawer.setAttribute('aria-hidden', 'false'); menu.setAttribute('aria-expanded', 'true');
    window.requestAnimationFrame(function () { drawer.classList.add('open'); });
    var first = drawer.querySelector('.dr-item'); if (first) first.focus();
  }
  function closeDrawer(restore) {
    drawer.classList.remove('open'); scrim.hidden = true; drawer.setAttribute('aria-hidden', 'true'); menu.setAttribute('aria-expanded', 'false');
    closing = window.setTimeout(function () { drawer.hidden = true; }, 230);
    if (restore !== false && lastFocus) lastFocus.focus();
  }
  menu.addEventListener('click', function () { if (drawer.hidden || !drawer.classList.contains('open')) openDrawer(); else closeDrawer(); });
  scrim.addEventListener('click', function () { closeDrawer(); });
  document.addEventListener('keydown', function (e) {
    if (drawer.hidden) return;
    if (e.key === 'Escape') { closeDrawer(); return; }
    if (e.key === 'Tab') {
      var f = drawer.querySelectorAll('a[href],button'); if (!f.length) return;
      var a = f[0]; var z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    }
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-open]'), function (b) {
    b.addEventListener('click', function () {
      var dlg = $(b.getAttribute('data-open'));
      if (b.getAttribute('data-open') === 'dlg-awards') renderAwards();
      if (b.getAttribute('data-open') === 'dlg-scores') renderScores();
      closeDrawer(false);
      if (dlg && dlg.showModal) { dlg.showModal(); var h = dlg.querySelector('h2'); if (h) h.focus({ preventScroll: true }); }
    });
  });
  Array.prototype.forEach.call(document.querySelectorAll('dialog'), function (d) {
    d.addEventListener('close', function () { menu.focus(); });
  });

  applyTheme(); renderSeg(); renderCards(); renderAwards();
  if (window.location.search.indexOf('debug=1') >= 0) window.launcherDebug = { awards: computeAwards, openDrawer: openDrawer };
})();
