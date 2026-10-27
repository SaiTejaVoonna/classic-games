// Classic Games launcher: the Games screen (continue card, game tiles, awards), the Awards, Scores and Settings tabs.
// It only reads what the games save on this device. No network, no accounts.
(function () {
  'use strict';

  var S = window.SnakeStorage;
  var E = window.SnakeEngine;
  var $ = function (id) { return document.getElementById(id); };
  var root = document.documentElement;

  function safeStorage() { try { return window.localStorage; } catch (e) { return null; } }
  var storage = safeStorage();
  function readJson(key) {
    try { var raw = storage && storage.getItem(key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }

  // ---------- saved choices (same format the games use) ----------
  // Appearance is one setting for the whole app. Dark is the default.
  var lookPref = S.createChoicePref(storage, S.LOOK_KEY, { theme: ['auto', 'light', 'dark'] }, { theme: 'dark' });
  lookPref.load();
  var appPref = S.createChoicePref(storage, S.APP_KEY, { sound: ['on', 'off'], haptics: ['on', 'off'] }, { sound: 'on', haptics: 'on' });
  appPref.load();
  var PREFS = { theme: lookPref, sound: appPref, haptics: appPref };

  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
  function applyTheme() {
    var t = lookPref.get().theme;
    var eff = t === 'auto' ? (mq && mq.matches ? 'light' : 'dark') : t;
    root.setAttribute('data-theme', eff);
    var meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', eff === 'light' ? '#f4f1ea' : '#0a0b10');
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
      // Snake follows the app Appearance unless it has its own saved look; picking an Appearance here hands control back to it.
      if (name === 'theme') { try { if (storage) storage.removeItem('classic-games.theme'); } catch (e) { /* fine */ } }
      renderSeg(); applyTheme();
    });
  });

  // ---------- what the games have saved ----------
  var STATS_KEY = 'classic-games.racer.stats';
  var BESTS_KEY = 'classic-games.racer.bests';
  var CHECK_KEY = 'classic-games.racer.checkpoint';
  var LAST_KEY = 'classic-games.lastPlayed'; // { game: 'snake' | 'racer', at }: written by each game when you play it
  var CHAPTERS = 10;

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
  // Cruise saves at each rest stop (after chapters 2, 4, 6 and 8) and, while you drive, the exact place you left
  // (frac of the Journey). chapter here is the chapter you will resume in.
  function racerSave() {
    var c = readJson(CHECK_KEY);
    var hasPos = c && typeof c.frac === 'number' && isFinite(c.frac) && c.frac > .005 && c.frac < .97;
    if (!c || c.mode !== 'journey' || typeof c.chapter !== 'number' || (c.chapter < 1 && !hasPos) || c.chapter >= CHAPTERS) return null;
    return { chapter: hasPos ? Math.min(CHAPTERS - 1, Math.floor(c.frac * CHAPTERS)) : c.chapter, place: hasPos, at: typeof c.at === 'number' ? c.at : 0 };
  }
  // Snake saves the paused game; it is only offered when the game itself would accept it.
  function snakeSave() {
    var d = readJson(S.SAVE_KEY);
    if (!d || d.v !== 1 || !E || !E.restore(d.snap)) return null;
    return { score: d.snap.score, length: d.snap.snake.length, at: typeof d.at === 'number' ? d.at : 0 };
  }
  // About how long is left from a rest stop: the Journey speeds up, so later chapters are shorter (the whole Journey is about 15 minutes).
  function racerMinutesLeft(chapter) {
    var v0 = 23.6, v1 = 41.7, v = v0 + (v1 - v0) * chapter / CHAPTERS;
    return Math.max(1, Math.round(15 * Math.log(v1 / v) / Math.log(v1 / v0)));
  }

  // Awards are computed from the saved stats, so nothing extra is stored.
  var AWARDS = [
    { id: 'first-drive', name: 'First drive', text: 'Play Cruise once', get: function (r) { return [r.runs, 1]; } },
    { id: 'close-10', name: 'Close calls', text: 'Squeeze past 10 cars', get: function (r) { return [r.near, 10]; } },
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
    var text = done + ' of ' + list.length;
    $('award-chip-text').textContent = text; $('strip-count').textContent = text + ' ›'; $('award-lede').textContent = text + ' earned.';
    var dots = $('strip-dots'); dots.textContent = '';
    list.forEach(function (a) { var i = document.createElement('i'); if (a.done) i.className = 'on'; dots.appendChild(i); });
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
    function head(t) { var h = document.createElement('h2'); h.className = 'sc-h'; h.textContent = t; box.appendChild(h); }
    head('Cruise');
    var bests = readJson(BESTS_KEY) || {}; var keys = Object.keys(bests).filter(function (k) { return typeof bests[k] === 'number' && bests[k] > 0; }).sort(function (a, b) { return bests[b] - bests[a]; });
    if (!keys.length) row('No score yet.', ''); else keys.slice(0, 8).forEach(function (k) { row(prettyProfile(k), String(bests[k])); });
    head('Snake');
    var v3 = readJson(S.BEST_KEY); var entries = [];
    if (v3 && v3.v === 3 && v3.best) Object.keys(v3.best).forEach(function (k) { if (v3.best[k] > 0) entries.push([k, v3.best[k]]); });
    entries.sort(function (a, b) { return b[1] - a[1]; });
    if (!entries.length) row('No score yet.', ''); else entries.slice(0, 8).forEach(function (e) { row(prettyProfile(e[0]), String(e[1])); });
  }

  // ---------- the Games screen ----------
  // The top card is the game you played last, if it has something to continue; otherwise Racer is featured.
  function renderHome() {
    var r = racerSave(); var sn = snakeSave(); var rs = racerStats(); var best = snakeBest();
    var last = readJson(LAST_KEY), lastAt = last && typeof last.at === 'number' ? last.at : 0;
    var snAt = Math.max(sn ? sn.at : 0, last && last.game === 'snake' ? lastAt : 0), rAt = Math.max(r ? r.at : 0, last && last.game === 'racer' ? lastAt : 0);
    var lastIsSnake = snAt > rAt; // the game you played most recently, whether or not it has a save
    var hero = lastIsSnake ? { game: 'snake', cont: !!sn } : { game: 'racer', cont: !!r };
    $('hero').setAttribute('data-game', hero.game); $('hero').setAttribute('data-continue', String(hero.cont));
    $('hero-img').src = hero.game === 'snake' ? 'assets/hero-snake.jpg' : 'assets/hero-racer.jpg';
    $('hero-tag').textContent = hero.cont ? 'CONTINUE' : 'PLAY';
    $('hero-title').textContent = hero.game === 'snake' ? 'Snake' : 'Cruise';
    var pb = $('hero-pb'); pb.hidden = true;
    var main = $('hero-main'); var alt = $('hero-alt');
    if (hero.game === 'snake' && !hero.cont) {
      $('hero-sub').textContent = best > 0 ? 'Best ' + best + ' · Play again' : 'Eat, grow and keep clear of the walls.';
      main.textContent = 'Play'; main.href = 'snake/'; alt.hidden = true;
    } else if (hero.game === 'snake') {
      $('hero-sub').textContent = 'Score ' + sn.score + ' · Length ' + sn.length + ' · Paused';
      main.textContent = 'Resume'; main.href = 'snake/?resume=1'; alt.hidden = false; alt.textContent = 'New game'; alt.href = 'snake/?new=1';
    } else if (hero.cont) {
      $('hero-sub').textContent = (r.place ? 'In Chapter ' : 'From Chapter ') + (r.chapter + 1) + ' of ' + CHAPTERS + ' · about ' + racerMinutesLeft(r.chapter) + ' min left';
      pb.hidden = false; $('hero-pb-fill').style.width = Math.round(r.chapter / CHAPTERS * 100) + '%';
      main.textContent = 'Resume'; main.href = 'racer/?resume=1'; alt.hidden = false; alt.textContent = 'New run'; alt.href = 'racer/?new=1';
    } else {
      $('hero-sub').textContent = 'Drive through changing roads, weather and light. Reach the coast.';
      main.textContent = 'Play'; main.href = 'racer/'; alt.hidden = true;
    }
    $('racer-meta').textContent = rs.runs > 0 ? 'Best ' + Math.floor(rs.bestDistance).toLocaleString('en-US') + ' m' : 'Journey and Endless';
    $('snake-meta').textContent = best > 0 ? 'Best ' + best : '12 mazes';
    // the game that is not on the top card shows a small chip when it also has something saved
    var rc = $('racer-chip'); var sc = $('snake-chip');
    rc.hidden = !(r && hero.game === 'snake'); if (!rc.hidden) rc.textContent = 'CH ' + (r.chapter + 1) + (r.place ? ' · PAUSED' : ' · REST STOP');
    sc.hidden = !(sn && hero.game === 'racer'); if (!sc.hidden) sc.textContent = 'PAUSED · ' + sn.score;
  }

  // ---------- tabs ----------
  var VIEWS = ['games', 'awards', 'scores', 'settings'];
  var view = 'games';
  function show(v, focus) {
    if (VIEWS.indexOf(v) < 0) v = 'games';
    view = v;
    VIEWS.forEach(function (n) { $('view-' + n).hidden = n !== v; });
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
      if (t.getAttribute('data-go') === v) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
    });
    if (v === 'games') renderHome();
    if (v === 'awards') renderAwards();
    if (v === 'scores') renderScores();
    var h = $(v === 'games' ? 'h-games' : 'h-' + v);
    if (focus && h) h.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
  function go(v) { var cur = window.location.hash.replace('#', ''); if (cur === v || (v === 'games' && !cur)) show(v, true); else window.location.hash = v; }
  Array.prototype.forEach.call(document.querySelectorAll('[data-go]'), function (b) { b.addEventListener('click', function () { go(b.getAttribute('data-go')); }); });
  window.addEventListener('hashchange', function () { show(window.location.hash.replace('#', ''), true); });
  // Coming back to the page (the browser's back button, or the Games button in a game) shows what was just saved.
  window.addEventListener('pageshow', function () { renderHome(); renderAwards(); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { renderHome(); renderAwards(); } });

  // ---------- help dialogs ----------
  Array.prototype.forEach.call(document.querySelectorAll('[data-open]'), function (b) {
    b.addEventListener('click', function () {
      var dlg = $(b.getAttribute('data-open'));
      if (dlg && dlg.showModal) { dlg.showModal(); var h = dlg.querySelector('h2'); if (h) h.focus({ preventScroll: true }); }
    });
  });

  applyTheme(); renderSeg(); renderAwards(); show(window.location.hash.replace('#', ''), false);
  if (window.location.search.indexOf('debug=1') >= 0) window.launcherDebug = { awards: computeAwards, show: show, view: function () { return view; }, hero: function () { return { game: $('hero').getAttribute('data-game'), cont: $('hero').getAttribute('data-continue') === 'true' }; } };
})();
