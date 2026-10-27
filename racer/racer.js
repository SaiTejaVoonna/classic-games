// Racer: an early playable prototype. A pseudo-3D road (projected horizontal slices, the
// classic technique) with curves, ten changing chapters, weather, sway and lights. The road
// rules are small: three lanes, traffic ahead, a crash ends the run. Everything here is a
// Classic Games prototype choice. Drawing and rules are in one file for now.
(function () {
  'use strict';

  var TAU = Math.PI * 2;
  var $ = function (id) { return document.getElementById(id); };
  var canvas = $('c');
  var g = canvas.getContext('2d');
  var params = new URLSearchParams(window.location.search);
  var DEBUG = params.get('debug') === '1';

  // ---------- helpers ----------
  function rnd(i, a) { var x = Math.sin(i * 127.1 + a * 311.7) * 43758.5453; return x - Math.floor(x); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function hex(h) { return [1, 3, 5].map(function (i) { return parseInt(h.slice(i, i + 2), 16); }); }
  function mix(a, b, t) {
    if (t <= 0) return a; if (t >= 1) return b;
    var A = hex(a); var B = hex(b);
    return '#' + A.map(function (v, i) { return Math.round(lerp(v, B[i], t)).toString(16).padStart(2, '0'); }).join('');
  }
  function rr(x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  // ---------- chapters (scene looks); numbers blend, colours blend, lists switch ----------
  // Ten chapters: a day that runs into night and out to dawn. kit and life are used by the sound.
  var CHAPTERS = [
    { name: 'Dawn Meadow', kit: 'piano', bed: 'meadow', life: ['songbirds', 'balloon', 'windmill'], balloon: 1, sky: ['#5f9fe6', '#b7d8f7', '#ffe7c8'], sunX: .3, sunY: .55, sunC: '#fff4cf', ground: ['#9bd06f', '#6fb251'], road: '#50586a', edge: '#f0ece0', line: '#fbf7ea', fog: '#d8ecff',
      ridge: ['#a9c9d8', '#86b69a', '#5e9a6e'], mist: .5, night: 0, stars: 0, rain: 0, snow: 0, leaves: 0, petals: 0, aurora: 0, heat: 0, skyline: 0, wind: 1, tintC: '#ffd9a0', tintA: .04,
      objs: ['round', 'round', 'pine', 'birch', 'bush', 'round', 'cherry', 'hut'] },
    { name: 'Cherry Hills', kit: 'pluck', bed: 'meadow', life: ['songbirds', 'windchimes', 'butterflies'], sky: ['#7fb2f0', '#f6c8e0', '#fff0e0'], sunX: .62, sunY: .5, sunC: '#fff6d8', ground: ['#a4d878', '#80c462'], road: '#58606f', edge: '#fff0f4', line: '#ffffff', fog: '#ffe4ee',
      ridge: ['#d9a6c6', '#9fc9a0', '#6fb07a'], mist: .6, night: 0, stars: 0, rain: 0, snow: 0, leaves: 0, petals: 1.6, aurora: 0, heat: 0, skyline: 0, wind: 1.2, tintC: '#ffb6d0', tintA: .05,
      objs: ['cherry', 'cherry', 'cherry', 'round', 'bush', 'hut', 'birch'] },
    { name: 'Desert Road', kit: 'acoustic', bed: 'desert', life: ['windchimes', 'flag', 'crickets'], sky: ['#3f93e8', '#9fd0ff', '#fde7b9'], sunX: .72, sunY: .35, sunC: '#fff7d0', ground: ['#e8c07e', '#d8ac68'], road: '#6a5c54', edge: '#efd9ae', line: '#fff0c2', fog: '#f6dcae',
      ridge: ['#e3b57a', '#d29f62', '#be8a52'], mist: .5, night: 0, stars: 0, rain: 0, snow: 0, leaves: 0, petals: 0, aurora: 0, heat: 1, skyline: 0, wind: .6, tintC: '#ffd27a', tintA: .07,
      objs: ['cactus', 'rock', 'cactus', 'bush', 'rock', 'cactus', 'hut'] },
    { name: 'Amber Valley', kit: 'cello', bed: 'meadow', life: ['windmill', 'crow', 'churchbell', 'crickets'], balloon: 1, sky: ['#6b5fb5', '#ff8f7a', '#ffd29a'], sunX: .72, sunY: .78, sunC: '#fff3c4', ground: ['#a8b45a', '#7a9a46'], road: '#5a4f6a', edge: '#f6dcc0', line: '#fff2d6', fog: '#ffc7a0',
      ridge: ['#9a6f9a', '#7d6a7a', '#5f7d56'], mist: .65, night: .15, stars: 0, rain: 0, snow: 0, leaves: 1, petals: 0, aurora: 0, heat: 0, skyline: 0, wind: 1.2, tintC: '#ff9a50', tintA: .09,
      objs: ['maple', 'maple', 'pine', 'hut', 'round', 'windmill', 'bush', 'hut'] },
    { name: 'Sunset Coast', kit: 'handpan', bed: 'waves', life: ['gulls', 'bellbuoy', 'boathorn', 'balloon'], water: 1, balloon: 1, sky: ['#5a4fb5', '#ff7f6e', '#ffd09a'], sunX: .5, sunY: .86, sunC: '#fff0b8', ground: ['#e9c792', '#d7b07c'], road: '#4a4a62', edge: '#fbe3c6', line: '#fff0d6', fog: '#ffb08c',
      ridge: ['#7b5aa8', '#a7607e', '#2f7fb4'], mist: .55, night: 0, stars: 0, rain: 0, snow: 0, leaves: 0, petals: 0, aurora: 0, heat: 0, skyline: 0, wind: 1.4, tintC: '#ff8a50', tintA: .1,
      objs: ['palm', 'umbrella', 'palm', 'bush', 'umbrella', 'house', 'palm', 'lighthouse', 'rock'] },
    { name: 'Dusk City', kit: 'electro-soft', bed: 'city', life: ['siren', 'cityhorns', 'plane', 'train'], sky: ['#1b2a5e', '#7a3d7a', '#ff9a6a'], sunX: .22, sunY: .9, sunC: '#ffcf9a', ground: ['#5b6272', '#4c5362'], road: '#2c3040', edge: '#9aa3c0', line: '#ffd98a', fog: '#a5527a',
      ridge: ['#4a3a70', '#33325e', '#26264a'], mist: .5, night: .6, stars: .4, rain: 0, snow: 0, leaves: 0, petals: 0, aurora: 0, heat: 0, skyline: 1, wind: .4, tintC: '#5a3a7a', tintA: .08,
      objs: ['tower', 'tower', 'lamp', 'tower', 'house', 'lamp', 'tower'] },
    { name: 'Neon Quarter', kit: 'electro', bed: 'rain', life: ['thunderfar', 'siren', 'raingust'], sky: ['#07031a', '#2a0f5e', '#ff4f9a'], sunX: .5, sunY: .95, sunC: '#ff6ec0', ground: ['#120d2a', '#0d0a20'], road: '#171a2c', edge: '#2c3a78', line: '#7fe3ff', fog: '#3b1a6a',
      ridge: ['#3a1670', '#2a1058', '#190a3c'], mist: .5, night: 1, stars: .8, rain: 1, snow: 0, leaves: 0, petals: 0, aurora: 0, heat: 0, skyline: 1, wind: .2, tintC: '#6a1a9a', tintA: .1,
      objs: ['neon', 'neon', 'tower', 'tower', 'neon', 'lamp', 'tower'] },
    { name: 'Storm Pass', kit: 'cinematic', bed: 'storm', life: ['raingust', 'tunnel'], lightning: 1, sky: ['#1a2230', '#3a4658', '#6a7a90'], sunX: .5, sunY: .9, sunC: '#9fb0c8', ground: ['#3a4f40', '#2f4235'], road: '#2a2f3a', edge: '#7d879a', line: '#c9d3e4', fog: '#56657c',
      ridge: ['#2c3748', '#27402f', '#1f3426'], mist: .7, night: .5, stars: 0, rain: 1, snow: 0, leaves: 0, petals: 0, aurora: 0, heat: 0, skyline: 0, wind: 3, tintC: '#102040', tintA: .12,
      objs: ['pine', 'pine', 'lamp', 'rock', 'pine', 'bush'] },
    { name: 'Northern Lights', kit: 'pads', bed: 'snow', life: ['owl', 'windchimes', 'train'], sky: ['#02040d', '#0b1a3a', '#1d4a6a'], sunX: .2, sunY: .45, sunC: '#f4f1e0', ground: ['#2a4a6a', '#cfdcec'], road: '#2a3350', edge: '#cfe0ff', line: '#e8f1ff', fog: '#2a4a7a',
      ridge: ['#16264a', '#0f1c3a', '#0a1430'], mist: .5, night: 1, stars: 1, rain: 0, snow: 1, leaves: 0, petals: 0, aurora: 1, heat: 0, skyline: 0, wind: .8, tintC: '#103a7a', tintA: .1,
      objs: ['pinesnow', 'pinesnow', 'pinesnow', 'cabin', 'pinesnow'] },
    { name: 'Sunrise Coast', kit: 'epic', bed: 'waves', life: ['gulls', 'foghorn', 'balloon', 'fireworks'], water: 1, balloon: 1, sky: ['#4f9be8', '#ffbfa0', '#fff1c8'], sunX: .5, sunY: .62, sunC: '#fff2c0', ground: ['#efd3a2', '#e0bb88'], road: '#4d5068', edge: '#fff0dc', line: '#fff6e6', fog: '#ffd0b0',
      ridge: ['#8c6aa8', '#c0788a', '#3f90c8'], mist: .6, night: 0, stars: 0, rain: 0, snow: 0, leaves: 0, petals: 0, aurora: 0, heat: 0, skyline: 0, wind: 1.4, tintC: '#ffb070', tintA: .08,
      objs: ['palm', 'umbrella', 'palm', 'bush', 'lighthouse', 'umbrella', 'palm', 'house'] }
  ];
  var JOURNEY_CHAPTERS = CHAPTERS.length;
  var CHAPTER_LENS = { demo: 900, full: 2800 }; // metres per chapter. Full is about 15 minutes with the speed ramp below; demo (?len=demo) is for quick checks.
  var chapterLen = 2800;
  var tripMode = 'journey'; // journey | endless

  function chapterAt(s) {
    var u = s / chapterLen;
    var i = Math.floor(u);
    return { i: i, idx: ((i % CHAPTERS.length) + CHAPTERS.length) % CHAPTERS.length, frac: u - i };
  }

  // Sunrise Coast starts in the pre-dawn dark and brightens as you drive: the sun climbs and the sky warms.
  var DAWN_SKY = ['#10183a', '#5a4a8a', '#c06a7a'], DAWN_SUN_Y = .97;
  var NUM_KEYS = ['water', 'lightning', 'sunX', 'sunY', 'mist', 'night', 'stars', 'rain', 'snow', 'leaves', 'petals', 'aurora', 'heat', 'skyline', 'wind', 'tintA'];
  var COL_KEYS = ['sunC', 'road', 'edge', 'line', 'fog', 'tintC'];
  // The scene at distance s: the chapter's look, blending into the next one over its last 22%.
  function sceneAt(s) {
    var c = chapterAt(s);
    var a = CHAPTERS[c.idx];
    var b = CHAPTERS[(c.idx + 1) % CHAPTERS.length];
    var t = clamp((c.frac - .78) / .22, 0, 1);
    t = t * t * (3 - 2 * t);
    if (tripMode === 'journey' && c.i >= JOURNEY_CHAPTERS - 1) t = 0; // the last chapter does not fade into the first
    var o = { name: a.name, chapter: c.i, frac: c.frac, t: t, a: a, b: b };
    NUM_KEYS.forEach(function (k) { o[k] = lerp(a[k] || 0, b[k] || 0, t); });
    COL_KEYS.forEach(function (k) { o[k] = mix(a[k], b[k], t); });
    o.sky = a.sky.map(function (col, i) { return mix(col, b.sky[i], t); });
    o.ground = a.ground.map(function (col, i) { return mix(col, b.ground[i], t); });
    o.ridge = a.ridge.map(function (col, i) { return mix(col, b.ridge[i], t); });
    if (c.idx === 9) { // the dawn itself
      var f = clamp(c.frac / .72, 0, 1); f = f * f * (3 - 2 * f);
      o.sky = a.sky.map(function (col, i) { return mix(DAWN_SKY[i], col, f); }); o.sunY = lerp(DAWN_SUN_Y, a.sunY, f); o.stars = lerp(.5, 0, f); o.night = lerp(.35, 0, f);
    } else if (c.idx === 8 && t > 0) { // the end of Northern Lights fades into the pre-dawn, not into the bright sky
      o.sky = a.sky.map(function (col, i) { return mix(col, DAWN_SKY[i], t); }); o.sunY = lerp(a.sunY, DAWN_SUN_Y, t);
    }
    return o;
  }

  // ---------- sizing ----------
  var W = 0; var H = 0; var dpr = 1;
  // The size is measured only when it can have changed, not every frame (measuring forces the page to lay out).
  var sizeDirty = true, dprCap = 2; // dprCap drops when the device cannot keep up (see frame)
  function resize() {
    if (!sizeDirty) return; sizeDirty = false;
    dpr = Math.min(dprCap, window.devicePixelRatio || 1);
    var r = canvas.getBoundingClientRect();
    W = Math.max(2, Math.round(r.width * dpr));
    H = Math.max(2, Math.round(r.height * dpr));
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'medium'; // the canvas forgets this whenever it is resized
  }
  window.addEventListener('resize', function () { sizeDirty = true; });
  window.addEventListener('orientationchange', function () { sizeDirty = true; });
  if (window.ResizeObserver) new window.ResizeObserver(function () { sizeDirty = true; }).observe(canvas);

  // ---------- game state ----------
  var mode = 'menu'; // menu | run | over | done
  var paused = false;
  var dist = 0;
  var speed = 0;
  var lane = 0; // continuous, lanes at -1, 0, 1
  var laneTarget = 0;
  var laneV = 0;   // lane velocity (lanes per second): the lane change is a damped spring
  var susp = { y: 0, v: 0 }; // suspension bob in CSS pixels
  var pitch = 0;   // nose dip when braking
  var roll = { y: 0, v: 0 }; // body roll: lags the lane change, overshoots a touch and settles
  var camRoll = 0; // the camera banks a little into a lane change and into a bend (radians)
  var carId = 0;
  var lastPB = null; // where the player car was drawn last frame, for spray and dust
  var BOXES = params.get('boxes') === '1'; // debug overlay of collision boxes
  var tAnim = 0;
  var tread = 0; // phase of the player's tyre tread, in sprite units
  var traffic = [];
  var nextSpawn = 300;
  var combo = 0;
  var comboTimer = 0;
  var score = 0;
  var lives = 3;
  var maxLives = 3;
  var shieldT = 0;
  var flashT = 0;
  var lightningT = 0;
  var skyT = 0; // a faint distant flicker in the clouds
  var shake = 0;
  var lastChapter = -1;
  var nextStop = 0; // index into the rest stops
  var particles = [];
  var nearTimer = 0;
  var chTimer = 0;
  var braking = false;
  var coinNote = 0;
  var coinNoteT = 0;
  var collected = {};
  var run = { near: 0, coins: 0, hits: 0 };

  var CAR_KINDS = ['hatch', 'sedan', 'suv', 'sport', 'van', 'taxi', 'truck'];
  var CAR_COLS = ['#e11d48', '#2563eb', '#f59e0b', '#7c3aed', '#10b981', '#06b6d4']; // few colours: each one is a prerendered sprite
  var TYPE_OF = { hatch: 'ev', sedan: 'sedan', suv: 'cross', sport: 'sedan', van: 'pod', taxi: 'pickup', truck: 'truck' };
  // width of each vehicle relative to the base traffic width (about 82% of a lane)
  var TYPE_W = { truck: 1.12, pod: 1.07, cross: 1.04, ev: 1.0, pickup: 1.03, sedan: 1.03, rally: 1.05 };
  var PLAYER_CARS = {
    rally: { name: 'Rally', col: '#1b3fbf', acc: '#ffd34a' },
    sedan: { name: 'Sport sedan', col: '#c9d3e6', acc: '#47e8ff' },
    ev: { name: 'Electric', col: '#1fb89a', acc: '#7dffc0' }
  };
  var seedN = 1;
  function rand() { seedN = (seedN * 16807) % 2147483647; return (seedN - 1) / 2147483646; }

  // Speed choices (game units per second) and difficulty (lives, traffic, shield time).
  // Speed rises by itself across the Journey, from 85 to 150 km/h (units are metres per second).
  var RAMP = { v0: 23.6, v1: 41.7, endlessMax: 44.5 };
  // The player sets the pace: a multiplier on that ramp, changed any time with the + and - buttons.
  // A faster pace also makes the Journey longer in distance, so it still takes about 15 minutes.
  var SPEED_STEPS = [1, 1.2, 1.4, 1.6, 1.8, 2, 2.3];
    var runMul = 1.6; // the pace the current run started at; it sets the chapter length
  var DIFFS = {
    easy: { lives: 3, gapMin: 140, gapRand: 70, twoFrom: 14000, twoChance: .25, shield: 2.6, vMin: .5, vVar: .2 },
    normal: { lives: 2, gapMin: 95, gapRand: 60, twoFrom: 1800, twoChance: .3, shield: 2, vMin: .4, vVar: .3 },
    hard: { lives: 1, gapMin: 75, gapRand: 50, twoFrom: 900, twoChance: .45, shield: 1.4, vMin: .38, vVar: .3 }
  };
  var REST_STOPS = [2, 4, 6, 8]; // after chapters 2, 4, 6 and 8 of a journey (in chapter lengths)
  var PREFS_KEY = 'classic-games.racer.prefs';
  var STATS_KEY = 'classic-games.racer.stats';
  var BESTS_KEY = 'classic-games.racer.bests';
  var CHECK_KEY = 'classic-games.racer.checkpoint';
  var APP_KEY = 'classic-games.app';
  var STYLES = ['auto', 'drive', 'cinematic', 'piano', 'electronic', 'acoustic'];

  function readJson(key) { try { var raw = window.localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }
  function writeJson(key, v) { try { window.localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* storage unavailable: fine */ } }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  var prefs = { mode: 'journey', difficulty: 'easy', speed: 'relaxed', length: 'full', music: 'on', sfx: 'on', style: 'auto', volMusic: 60, volFx: 70, volEngine: 70, bass: 50, calm: 'off', car: 'rally', speedIdx: 3 };
  (function loadPrefs() {
    var s = readJson(PREFS_KEY); if (!s || typeof s !== 'object') return;
    if (s.music === 'on' || s.music === 'off') prefs.music = s.music;
    if (s.sfx === 'on' || s.sfx === 'off') prefs.sfx = s.sfx;
    if (STYLES.indexOf(s.style) >= 0) prefs.style = s.style;
    if (s.calm === 'on' || s.calm === 'off') prefs.calm = s.calm;
    if (has(PLAYER_CARS, s.car)) prefs.car = s.car;
    if (typeof s.speedIdx === 'number' && s.speedIdx >= 0 && s.speedIdx < SPEED_STEPS.length) prefs.speedIdx = Math.round(s.speedIdx);
    ['volMusic', 'volFx', 'volEngine', 'bass'].forEach(function (k) { if (typeof s[k] === 'number' && s[k] >= 0 && s[k] <= 100) prefs[k] = Math.round(s[k]); });
  })();
  function savePrefs() { writeJson(PREFS_KEY, prefs); }

  function appChoice(name) { var a = readJson(APP_KEY); return a && a.chosen && a.chosen[name] === 'off' ? 'off' : 'on'; }

  var stats = (function () {
    var s = readJson(STATS_KEY) || {}; var o = {};
    ['runs', 'near', 'nearBest', 'coins', 'journeys', 'noHitJourneys', 'maxChapter', 'bestDistance'].forEach(function (k) { o[k] = typeof s[k] === 'number' && isFinite(s[k]) ? s[k] : 0; });
    return o;
  })();
  function saveStats() { writeJson(STATS_KEY, stats); }
  function bestKey() { return prefs.mode + '|' + prefs.difficulty + (prefs.mode === 'journey' ? '|' + prefs.length : ''); }
  function getBest() { var b = readJson(BESTS_KEY) || {}; return typeof b[bestKey()] === 'number' ? b[bestKey()] : 0; }
  function submitBest(sc) { var b = readJson(BESTS_KEY) || {}; var k = bestKey(); var isBest = sc > (typeof b[k] === 'number' ? b[k] : 0); if (isBest) { b[k] = sc; writeJson(BESTS_KEY, b); } return isBest; }
  var ignoreCheckpoint = params.get('new') === '1'; // New run on the Games screen: open the start screen without offering the old checkpoint
  function getCheckpoint() {
    if (ignoreCheckpoint) return null;
    var c = readJson(CHECK_KEY);
    var hasPos = c && typeof c.frac === 'number' && isFinite(c.frac) && c.frac > .005 && c.frac < .97; // a mid-chapter save: where you were when you left
    if (!c || c.mode !== 'journey' || typeof c.chapter !== 'number' || (c.chapter < 1 && !hasPos) || c.chapter >= JOURNEY_CHAPTERS || !has(DIFFS, c.difficulty)) return null;
    if (!hasPos) delete c.frac;
    c.chapter = Math.max(0, Math.floor(c.chapter)); // a damaged save must never break the start screen: lives and score fall back to safe values
    c.lives = typeof c.lives === 'number' && isFinite(c.lives) && c.lives >= 1 ? Math.min(9, Math.floor(c.lives)) : 1;
    c.score = typeof c.score === 'number' && isFinite(c.score) && c.score >= 0 ? c.score : 0;
    return c;
  }

  var calmUntil = 0; // after a bump the next stretch of road is quieter
  if (params.get('speed') !== null && !isNaN(parseInt(params.get('speed'), 10))) prefs.speedIdx = clamp(parseInt(params.get('speed'), 10), 0, SPEED_STEPS.length - 1); // for tests: &speed=0 is the gentlest pace
  function mul() { return SPEED_STEPS[prefs.speedIdx]; }
  var keepOn = false; // true after the finish when the player chooses Keep driving
  function journeyLen() { return JOURNEY_CHAPTERS * chapterLen; }
  // Rest stops slow the car smoothly for 260 m either side.
  function stopEase(d) {
    var f = 1;
    for (var i = 0; i < REST_STOPS.length; i++) { var dd = Math.abs(d - REST_STOPS[i] * chapterLen); if (dd < 260) f = Math.min(f, 1 - .35 * (.5 + .5 * Math.cos(Math.PI * dd / 260))); }
    return f;
  }
  function targetSpeed(d) {
    var S = journeyLen(), v = d < S ? RAMP.v0 + (RAMP.v1 - RAMP.v0) * d / S : Math.min(RAMP.endlessMax, RAMP.v1 + (d - S) * .0002);
    return v * mul() * (tripMode === 'journey' ? stopEase(d) : 1);
  }
  // Minutes left on the ramp: the integral of ds/v over the rest of the Journey, plus a few seconds per rest stop.
  function secondsLeft(d) {
    var S = journeyLen(), r = Math.max(0, S - d); if (r <= 0) return 0;
    var v = RAMP.v0 + (RAMP.v1 - RAMP.v0) * d / S, t = S / (RAMP.v1 - RAMP.v0) * Math.log(RAMP.v1 / v), stops = 0;
    for (var i = 0; i < REST_STOPS.length; i++) if (REST_STOPS[i] * chapterLen > d) stops++;
    return t / mul() + stops * 8;
  }

  function applyTrip() {
    tripMode = keepOn ? 'endless' : 'journey'; chapterLen = params.get('len') === 'demo' ? CHAPTER_LENS.demo : Math.round(CHAPTER_LENS.full * runMul);
    maxLives = DIFFS[prefs.difficulty].lives;
  }

  function reset(fromCheckpoint) {
    applyTrip();
    keepOn = false; runMul = mul(); applyTrip(); dist = 0; speed = RAMP.v0 * mul(); lane = 0; laneV = 0; susp = { y: 0, v: 0 }; pitch = 0; roll = { y: 0, v: 0 }; camRoll = 0; laneTarget = 0; traffic = []; nextSpawn = 300; combo = 0; comboTimer = 0;
    score = 0; shake = 0; particles = []; lastChapter = -1; nearTimer = 0; shieldT = 0; flashT = 0; lives = maxLives; nextStop = 0; collected = {}; momentFx = {}; restCh = 0; saveT = 8; countT = 0;
    run = { near: 0, coins: 0, hits: 0 }; coinNote = 0; coinNoteT = 0; braking = false; paused = false; calmUntil = 0;
    if (fromCheckpoint) {
      dist = fromCheckpoint.frac != null ? Math.round(fromCheckpoint.frac * journeyLen()) : fromCheckpoint.chapter * chapterLen; restCh = fromCheckpoint.chapter; lives = clamp(fromCheckpoint.lives, 1, maxLives); score = fromCheckpoint.score || 0; run.hits = 1; speed = targetSpeed(dist);
      nextSpawn = dist + 260; while (nextStop < REST_STOPS.length && REST_STOPS[nextStop] * chapterLen <= dist) nextStop++;
    }
    seedN = (Date.now() % 100000) + 7;
    if (params.get('seed')) seedN = parseInt(params.get('seed'), 10) || 7;
  }

  // Two vehicles touch when their centres are closer than (almost) the sum of their half-widths.
  function hitGap(c) { return (BODY * (TYPE_W[prefs.car] || 1) + BODY * (TYPE_W[TYPE_OF[c.kind]] || 1)) / 2 * .9; }
  var NEAR_GAP = .95; // a close call: you squeezed past, closer than a neighbouring lane (exactly 1) but without touching

  function spawnWave(z) {
    var d = DIFFS[prefs.difficulty];
    var n = dist > d.twoFrom && rand() < d.twoChance ? 2 : 1;
    var busy = {}; var nb = 0;
    traffic.forEach(function (c) { if (c.knock || Math.abs(c.z - z) >= 40) return; [c.lane, c.lc ? c.lc.to : c.lane].forEach(function (l) { if (!busy[l]) { busy[l] = 1; nb++; } }); });
    n = Math.min(n, 2 - nb); if (n <= 0) return false; // always leave one lane open
    var lanes = [-1, 0, 1].filter(function (l) { return !busy[l]; });
    for (var i = 0; i < n; i++) {
      var k = Math.floor(rand() * lanes.length);
      var ln = lanes.splice(k, 1)[0];
      var kind = CAR_KINDS[Math.floor(rand() * CAR_KINDS.length)];
      // driver types: trucks keep slow and to their lane; sports cars drive faster and overtake when held up
      var persona = kind === 'truck' ? 'slow' : kind === 'sport' || rand() < .15 ? 'fast' : 'calm', pv = persona === 'slow' ? .9 : persona === 'fast' ? 1.12 : 1;
      traffic.push({ id: ++carId, z: z + i * 6 * rand(), lane: ln, laneF: ln, persona: persona, blockedT: 0, v: Math.min(speed * .95, speed * (d.vMin + rand() * d.vVar) * pv), kind: kind, col: CAR_COLS[Math.floor(rand() * CAR_COLS.length)], passed: false, minGap: 9, canLc: rand() < clamp((dist / journeyLen() - .12) * .7, 0, .35), lc: null });
    }
    return true;
  }

  // Coins come in short lines, hearts are rare. Positions come from the road distance, so the
  // drawing and the pickup always agree.
  function coinChunk(cn) {
    if (rnd(cn, 72) < .35) return null;
    return { lane: Math.floor(rnd(cn, 71) * 3) - 1, count: 5 + Math.floor(rnd(cn, 73) * 3), start: cn * 90 + 20 };
  }
  function heartChunk(hn) {
    if (rnd(hn, 81) < .45) return null;
    return { lane: Math.floor(rnd(hn, 82) * 3) - 1, at: hn * 600 + 330 };
  }
  // Bridges: on the coast chapters the road crosses open water on a long bridge about every 1.4 km, and a small boat
  // sails under it. bridgeAt(pos) is 0 on land and 1 on the deck, easing in over the first and last 6 m.
  var BRIDGE_EVERY = 1400, BRIDGE_LEN = 170, bridgeCache = {}, lastJoint = 0, hornBridge = -1;
  function bridgeStart(b) {
    var key = b + ':' + chapterLen + ':' + tripMode;
    if (!(key in bridgeCache)) { var st = b * BRIDGE_EVERY + 320; bridgeCache[key] = st > 200 && sceneAt(st).water > .95 && sceneAt(st + BRIDGE_LEN).water > .95 && !nearStop(st) && !nearStop(st + BRIDGE_LEN) ? st : null; }
    return bridgeCache[key];
  }
  function bridgeAt(pos) {
    var st = bridgeStart(Math.floor((pos - 320) / BRIDGE_EVERY)); if (st == null) return 0;
    var u = pos - st; return u < 0 || u > BRIDGE_LEN ? 0 : clamp(Math.min(u, BRIDGE_LEN - u) / 6, 0, 1);
  }
  function nearStop(pos) { // calm road around rest stops and the finish
    for (var i = 0; i < REST_STOPS.length; i++) if (Math.abs(pos - REST_STOPS[i] * chapterLen) < 110) return true;
    return tripMode === 'journey' && pos > JOURNEY_CHAPTERS * chapterLen - 160;
  }

  // ---------- road geometry ----------
  var DRAW = 330; // metres drawn
  var PD = 9;     // metres ahead of the camera where the player car stands
  // Three lanes share the road, so one lane is 2/3 of the road half-width: lane centres sit at 0 and +-LANE
  // and the painted lane lines at +-1/3. Drawing, pickups and contact all use this one number.
  var LANE = 2 / 3;
  var BODY = .78;  // how much of its lane a vehicle fills (width of a base car, in lanes)
  var CAR_HALF = 3.4; // a car counts as passed once it is this far behind the player
  var HIT_AHEAD = 5.5; var HIT_BEHIND = 2.5; // contact window around the player's depth: drawn cars touch about when this fires
  var K = 0.03;   // perspective strength
  var CURVE_A = 1.6e-4;
  function curveAt(s) {
    var gate = clamp(Math.sin(s / 1100) * 2.2, -1, 1);
    return CURVE_A * (gate * Math.sin(s / 380 + 1) + .5 * Math.sin(s / 170) * Math.abs(gate));
  }
  var xo = new Float32Array(DRAW + 2); // curve offset by metre ahead (road-half units)
  function buildCurve() {
    var x = 0; var dx = 0;
    xo[0] = 0;
    for (var d = 1; d <= DRAW + 1; d++) { dx += curveAt(dist + d) * 1; x += dx * 1; xo[d] = x; }
  }
  function xoAt(d) { var i = clamp(Math.floor(d), 0, DRAW); var f = d - i; return lerp(xo[i], xo[Math.min(DRAW + 1, i + 1)], f); }

  var hy = 0; var cx = 0; var RH = 0; var camX = 0;
  function pOf(d) { return 1 / (1 + d * K); }
  function yOf(p) { return hy + (H - hy) * p; }
  // Hills: the road rises and falls. Rows are shifted up or down with distance, and a row can
  // never be lower than the one in front of it, so a crest hides what is behind it.
  var HILL = [10, 3.8]; var ES = 0; var e0 = 0; var hyR = 0;
  function elev(s) { return HILL[0] * Math.sin(s / 330) + HILL[1] * Math.sin(s / 143 + 1.3); }
  function rowAt(d) { var p = pOf(d); return { y: yOf(p) - (elev(dist + d) - e0) * p * ES, p: p, ct: cx + (xoAt(d) - camX) * p * RH, hw: RH * p }; }
  var rows = [], roadEnd = DRAW; // roadEnd: how far ahead the visible road goes (less than DRAW when a crest hides the rest)
  function buildRows() {
    rows = []; var prev = 1e9; var d = -.5, hid = 0;
    while (d <= DRAW) {
      var r = rowAt(d); r.d = d;
      if (r.y > prev - .3) { r.y = prev - .3; hid += d < 8 ? .35 : d < 30 ? .8 : d < 100 ? 1.6 : 3; } // this bit of road is behind a crest
      else if (hid > 8) break; // the road comes back into view far beyond a crest: stop here, so the hill hides it instead of showing a second road beside the first
      prev = r.y; rows.push(r);
      d += d < 8 ? .35 : d < 30 ? .8 : d < 100 ? 1.6 : 3;
    }
    roadEnd = rows.length ? rows[rows.length - 1].d : DRAW;
  }

  // ---------- sprites ----------
  // The tread of each rear tyre is redrawn every frame with stripes that roll upward at the car's own speed,
  // so the wheels turn. Geometry comes from the sprite art (RacerCars.tyre).
  function drawTyres(x, by, Wd, type, spin) {
    var T = window.RacerCars && window.RacerCars.tyre[type]; if (!T || Wd < 46 || spin == null) return;
    var s = Wd / 100, x0 = T[0], w = T[1], h = T[2], per = h * .22, ph = ((spin % per) + per) % per, n = Math.ceil(h / per) + 1;
    [-1, 1].forEach(function (sd) {
      var left = sd < 0 ? x - (x0 + w) * s : x + x0 * s, tw = w * s, th = h * s, tx = sd < 0 ? left + tw * .2 : left, tdw = tw * .8;
      g.save(); rr(tx, by - th * .96, tdw, th * .94, tw * .3); g.clip();
      for (var k = 0; k < n; k++) {
        var yy = by - ((ph + k * per) % (h + per)) * s;
        // a lit tread block with a dark groove under it: dark-on-black alone was invisible, so the wheels looked static
        g.fillStyle = 'rgba(170,180,200,.2)'; g.fillRect(tx, yy - per * .62 * s, tdw, per * .3 * s);
        g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(tx, yy - per * .32 * s, tdw, per * .32 * s);
      }
      g.restore();
    });
  }
  function drawSprite(e, x, by, Wd) {
    var s = Wd / 100, b = e.box;
    g.drawImage(e.canvas, x + b[0] * s, by + b[1] * s, b[2] * s, b[3] * s);
  }
  function carRear(x, by, w, col, kind, o) {
    o = o || {};
    if (o.type && window.RacerCars) {
      var RC = window.RacerCars, px = o.px, e;
      if (!px && w * (TYPE_W[o.type] || 1) * RC.box(o.type)[2] / 100 < 150) { e = RC.sprite(o.type, col, o.acc, o.brake, 160); if (e.ready) px = 160; }
      e = RC.sprite(o.type, col, o.acc, o.brake, px === 160 ? 160 : o.px);
      if (e.ready) {
        if (o.reflect > .25 && !o.rot) { g.save(); g.translate(x, by); g.scale(1, -.45); g.globalAlpha = .17 * o.reflect; drawSprite(e, 0, 0, w * (TYPE_W[o.type] || 1)); g.restore(); } // the wet road mirrors the car
        if (o.rot) { g.save(); g.translate(x, by); g.rotate(o.rot); drawSprite(e, 0, 0, w * (TYPE_W[o.type] || 1)); g.restore(); } else { drawSprite(e, x, by, w * (TYPE_W[o.type] || 1)); drawTyres(x, by, w * (TYPE_W[o.type] || 1), o.type, o.spin); }
        return;
      }
    }
    var T = { hatch: { bh: .36, ch: .3, ct: .74, w: 1 }, sedan: { bh: .34, ch: .28, ct: .66, w: 1.02 }, suv: { bh: .42, ch: .34, ct: .78, w: 1.08 }, sport: { bh: .3, ch: .22, ct: .62, w: 1.06, sp: 1 }, taxi: { bh: .34, ch: .28, ct: .66, w: 1.02, roof: 1 }, van: { bh: .46, ch: .4, ct: .86, w: 1.1 }, truck: { box: 1, w: 1.15 } }[kind] || { bh: .36, ch: .3, ct: .74, w: 1 };
    var Wd = w * T.w;
    g.save();
    g.fillStyle = 'rgba(0,0,0,.38)'; g.beginPath(); g.ellipse(x, by + Wd * .02, Wd * .62, Wd * .09, 0, 0, TAU); g.fill();
    if (o.under) {
      var ug = g.createRadialGradient(x, by, 0, x, by, Wd * .9);
      ug.addColorStop(0, o.under + 'aa'); ug.addColorStop(1, o.under + '00');
      g.fillStyle = ug; g.beginPath(); g.ellipse(x, by, Wd * .9, Wd * .22, 0, 0, TAU); g.fill();
    }
    var tail = o.tail || '#ff3a3a';
    if (T.box) {
      var h = Wd;
      var gr = g.createLinearGradient(0, by - h, 0, by); gr.addColorStop(0, '#eef1f6'); gr.addColorStop(1, '#aeb5c3');
      g.fillStyle = gr; rr(x - Wd / 2, by - h, Wd, h - Wd * .12, Wd * .05); g.fill();
      g.fillStyle = '#262b36'; g.fillRect(x - Wd / 2, by - Wd * .2, Wd, Wd * .1);
    } else {
      var bh = Wd * T.bh; var ch = Wd * T.ch;
      var bg = g.createLinearGradient(0, by - bh - Wd * .1, 0, by);
      bg.addColorStop(0, mix(col, '#ffffff', .3)); bg.addColorStop(.4, col); bg.addColorStop(1, mix(col, '#000000', .55));
      g.fillStyle = bg; rr(x - Wd / 2, by - bh - Wd * .08, Wd, bh + Wd * .02, Wd * .1); g.fill();
      var ctw = Wd * T.ct;
      g.beginPath(); g.moveTo(x - Wd * .46, by - bh - Wd * .02); g.lineTo(x - ctw / 2, by - bh - ch - Wd * .04);
      g.quadraticCurveTo(x, by - bh - ch - Wd * .09, x + ctw / 2, by - bh - ch - Wd * .04); g.lineTo(x + Wd * .46, by - bh - Wd * .02); g.closePath();
      g.fillStyle = mix(col, '#000000', .15); g.fill();
      var gg = g.createLinearGradient(x - ctw / 2, 0, x + ctw / 2, 0); gg.addColorStop(0, '#0e1522'); gg.addColorStop(.5, '#25354f'); gg.addColorStop(1, '#0e1522');
      g.beginPath(); g.moveTo(x - Wd * .4, by - bh - Wd * .05); g.lineTo(x - ctw / 2 + Wd * .04, by - bh - ch - Wd * .01);
      g.quadraticCurveTo(x, by - bh - ch - Wd * .05, x + ctw / 2 - Wd * .04, by - bh - ch - Wd * .01); g.lineTo(x + Wd * .4, by - bh - Wd * .05); g.closePath();
      g.fillStyle = gg; g.fill();
      if (T.sp) { g.fillStyle = mix(col, '#000000', .5); rr(x - Wd * .44, by - bh - Wd * .12, Wd * .88, Wd * .045, Wd * .02); g.fill(); }
      if (T.roof) { g.fillStyle = '#fff7a8'; rr(x - Wd * .13, by - bh - ch - Wd * .1, Wd * .26, Wd * .07, Wd * .02); g.fill(); }
      g.fillStyle = '#1a1d25'; rr(x - Wd * .36, by - Wd * .12, Wd * .72, Wd * .1, Wd * .04); g.fill();
      g.save(); g.shadowColor = tail; g.shadowBlur = Wd * (o.brake ? .35 : .2); g.fillStyle = tail;
      rr(x - Wd * .47, by - bh * .8, Wd * .24, Wd * .08, Wd * .03); g.fill(); rr(x + Wd * .23, by - bh * .8, Wd * .24, Wd * .08, Wd * .03); g.fill();
      g.globalAlpha = .8; g.fillRect(x - Wd * .22, by - bh * .76, Wd * .44, Wd * .022); g.restore();
      g.fillStyle = '#e9edf2'; rr(x - Wd * .09, by - Wd * .15, Wd * .18, Wd * .055, Wd * .01); g.fill();
      var sh = g.createLinearGradient(0, by - bh, 0, by - bh * .4); sh.addColorStop(0, 'rgba(255,255,255,.28)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = sh; rr(x - Wd * .46, by - bh - Wd * .04, Wd * .92, bh * .5, Wd * .08); g.fill();
    }
    [-1, 1].forEach(function (sd) {
      var tx = sd < 0 ? x - Wd * .54 : x + Wd * .39; var th = Wd * (T.box ? .3 : .27);
      g.fillStyle = '#07080b'; rr(tx, by - th, Wd * .15, th, Wd * .05); g.fill();
      g.strokeStyle = 'rgba(205,215,235,.55)'; g.lineWidth = Math.max(1, Wd * .012); rr(tx, by - th, Wd * .15, th, Wd * .05); g.stroke();
      g.fillStyle = '#4a5266'; rr(tx + (sd < 0 ? Wd * .09 : Wd * .02), by - th * .8, Wd * .04, th * .6, Wd * .02); g.fill();
    });
    g.restore();
  }

  function glowDot(x, y, r, col) {
    g.save(); g.globalCompositeOperation = 'lighter';
    var gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col + 'cc'); gr.addColorStop(1, col + '00');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.restore();
  }

  var RIGID = { post: 1, tower: 1, neon: 1, house: 1, hut: 1, cabin: 1, lighthouse: 1, windmill: 1, lamp: 1, rock: 1, umbrella: 1 };
  // Roadside objects stand on the ground at (x, y) with scale s. sw = wind sway.
  function drawObj(kind, x, y, s, k, S, sw, lit) {
    var col, v = .8 + rnd(k, 7) * .5;
    if (RIGID[kind]) sw = 0; // buildings, posts and rocks stand still; only plants bend
    g.save(); g.translate(x, y); g.transform(1, 0, sw * .02, 1, 0, 0); g.scale(v, v * (.92 + rnd(k, 9) * .25));
    var greens = ['#4f9a4a', '#3f8a46', '#5aa55a', '#3a7a40'];
    var autumn = ['#e08a2e', '#c2410c', '#e8b040', '#d9822b'];
    if (kind === 'round' || kind === 'maple') {
      col = kind === 'maple' ? autumn[k % 4] : greens[k % 4];
      g.fillStyle = '#5a4130'; g.fillRect(-3 * s, -28 * s, 6 * s, 28 * s);
      [[0, -48, 24, 0], [-11, -40, 17, 1], [12, -41, 17, 1], [0, -56, 16, 2]].forEach(function (c) {
        g.fillStyle = c[3] === 0 ? mix(col, '#000000', .22) : c[3] === 2 ? mix(col, '#ffffff', .22) : col;
        g.beginPath(); g.arc(c[0] * s, c[1] * s, c[2] * s, 0, TAU); g.fill();
      });
    } else if (kind === 'pine' || kind === 'pinesnow') {
      col = kind === 'pinesnow' ? '#16382c' : ['#2f5a44', '#3a6a4a'][k % 2];
      g.fillStyle = '#3a2a20'; g.fillRect(-2 * s, -10 * s, 4 * s, 10 * s);
      for (var i = 0; i < 5; i++) {
        g.fillStyle = col; g.beginPath(); g.moveTo(sw * .1 * i * s, -(72 - i * 11) * s); g.lineTo((8 + i * 5) * s, -(42 - i * 10) * s); g.lineTo(-(8 + i * 5) * s, -(42 - i * 10) * s); g.fill();
        if (kind === 'pinesnow') { g.fillStyle = '#eaf2fb'; g.beginPath(); g.moveTo(0, -(72 - i * 11) * s); g.lineTo((4 + i * 2) * s, -(62 - i * 11) * s); g.lineTo(-(4 + i * 2) * s, -(62 - i * 11) * s); g.fill(); }
      }
    } else if (kind === 'birch') {
      g.fillStyle = '#e8e4d8'; g.fillRect(-2.5 * s, -46 * s, 5 * s, 46 * s); g.fillStyle = '#444';
      for (var q = 0; q < 4; q++) g.fillRect(-2.5 * s, -(8 + q * 10) * s, 5 * s, 1.5 * s);
      [[0, -54, 15], [-9, -46, 11], [10, -47, 11]].forEach(function (c) { g.fillStyle = '#b9c85a'; g.beginPath(); g.arc(c[0] * s, c[1] * s, c[2] * s, 0, TAU); g.fill(); });
    } else if (kind === 'cherry') {
      g.fillStyle = '#5a4130'; g.fillRect(-3 * s, -30 * s, 6 * s, 30 * s);
      [[0, -52, 22], [-14, -44, 15], [14, -46, 16], [0, -62, 14]].forEach(function (c, j) { g.fillStyle = j % 2 ? '#ffb7d0' : '#ff9fc0'; g.beginPath(); g.arc(c[0] * s, c[1] * s, c[2] * s, 0, TAU); g.fill(); });
    } else if (kind === 'palm') {
      g.strokeStyle = '#8a6a3c'; g.lineWidth = 5 * s; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(6 * s + sw * .3 * s, -30 * s, 2 * s + sw * .6 * s, -58 * s); g.stroke();
      for (var a = 0; a < 7; a++) { var an = a / 7 * TAU; g.strokeStyle = '#2f9e6a'; g.lineWidth = 4 * s; g.beginPath(); g.moveTo(2 * s + sw * .6 * s, -58 * s); g.quadraticCurveTo(2 * s + Math.cos(an) * 18 * s, -70 * s + Math.sin(an) * 6 * s, 2 * s + Math.cos(an) * 30 * s, -56 * s + Math.sin(an) * 14 * s); g.stroke(); }
    } else if (kind === 'cactus') {
      g.fillStyle = '#4e8f55'; rr(-5 * s, -42 * s, 10 * s, 42 * s, 5 * s); g.fill(); rr(-17 * s, -30 * s, 8 * s, 18 * s, 4 * s); g.fill(); g.fillRect(-17 * s, -14 * s, 14 * s, 6 * s); rr(9 * s, -36 * s, 8 * s, 18 * s, 4 * s); g.fill(); g.fillRect(3 * s, -20 * s, 14 * s, 6 * s);
    } else if (kind === 'rock') {
      g.fillStyle = S.rockC; g.beginPath(); g.moveTo(-22 * s, 0); g.quadraticCurveTo(-18 * s, -24 * s, -2 * s, -22 * s); g.quadraticCurveTo(16 * s, -26 * s, 24 * s, 0); g.fill();
      g.fillStyle = 'rgba(255,255,255,.14)'; g.beginPath(); g.moveTo(-12 * s, -6 * s); g.quadraticCurveTo(-6 * s, -20 * s, 2 * s, -18 * s); g.lineTo(-4 * s, -4 * s); g.fill();
    } else if (kind === 'bush') {
      [[-9, -7, 10, 0], [3, -10, 12, 1], [14, -6, 9, 0]].forEach(function (c) { g.fillStyle = c[3] ? '#6fb85a' : '#4f9a4a'; g.beginPath(); g.arc(c[0] * s, c[1] * s, c[2] * s, 0, TAU); g.fill(); });
      g.fillStyle = '#ffd1e8'; [[-6, -9], [8, -14], [12, -5]].forEach(function (c) { g.beginPath(); g.arc(c[0] * s, c[1] * s, 2 * s, 0, TAU); g.fill(); });
    } else if (kind === 'hut' || kind === 'house' || kind === 'cabin') {
      var w = (kind === 'house' ? 44 : 34) * s; var h = (kind === 'house' ? 34 : 24) * s;
      g.fillStyle = kind === 'cabin' ? '#7a5a3a' : ['#d9c3a0', '#f4e3c8', '#cfe3f5', '#f6c9c0'][k % 4]; g.fillRect(-w / 2, -h, w, h);
      g.fillStyle = kind === 'cabin' ? '#e9f1fb' : ['#b5532f', '#7a3b2e', '#34495e'][k % 3];
      g.beginPath(); g.moveTo(-w * .65, -h); g.lineTo(0, -h - 20 * s); g.lineTo(w * .65, -h); g.fill();
      var on = lit > .3 || kind === 'cabin';
      g.fillStyle = on ? '#ffd27a' : '#2a3347';
      if (on) { g.save(); g.shadowColor = '#ffcf70'; g.shadowBlur = 12 * s; g.fillRect(-w * .4, -h * .75, 8 * s, 8 * s); g.fillRect(w * .22, -h * .75, 8 * s, 8 * s); g.restore(); } else { g.fillRect(-w * .4, -h * .75, 8 * s, 8 * s); g.fillRect(w * .22, -h * .75, 8 * s, 8 * s); }
      if (kind !== 'house') { for (var sm = 0; sm < 3; sm++) { var u = (tAnim * .4 + sm / 3 + k * .13) % 1; g.fillStyle = 'rgba(235,235,240,' + (.5 * (1 - u)) + ')'; g.beginPath(); g.arc(w * .2 + u * 10 * s, -h - 18 * s - u * 30 * s, (3 + u * 6) * s, 0, TAU); g.fill(); } }
    } else if (kind === 'umbrella') {
      g.fillStyle = '#e8dcc6'; g.beginPath(); g.ellipse(18 * s, -2 * s, 22 * s, 4 * s, 0, 0, TAU); g.fill();
      g.fillStyle = '#7a5a3a'; g.fillRect(-1.5 * s, -44 * s, 3 * s, 44 * s);
      var uc = ['#e8483f', '#35a7ff', '#ffd54f', '#7cc67a'][k % 4];
      for (var us = 0; us < 6; us++) { g.fillStyle = us % 2 ? '#ffffff' : uc; g.beginPath(); g.moveTo(0, -48 * s); g.quadraticCurveTo(-24 * s + us * 8 * s, -52 * s, -24 * s + us * 8 * s + 8 * s, -36 * s); g.lineTo(-24 * s + us * 8 * s, -36 * s); g.fill(); }
    } else if (kind === 'lighthouse') {
      g.fillStyle = '#f4f1ea'; g.beginPath(); g.moveTo(-10 * s, 0); g.lineTo(-6 * s, -80 * s); g.lineTo(6 * s, -80 * s); g.lineTo(10 * s, 0); g.fill();
      g.fillStyle = '#c0392b'; [18, 42, 66].forEach(function (yy) { g.fillRect(-9 * s + (yy / 80) * 3 * s, -yy * s, 18 * s - (yy / 80) * 6 * s, 9 * s); });
      g.fillStyle = '#2d3440'; g.fillRect(-8 * s, -88 * s, 16 * s, 8 * s); glowDot(0, -92 * s, (S.night > .4 ? 30 : 11) * s, '#ffe9a0');
    } else if (kind === 'windmill') {
      var wmg = g.createLinearGradient(-12 * s, 0, 12 * s, 0); wmg.addColorStop(0, '#c99b6d'); wmg.addColorStop(1, '#8a6040');
      g.fillStyle = wmg; g.beginPath(); g.moveTo(-12 * s, 0); g.lineTo(-7 * s, -44 * s); g.lineTo(7 * s, -44 * s); g.lineTo(12 * s, 0); g.fill(); // timber tower
      g.fillStyle = '#4a3020'; rr(-3 * s, -11 * s, 6 * s, 11 * s, 3 * s); g.fill(); g.fillRect(-2 * s, -30 * s, 4 * s, 5 * s); // door and window
      g.fillStyle = '#6b3d26'; g.beginPath(); g.moveTo(-9 * s, -44 * s); g.lineTo(0, -56 * s); g.lineTo(9 * s, -44 * s); g.fill();
      g.save(); g.translate(0, -47 * s); g.rotate(tAnim * .9 + k);
      for (var b = 0; b < 4; b++) { g.rotate(Math.PI / 2); g.fillStyle = '#5a3a24'; g.fillRect(-1.2 * s, 0, 2.4 * s, 25 * s); g.fillStyle = 'rgba(245,236,214,.92)'; g.fillRect(1.6 * s, 6 * s, 6 * s, 17 * s); g.strokeStyle = '#5a3a24'; g.lineWidth = Math.max(.5, .8 * s); g.strokeRect(1.6 * s, 6 * s, 6 * s, 17 * s); }
      g.fillStyle = '#3a2618'; g.beginPath(); g.arc(0, 0, 2.6 * s, 0, TAU); g.fill(); g.restore();
    } else if (kind === 'tower' || kind === 'neon') {
      var tw = (30 + rnd(k, 1) * 26) * s; var th = (100 + rnd(k, 2) * 150) * s;
      var gr = g.createLinearGradient(-tw / 2, 0, tw / 2, 0);
      var neon = kind === 'neon' || S.night > .8;
      gr.addColorStop(0, neon ? '#2b2f6a' : '#5b6b86'); gr.addColorStop(1, neon ? '#12162e' : '#34405a');
      g.fillStyle = gr; g.fillRect(-tw / 2, -th, tw, th);
      var cols = Math.max(2, Math.floor(tw / (9 * s))); var rows = Math.max(2, Math.floor(th / (11 * s)));
      var wins = [new Path2D(), new Path2D(), new Path2D(), new Path2D()], ww = (tw - 6 * s) / cols - 2 * s; // windows are batched into one path per colour: hundreds of tiny fills made the city the slowest chapter
      for (var r = 0; r < rows; r++) for (var c2 = 0; c2 < cols; c2++) {
        var lit2 = lit > .25 && rnd(r * 9 + c2 + k, 4) > .38;
        wins[lit2 ? 1 + (neon ? (r + c2) % 3 : 0) : 0].rect(-tw / 2 + 3 * s + c2 * (tw - 6 * s) / cols, -th + 4 * s + r * 11 * s, ww, 6 * s);
      }
      g.fillStyle = 'rgba(20,30,50,.55)'; g.fill(wins[0]);
      g.globalAlpha = .88;
      [neon ? '#ff4fd8' : '#ffd97a', '#35e6ff', '#ffe066'].forEach(function (col, ci) { g.fillStyle = col; g.fill(wins[ci + 1]); });
      g.globalAlpha = 1;
      g.fillStyle = '#222'; g.fillRect(-s, -th - 14 * s, 2 * s, 14 * s);
      if (((tAnim * 1.2 + k) % 1) < .5) { g.save(); g.shadowColor = '#ff3b3b'; g.shadowBlur = 12; g.fillStyle = '#ff3b3b'; g.beginPath(); g.arc(0, -th - 14 * s, 2.4 * s, 0, TAU); g.fill(); g.restore(); }
      if (kind === 'neon') {
        var nc = ['#ff4fd8', '#35e6ff', '#ffe066', '#7cff6b'][k % 4];
        var onn = ((tAnim * (1 + rnd(k, 2))) % 1) > .12;
        g.save(); g.shadowColor = nc; g.shadowBlur = onn ? 18 : 2; g.fillStyle = onn ? nc : '#333'; g.fillStyle = '#140a24'; g.fillRect(-tw * .5 - 11 * s, -th * .62, 10 * s, 40 * s); // blade sign on a bracket
        g.strokeStyle = onn ? nc : '#444'; g.lineWidth = 1.6 * s; g.strokeRect(-tw * .5 - 11 * s, -th * .62, 10 * s, 40 * s);
        g.fillStyle = onn ? nc : '#333'; for (var lt = 0; lt < 4; lt++) g.fillRect(-tw * .5 - 8.5 * s, -th * .62 + 5 * s + lt * 9 * s, 5 * s, 4.5 * s);
        g.restore(); g.fillStyle = '#222'; g.fillRect(-tw * .5 - 1 * s, -th * .62 + 3 * s, 1.5 * s, 34 * s);
      }
    } else if (kind === 'post') {
      g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(0, 0, 5 * s, 1.5 * s, 0, 0, TAU); g.fill();
      g.fillStyle = '#f3efe6'; g.fillRect(-1.6 * s, -26 * s, 3.2 * s, 26 * s); g.fillStyle = '#e8661a'; g.fillRect(-1.6 * s, -23 * s, 3.2 * s, 6 * s); g.fillStyle = '#222'; g.fillRect(-1.6 * s, -9 * s, 3.2 * s, 3 * s);
    } else if (kind === 'lamp') {
      g.fillStyle = '#2f3644'; g.fillRect(-2 * s, -64 * s, 4 * s, 64 * s); g.fillRect(0, -66 * s, 16 * s, 3 * s);
      if (lit > .2) { glowDot(14 * s, -62 * s, 13 * s, '#ffd98a'); g.fillStyle = '#ffe9a8'; g.beginPath(); g.arc(14 * s, -62 * s, 4 * s, 0, TAU); g.fill(); }
    }
    g.restore();
  }

  // ---------- drawing ----------
  // ---------- big moments ----------
  // One moment per chapter, about half a minute long, played in the sky and along the horizon: centred and large,
  // so a portrait screen shows all of it. They come from the distance driven, so they need no saved state.
  var MOMENTS = ['balloons', 'steam', 'freight', 'geese', 'liner', 'airship', 'drones', 'storm', 'aurora', 'fireworks'];
  var MOMENT_FROM = .3, MOMENT_LEN = .3, momentFx = {};
  function momentAt(pos) {
    var c = chapterAt(pos), u = (c.frac - MOMENT_FROM) / MOMENT_LEN;
    if (u <= 0 || u >= 1 || (tripMode === 'journey' && c.i >= JOURNEY_CHAPTERS)) return null;
    return { kind: MOMENTS[c.idx], u: u, a: clamp(Math.min(u, 1 - u) * 7, 0, 1), ch: c.i };
  }
  function trainOnHorizon(x, base, cars, steam, a, S) { // a train seen side on, far away, running along the horizon
    var L = 36 * dpr, h = 13 * dpr, gap = 4 * dpr, dir = 1;
    var col = function (c) { return mix(c, S.fog, steam ? .3 : .12); }; // the desert haze is thick, so the containers keep more colour
    for (var i = 0; i < cars; i++) {
      var cx0 = x - i * (L + gap) * dir;
      if (cx0 < -L * 2 || cx0 > W + L * 2) continue;
      if (i === 0) {
        g.fillStyle = col(steam ? '#1f2a24' : '#e07b1f'); g.fillRect(cx0 - L, base - h * 1.15, L, h * 1.15);
        if (steam) { g.fillRect(cx0 - L * .3, base - h * 1.7, L * .14, h * .6); g.fillStyle = col('#c0392b'); g.fillRect(cx0 - L, base - h * .25, L, h * .25); }
        else { g.fillStyle = col('#ffe7a0'); g.fillRect(cx0 - L * .22, base - h * .95, L * .16, h * .3); }
      } else {
        var cc = steam ? '#7a1f2b' : ['#c0392b', '#2471a3', '#d68910', '#1e8449', '#7d3c98', '#5d6d7e'][i % 6];
        g.fillStyle = col(cc); g.fillRect(cx0 - L, base - h, L, h);
        if (steam) { g.fillStyle = col('#ffe6a8'); for (var w = 0; w < 5; w++) g.fillRect(cx0 - L + 4 * dpr + w * 6.4 * dpr, base - h * .72, 3.6 * dpr, h * .3); }
        else { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(cx0 - L * .5, base - h, 1 * dpr, h); }
      }
    }
    if (steam) for (var k = 0; k < 9; k++) { // steam trails back from the chimney and rises
      var px = x - L * .23 - k * 12 * dpr, py = base - h * 1.8 - k * 4 * dpr, pr = (4 + k * 1.8) * dpr;
      g.globalAlpha = a * .7 * (1 - k / 9); g.fillStyle = '#f4f4f2'; g.beginPath(); g.arc(px, py, pr, 0, TAU); g.fill();
    }
    else for (var q = 0; q < 6; q++) { g.globalAlpha = a * .25 * (1 - q / 6); g.fillStyle = mix('#d6b67e', S.fog, .3); g.beginPath(); g.ellipse(x - (q + 1) * cars * 3 * dpr, base - 2 * dpr, 30 * dpr, 4 * dpr, 0, 0, TAU); g.fill(); }
    g.globalAlpha = a;
  }
  function balloonAt(x, y, u, c1, c2) { // a hot-air balloon, u = size unit
    var env = g.createRadialGradient(x - 6 * u, y - 8 * u, 2 * u, x, y, 30 * u); env.addColorStop(0, c1); env.addColorStop(1, c2);
    g.fillStyle = env; g.beginPath(); g.moveTo(x, y - 26 * u); g.bezierCurveTo(x + 26 * u, y - 24 * u, x + 28 * u, y + 10 * u, x + 6 * u, y + 24 * u); g.lineTo(x - 6 * u, y + 24 * u); g.bezierCurveTo(x - 28 * u, y + 10 * u, x - 26 * u, y - 24 * u, x, y - 26 * u); g.fill();
    g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(x, y - 2 * u, 6 * u, 24 * u, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(60,40,30,.6)'; g.lineWidth = Math.max(1, u * .6); g.beginPath(); g.moveTo(x - 5 * u, y + 24 * u); g.lineTo(x - 3 * u, y + 31 * u); g.moveTo(x + 5 * u, y + 24 * u); g.lineTo(x + 3 * u, y + 31 * u); g.stroke();
    g.fillStyle = '#7a5236'; g.fillRect(x - 4 * u, y + 31 * u, 8 * u, 6 * u);
  }
  var DRONE_SHAPES = [ // the drone show: each formation is a list of points on a unit square, morphing one into the next
    function (i, n) { var t = i / n * TAU; return [Math.cos(t), Math.sin(t)]; },
    function (i, n) { var t = i / n * TAU; return [Math.pow(Math.sin(t), 3) * 1.05, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 15]; },
    function (i, n) { var t = i / n * TAU, r = i % 2 ? .45 : 1; return [Math.cos(t - Math.PI / 2) * r, Math.sin(t - Math.PI / 2) * r]; }
  ];
  function drawMoment(S, layer) {
    var M = momentAt(dist); if (!M) return;
    var a = M.a, u = M.u, shift = -xoAt(DRAW * .8) * .12 * 40 * dpr * .3; g.save(); g.globalAlpha = a;
    if (layer === 'back' && M.kind === 'balloons') { // a balloon festival lifting off from behind the hills
      [['#ff8a7a', '#a52a2a'], ['#7adbd0', '#14665f'], ['#ffe08a', '#c07a10'], ['#b9a2ff', '#4b3aa8'], ['#ff9fd0', '#a8326e'], ['#9fe08a', '#2f7a2a']].forEach(function (c, i) {
        var rise = clamp(u * 1.6 - i * .1, 0, 1.2), x = W * (.12 + i * .155) + Math.sin(tAnim * .3 + i) * 8 * dpr + shift, y = hyR + 30 * dpr - rise * H * .42, uu = dpr * (.55 + (i % 3) * .2);
        if (rise > 0) balloonAt(x, y, uu, c[0], c[1]);
      });
    }
    if (layer === 'front') {
      if (M.kind === 'steam' || M.kind === 'freight') trainOnHorizon(-W * .2 + u * W * 1.9 + shift, hyR - 3 * dpr, M.kind === 'steam' ? 6 : 9, M.kind === 'steam', a, S);
      if (M.kind === 'liner') { // a cruise ship crossing the sea on the horizon, lights in every window
        var sx = W * (.5 + u * .55) + shift, // the liner keeps to the right half of the sea, clear of the giant wheel
           sb = hyR - 1 * dpr, sl = 150 * dpr, night = S.night > .4;
        g.fillStyle = mix('#1d3557', S.fog, .25); g.beginPath(); g.moveTo(sx - sl / 2, sb - 11 * dpr); g.lineTo(sx + sl / 2 + 10 * dpr, sb - 11 * dpr); g.lineTo(sx + sl / 2, sb); g.lineTo(sx - sl / 2 + 6 * dpr, sb); g.closePath(); g.fill();
        [[.44, 9], [.36, 17], [.26, 24]].forEach(function (dk, i) { g.fillStyle = mix(i % 2 ? '#e9e5dc' : '#f6f3ec', S.fog, .2); g.fillRect(sx - sl * dk[0] - 6 * dpr, sb - 11 * dpr - dk[1] * dpr + (i ? 0 : 1 * dpr), sl * dk[0] * 1.7, (dk[1] - (i ? [9, 17][i - 1] : 0)) * dpr + 1); });
        g.fillStyle = mix('#c0392b', S.fog, .2); g.fillRect(sx + sl * .12, sb - 33 * dpr, 12 * dpr, 9 * dpr); g.fillStyle = '#1b1b1b'; g.fillRect(sx + sl * .12, sb - 35 * dpr, 12 * dpr, 2 * dpr);
        g.fillStyle = night ? '#ffe39a' : 'rgba(60,90,120,.7)'; for (var wr = 0; wr < 3; wr++) for (var wc = 0; wc < 22 - wr * 5; wc++) g.fillRect(sx - sl * .42 + wc * 6.4 * dpr + wr * 9 * dpr, sb - 15 * dpr - wr * 7.5 * dpr, 2.6 * dpr, 2 * dpr);
        g.globalAlpha = a * .5; g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(sx - sl * .55, sb - 1 * dpr, 26 * dpr, 2 * dpr, 0, 0, TAU); g.fill(); // wake
      }
      if (M.kind === 'geese') { // a big V of geese flying over, wings beating
        var gx = W * (1.15 - u * 1.5), gy = H * .2 + Math.sin(u * 3) * 10 * dpr;
        g.strokeStyle = 'rgba(40,30,30,.85)'; g.lineCap = 'round'; g.lineWidth = 2.2 * dpr;
        for (var b = 0; b < 11; b++) { var row = Math.ceil(b / 2), sd = b % 2 ? 1 : -1, bx = gx + row * 22 * dpr, by = gy + sd * row * 13 * dpr, fl = Math.sin(tAnim * 7 + b) * 6 * dpr, ws = 11 * dpr;
          g.beginPath(); g.moveTo(bx - ws, by - fl); g.quadraticCurveTo(bx - ws * .4, by - 2 * dpr, bx, by); g.quadraticCurveTo(bx + ws * .4, by - 2 * dpr, bx + ws, by - fl); g.stroke(); }
      }
      if (M.kind === 'airship') { // an airship drifts over the skyline, its screen glowing, searchlights sweeping
        g.save(); g.globalCompositeOperation = 'lighter';
        [-1, 1].forEach(function (sd) { var bx = W * (.5 + sd * .28), ang = Math.sin(tAnim * .6 + sd) * .45 + sd * .1, len = H * .5, bw = 34 * dpr;
          var bg = g.createLinearGradient(bx, hyR, bx + Math.sin(ang) * len, hyR - Math.cos(ang) * len); bg.addColorStop(0, 'rgba(200,220,255,' + .22 * a + ')'); bg.addColorStop(1, 'rgba(200,220,255,0)');
          g.fillStyle = bg; g.beginPath(); g.moveTo(bx - 3 * dpr, hyR); g.lineTo(bx + Math.sin(ang) * len - bw * Math.cos(ang), hyR - Math.cos(ang) * len - bw * Math.sin(ang)); g.lineTo(bx + Math.sin(ang) * len + bw * Math.cos(ang), hyR - Math.cos(ang) * len + bw * Math.sin(ang)); g.lineTo(bx + 3 * dpr, hyR); g.fill(); });
        g.restore();
        var ax = W * (-.2 + u * 1.4) + shift, ay = hyR - H * .2, al = 64 * dpr, ah = 18 * dpr;
        var ag2 = g.createLinearGradient(0, ay - ah, 0, ay + ah); ag2.addColorStop(0, '#c8ccd6'); ag2.addColorStop(1, '#6b7080');
        g.fillStyle = ag2; g.beginPath(); g.ellipse(ax, ay, al, ah, 0, 0, TAU); g.fill();
        g.fillStyle = '#3b3f4a'; g.beginPath(); g.moveTo(ax - al * .95, ay); g.lineTo(ax - al * 1.15, ay - ah * .9); g.lineTo(ax - al * 1.15, ay + ah * .9); g.closePath(); g.fill();
        g.fillStyle = '#2a2d36'; g.fillRect(ax - 10 * dpr, ay + ah - 2 * dpr, 20 * dpr, 5 * dpr);
        var scr = ((tAnim * .5) % 1); g.fillStyle = ['#35e6ff', '#ff4fd8', '#ffe066'][Math.floor(tAnim * .5) % 3]; g.globalAlpha = a * .85; g.fillRect(ax - al * .45, ay - ah * .35, al * .9 * (.3 + .7 * scr), ah * .7); g.globalAlpha = a;
        if (Math.sin(tAnim * 5) > .6) { glowDot(ax + al * .98, ay, 8 * dpr, '#ff3b3b'); glowDot(ax - al * 1.1, ay, 8 * dpr, '#7cff6b'); }
      }
      if (M.kind === 'drones') { // a drone light show: a ring, then a heart, then a star, over the towers
        var n = 48, ph = u * 3, A = Math.floor(clamp(ph, 0, 2.999)), f = smoothT(clamp((ph - A) * 1.6 - .3, 0, 1)), B = Math.min(2, A + 1), ccx = W * .5 + shift * .5, ccy = hyR - H * .085, R = Math.min(W * .2, H * .065);
        g.save(); g.globalCompositeOperation = 'lighter';
        for (var di = 0; di < n; di++) { var p0 = DRONE_SHAPES[A](di, n), p1 = DRONE_SHAPES[B](di, n), dx = ccx + (p0[0] + (p1[0] - p0[0]) * f) * R, dy = ccy + (p0[1] + (p1[1] - p0[1]) * f) * R, dc = di % 3 ? '#35e6ff' : '#ff4fd8';
          glowDot(dx, dy, 4.5 * dpr, dc); g.fillStyle = '#ffffff'; g.fillRect(dx - dpr, dy - dpr, 2 * dpr, 2 * dpr); }
        g.restore();
      }
      if (M.kind === 'aurora') { // the aurora flares: bright curtains dance low over the mountains, and stars fall
        g.save(); g.globalCompositeOperation = 'screen';
        for (var cb = 0; cb < 3; cb++) { var acg = g.createLinearGradient(0, hyR - H * .32, 0, hyR); var cc2 = ['120,255,190', '90,220,255', '200,140,255'][cb];
          acg.addColorStop(0, 'rgba(' + cc2 + ',0)'); acg.addColorStop(.5, 'rgba(' + cc2 + ',' + (.5 * a) + ')'); acg.addColorStop(1, 'rgba(' + cc2 + ',0)');
          g.fillStyle = acg; g.beginPath(); g.moveTo(0, hyR); for (var ax2 = 0; ax2 <= W + 16 * dpr; ax2 += 16 * dpr) g.lineTo(ax2, hyR - H * (.16 + cb * .05) - Math.sin(ax2 / dpr * .012 + tAnim * 1.1 + cb * 2) * H * .06); g.lineTo(W + 16 * dpr, hyR); g.fill(); }
        g.restore();
        for (var st = 0; st < 3; st++) { var sp = (tAnim * .45 + st * .37) % 1; if (sp < .25) { var q2 = sp / .25, x1 = W * (.15 + st * .3) + q2 * 80 * dpr, y1 = H * (.1 + st * .04) + q2 * 40 * dpr, sgr = g.createLinearGradient(x1, y1, x1 - 50 * dpr, y1 - 25 * dpr); sgr.addColorStop(0, 'rgba(255,255,255,' + (a * (1 - q2)) + ')'); sgr.addColorStop(1, 'rgba(255,255,255,0)'); g.strokeStyle = sgr; g.lineWidth = 2 * dpr; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 - 50 * dpr, y1 - 25 * dpr); g.stroke(); } }
      }
      if (M.kind === 'fireworks') { // fireworks over the harbour: a burst every second, each one fading as it falls
        g.save(); g.globalCompositeOperation = 'lighter';
        for (var fk = 0; fk < 4; fk++) { var cyc = tAnim * .8 + fk * .27, gen = Math.floor(cyc), fp = cyc - gen, fx = W * (.15 + rnd(gen * 4 + fk, 3) * .7), fy = H * (.14 + rnd(gen * 4 + fk, 4) * .14), fc = ['#ffd166', '#ff6b8a', '#7cf0ff', '#b9ff7a'][(gen + fk) % 4];
          if (fp < .18) { g.fillStyle = fc; g.globalAlpha = a; g.fillRect(fx - dpr, fy + (1 - fp / .18) * (hyR - fy), 2 * dpr, 6 * dpr); continue; } // the rocket going up
          var e = (fp - .18) / .82; g.globalAlpha = a * (1 - e);
          for (var sp2 = 0; sp2 < 22; sp2++) { var ang2 = sp2 / 22 * TAU, rr2 = e * 46 * dpr, px2 = fx + Math.cos(ang2) * rr2, py2 = fy + Math.sin(ang2) * rr2 + e * e * 22 * dpr; g.fillStyle = fc; g.beginPath(); g.arc(px2, py2, 1.8 * dpr, 0, TAU); g.fill(); }
        }
        g.restore();
      }
    }
    g.restore();
  }
  function smoothT(x) { return x * x * (3 - 2 * x); }
  // Sunset Coast's seaside fair: a giant wheel on the horizon that turns slowly, its cabins always hanging level
  // and its rim lit with bulbs. It fades in and out with the chapter.
  function drawWheel(S) {
    var a = (S.a.name === 'Sunset Coast' ? 1 - S.t : 0) + (S.b.name === 'Sunset Coast' ? S.t : 0); if (a < .02) return;
    var R = Math.min(W * .15, H * .072), x = W * .2 - xoAt(DRAW * .8) * .12 * 40 * dpr * .3, base = hyR + 1 * dpr, cy = base - R - 8 * dpr, rot = tAnim * .1, n = 8;
    var steel = mix('#ffffff', S.fog, .15), dark = mix('#4a3b46', S.fog, .15);
    g.save(); g.globalAlpha = a; g.lineCap = 'round';
    g.fillStyle = mix('#7a5236', S.fog, .15); g.fillRect(x - R * .9, base - 3 * dpr, R * 1.8, 4 * dpr); // the pier it stands on
    g.strokeStyle = dark; g.lineWidth = 3.5 * dpr; g.beginPath(); g.moveTo(x - R * .55, base - 2 * dpr); g.lineTo(x, cy); g.lineTo(x + R * .55, base - 2 * dpr); g.stroke(); // the A-frame legs
    g.strokeStyle = steel; g.lineWidth = 1.6 * dpr; g.beginPath();
    for (var i = 0; i < n; i++) { var an = rot + i / n * TAU; g.moveTo(x, cy); g.lineTo(x + Math.cos(an) * R, cy + Math.sin(an) * R); } g.stroke(); // spokes
    g.lineWidth = 3.5 * dpr; g.beginPath(); g.arc(x, cy, R, 0, TAU); g.stroke(); // the rim
    var cols = ['#e8483f', '#35a7ff', '#ffd54f', '#7cc67a', '#ff8fb8', '#b9a2ff'];
    for (var c = 0; c < n; c++) { var a2 = rot + c / n * TAU, px = x + Math.cos(a2) * R, py = cy + Math.sin(a2) * R; // each cabin hangs straight down from the rim
      g.fillStyle = mix(cols[c % cols.length], S.fog, .12); rr(px - 5 * dpr, py + 1.5 * dpr, 10 * dpr, 8 * dpr, 2.5 * dpr); g.fill(); }
    for (var bI = 0; bI < 16; bI++) { var ab = rot + bI / 16 * TAU; if ((Math.floor(tAnim * 3) + bI) % 3 !== 0) { g.fillStyle = '#fff2b8'; g.beginPath(); g.arc(x + Math.cos(ab) * R, cy + Math.sin(ab) * R, 1.6 * dpr, 0, TAU); g.fill(); } } // chasing bulbs
    g.fillStyle = dark; g.beginPath(); g.arc(x, cy, 4 * dpr, 0, TAU); g.fill();
    g.restore();
  }
  // the sound of each moment: once when it starts, and again for what repeats (each firework, each lightning strike)
  function stepMoment(dt) {
    var M = momentAt(dist); if (!M || mode !== 'run') return;
    var key = M.ch + ':' + M.kind;
    if (!momentFx[key] && M.u > .05) {
      momentFx[key] = 1;
      var first = { balloons: ['balloon', -.3], steam: ['whistle', .2], freight: ['boathorn', 0], geese: ['geese', .5], liner: ['foghorn', 0], airship: ['plane', 0], drones: ['shimmer', 0], storm: null, aurora: ['shimmer', 0], fireworks: null }[M.kind];
      if (first) au('life', first[0], first[1]);
      if (M.kind === 'steam' || M.kind === 'freight') setTimeout(function () { au('life', 'train', 0); }, 1200);
      if (M.kind === 'liner') setTimeout(function () { au('life', 'gulls', .4); }, 2600);
      if (M.kind === 'geese') setTimeout(function () { au('life', 'geese', -.4); }, 3200);
      if (M.kind === 'balloons') setTimeout(function () { au('life', 'balloon', .4); }, 2400);
      if (M.kind === 'aurora') setTimeout(function () { au('life', 'windchimes', .3); }, 3000);
    }
    if (M.kind === 'fireworks') { var fg2 = Math.floor(tAnim * .8 * 4); if (fg2 !== momentFx.fw && Math.random() < .5) au('life', 'fireworks', (Math.random() - .5) * .8); momentFx.fw = fg2; }
    if (M.kind === 'storm' && lightningT <= 0 && Math.random() < dt * .7) { lightningT = .4; au('event', 'thunder', { close: true, delay: .1 + Math.random() * .6 }); } // the storm breaks: strikes come thick and fast
  }

  function drawSky(S) {
    var sk = g.createLinearGradient(0, 0, 0, hy);
    sk.addColorStop(0, S.sky[0]); sk.addColorStop(.55, S.sky[1]); sk.addColorStop(1, S.sky[2]);
    g.fillStyle = sk; g.fillRect(0, 0, W, Math.max(hy, hyR) + 2);
    if (S.stars > .02) { for (var i = 0; i < 90; i++) { g.fillStyle = 'rgba(255,255,255,' + (S.stars * (.25 + .6 * Math.abs(Math.sin(tAnim * 1.5 + i)))) + ')'; g.fillRect(rnd(i, 1) * W, rnd(i, 2) * hy * .8, 1.5 * dpr, 1.5 * dpr); } }
    var sx0 = S.sunX * W; var sy0 = hy * S.sunY;
    var sunA = 1 - S.stars * .6;
    var breathe = 1 + .06 * Math.sin(tAnim * .9);
    var gl = g.createRadialGradient(sx0, sy0, 0, sx0, sy0, W * .55 * breathe);
    gl.addColorStop(0, 'rgba(255,240,200,' + (.85 * sunA) + ')'); gl.addColorStop(.2, 'rgba(255,210,150,' + (.4 * sunA) + ')'); gl.addColorStop(1, 'rgba(255,190,120,0)');
    g.fillStyle = gl; g.fillRect(0, 0, W, hy + 30 * dpr);
    g.save(); g.globalCompositeOperation = 'lighter'; var bl = g.createRadialGradient(sx0, sy0, W * .04, sx0, sy0, W * .75); bl.addColorStop(0, 'rgba(255,214,150,' + (.38 * sunA) + ')'); bl.addColorStop(.35, 'rgba(255,190,120,' + (.12 * sunA) + ')'); bl.addColorStop(1, 'rgba(255,170,100,0)'); g.fillStyle = bl; g.fillRect(0, 0, W, hy + 40 * dpr); g.restore();
    g.fillStyle = S.sunC; g.beginPath(); g.arc(sx0, sy0, W * .05, 0, TAU); g.fill();
    if (S.stars > .5) { g.fillStyle = 'rgba(8,10,24,.7)'; g.beginPath(); g.arc(sx0 + W * .02, sy0, W * .05, 0, TAU); g.fill(); }
    // clouds
    for (var c = 0; c < 4; c++) {
      var x = ((rnd(c, 5) * W * 1.4 + tAnim * 14 * dpr * (.5 + rnd(c, 6))) % (W * 1.4)) - W * .2; var y = H * .19 + rnd(c, 7) * (hy * .62 - H * .19);
      g.fillStyle = 'rgba(255,255,255,' + (.55 - S.stars * .35) + ')';
      [0, 30, 60, 22, 46].forEach(function (dx, k2) { g.beginPath(); g.ellipse(x + dx * dpr, y + (k2 > 2 ? 6 * dpr : 0), 34 * dpr, 13 * dpr, 0, 0, TAU); g.fill(); });
    }
    // life in the sky: a flock of birds, a slow balloon, a shooting star
    if (S.night < .5 && S.stars < .4) {
      for (var fl = 0; fl < 2; fl++) {
      var bu = ((tAnim + 3 + fl * 17) % (fl ? 41 : 26)) / (fl ? 41 : 26);
      if (bu < .5) {
        var bx0 = fl ? W * 1.1 - bu * 2 * W * 1.2 : -W * .1 + bu * 2 * W * 1.2; var by0 = Math.max(H * .2, hy * (fl ? .42 : .55)) + Math.sin(bu * 6) * hy * .05;
        g.strokeStyle = 'rgba(40,30,60,.7)'; g.lineWidth = 1.8 * dpr; g.lineCap = 'round';
        for (var bi = 0; bi < 7; bi++) {
          var row = Math.ceil(bi / 2); var sd = bi % 2 ? 1 : -1; var bx = bx0 + (fl ? 1 : -1) * row * 20 * dpr; var by = by0 + sd * row * 9 * dpr; var wing = Math.sin(tAnim * 8 + bi) * 4 * dpr;
          g.beginPath(); g.moveTo(bx - 8 * dpr, by + wing * .3); g.quadraticCurveTo(bx - 4 * dpr, by - 5 * dpr - wing, bx, by); g.quadraticCurveTo(bx + 4 * dpr, by - 5 * dpr - wing, bx + 8 * dpr, by + wing * .3); g.stroke();
        }
      }
      }
    }
    if (S.a.balloon && S.night < .5 && S.a.name !== 'Sunset Coast' && !(momentAt(dist) && momentAt(dist).kind === 'balloons')) for (var bl = 0; bl < 1; bl++) { // one balloon drifts across the sky
      var lx = ((tAnim * (bl ? 4.2 : 6) * dpr + bl * W * .7) % (W * 1.5)) - W * .25; var ly = Math.max(H * .24, hy * (bl ? .55 : .75)) + Math.sin(tAnim * .4 + bl * 2) * 7 * dpr; var u = dpr * (bl ? .62 : 1); var sway = Math.sin(tAnim * .7 + bl) * .05;
      g.save(); g.translate(lx, ly); g.rotate(sway);
      var env = g.createRadialGradient(-6 * u, -8 * u, 2 * u, 0, 0, 30 * u); env.addColorStop(0, bl ? '#7adbd0' : '#ff8a7a'); env.addColorStop(.6, bl ? '#2aa198' : '#e8483f'); env.addColorStop(1, bl ? '#14665f' : '#a52a2a');
      g.fillStyle = env; g.beginPath(); g.moveTo(0, -26 * u); g.bezierCurveTo(26 * u, -24 * u, 28 * u, 10 * u, 6 * u, 24 * u); g.lineTo(-6 * u, 24 * u); g.bezierCurveTo(-28 * u, 10 * u, -26 * u, -24 * u, 0, -26 * u); g.fill();
      g.save(); g.clip(); g.fillStyle = '#ffd966'; g.beginPath(); g.ellipse(0, 0, 8 * u, 30 * u, 0, 0, TAU); g.fill(); g.fillStyle = '#fff3d0'; g.beginPath(); g.ellipse(0, 0, 2.5 * u, 30 * u, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.22)'; g.beginPath(); g.ellipse(-12 * u, -8 * u, 4 * u, 16 * u, .3, 0, TAU); g.fill(); g.restore();
      g.strokeStyle = 'rgba(60,40,30,.7)'; g.lineWidth = u; g.beginPath(); g.moveTo(-6 * u, 24 * u); g.lineTo(-4 * u, 34 * u); g.moveTo(6 * u, 24 * u); g.lineTo(4 * u, 34 * u); g.stroke();
      g.fillStyle = '#7a5230'; rr(-6 * u, 34 * u, 12 * u, 8 * u, 2 * u); g.fill(); g.fillStyle = '#5a3a20'; g.fillRect(-6 * u, 36 * u, 12 * u, 2 * u);
      glowDot(0, 27 * u, 9 * u, '#ffb347'); g.restore();
    }
    if (S.stars > .6) {
      var su = (tAnim % 16) / 16;
      if (su < .07) { var q = su / .07; var sx1 = W * (.2 + q * .5); var sy1 = hy * (.1 + q * .3); var sg = g.createLinearGradient(sx1, sy1, sx1 - 90 * dpr, sy1 - 45 * dpr); sg.addColorStop(0, 'rgba(255,255,255,' + (1 - q) + ')'); sg.addColorStop(1, 'rgba(255,255,255,0)'); g.strokeStyle = sg; g.lineWidth = 2 * dpr; g.beginPath(); g.moveTo(sx1, sy1); g.lineTo(sx1 - 90 * dpr, sy1 - 45 * dpr); g.stroke(); }
    }
    if (S.aurora > .02) {
      g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = S.aurora * .9;
      for (var b = 0; b < 3; b++) {
        var ag = g.createLinearGradient(0, hy * .05, 0, hy * .85); var cc = ['90,255,180', '70,200,255', '150,120,255'][b];
        ag.addColorStop(0, 'rgba(' + cc + ',0)'); ag.addColorStop(.45, 'rgba(' + cc + ',.45)'); ag.addColorStop(1, 'rgba(' + cc + ',0)');
        g.fillStyle = ag; g.beginPath(); g.moveTo(0, hy * .9);
        for (var x2 = 0; x2 <= W; x2 += 18 * dpr) g.lineTo(x2, hy * (.3 + b * .1) + Math.sin(x2 / dpr * .009 + tAnim * .7 + b * 1.7) * hy * .12);
        g.lineTo(W, hy * .9); g.fill();
      }
      g.restore();
    }
    // ridges and the far skyline sit on the hill-shifted horizon
    drawMoment(S, 'back');
    var far = xoAt(DRAW * .8) * .12; var hySaved = hy; hy = hyR;
    for (var L = -1; L < 3; L++) { // L = -1 is a faint, slow range far behind the others
      var rc = L < 0 ? mix(S.ridge[0], S.fog, .55) : S.ridge[L];
      var amp = L < 0 ? H * .07 : H * (.05 + L * .012); var base = L < 0 ? hy - H * .03 : hy - H * .008 * (2 - L);
      var rgr = g.createLinearGradient(0, base - amp * 1.1, 0, hy + 6); rgr.addColorStop(0, rc); rgr.addColorStop(.7, rc); rgr.addColorStop(1, mix(rc, mix(S.ground[0], S.fog, .55), .92));
      g.fillStyle = rgr; g.beginPath(); g.moveTo(0, hy + 24 * dpr); // ends under the solid ground, so its edge never shows through the fade
      for (var xx = 0; xx <= W + 8 * dpr; xx += 8 * dpr) { // run past the right edge so the range never ends in a slanted cut
        var q = xx / dpr - far * 40 * (L < 0 ? .12 : .3 + L * .4) + dist * (L < 0 ? .004 : .01 * (L + 1));
        g.lineTo(xx, base - amp * (.5 + .5 * Math.sin(q * .011 + L * 2)) - amp * .4 * Math.sin(q * .027 + L * 5));
      }
      g.lineTo(W, hy + 24 * dpr); g.fill();
      var mg = g.createLinearGradient(0, base - amp * 1.4, 0, hy + 10); mg.addColorStop(0, 'rgba(255,255,255,0)'); mg.addColorStop(.55, mix(S.fog, '#ffffff', .1) + Math.round(S.mist * (.38 - Math.max(L, 0) * .08) * 255).toString(16).padStart(2, '0')); mg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = mg; g.fillRect(0, base - amp * 1.4, W, hy + 10 - (base - amp * 1.4));
    }
    if (S.skyline > .02) {
      g.globalAlpha = S.skyline;
      for (var i2 = 0; i2 < 20; i2++) {
        var bw = W / 20; var bh = H * (.04 + rnd(i2, 3) * .11); var bx = i2 * bw - far * 30;
        g.fillStyle = mix(S.ridge[1], '#ff4f9a', .08); g.fillRect(bx, hy - bh, bw - 2, bh + 2);
        if (S.night > .4) { g.fillStyle = 'rgba(255,224,130,.4)'; for (var k3 = 0; k3 < bh / (9 * dpr); k3++) if (rnd(i2 * 7 + k3, 4) > .5) g.fillRect(bx + 3 * dpr, hy - bh + 3 * dpr + k3 * 9 * dpr, bw - 8 * dpr, 3 * dpr); }
      }
      g.globalAlpha = 1;
    }
    drawWheel(S); drawMoment(S, 'front');
    hy = hySaved;
  }

  function shoreAt(r) { return 1.9 - .86 * bridgeAt(dist + r.d); } // where the water starts, in road half-widths
  // A boat seen from behind and above: hull, cabin and a white wake. kind 0 is a sailboat, 1 a low motor launch
  // (that one fits under the bridge). dir is -1 or 1 for the way it is heading across the screen.
  function drawBoat(x, y, s, kind, dir) {
    g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(x - dir * 34 * s, y + 1 * s, 30 * s, 2.6 * s, 0, 0, TAU); g.fill(); // wake
    g.fillStyle = kind ? '#f2f0ea' : '#c0392b'; g.beginPath(); g.moveTo(x - 22 * s, y - 7 * s); g.lineTo(x + 22 * s, y - 7 * s); g.lineTo(x + (16 + dir * 8) * s, y); g.lineTo(x - (16 - dir * 8) * s, y); g.closePath(); g.fill();
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x - 20 * s, y - 2.6 * s, 40 * s, 2.6 * s);
    if (kind) { g.fillStyle = '#2b4a6f'; g.fillRect(x - 9 * s, y - 14 * s, 18 * s, 7 * s); g.fillStyle = '#9fd2ee'; g.fillRect(x - 7 * s, y - 13 * s, 14 * s, 3 * s); }
    else { g.fillStyle = '#5a4636'; g.fillRect(x - .9 * s, y - 44 * s, 1.8 * s, 37 * s); g.fillStyle = '#f7f3ea'; g.beginPath(); g.moveTo(x + 1.5 * s, y - 43 * s); g.lineTo(x + 1.5 * s, y - 9 * s); g.lineTo(x + (dir > 0 ? 22 : -19) * s, y - 9 * s); g.closePath(); g.fill(); }
  }
  function drawWater(S) {
    var n = rows.length; if (n < 3) return;
    g.save(); g.globalAlpha = clamp(S.water, 0, 1);
    var gw = g.createLinearGradient(0, rows[n - 1].y, 0, H); gw.addColorStop(0, '#8fd0ec'); gw.addColorStop(1, '#2a7fb4');
    g.fillStyle = gw;
    [-1, 1].forEach(function (sd) {
      g.beginPath(); g.moveTo(sd < 0 ? 0 : W, rows[0].y);
      for (var i = 0; i < n; i++) g.lineTo(rows[i].ct + sd * rows[i].hw * shoreAt(rows[i]), rows[i].y);
      g.lineTo(sd < 0 ? 0 : W, rows[n - 1].y); g.closePath(); g.fill();
    });
    g.strokeStyle = 'rgba(255,255,255,' + (.45 + .15 * Math.sin(tAnim * 1.3)) + ')'; g.lineWidth = 2 * dpr;
    [-1, 1].forEach(function (sd) {
      g.beginPath();
      for (var j = 0; j < n; j++) { var r = rows[j]; if (j === 0) g.moveTo(r.ct + sd * r.hw * shoreAt(r), r.y); else g.lineTo(r.ct + sd * r.hw * shoreAt(r), r.y); }
      g.stroke();
    });
    for (var wv = 0; wv < 16; wv++) {
      var wd = (((wv * 19 - tAnim * 6) % 300) + 300) % 300 + 2; var rw = rowAt(wd); rw.d = wd;
      var wa = clamp(rw.p * 1.7, 0, .6) * clamp(S.water, 0, 1) * (1 - wd / 320);
      [-1, 1].forEach(function (sd) {
        var x0 = rw.ct + sd * rw.hw * shoreAt(rw); var x1 = sd < 0 ? 0 : W;
        g.strokeStyle = 'rgba(255,255,255,' + wa + ')'; g.lineWidth = Math.max(1, 2.4 * rw.p * dpr); g.beginPath(); g.moveTo(x0, rw.y);
        for (var si = 1; si <= 10; si++) g.lineTo(x0 + (x1 - x0) * si / 10, rw.y + Math.sin(tAnim * 1.3 + si * 1.2 + wv) * rw.p * 3.5 * dpr);
        g.stroke();
      });
    }
    g.fillStyle = S.sunC;
    for (var q = 0; q < 26; q++) {
      var rj = rows[Math.floor(rnd(q, 61) * (n - 1) * .85)]; var gx = rj.ct + (q % 2 ? 1 : -1) * rj.hw * (2.1 + rnd(q, 62) * 5);
      g.globalAlpha = clamp(S.water, 0, 1) * (.15 + .5 * Math.max(0, Math.sin(tAnim * 1.2 + q * 1.9)));
      g.beginPath(); g.ellipse(gx, rj.y, (4 + rnd(q, 63) * 8) * rj.p * dpr + 1, Math.max(.6, rj.p * 1.6 * dpr), 0, 0, TAU); g.fill();
    }
    g.globalAlpha = clamp(S.water, 0, 1);
    // boats live in the world, so they come towards you and pass like everything else; far ones first
    var boats = [], bn, bd;
    for (bn = Math.floor(dist / 140); bn <= Math.floor((dist + DRAW) / 140); bn++) {
      bd = bn * 140 + rnd(bn, 71) * 60 - dist; if (bd < 6 || bd > DRAW || rnd(bn, 72) < .35) continue;
      var sideB = rnd(bn, 73) < .5 ? -1 : 1; boats.push({ d: bd, lat: sideB * (2.3 + rnd(bn, 74) * 1.6 + Math.sin(tAnim * .05 + bn) * .3), kind: 0, dir: sideB });
    }
    for (bn = Math.floor((dist - 320) / BRIDGE_EVERY); bn <= Math.floor((dist + DRAW - 320) / BRIDGE_EVERY); bn++) {
      var st = bridgeStart(bn); if (st == null) continue; bd = st + BRIDGE_LEN * .5 - dist; if (bd < 2 || bd > DRAW) continue;
      var dirB = bn % 2 ? 1 : -1, ph = ((tAnim * .22 + bn * .37) % 1 + 1) % 1; // the launch crosses under the deck, side to side, every ~4.5 s
      boats.push({ d: bd, lat: dirB * (ph * 7 - 3.5), kind: 1, dir: dirB, under: true });
    }
    boats.sort(function (a, b) { return b.d - a.d; }).forEach(function (bt) {
      var r = rowAt(bt.d), sB = r.p * (W / 230) * 1.35, x = cx + (xoAt(bt.d) + bt.lat - camX) * r.p * RH;
      if (x > -W * .3 && x < W * 1.3) drawBoat(x, r.y + (bt.under ? r.hw * .12 : 0), sB * (bt.kind ? 2.6 : 1.8), bt.kind, bt.dir);
    });
    // the bridge deck's side face and its piers, under the road edge; the road drawn next covers what is behind it
    g.globalAlpha = 1;
    [-1, 1].forEach(function (sd) {
      for (var i = 0; i < n - 1; i++) {
        var a = rows[i], b = rows[i + 1], ba = bridgeAt(dist + a.d), bb = bridgeAt(dist + b.d); if (ba <= 0 && bb <= 0) continue;
        var xa = a.ct + sd * a.hw * 1.02, xb = b.ct + sd * b.hw * 1.02;
        g.fillStyle = mix('#c9c3b6', S.fog, clamp((1 - a.p) * .6, 0, .6));
        g.beginPath(); g.moveTo(xa, a.y); g.lineTo(xb, b.y); g.lineTo(xb, b.y + b.hw * .07 * bb); g.lineTo(xa, a.y + a.hw * .07 * ba); g.closePath(); g.fill();
        if (Math.floor((dist + a.d) / 16) !== Math.floor((dist + b.d) / 16) && ba > .9) { // a pier every 16 m
          g.fillStyle = mix('#8f8a80', S.fog, clamp((1 - a.p) * .6, 0, .6)); g.fillRect(xa - sd * a.hw * .07, a.y, a.hw * .07, a.hw * .2);
        }
      }
    });
    g.restore();
  }

  function drawGround(S) {
    var top = Math.min(hyR, rows.length ? rows[rows.length - 1].y : hy);
    var c0 = mix(S.ground[0], S.fog, .55), feather = 38 * dpr, gy = top + feather * .25;
    var gg = g.createLinearGradient(0, gy, 0, H); // starts where the feather ends, in the same colour, so there is no step
    gg.addColorStop(0, c0); gg.addColorStop(.12, mix(S.ground[0], S.fog, .3)); gg.addColorStop(1, S.ground[1]);
    var fe = g.createLinearGradient(0, top - feather, 0, gy); // eased fade-in: a straight ramp leaves a visible crease at both ends
    [[0, 0], [.25, .06], [.5, .25], [.75, .62], [.9, .88], [1, 1]].forEach(function (st) { fe.addColorStop(st[0], c0 + Math.round(st[1] * 255).toString(16).padStart(2, '0')); });
    g.fillStyle = fe; g.fillRect(0, top - feather, W, gy - (top - feather) + 1);
    g.fillStyle = gg; g.fillRect(0, gy, W, H - gy);
    if (S.water > .03) drawWater(S);
    if (S.snow > .05 && rows.length > 2) { // snow along both edges of the road
      g.fillStyle = 'rgba(244,249,255,' + (.8 * clamp(S.snow, 0, 1)) + ')';
      [-1, 1].forEach(function (sd) {
        g.beginPath(); g.moveTo(rows[0].ct + sd * rows[0].hw, rows[0].y);
        for (var i = 1; i < rows.length; i++) g.lineTo(rows[i].ct + sd * rows[i].hw * (1 + .55 * rows[i].p + .05), rows[i].y);
        for (var j = rows.length - 1; j >= 0; j--) g.lineTo(rows[j].ct + sd * rows[j].hw, rows[j].y);
        g.closePath(); g.fill();
      });
    }
  }

  // The road is drawn as smooth filled shapes (not thin slices), so its edges are anti-aliased
  // and nothing flickers as it scrolls.
  function drawRoad(S) {
    var n = rows.length; if (n < 3) return;
    var rg = g.createLinearGradient(0, rows[n - 1].y, 0, H); rg.addColorStop(0, mix(S.road, S.fog, .55)); rg.addColorStop(1, S.road);
    g.fillStyle = rg; g.beginPath(); g.moveTo(rows[0].ct - rows[0].hw, rows[0].y);
    var i;
    for (i = 1; i < n; i++) g.lineTo(rows[i].ct - rows[i].hw, rows[i].y);
    for (i = n - 1; i >= 0; i--) g.lineTo(rows[i].ct + rows[i].hw, rows[i].y);
    g.closePath(); g.fill();
    g.fillStyle = S.edge;
    [-1, 1].forEach(function (sd) {
      g.beginPath(); g.moveTo(rows[0].ct + sd * rows[0].hw, rows[0].y);
      for (var a = 1; a < n; a++) g.lineTo(rows[a].ct + sd * rows[a].hw, rows[a].y);
      for (var b = n - 1; b >= 0; b--) g.lineTo(rows[b].ct + sd * rows[b].hw * .955, rows[b].y);
      g.closePath(); g.fill();
    });
    var RUM = mix(S.edge, '#000000', .45); g.fillStyle = RUM; // rumble strips: short dark blocks along the edge lines
    [-1, 1].forEach(function (sd) {
      g.beginPath();
      for (var rm = Math.floor(dist / 5); rm * 5 < dist + 40; rm++) { // near only: far away they turn into a jittery dashed line
        var r0 = Math.max(.5, rm * 5 - dist), r1 = rm * 5 + 2.4 - dist; if (r1 < .5) continue; var A = rowAt(r0), B = rowAt(r1);
        g.moveTo(A.ct + sd * A.hw * .955, A.y); g.lineTo(A.ct + sd * A.hw, A.y); g.lineTo(B.ct + sd * B.hw, B.y); g.lineTo(B.ct + sd * B.hw * .955, B.y); g.closePath();
      }
      g.fill();
    });
    // lane dashes: each dash is one smooth shape that follows the curve and the hill
    var LEN = 7; var PER = 16; g.fillStyle = S.line;
    for (var side = -1; side <= 1; side += 2) {
      g.beginPath();
      for (var m = Math.floor(dist / PER); m * PER < dist + DRAW; m++) {
        var s0 = m * PER - dist; var s1 = s0 + LEN; if (s1 < 0) continue; s0 = Math.max(s0, -.4); if (s0 > roadEnd) break; s1 = Math.min(s1, roadEnd);
        var L = []; var R = [];
        for (var j = 0; j <= 6; j++) { var dd = s0 + (s1 - s0) * j / 6; var rw = rowAt(dd); var lw = rw.hw * .02; var c = rw.ct + side * rw.hw / 3; L.push([c - lw, rw.y]); R.push([c + lw, rw.y]); }
        g.moveTo(L[0][0], L[0][1]); for (var k = 1; k <= 6; k++) g.lineTo(L[k][0], L[k][1]); for (var k2 = 6; k2 >= 0; k2--) g.lineTo(R[k2][0], R[k2][1]); g.closePath();
      }
      g.fill();
    }
    [-1, 1].forEach(function (sd) { // bridge railings: a low wall along each edge, a little taller near you
      for (var i = 0; i < n - 1; i++) {
        var a = rows[i], b = rows[i + 1], ba = bridgeAt(dist + a.d), bb = bridgeAt(dist + b.d); if (ba <= 0 && bb <= 0) continue;
        var xa = a.ct + sd * a.hw * 1.02, xb = b.ct + sd * b.hw * 1.02, ha = a.hw * .1 * ba, hb = b.hw * .1 * bb;
        g.fillStyle = mix('#e9e4d8', S.fog, clamp((1 - a.p) * .6, 0, .6));
        g.beginPath(); g.moveTo(xa, a.y); g.lineTo(xb, b.y); g.lineTo(xb, b.y - hb); g.lineTo(xa, a.y - ha); g.closePath(); g.fill();
        g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.moveTo(xa, a.y - ha * .45); g.lineTo(xb, b.y - hb * .45); g.lineTo(xb, b.y - hb * .3); g.lineTo(xa, a.y - ha * .3); g.closePath(); g.fill();
      }
    });
    if (S.rain > .1) { // raindrops land on the road: small rings that open and fade
      g.strokeStyle = 'rgba(220,235,255,1)';
      for (var sp = 0; sp < 34; sp++) {
        var cyc = tAnim * 2.2 + rnd(sp, 81), gen = Math.floor(cyc), ph = cyc - gen, sdd = 2 + rnd(sp * 7 + gen, 82) * 60, srw = rowAt(sdd);
        var sxx = srw.ct + (rnd(sp * 7 + gen, 83) * 2 - 1) * srw.hw * .95, srr = (1.5 + ph * 7) * srw.p * dpr * 2 + 1;
        g.globalAlpha = (1 - ph) * .5 * S.rain; g.lineWidth = Math.max(.7, srw.p * 2 * dpr);
        g.beginPath(); g.ellipse(sxx, srw.y, srr, srr * .32, 0, 0, TAU); g.stroke();
      }
      g.globalAlpha = 1;
    }
    if (S.rain > .1) { // wet road: the sky shows in the surface, brighter in the distance
      var ws = g.createLinearGradient(0, rows[n - 1].y, 0, H); ws.addColorStop(0, mix(S.sky[2], '#ffffff', .15) + Math.round(.12 * S.rain * 255).toString(16).padStart(2, '0')); ws.addColorStop(1, mix(S.sky[1], '#000000', .2) + Math.round(.08 * S.rain * 255).toString(16).padStart(2, '0'));
      g.fillStyle = ws; g.beginPath(); g.moveTo(rows[0].ct - rows[0].hw, rows[0].y);
      for (i = 1; i < n; i++) g.lineTo(rows[i].ct - rows[i].hw, rows[i].y);
      for (i = n - 1; i >= 0; i--) g.lineTo(rows[i].ct + rows[i].hw, rows[i].y);
      g.closePath(); g.fill();
    }
  }

  function objectKind(a, k) { return a.objs[Math.floor(rnd(k, 33) * a.objs.length)]; }

  function drawWorld(S) {
    // collect roadside objects and traffic, draw far to near
    var items = []; var SP = 11;
    var n0 = Math.floor((dist + 6) / SP); var n1 = Math.floor((dist + DRAW) / SP);
    for (var n = n0; n <= n1; n++) {
      for (var sd = -1; sd <= 1; sd += 2) {
        var k = n * 2 + (sd > 0 ? 1 : 0); if (rnd(k, 41) < .12) continue;
        var pos = n * SP + rnd(k, 42) * 6; var d = pos - dist; if (d < 4 || d > DRAW || bridgeAt(pos) > 0) continue;
        var ch = chapterAt(pos); var A = CHAPTERS[ch.idx]; var B = CHAPTERS[(ch.idx + 1) % CHAPTERS.length];
        var use = ch.frac > .88 && rnd(k, 43) < (ch.frac - .88) / .12 ? B : A;
        items.push({ d: d, kind: objectKind(use, k), side: sd, k: k, lat: sd * (1.12 + rnd(k, 44) * .75), lit: Math.max(use.night, S.night * .5), snow: use.snow, S: use });
      }
    }
    for (var pn = Math.floor((dist + 6) / 30); pn <= Math.floor((dist + DRAW) / 30); pn++) for (var ps = -1; ps <= 1; ps += 2) { var pd = pn * 30 - dist; if (pd > 4 && pd < DRAW && !bridgeAt(pn * 30)) items.push({ d: pd, kind: 'post', side: ps, k: pn * 2 + (ps > 0 ? 1 : 0), lat: ps * 1.1, lit: 0 }); }
    var MS = 55;
    for (var mn = Math.floor((dist + 10) / MS); mn <= Math.floor((dist + DRAW) / MS); mn++) {
      for (var ms = -1; ms <= 1; ms += 2) {
        var mk = mn * 2 + (ms > 0 ? 1 : 0) + 500; if (rnd(mk, 51) < .3) continue;
        var md = mn * MS + rnd(mk, 52) * 30 - dist; if (md < 10 || md > DRAW || bridgeAt(md + dist + 0) > 0 || bridgeAt(md + dist + 25) > 0) continue;
        items.push({ d: md, mound: true, lat: ms * (2.4 + rnd(mk, 53) * 3.5), size: 80 + rnd(mk, 54) * 160, k: mk });
      }
    }
    var cn; var ci;
    for (cn = Math.floor(dist / 90); cn <= Math.floor((dist + DRAW) / 90); cn++) {
      var ck = coinChunk(cn); if (!ck || nearStop(ck.start)) continue;
      for (ci = 0; ci < ck.count; ci++) { var cd = ck.start + ci * 7 - dist; var cid = cn * 10 + ci; if (cd > 1.5 && cd < roadEnd && !collected[cid]) items.push({ d: cd, coin: true, lat: ck.lane * LANE, k: cid }); }
    }
    for (var hn = Math.floor(dist / 600); hn <= Math.floor((dist + DRAW) / 600); hn++) {
      var hk = heartChunk(hn); if (!hk || nearStop(hk.at) || collected['h' + hn]) continue;
      var hd = hk.at - dist; if (hd > 1.5 && hd < roadEnd) items.push({ d: hd, heart: true, lat: hk.lane * LANE, k: hn });
    }
    if (tripMode === 'journey') {
      REST_STOPS.concat([JOURNEY_CHAPTERS]).forEach(function (cl, i) { var ad = cl * chapterLen - dist; if (ad > 2 && ad < DRAW) items.push({ d: ad, arch: true, finish: i === REST_STOPS.length }); });
    }
    traffic.forEach(function (c) { var d = c.z - dist; if (d > 1 && d < Math.min(DRAW, roadEnd + 4)) items.push({ d: d, car: c }); });
    items.sort(function (a, b) { return b.d - a.d; });
    var rockC = mix(S.ground[1], '#7a6a5a', .5);
    var S2 = { night: S.night, rockC: rockC };
    nearItems = []; var drawItem = function (it) {
      var rw = rowAt(it.d); var p = rw.p; var y = rw.y;
      if (it.arch) {
        var as = p * (W / 230) * 1.35; var ac = xoAt(it.d); var ax0 = cx + (ac - 1.12 - camX) * p * RH; var ax1 = cx + (ac + 1.12 - camX) * p * RH; var ah = 96 * as;
        g.fillStyle = '#2a3350'; g.fillRect(ax0 - 4 * as, y - ah, 8 * as, ah); g.fillRect(ax1 - 4 * as, y - ah, 8 * as, ah);
        g.fillStyle = it.finish ? '#f4f1ea' : '#1f2a44'; g.fillRect(ax0 - 6 * as, y - ah - 22 * as, ax1 - ax0 + 12 * as, 24 * as);
        if (it.finish) { g.fillStyle = '#111'; var sq = 8 * as; for (var qx = 0; qx * sq < ax1 - ax0 + 12 * as; qx++) for (var qy = 0; qy < 3; qy++) if ((qx + qy) % 2 === 0) g.fillRect(ax0 - 6 * as + qx * sq, y - ah - 22 * as + qy * sq, sq, sq); }
        else { g.fillStyle = '#ffd166'; g.font = '800 ' + (13 * as) + 'px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('REST STOP', (ax0 + ax1) / 2, y - ah - 5 * as); }
        if (S.night > .4) { glowDot(ax0, y - ah - 10 * as, 22 * as, '#ffd98a'); glowDot(ax1, y - ah - 10 * as, 22 * as, '#ffd98a'); }
        return;
      }
      if (it.heart) {
        var hx = cx + (xoAt(it.d) + it.lat - camX) * p * RH; var hs = p * (W / 230) * 1.35; var hy2 = y - (16 + Math.sin(tAnim * 3) * 2) * hs;
        glowDot(hx, hy2, 24 * hs, '#ff6b8a'); g.fillStyle = '#ff4d73'; g.beginPath(); g.moveTo(hx, hy2 + 9 * hs); g.bezierCurveTo(hx - 16 * hs, hy2 - 2 * hs, hx - 9 * hs, hy2 - 14 * hs, hx, hy2 - 6 * hs); g.bezierCurveTo(hx + 9 * hs, hy2 - 14 * hs, hx + 16 * hs, hy2 - 2 * hs, hx, hy2 + 9 * hs); g.fill();
        g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.ellipse(hx - 5 * hs, hy2 - 5 * hs, 2.5 * hs, 1.6 * hs, -.6, 0, TAU); g.fill();
        return;
      }
      if (it.coin) {
        var kx = cx + (xoAt(it.d) + it.lat - camX) * p * RH; var cs = p * (W / 230) * 1.35; var cr = 8 * cs; var cw = Math.max(.15, Math.abs(Math.cos(tAnim * 3 + it.k * .6))) * cr; var cy = y - 14 * cs;
        glowDot(kx, cy, cr * 2.2, '#ffd166');
        var cg = g.createLinearGradient(kx - cw, cy - cr, kx + cw, cy + cr); cg.addColorStop(0, '#fff2a8'); cg.addColorStop(.5, '#ffc933'); cg.addColorStop(1, '#c98a10');
        g.fillStyle = cg; g.beginPath(); g.ellipse(kx, cy, cw, cr, 0, 0, TAU); g.fill(); g.strokeStyle = '#b87a0c'; g.lineWidth = Math.max(1, cs * .8); g.stroke();
        return;
      }
      if (it.mound) {
        var mx = cx + (xoAt(it.d) + it.lat - camX) * p * RH; var mw = it.size * p * (W / 230) * 1.35; var mh = mw * (.26 + rnd(it.k, 55) * .16);
        var mg = g.createLinearGradient(0, y - mh, 0, y); var fogT = clamp((1 - p) * .5, 0, .5);
        mg.addColorStop(0, mix(mix(S.ground[0], '#ffffff', .07), S.fog, fogT)); mg.addColorStop(1, mix(S.ground[0], S.fog, fogT));
        g.fillStyle = mg; g.beginPath(); g.ellipse(mx, y, mw, mh, 0, Math.PI, 0); g.fill();
        return;
      }
      if (it.car) {
        var c = it.car; var x = cx + (xoAt(it.d) + (c.laneF + (c.knock || 0) * (c.kx || 0)) * LANE - camX) * p * RH; var w = p * RH * LANE * BODY;
        if (S.night > .5) { glowDot(x, y, w * .7, '#ff2a4a'); }
        if (S.rain > .3) { var spg = g.createRadialGradient(x, y, 0, x, y, w * .75); spg.addColorStop(0, 'rgba(215,228,245,' + (.32 * S.rain) + ')'); spg.addColorStop(1, 'rgba(215,228,245,0)'); g.fillStyle = spg; g.beginPath(); g.ellipse(x, y - w * .05, w * .75, w * .22, 0, 0, TAU); g.fill(); } // spray off the tyres
        if (c.hurt > 0) { glowDot(x, y - w * .3, w * 1.1, Math.sin(tAnim * 40) > 0 ? '#ff3b3b' : '#ffb347'); g.globalAlpha = clamp(c.hurt * 1.6, .25, 1); }
        carRear(x, y, w, c.col, c.kind, { type: TYPE_OF[c.kind], brake: false, rot: c.rot, reflect: S.rain, spin: c.tread || 0, tail: '#ff3a3a', under: S.night > .85 ? c.col : null });
        g.globalAlpha = 1;
        if (!c.knock) {
          var tw = w * (TYPE_W[TYPE_OF[c.kind]] || 1);
          if (c.lc && c.lc.t < .8 && Math.sin(tAnim * 16) > 0) glowDot(x + Math.sign(c.lc.to - c.lc.from) * tw * .44, y - tw * .3, tw * .16, '#ffb000'); // indicator
          if (Math.sin(tAnim * 1.3 + c.id * 5.1) > .93 || (c.lc && c.lc.t < 0)) { glowDot(x - tw * .3, y - tw * .32, tw * .17, '#ff2a3a'); glowDot(x + tw * .3, y - tw * .32, tw * .17, '#ff2a3a'); } // brake lights
        }
        return;
      }
      var s = p * (W / 230) * 1.35; var x2 = cx + (xoAt(it.d) + it.lat - camX) * p * RH;
      if (x2 < -W * .3 || x2 > W * 1.3) return;
      var sway = Math.sin(tAnim * 2.4 + it.k * 1.7) * S.wind * s * 3;
      drawObj(it.kind, x2, y, s, it.k, S2, sway, it.lit);
    };
    drawNear = function () { nearItems.forEach(drawItem); };
    items.forEach(function (it) { if (it.d >= PD) drawItem(it); else nearItems.push(it); }); // what is closer than the player is drawn after the player
  }
  var nearItems = [], drawNear = function () {};

  // The player is a normal road object at PD metres ahead of the camera, so it follows the bends and
  // hills exactly like traffic does. Contact with traffic is tested at the same depth.
  function playerBox() { var r = rowAt(PD); return { x: r.ct + lane * LANE * r.hw, y: r.y, w: r.hw * LANE * BODY }; }
  function drawPlayer(S) {
    var pb = playerBox(); var py = pb.y + (susp.y - pitch * 2.5) * dpr; var pw = pb.w; var tilt = clamp(roll.y, -.17, .17);
    if (S.rain > .3) { var psg = g.createRadialGradient(pb.x, py, 0, pb.x, py, pw * .8); psg.addColorStop(0, 'rgba(215,228,245,' + (.3 * S.rain * clamp(speed / 30, .3, 1)) + ')'); psg.addColorStop(1, 'rgba(215,228,245,0)'); g.fillStyle = psg; g.beginPath(); g.ellipse(pb.x, py - pw * .02, pw * .85, pw * .2, 0, 0, TAU); g.fill(); } // spray off your own tyres
    if (S.night > .5 || S.rain > .3) {
      var px = pb.x;
      g.save(); g.globalCompositeOperation = 'lighter'; g.translate(px, py - pw * .5); g.scale(1, 3.4);
      var hl = g.createRadialGradient(0, 0, 0, 0, 0, W * .26); hl.addColorStop(0, 'rgba(255,244,200,.34)'); hl.addColorStop(1, 'rgba(255,244,200,0)');
      g.fillStyle = hl; g.beginPath(); g.arc(0, 0, W * .26, 0, TAU); g.fill(); g.restore();
    }
    var x = pb.x; lastPB = { x: x, y: py, w: pw };
    g.save(); g.translate(x, py); g.transform(1, 0, -tilt, 1, 0, 0);
    var pc = PLAYER_CARS[prefs.car];
    carRear(0, 0, pw, pc.col, 'sport', { type: prefs.car, acc: pc.acc, px: 420, brake: braking, reflect: S.rain, spin: tread, under: S.night > .6 ? '#35e6ff' : null, tail: '#ff3355' });
    g.restore();
    if (shieldT > 0) {
      var sa = shieldT < .8 ? (Math.sin(tAnim * 30) > 0 ? .5 : .15) : .45;
      g.save(); g.translate(x, py - pw * .18); g.globalAlpha = sa;
      var sgr = g.createRadialGradient(0, 0, pw * .1, 0, 0, pw * .62); sgr.addColorStop(0, 'rgba(120,220,255,0)'); sgr.addColorStop(1, 'rgba(120,220,255,.9)');
      g.fillStyle = sgr; g.beginPath(); g.ellipse(0, 0, pw * .62, pw * .45, 0, 0, TAU); g.fill(); g.restore();
    }
  }

  // Petals and leaves are real things in the air beside the road: each has a distance ahead, a side
  // position and a height. The car drives through them, the wind carries them across, they fall
  // and flutter (a petal shows its face, then its edge). Far ones are drawn behind the car, near
  // ones in front, and they fade with the scene instead of popping in and out.
  var FLURRY_N = 30, flurry = [];
  // Petals and leaves drift down beside the road, carried by the wind. They move with the air, not with the ground,
  // so they slide past gently instead of rushing at the screen, and they never fall across the road or the car.
  function seedFlake(f, far) {
    var sd = Math.random() < .5 ? -1 : 1;
    f.d = far ? 25 + Math.random() * 50 : 8 + Math.random() * 67; f.lat = sd * (1.12 + Math.random() * 1.1); f.h = .2 + Math.random() * .9;
    f.fall = .06 + Math.random() * .1; f.ph = Math.random() * TAU; f.flip = 1.6 + Math.random() * 2.4; f.size = .8 + Math.random() * .5; f.c = Math.random(); f.spin = (Math.random() - .5) * 2; return f;
  }
  function stepFlurry(dt, S) {
    var amt = Math.max(S.petals, S.leaves); if (amt < .02) { flurry.length = 0; return; }
    while (flurry.length < FLURRY_N) flurry.push(seedFlake({}, false));
    var v = (mode === 'run' ? speed : mode === 'menu' ? 20 : 0) * .3, wind = S.wind; // the air moves with you, so they pass at a third of your speed
    flurry.forEach(function (f) {
      f.ph += f.flip * dt; f.d -= v * dt;
      f.lat += Math.sign(f.lat) * (wind * .12 + Math.sin(f.ph * .7) * .18) * dt; f.h -= f.fall * (1 + .5 * Math.sin(f.ph)) * dt;
      if (f.d < 2 || f.h < 0 || Math.abs(f.lat) > 2.6 || Math.abs(f.lat) < 1.05) seedFlake(f, true);
    });
  }
  function drawFlurry(S, far) {
    var amt = Math.max(S.petals, S.leaves); if (amt < .02 || !flurry.length) return;
    var petal = S.petals >= S.leaves, cols = petal ? [['#ff8fb8', '#ffd3e4'], ['#f772a6', '#ffc2da'], ['#ffa8c8', '#fff0f6']] : [['#d9822b', '#f2b45a'], ['#b5462a', '#e07a4a'], ['#c99a2e', '#f0cf6a']];
    var amtN = FLURRY_N * clamp(amt / (petal ? 1.6 : 1), 0, 1);
    for (var i = 0; i < FLURRY_N && i < amtN; i++) {
      var f = flurry[i]; if ((f.d >= PD) !== far || f.d > DRAW) continue;
      var r = rowAt(f.d), x = cx + (xoAt(f.d) + f.lat - camX) * r.p * RH, y = r.y - f.h * r.hw;
      var rad = clamp((petal ? .05 : .055) * f.size * r.hw, 3 * dpr, 11 * dpr), face = .25 + .75 * Math.abs(Math.cos(f.ph)), cc = cols[Math.floor(f.c * cols.length)];
      g.globalAlpha = clamp(amtN - i, 0, 1) * clamp((120 - f.d) / 30, 0, 1);
      g.save(); g.translate(x, y); g.rotate(f.ph * .35 * f.spin + (petal ? 0 : .6)); g.scale(1, face);
      g.fillStyle = cc[0]; g.beginPath();
      if (petal) { // a cherry petal: rounded, with a small notch at the tip
        g.moveTo(0, rad); g.bezierCurveTo(-rad * 1.1, rad * .4, -rad * .9, -rad * .9, -rad * .2, -rad); g.lineTo(0, -rad * .7); g.lineTo(rad * .2, -rad); g.bezierCurveTo(rad * .9, -rad * .9, rad * 1.1, rad * .4, 0, rad);
      } else { g.moveTo(0, -rad * 1.2); g.quadraticCurveTo(rad * .9, 0, 0, rad * 1.2); g.quadraticCurveTo(-rad * .9, 0, 0, -rad * 1.2); } // a leaf: pointed at both ends
      g.fill(); g.strokeStyle = petal ? 'rgba(170,40,90,.35)' : 'rgba(80,40,20,.3)'; g.lineWidth = Math.max(.6, rad * .08); g.stroke();
      g.fillStyle = cc[1]; g.beginPath(); g.ellipse(-rad * .15, -rad * .2, rad * .35, rad * .5, 0, 0, TAU); g.fill(); // light side
      if (!petal) { g.strokeStyle = 'rgba(80,40,20,.45)'; g.lineWidth = Math.max(.6, rad * .1); g.beginPath(); g.moveTo(0, -rad * 1.1); g.lineTo(0, rad * 1.5); g.stroke(); }
      g.restore();
    }
    g.globalAlpha = 1;
  }
  function drawWeather(S) {
    if (skyT > 0) { var sa = skyT / .7; g.fillStyle = 'rgba(210,220,255,' + (.11 * sa * (Math.sin(skyT * 40) > 0 ? 1 : .45)) + ')'; g.fillRect(0, 0, W, hyR); }
    if (lightningT > 0) {
      var la = lightningT / .4;
      g.fillStyle = 'rgba(235,242,255,' + (.45 * la * (Math.sin(lightningT * 60) > -.3 ? 1 : .4)) + ')'; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(245,248,255,' + la + ')'; g.lineWidth = 3 * dpr; g.beginPath(); var bx0 = W * (.3 + rnd(Math.floor(tAnim), 91) * .4); g.moveTo(bx0, 0);
      for (var bi = 1; bi < 8; bi++) g.lineTo(bx0 + (rnd(bi + Math.floor(tAnim), 92) - .5) * 60 * dpr, bi * hy / 8); g.stroke();
    }
    if (flashT > 0 && (mode === 'run' || mode === 'over')) { g.fillStyle = 'rgba(255,60,60,' + (.28 * flashT / .35) + ')'; g.fillRect(0, 0, W, H); }
    // Rain and snow come in three depths: many small slow drops far away, a few big fast ones close by. Streaks grow
    // with speed and lean with the wind and with the lane change.
    var sp = mode === 'run' ? clamp(speed / 40, 0, 1.6) : .4, lean = clamp(-laneV * .05, -.25, .25) - .22 - S.wind * .03;
    if (S.rain > .05) {
      [[26, 9, 800, .2, 1], [16, 15, 1250, .3, 1.4], [6, 24, 1900, .42, 2]].forEach(function (Ly, li) {
        var n = Math.round(Ly[0] * S.rain), len = Ly[1] * (1 + .5 * sp) * dpr;
        var rgd = g.createLinearGradient(0, 0, 0, H); rgd.addColorStop(0, 'rgba(205,228,255,0)'); rgd.addColorStop(.3, 'rgba(205,228,255,' + (Ly[3] * .45 * S.rain) + ')'); rgd.addColorStop(1, 'rgba(205,228,255,' + (Ly[3] * .8 * S.rain) + ')');
        g.strokeStyle = rgd; g.lineWidth = Ly[4] * .8 * dpr; g.lineCap = 'round'; g.beginPath();
        for (var i = 0; i < n; i++) { var x = rnd(i + li * 77, 1) * W; var y = ((rnd(i + li * 77, 2) * H + tAnim * Ly[2] * dpr) % H); g.moveTo(x, y); g.lineTo(x + lean * len, y + len); }
        g.stroke();
      });
      g.fillStyle = 'rgba(15,22,40,' + (.05 * S.rain) + ')'; g.fillRect(0, 0, W, H);
    }
    if (S.snow > .05) {
      g.fillStyle = '#fff';
      [[34, 1.3, 70, .35], [18, 2.4, 130, .5], [7, 4.4, 210, .65]].forEach(function (Ly, li) {
        var n = Math.round(Ly[0] * S.snow);
        for (var j = 0; j < n; j++) {
          var k = j + li * 91, x = (rnd(k, 1) * W + Math.sin(tAnim * (1 + li * .4) + k) * (10 + li * 8) * dpr - lean * 60 * dpr * li) % W, y = (rnd(k, 2) * H + tAnim * Ly[2] * dpr * (.7 + rnd(k, 4) * .6)) % H;
          g.globalAlpha = Ly[3] * (.6 + rnd(k, 3) * .4) * clamp(S.snow, 0, 1); g.beginPath(); g.arc(x < 0 ? x + W : x, y, Ly[1] * (.8 + rnd(k, 3) * .5) * dpr, 0, TAU); g.fill();
        }
      });
      g.globalAlpha = 1;
    }
    if (S.heat > .05) { // heat haze: a soft warm glow just above the ground, no hard edges (bars read as lines)
      var hz = g.createLinearGradient(0, hyR - 20 * dpr, 0, hyR + 90 * dpr); hz.addColorStop(0, 'rgba(255,236,200,0)'); hz.addColorStop(.45, 'rgba(255,236,200,' + (.16 * S.heat) + ')'); hz.addColorStop(1, 'rgba(255,236,200,0)');
      g.fillStyle = hz; g.fillRect(0, hyR - 20 * dpr, W, 110 * dpr);
    }
    if (S.night > .25 && S.rain < .3 && S.snow < .3) { // fireflies
      for (var ff = 0; ff < 16; ff++) {
        var fx = rnd(ff, 1) * W + Math.sin(tAnim * .6 + ff) * 30 * dpr; var fy = hy + (H - hy) * (.25 + rnd(ff, 2) * .45) + Math.cos(tAnim * .5 + ff) * 20 * dpr;
        g.globalAlpha = clamp(S.night, 0, 1) * (.35 + .5 * Math.max(0, Math.sin(tAnim * 1.3 + ff * 2))); glowDot(fx, fy, 9 * dpr, '#d8ff7a');
      }
      g.globalAlpha = 1;
    }
    // fog band at the horizon
    var fg = g.createLinearGradient(0, hyR - H * .06, 0, hyR + H * .28);
    fg.addColorStop(0, S.fog + '00'); fg.addColorStop(.3, S.fog + 'ff'); fg.addColorStop(1, S.fog + '00');
    g.globalAlpha = .3 + S.mist * .15; g.fillStyle = fg; // thinner: a heavy band read as a milky stripe across the screen g.fillRect(0, hyR - H * .06, W, H * .34); g.globalAlpha = 1;
    // tint, light vignette
    g.fillStyle = S.tintC; g.globalAlpha = S.tintA; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
    var vg = g.createRadialGradient(cx, H * .55, W * .35, cx, H * .55, W * .95);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,' + (.25 + S.night * .3) + ')');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
  }

  // Thin streaks that fly outwards from the vanishing point, only at high speed and only near the edges.
  function drawSpeedLines() {
    var sn = clamp((speed - 28) / 14, 0, 1); if (sn <= 0 || mode !== 'run') return;
    var n = rows.length; if (n < 3) return;
    g.save(); g.beginPath(); g.rect(0, 0, W, H); // keep the streaks off the road and the cars: clip the road out
    g.moveTo(rows[0].ct - rows[0].hw * 1.06, rows[0].y); for (var i = 1; i < n; i++) g.lineTo(rows[i].ct - rows[i].hw * 1.06, rows[i].y);
    for (i = n - 1; i >= 0; i--) g.lineTo(rows[i].ct + rows[i].hw * 1.06, rows[i].y); g.closePath(); g.clip('evenodd');
    g.lineCap = 'round';
    for (var k = 0; k < 22; k++) {
      var side = k % 2 ? 1 : -1, ph = (tAnim * (.9 + rnd(k, 32) * .8) + rnd(k, 33)) % 1, r = rows[Math.min(n - 1, Math.floor((1 - ph * ph) * (n - 1)))];
      var lat = side * (1.25 + rnd(k, 31) * 1.9), x0 = r.ct + lat * r.hw, y0 = r.y, x1 = r.ct + lat * r.hw * 1.12, y1 = y0 + (H - y0) * .07 * (.4 + ph);
      var lg = g.createLinearGradient(x0, y0, x1, y1); lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(1, 'rgba(255,248,230,' + (.34 * sn * Math.sin(ph * Math.PI)) + ')');
      g.strokeStyle = lg; g.lineWidth = Math.max(1, r.p * 3.2 * dpr); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    }
    g.restore();
  }
  // Debug overlay (?debug=1&boxes=1): the boxes the game uses for contact, and a few numbers.
  function drawBoxes() {
    var pb = playerBox(), pw = pb.w * (TYPE_W[prefs.car] || 1), ph = pb.w * .55;
    g.save(); g.lineWidth = 2 * dpr; g.font = (11 * dpr) + 'px monospace'; g.fillStyle = '#fff';
    g.strokeStyle = '#34e39c'; g.strokeRect(pb.x - pw / 2, pb.y - ph, pw, ph);
    traffic.forEach(function (c) {
      var d = c.z - dist; if (d < 1 || d > 200) return; var r = rowAt(d), w = r.hw * LANE * BODY * (TYPE_W[TYPE_OF[c.kind]] || 1), x = r.ct + c.laneF * LANE * r.hw, hot = d - PD < HIT_AHEAD && d - PD > -HIT_BEHIND;
      g.strokeStyle = hot ? '#ff3b3b' : '#ffd166'; g.strokeRect(x - w / 2, r.y - w * .55, w, w * .55);
      g.fillText('L' + c.laneF.toFixed(1) + ' d' + Math.round(d), x - w / 2, r.y - w * .6);
    });
    g.fillText('lane ' + lane.toFixed(2) + ' v ' + laneV.toFixed(2) + ' speed ' + (speed * 3.6).toFixed(0) + ' shield ' + shieldT.toFixed(1) + ' lives ' + lives, 8 * dpr, H - 8 * dpr);
    g.restore();
  }
  function drawParticles(behind) {
    particles.forEach(function (p) {
      if (!!p.behind !== !!behind) return;
      g.globalAlpha = clamp(p.life, 0, 1); g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, p.r * dpr, 0, TAU); g.fill();
    });
    g.globalAlpha = 1;
  }

  function render() {
    resize();
    hy = H * .4; cx = W / 2; RH = W * (.9 + .035 * clamp((speed - 23) / 20, 0, 1)); camX = lane * LANE * .75; // the view widens a little with speed
    ES = H * .02; e0 = elev(dist);
    buildCurve();
    hyR = hy - (elev(dist + DRAW * .8) - e0) * pOf(DRAW * .8) * ES * .7;
    buildRows();
    var S = sceneAt(dist);
    g.save();
    if (Math.abs(camRoll) > 1.2e-3) { // bank the whole view about its centre; a small zoom keeps the corners covered
      var rk = Math.cos(camRoll) + Math.max(H / W, W / H) * Math.abs(Math.sin(camRoll));
      g.translate(W / 2, H / 2); g.rotate(camRoll); g.scale(rk, rk); g.translate(-W / 2, -H / 2);
    }
    if (shake > 0) g.translate((Math.random() - .5) * shake * dpr, (Math.random() - .5) * shake * dpr);
    drawSky(S); drawGround(S); drawRoad(S); drawWorld(S); drawFlurry(S, true); drawParticles(true); drawPlayer(S); drawNear(); drawSpeedLines(); drawWeather(S); drawFlurry(S, false); drawParticles(false);
    if (BOXES) drawBoxes();
    g.restore();
    return S;
  }

  // ---------- audio ----------
  var A = window.RacerAudio ? window.RacerAudio.create({
    AudioContext: window.AudioContext || window.webkitAudioContext,
    vibrate: window.navigator.vibrate ? window.navigator.vibrate.bind(window.navigator) : null,
    setInterval: window.setInterval.bind(window), clearInterval: window.clearInterval.bind(window)
  }) : null;
  function au(fn, a, b) { if (A && typeof A[fn] === 'function') { try { return A[fn](a, b); } catch (e) { return undefined; } } return undefined; }
  function audioPrefs() {
    au('setPrefs', {
      music: prefs.music === 'on', sfx: prefs.sfx === 'on', style: prefs.style, volMusic: prefs.volMusic / 100, volFx: prefs.volFx / 100, volEngine: prefs.volEngine / 100, bass: prefs.bass / 100,
      calm: prefs.calm === 'on', car: prefs.car, sound: appChoice('sound') === 'on', haptics: appChoice('haptics') === 'on'
    });
  }
  audioPrefs();

  // ---------- HUD ----------
  var elDist = $('dist'); var elSpd = $('spd'); var elNear = $('near'); var elHearts = $('hearts'); var elCoins = $('coinc');
  var elChapter = $('chapter'); var elChNum = $('ch-num'); var elChName = $('ch-name'); var elTrip = $('trip'); var elFill = $('trip-fill'); var elDots = $('trip-dots'); var elTripLabel = $('trip-label');
  var cache = {};
  function setText(el, key, v) { if (cache[key] !== v) { cache[key] = v; el.textContent = v; } }
  function hearts() { var s = ''; var i; for (i = 0; i < lives; i++) s += '♥'; for (i = lives; i < maxLives; i++) s += '♡'; return s; }
  function hud() {
    setText(elDist, 'd', String(Math.floor(score)));
    setText(elSpd, 's', String(Math.round(speed * 3.6)));
    setText(elHearts, 'h', hearts());
    setText(elCoins, 'c', '● ' + run.coins);
    var showTrip = tripMode === 'journey' && mode === 'run';
    elTrip.hidden = !showTrip;
    if (showTrip) {
      var tot = JOURNEY_CHAPTERS * chapterLen;
      elFill.style.width = clamp(dist / tot * 100, 0, 100).toFixed(1) + '%';
      var sec = secondsLeft(dist), mins = Math.round(sec / 60);
      setText(elTripLabel, 'tl', 'Chapter ' + Math.min(JOURNEY_CHAPTERS, chapterAt(dist).i + 1) + ' of ' + JOURNEY_CHAPTERS + '  \u00b7  ' + (sec < 75 ? 'under a minute and a half left' : 'about ' + mins + ' min left'));
    }
  }
  function buildTrip() {
    elDots.textContent = '';
    var total = JOURNEY_CHAPTERS * chapterLen;
    REST_STOPS.concat([JOURNEY_CHAPTERS]).forEach(function (cl, i) {
      var d = document.createElement('i'); d.className = i === REST_STOPS.length ? 'f' : 'r'; d.style.left = (cl * chapterLen / total * 100) + '%'; elDots.appendChild(d);
    });
  }
  function showChapter(num, name) { elChNum.textContent = num; elChName.textContent = name; elChapter.classList.add('show'); chTimer = 3.2; }
  function showNear(text) { elNear.textContent = text; elNear.classList.add('show'); nearTimer = .9; }

  // ---------- results, stats and checkpoints ----------
  function endRun(finished) {
    stats.runs += 1; stats.near += run.near; stats.nearBest = Math.max(stats.nearBest, run.comboMax || 0); stats.coins += run.coins;
    stats.maxChapter = Math.max(stats.maxChapter, chapterAt(dist).i); stats.bestDistance = Math.max(stats.bestDistance, Math.floor(dist));
    if (finished) { stats.journeys += 1; if (run.hits === 0) stats.noHitJourneys += 1; }
    saveStats();
  }
  function clearCheckpoint() { try { window.localStorage.removeItem(CHECK_KEY); } catch (e) { /* fine */ } }
  // A checkpoint keeps the last rest stop (chapter) and, while you drive, the exact place you left (frac of the Journey).
  // Closing the app brings you back to that place; losing your last heart sends you back to the last rest stop.
  var restCh = 0, saveT = 8, countT = 0;
  function saveCheckpoint(chapter, frac) { var o = { v: 1, mode: 'journey', difficulty: prefs.difficulty, length: prefs.length, chapter: chapter, lives: lives, score: Math.floor(score), at: Date.now() }; if (frac != null) o.frac = frac; writeJson(CHECK_KEY, o); }
  function savePlace() { if (mode === 'run' && tripMode === 'journey' && !keepOn && dist > 300 && dist < journeyLen() - 200) saveCheckpoint(restCh, dist / journeyLen()); }

  var ovTitle = $('ov-title'); var ovSub = $('ov-sub'); var ovStats = $('ov-stats'); var optsBox = $('opts'); var playBtn = $('play'); var contBtn = $('cont');
  function showOverlay(kind, o) {
    o = o || {};
    ovTitle.textContent = o.title || 'Cruise'; ovSub.textContent = o.sub || '';
    ovStats.textContent = '';
    (o.stats || []).forEach(function (r) { var d = document.createElement('div'); var a = document.createElement('span'); a.textContent = r[0]; var b = document.createElement('b'); b.textContent = r[1]; d.appendChild(a); d.appendChild(b); ovStats.appendChild(d); });
    ovStats.hidden = !(o.stats && o.stats.length);
    optsBox.hidden = kind !== 'menu';
    playBtn.textContent = kind === 'menu' ? 'Play' : 'Play again';
    $('keep').hidden = kind !== 'done';
    var cp = tripMode === 'journey' || kind === 'menu' ? getCheckpoint() : null;
    contBtn.hidden = !cp; if (cp) contBtn.textContent = 'Continue: chapter ' + (cp.chapter + 1) + '  ' + new Array(cp.lives + 1).join('♥');
    $('ov').setAttribute('data-kind', kind); $('ov').hidden = false;
    $('menu-btn').hidden = kind === 'menu';
  }
  function gameOver() {
    mode = 'over'; speed = 0; shake = 18; flashT = .5; braking = false;
    burst(cx, H * .8, 40, ['#ffb347', '#ff6b4a', '#ffd166', '#888']);
    au('event', 'crash'); au('stop');
    if (tripMode === 'journey' && !keepOn) { if (restCh >= 1) saveCheckpoint(restCh); else clearCheckpoint(); } // a lost run restarts from the last rest stop
    endRun(false);
    var s = Math.floor(score); var isBest = submitBest(s);
    window.setTimeout(function () {
      if (mode !== 'over') return;
      showOverlay('over', { title: 'Crash', sub: isBest ? 'New best!' : 'Best ' + getBest(), stats: [['Distance', Math.floor(dist) + ' m'], ['Score', String(s)], ['Reached', 'Chapter ' + Math.min(JOURNEY_CHAPTERS, chapterAt(dist).i + 1) + ' of ' + JOURNEY_CHAPTERS], ['Coins', String(run.coins)], ['Close calls', String(run.near)], ['Bumps', String(run.hits)]] });
    }, 700);
  }
  function finishJourney() {
    mode = 'done'; braking = false; score += lives * 100; flashT = 0;
    au('event', 'finish'); au('stop');
    endRun(true); clearCheckpoint();
    var s = Math.floor(score); var isBest = submitBest(s);
    burst(cx, H * .5, 50, ['#ffd166', '#ff9ab0', '#9fe9ff', '#fff']);
    window.setTimeout(function () {
      if (mode !== 'done') return;
      showOverlay('done', { title: 'You made it', sub: (isBest ? 'New best. ' : '') + 'Sunrise Coast reached. The road does not have to end.', stats: [['Distance', Math.floor(dist) + ' m'], ['Score', String(s)], ['Lives left', hearts()], ['Coins', String(run.coins)], ['Close calls', String(run.near)], ['Bumps', String(run.hits)]] });
    }, 1400);
  }
  // After the finish the player can carry on: Endless keeps the speed near the top and the chapters cycle.
  function keepDriving() {
    keepOn = true; applyTrip(); mode = 'run'; $('ov').hidden = true; traffic = []; nextSpawn = dist + 260; lives = maxLives; shieldT = 3; braking = false; paused = false; last = null;
    run = { near: 0, coins: 0, hits: 0 }; collected = {}; lastChapter = -1; au('unlock'); audioPrefs(); au('setChapter', chapterAt(dist).idx); au('start'); hud();
  }
  function bump(hit) {
    run.hits += 1; lives -= 1; combo = 0; comboTimer = 0;
    if (hit) { hit.knock = hit.lane === 0 ? (rand() < .5 ? -1 : 1) : hit.lane; hit.kx = 0; hit.hurt = 1.1; hit.v = Math.min(hit.v, speed * .5); laneV += (lane >= hit.laneF ? 1 : -1) * 4.5; } // the knock shoves you sideways; the steering spring brings you back
    if (lives <= 0) { gameOver(); return; }
    shieldT = DIFFS[prefs.difficulty].shield; shake = 12; flashT = .35; calmUntil = dist + 500;
    traffic = traffic.filter(function (c) { var d = c.z - dist; return c === hit || d > 90 || d < PD - 4; }); // the road ahead clears so you can recover, except the car you hit
    nextSpawn = Math.max(nextSpawn, dist + 120);
    burst(cx, H * .8, 14, ['#ffb347', '#ffd166']);
    au('event', 'bump');
  }

  // ---------- loop ----------
  var last = null; var lastScene = null; var sceneTick = 0;
  function burst(x, y, n, cols) {
    for (var i = 0; i < n; i++) { var a = Math.random() * TAU; var v = 40 + Math.random() * 220; particles.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: 1, r: 2 + Math.random() * 3, c: cols[i % cols.length] }); }
  }
  // A few cars far ahead signal for a moment, then slide into the next lane if it is clear.
  // While changing, a car counts as being in both lanes, so a lane is never left without a gap.
  // Weather and ground react to the car: spray in rain, snow kicked up, dust on the desert road, leaves in autumn.
  function emitRoadParticles(dt, S) {
    var B = lastPB, rate = 0, col, vy, gv = 40, life = .6, r = 2.5, grow = 8, kind = null;
    if (S.rain > .2) { rate = 46 * S.rain; col = 'rgba(225,238,255,.42)'; kind = 'spray'; }
    else if (S.snow > .3) { rate = 26 * S.snow; col = 'rgba(255,255,255,.55)'; kind = 'snow'; }
    else if (S.heat > .5) { rate = 24 * S.heat; col = 'rgba(214,182,126,.36)'; kind = 'dust'; r = 3; grow = 14; }
    // no leaves kicked up off the road: from behind they read as dirt specks
    if (Math.abs(laneV) > 1.6 && speed > 24 && Math.random() < dt * 34) { // tyres squeal through a quick lane change: a thin puff off the loaded side
      var side = laneV > 0 ? -1 : 1;
      particles.push({ behind: true, x: B.x + side * B.w * .36, y: B.y + 5 * dpr, vx: side * (10 + Math.random() * 30), vy: -(10 + Math.random() * 30), life: 1, r: 2.2, c: 'rgba(232,232,238,.32)', gv: -5, grow: 10, decay: 1.8 });
    }
    if (!kind || Math.random() > dt * rate) return;
    var sd = Math.random() < .5 ? -1 : 1, x = B.x + sd * B.w * (.3 + Math.random() * .12), y = B.y + 5 * dpr; // behind the car, at road level
    if (kind === 'leaf') { col = ['#e8b040', '#c2410c', '#e08a2e'][Math.floor(Math.random() * 3)]; particles.push({ x: x, y: y, vx: sd * (40 + Math.random() * 120), vy: -(60 + Math.random() * 120), life: 1, r: 3, c: col, gv: 160, decay: 1.1 }); return; }
    vy = -(20 + Math.random() * 60);
    particles.push({ behind: true, x: x, y: y, vx: sd * (10 + Math.random() * 40), vy: vy, life: 1, r: r, c: col, gv: kind === 'dust' ? -10 : gv, grow: grow, decay: 1 / life });
  }
  // The speed a car really drives at this moment. Each car has its own pace, but it never drives through the one
  // in front of it (it eases down to that car's speed), and it never joins two others to fill all three lanes at
  // once, so there is always a way through. A car that is changing lane counts in both of its lanes.
  function steerSpeed(c) {
    if (c.knock) return c.v;
    var ve = c.v, mine = [c.lane, c.lc ? c.lc.to : c.lane], near = {}, nl = 0, ahead = 1e9, i, j;
    for (i = 0; i < traffic.length; i++) {
      var o = traffic[i]; if (o === c || o.knock) continue;
      var dz = o.z - c.z, ol = [o.lane, o.lc ? o.lc.to : o.lane], ov = o.vs == null ? o.v : o.vs, shares = false;
      for (j = 0; j < 2; j++) if (mine.indexOf(ol[j]) >= 0) shares = true;
      if (shares && dz > 0 && dz < 24) ve = Math.min(ve, ov * (dz < 14 ? .85 : 1));
      if (dz > -2 && dz < 32) { for (j = 0; j < 2; j++) if (mine.indexOf(ol[j]) < 0 && !near[ol[j]]) { near[ol[j]] = 1; nl++; } if (dz > 0) ahead = Math.min(ahead, ov); }
    }
    if (nl + (mine[0] === mine[1] ? 1 : 2) >= 3) ve = Math.min(ve, ahead);
    return ve;
  }
  function stepLaneChange(c, dt, d) {
    var vs = c.vs == null ? c.v : c.vs; c.blockedT = vs < c.v * .93 ? (c.blockedT || 0) + dt : 0;
    var overtake = c.persona === 'fast' && c.blockedT > 1.2 && d > 70 && !c.lc; // held up behind a slower car: look for a gap and pull out
    if (overtake || (!c.lc && c.canLc && d > 150 && d < 230)) {
      c.canLc = false; c.blockedT = -3;
      var others = {}, n = 0;
      traffic.forEach(function (o) { if (o !== c && !o.knock && Math.abs(o.z - c.z) < 45) [o.lane, o.lc ? o.lc.to : o.lane].forEach(function (l) { if (!others[l]) { others[l] = 1; n++; } }); });
      var opts = [-1, 1].map(function (dr) { return c.lane + dr; }).filter(function (l) { return l >= -1 && l <= 1 && !others[l] && (n + 1 <= 2); });
      if (opts.length) c.lc = { from: c.lane, to: opts[Math.floor(rand() * opts.length)], t: -.9 };
    }
    if (c.lc) {
      c.lc.t += dt;
      if (c.lc.t >= 1.1) { c.lane = c.lc.to; c.laneF = c.lane; c.lc = null; }
      else if (c.lc.t > 0) { var u = c.lc.t / 1.1; c.laneF = c.lc.from + (c.lc.to - c.lc.from) * u * u * (3 - 2 * u); }
    }
  }
  function step(dt) {
    if (paused) return;
    if (countT > 0) { // 3, 2, 1 before a resumed drive moves
      var before = Math.ceil(countT); countT -= dt; var now2 = Math.ceil(countT);
      if (now2 !== before || !elChapter.classList.contains('show')) { if (now2 > 0) showChapter('Welcome back', String(now2)); else { elChapter.classList.remove('show'); chTimer = 0; } }
      tAnim += dt; return;
    }
    if (mode === 'run') { saveT -= dt; if (saveT <= 0) { saveT = 8; savePlace(); } }
    tAnim += dt;
    var TREAD_MAX = 1.7; // sprite units per frame; a groove is about 7, so it always reads as rolling and never strobes backwards
    if (mode === 'run' || mode === 'menu') tread += Math.min((mode === 'run' ? speed : 20) * dt * 2.6, TREAD_MAX);
    particles.forEach(function (p) { p.x += p.vx * dt * dpr; p.y += p.vy * dt * dpr; p.vy += (p.gv == null ? 300 : p.gv) * dt; p.r += (p.grow || 0) * dt; p.life -= dt * (p.decay || 1.4); });
    particles = particles.filter(function (p) { return p.life > 0; });
    if (shake > 0) shake = Math.max(0, shake - dt * 40);
    if (flashT > 0) flashT = Math.max(0, flashT - dt);
    if (lightningT > 0) lightningT = Math.max(0, lightningT - dt);
    if (chTimer > 0) { chTimer -= dt; if (chTimer <= 0) elChapter.classList.remove('show'); }
    if (nearTimer > 0) { nearTimer -= dt; if (nearTimer <= 0) elNear.classList.remove('show'); }
    // Lane change: a damped spring that settles in about 0.28 s on dry road. Rain and snow soften it
    // (slower, with a little sway) so the road feels wet without changing how far a lane is.
    var wet = lastScene ? clamp(lastScene.rain * .8 + lastScene.snow, 0, 1) : 0;
    var om = 17 * (1 - .22 * wet), ze = 1 - .3 * wet, h2 = dt / 2;
    for (var sub = 0; sub < 2; sub++) { laneV += (om * om * (laneTarget - lane) - 2 * ze * om * laneV) * h2; lane += laneV * h2; }
    lane = clamp(lane, -1.06, 1.06);
    // Suspension: a lightly damped spring pushed by road bumps and by the curvature of the hills.
    var sn = clamp(speed / 42, 0, 1);
    var bumpF = (rnd(Math.floor(dist / 2.2), 61) - .5) * 460 * sn, hillF = (elev(dist + 3) - 2 * elev(dist) + elev(dist - 3)) * 1500 * sn;
    susp.v += (bumpF + hillF - 190 * susp.y - 8 * susp.v) * dt; susp.y = clamp(susp.y + susp.v * dt, -5, 5);
    pitch += ((braking ? 1 : 0) - pitch) * Math.min(1, dt * 6);
    roll.v += ((clamp(laneV * .035, -.15, .15) - roll.y) * 150 - roll.v * 11 * (1 - .35 * wet)) * dt; roll.y += roll.v * dt;
    camRoll += (clamp(-laneV * .0042 + curveAt(dist + 28) * 70, -.022, .022) - camRoll) * Math.min(1, dt * 4);
    if (mode === 'run' && lastPB && lastScene && speed > 14) emitRoadParticles(dt, lastScene);
    if (lastScene) stepFlurry(dt, lastScene);
    stepMoment(dt);
    if (mode === 'run') { // on a bridge: the wheels thump over a joint every 12 m, and a boat sounds its horn as you reach one
      var onB = bridgeAt(dist + PD) > .5, jn = Math.floor((dist + PD) / 12);
      if (onB && jn !== lastJoint) au('event', 'joint'); lastJoint = jn;
      var bk = Math.floor((dist + 120 - 320) / BRIDGE_EVERY);
      if (bk !== hornBridge && bridgeAt(bk * BRIDGE_EVERY + 320 + BRIDGE_LEN / 2) > 0 && bk * BRIDGE_EVERY + 320 - dist < 140) { hornBridge = bk; au('life', 'boathorn', -.3); }
    }
    // Thunder follows the light: a strike you see is heard a moment later (closer strikes sooner); between strikes the sky
    // flickers faintly far away and a distant rumble follows. No thunder ever plays without a flash in Storm Pass.
    if (skyT > 0) skyT = Math.max(0, skyT - dt);
    if (lastScene && lastScene.lightning > .5 && lightningT <= 0 && Math.random() < dt * .14) { lightningT = .4; au('event', 'thunder', { close: true, delay: .15 + Math.random() * 1.1 }); }
    else if (lastScene && lastScene.lightning > .3 && skyT <= 0 && lightningT <= 0 && Math.random() < dt * .1) { skyT = .7; au('event', 'thunder', { close: false, delay: 1.2 + Math.random() * 2 }); }
    if (mode === 'menu') { dist += 20 * dt; return; }
    if (mode !== 'run') return;
    shieldT = Math.max(0, shieldT - dt);
    speed += (targetSpeed(dist) * (braking ? .55 : 1) - speed) * Math.min(1, dt * (braking ? 1.6 : .8));
    dist += speed * dt; score += speed * dt * .1;
    if (comboTimer > 0) { comboTimer -= dt; if (comboTimer <= 0) combo = 0; }
    var c0 = chapterAt(dist);
    if (tripMode === 'journey' && c0.i >= JOURNEY_CHAPTERS) { finishJourney(); return; }
    if (c0.i !== lastChapter) { lastChapter = c0.i; showChapter('Chapter ' + (c0.i + 1), CHAPTERS[c0.idx].name); au('setChapter', c0.idx); if (c0.i > 0) au('event', 'chapter'); }
    if (tripMode === 'journey' && nextStop < REST_STOPS.length && dist >= REST_STOPS[nextStop] * chapterLen) {
      var cpCh = REST_STOPS[nextStop]; nextStop++;
      if (lives < maxLives) lives++;
      restCh = cpCh; saveCheckpoint(cpCh); showChapter('Rest stop', 'Heart restored'); au('event', 'rest');
    }
    var diff = DIFFS[prefs.difficulty];
    while (nextSpawn < dist + DRAW) {
      if (!nearStop(nextSpawn)) spawnWave(nextSpawn);
      var dens = (1 - .22 * clamp(dist / journeyLen(), 0, 1)) * (dist < calmUntil ? 1.35 : 1) * Math.pow(mul(), .6); // faster means more road between cars
      nextSpawn += (diff.gapMin + rand() * diff.gapRand) * dens; if (chapterAt(nextSpawn).frac < .08) nextSpawn += 50;
    }
    // pickups
    var cn;
    for (cn = Math.floor((dist + PD - 4) / 90); cn <= Math.floor((dist + PD + 6) / 90); cn++) {
      var ck = coinChunk(cn); if (!ck || nearStop(ck.start)) continue;
      for (var ci = 0; ci < ck.count; ci++) {
        var id = cn * 10 + ci; if (collected[id]) continue;
        var cd = ck.start + ci * 7 - dist;
        if (Math.abs(cd - PD) < 2.6 && Math.abs(lane - ck.lane) < .75) {
          collected[id] = true; run.coins += 1; score += 2;
          coinNote = tAnim - coinNoteT < 1.6 ? coinNote + 1 : 0; coinNoteT = tAnim; au('event', 'coin', { i: coinNote });
        }
      }
    }
    var hn = Math.floor((dist + PD + 2) / 600); var hk = heartChunk(hn);
    if (hk && !nearStop(hk.at) && !collected['h' + hn]) {
      var hd = hk.at - dist;
      if (Math.abs(hd - PD) < 2.8 && Math.abs(lane - hk.lane) < .75) { collected['h' + hn] = true; if (lives < maxLives) { lives++; au('event', 'heart'); } else { score += 25; au('event', 'coin', { i: 6 }); } }
    }
    for (var i = 0; i < traffic.length; i++) {
      var c = traffic[i]; if (c.vs == null) c.vs = c.v; c.vs += (steerSpeed(c) - c.vs) * Math.min(1, dt * 3); c.z += c.vs * dt; c.tread = (c.tread || 0) + Math.min(c.vs * dt * 2.6, TREAD_MAX); var d = c.z - dist; var gap = Math.abs(lane - c.laneF);
      if (c.hurt > 0) c.hurt -= dt; if (c.knock) { c.kx += dt * 2.4; c.rot = (c.rot || 0) + c.knock * dt * 2.6; }
      if (c.knock) continue;
      stepLaneChange(c, dt, d);
      gap = Math.abs(lane - c.laneF);
      if (Math.abs(d - PD) < 8) c.minGap = Math.min(c.minGap, gap);
      if (!c.whoosh && d < PD + 16 && d > PD) { c.whoosh = true; au('event', 'pass', { side: c.lane - lane, v: speed }); }
      if (d - PD < HIT_AHEAD && d - PD > -HIT_BEHIND && gap < hitGap(c) && shieldT <= 0) { bump(c); if (mode !== 'run') return; break; }
      if (!c.passed && d < PD - CAR_HALF) {
        c.passed = true;
        if (c.minGap < NEAR_GAP) {
          combo += 1; comboTimer = 3; run.near += 1; run.comboMax = Math.max(run.comboMax || 0, combo); score += 5 * combo;
          showNear((combo > 1 ? 'CLOSE  x' + combo : 'CLOSE') + '   +' + 5 * combo); au('event', 'near', { combo: combo });
        }
      }
    }
    traffic = traffic.filter(function (c) { return c.z > dist - 30; });
    au('setSpeed', speed); au('setIntensity', clamp((speed / mul() - RAMP.v0) / (RAMP.v1 - RAMP.v0) * .8 + combo * .06 + (shieldT > 0 ? .05 : 0), 0, 1)); au('setBrake', braking);
    au('setChapterProgress', c0.frac); au('setLives', lives, maxLives); au('setDrive', (elev(dist + 8) - elev(dist)) / 8 / .05, laneV);
    sceneTick = (sceneTick + 1) % 8;
    if (sceneTick === 0 && lastScene) au('setScene', { water: lastScene.water, rain: lastScene.rain, night: lastScene.night, snow: lastScene.snow, wind: lastScene.wind, heat: lastScene.heat, bed: lastScene.a.bed, nextBed: lastScene.b.bed, t: lastScene.t, life: lastScene.a.life, idx: c0.idx });
    hud();
  }
  // Frames that keep arriving late mean the device is struggling: render at a lower resolution (CSS size is unchanged,
  // so the picture is only a little softer) and go back up if it is smooth for a long time.
  var slowT = 0, fastT = 0;
  function adaptQuality(dt) {
    if (mode !== 'run' || paused) { slowT = fastT = 0; return; }
    var ms = dt * 1000;
    if (ms > 26) { slowT += dt; fastT = 0; } else if (ms < 18.5) { fastT += dt; slowT = Math.max(0, slowT - dt * .5); } else { slowT = Math.max(0, slowT - dt * .25); }
    if (slowT > 2 && dprCap > 1) { dprCap = Math.max(1, dprCap - .25); sizeDirty = true; slowT = 0; }
    else if (fastT > 14 && dprCap < 2) { dprCap = Math.min(2, dprCap + .25); sizeDirty = true; fastT = 0; }
  }
  var perf = { work: 0, gap: 0, worst: 0 }, FPS = params.get('fps') === '1'; // ?fps=1 shows how long a frame takes
  function frame(t) {
    if (last === null) last = t;
    var dt = Math.min(.05, (t - last) / 1000); last = t;
    var t0 = window.performance.now();
    step(dt); lastScene = render();
    var work = window.performance.now() - t0; // milliseconds spent on this frame (the budget is 16.7 at 60 fps)
    adaptQuality(dt);
    perf.work += (work - perf.work) * .05; perf.gap += (dt * 1000 - perf.gap) * .05; perf.worst = Math.max(perf.worst * .99, work);
    if (FPS) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#000a'; g.fillRect(0, H * .3, 118 * dpr, 40 * dpr); g.fillStyle = '#9fffc9'; g.font = (11 * dpr) + 'px monospace'; g.fillText('work ' + perf.work.toFixed(1) + ' ms', 6 * dpr, H * .3 + 15 * dpr); g.fillText('worst ' + perf.worst.toFixed(1) + ' ms', 6 * dpr, H * .3 + 30 * dpr); g.restore(); }
    window.requestAnimationFrame(frame);
  }

  // ---------- starting, pausing and the menu ----------
  // A one-time hint on the very first run, so the controls are not a secret.
  var HINT_KEY = 'classic-games.racer.hint';
  function showHint() {
    if (readJson(HINT_KEY)) return;
    writeJson(HINT_KEY, 1);
    var h = $('hint'); h.hidden = false; h.classList.add('show');
    window.setTimeout(function () { h.classList.remove('show'); window.setTimeout(function () { h.hidden = true; }, 500); }, 4200);
  }
  function abandonRun() { if (mode === 'run' && (dist > 60 || run.coins || run.near)) endRun(false); } // leaving a run by Restart or Menu still counts it
  function start(fromCheckpoint, countdown) {
    ignoreCheckpoint = false; abandonRun(); reset(fromCheckpoint); mode = 'run'; if (countdown) { countT = 3; showChapter('Welcome back', '3'); } $('ov').hidden = true; $('ps').hidden = true; $('ss').hidden = true;
    buildTrip(); au('unlock'); audioPrefs(); au('setChapter', chapterAt(dist).idx); au('start'); hud(); showHint();
  }
  function backToMenu() {
    abandonRun(); mode = 'menu'; paused = false; applyTrip(); dist = 0; lastChapter = -1; traffic = []; speed = 0; shieldT = 0; flashT = 0; lives = maxLives; run = { near: 0, coins: 0, hits: 0 }; combo = 0;
    au('stop'); $('ps').hidden = true; $('ss').hidden = true; elChapter.classList.remove('show'); elNear.classList.remove('show');
    showOverlay('menu', { title: 'Cruise', sub: 'Swipe left or right to change lane. Pass close to traffic for combos.' }); renderOpts(); hud();
  }
  function pauseGame() { if (mode !== 'run' || paused) return; savePlace(); paused = true; brakeOff(); au('pause'); $('ps').hidden = false; $('ps-resume').focus(); }
  function resumeGame() { if (!paused) return; paused = false; $('ps').hidden = true; $('ss').hidden = true; au('resume'); last = null; }
  function openSound(from) { $('ss').hidden = false; $('ss').setAttribute('data-from', from); $('ss-close').focus(); }
  function closeSound() { $('ss').hidden = true; if (paused) $('ps-resume').focus(); }

  function renderOpts() {
    Array.prototype.forEach.call(document.querySelectorAll('.opt'), function (row) {
      var name = row.getAttribute('data-opt'); if (!name) return; // the speed row has its own handler
      Array.prototype.forEach.call(row.querySelectorAll('button'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-val') === String(prefs[name]))); });
    });
    $('best-line').textContent = 'Best score: ' + getBest(); renderSpeedUi();
    var vm = $('vol-music'); var vf = $('vol-fx'); var vb = $('vol-bass'); vm.value = prefs.volMusic; vf.value = prefs.volFx; vb.value = prefs.bass; $('vol-engine').value = prefs.volEngine;
    var cp = getCheckpoint(); contBtn.hidden = !cp || $('ov').getAttribute('data-kind') !== 'menu'; if (cp) contBtn.textContent = 'Continue: chapter ' + (cp.chapter + 1) + '  ' + new Array(cp.lives + 1).join('♥');
  }
  Array.prototype.forEach.call(document.querySelectorAll('.opt button'), function (b) {
    b.addEventListener('click', function () {
      var name = b.closest('.opt').getAttribute('data-opt'); var v = b.getAttribute('data-val'); if (!name) return;
      prefs[name] = v; savePrefs(); applyTrip(); renderOpts(); audioPrefs(); au('unlock');
    });
  });
  [['vol-music', 'volMusic'], ['vol-fx', 'volFx'], ['vol-engine', 'volEngine'], ['vol-bass', 'bass']].forEach(function (p) {
    $(p[0]).addEventListener('input', function () { prefs[p[1]] = parseInt($(p[0]).value, 10); audioPrefs(); });
    $(p[0]).addEventListener('change', savePrefs);
  });

  // ---------- input ----------
  function go(dir) {
    if (mode !== 'run' || paused) return;
    var before = laneTarget; laneTarget = clamp(laneTarget + dir, -1, 1);
    if (before !== laneTarget) { au('unlock'); au('event', 'lane', { dir: dir }); }
  }
  // Speed control: the + and - buttons beside the speed readout, the + and - keys, and Up for faster.
  function changeSpeed(dir) {
    var n = clamp(prefs.speedIdx + dir, 0, SPEED_STEPS.length - 1); if (n === prefs.speedIdx) return;
    prefs.speedIdx = n; savePrefs(); renderSpeedUi(); au('unlock');
  }
  function renderSpeedUi() {
    $('spd-minus').disabled = prefs.speedIdx <= 0; $('spd-plus').disabled = prefs.speedIdx >= SPEED_STEPS.length - 1;
    $('spd-pace').textContent = 'pace ' + mul().toFixed(1) + 'x';
    Array.prototype.forEach.call(document.querySelectorAll('[data-speedidx]'), function (b) {
      var near = [0, 3, 5, 6].reduce(function (a, i) { return Math.abs(i - prefs.speedIdx) < Math.abs(a - prefs.speedIdx) ? i : a; }, 0);
      b.setAttribute('aria-pressed', String(parseInt(b.getAttribute('data-speedidx'), 10) === near));
    });
  }
  $('spd-minus').addEventListener('click', function () { changeSpeed(-1); });
  $('spd-plus').addEventListener('click', function () { changeSpeed(1); });
  Array.prototype.forEach.call(document.querySelectorAll('[data-speedidx]'), function (b) {
    b.addEventListener('click', function () { prefs.speedIdx = parseInt(b.getAttribute('data-speedidx'), 10); savePrefs(); renderSpeedUi(); au('unlock'); });
  });
  playBtn.addEventListener('click', function () { start(null); });
  contBtn.addEventListener('click', function () { var cp = getCheckpoint(); if (cp) start(cp, true); });
  $('keep').addEventListener('click', keepDriving);
  $('menu-btn').addEventListener('click', backToMenu);
  $('pause').addEventListener('click', function () { if (paused) resumeGame(); else pauseGame(); });
  $('ps-resume').addEventListener('click', resumeGame);
  $('ps-restart').addEventListener('click', function () { start(null); });
  $('ps-sound').addEventListener('click', function () { openSound('pause'); });
  $('sound-btn').addEventListener('click', function () { openSound('menu'); });
  $('ss-close').addEventListener('click', closeSound);
  var brake = $('brake');
  function brakeOn(e) { braking = true; brake.setAttribute('aria-pressed', 'true'); if (e && e.pointerId !== undefined) { try { brake.setPointerCapture(e.pointerId); } catch (x) { /* fine */ } } }
  function brakeOff() { braking = false; brake.setAttribute('aria-pressed', 'false'); }
  brake.addEventListener('pointerdown', brakeOn); brake.addEventListener('pointerup', brakeOff); brake.addEventListener('pointercancel', brakeOff); brake.addEventListener('lostpointercapture', brakeOff);
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return; // Ctrl+S, Ctrl+D, zoom and the rest stay the browser's
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === 'ArrowLeft' || k === 'a') { go(-1); e.preventDefault(); }
    else if (k === 'ArrowRight' || k === 'd') { go(1); e.preventDefault(); }
    else if (k === 'ArrowUp' || k === 'w' || k === '+' || k === '=') { if (mode === 'run' && !paused) changeSpeed(1); e.preventDefault(); }
    else if (k === '-' || k === '_') { if (mode === 'run' && !paused) changeSpeed(-1); e.preventDefault(); }
    else if (k === 'ArrowDown' || k === 's') { if (mode === 'run' && !paused) braking = true; e.preventDefault(); }
    else if (k === 'p' || k === 'Escape') { if (!$('ss').hidden) closeSound(); else if (paused) resumeGame(); else pauseGame(); }
    else if (k === 'Enter' && !$('ov').hidden && document.activeElement && document.activeElement.tagName !== 'BUTTON') { start(null); e.preventDefault(); }
  });
  document.addEventListener('keyup', function (e) { if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') braking = false; });
  var stage = $('stage'); var sw0 = null;
  stage.addEventListener('pointerdown', function (e) { if (e.target.closest('button,a,input,.sheet,.overlay')) return; sw0 = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false }; });
  stage.addEventListener('pointermove', function (e) {
    if (!sw0 || sw0.id !== e.pointerId) return;
    var dx = e.clientX - sw0.x;
    if (Math.abs(dx) > 26 && Math.abs(dx) > Math.abs(e.clientY - sw0.y)) { go(dx > 0 ? 1 : -1); sw0.x = e.clientX; sw0.y = e.clientY; sw0.moved = true; }
  });
  stage.addEventListener('pointerup', function (e) {
    if (sw0 && sw0.id === e.pointerId && !sw0.moved && mode === 'run') { var r = stage.getBoundingClientRect(); go(e.clientX < r.left + r.width / 2 ? -1 : 1); }
    sw0 = null;
  });
  stage.addEventListener('pointercancel', function () { sw0 = null; });
  document.addEventListener('visibilitychange', function () { last = null; if (document.hidden) { savePlace(); pauseGame(); } });
  window.addEventListener('pagehide', savePlace);
  window.addEventListener('resize', function () { sizeDirty = true; render(); });
  window.addEventListener('storage', function () { audioPrefs(); });

  // ---------- vehicle sprites ----------
  var spriteList = [];
  (function initCars() {
    var RC = window.RacerCars; if (!RC) return;
    Object.keys(PLAYER_CARS).forEach(function (id) {
      var pc = PLAYER_CARS[id]; $('car-img-' + id).src = RC.thumb(id, pc.col, pc.acc);
      spriteList.push(RC.sprite(id, pc.col, pc.acc, false, 420), RC.sprite(id, pc.col, pc.acc, true, 420));
    });
    $('car-img-f1').src = RC.thumb('f1', '#d9262c', '#ffd34a');
    var seen = {}; CAR_KINDS.forEach(function (k) { seen[TYPE_OF[k]] = 1; });
    Object.keys(seen).forEach(function (t) { CAR_COLS.forEach(function (c) { spriteList.push(RC.sprite(t, c, null, false, 320), RC.sprite(t, c, null, false, 160)); }); });
  })();

  // ---------- init ----------
  runMul = mul(); renderSpeedUi(); applyTrip(); reset(null); showOverlay('menu', { title: 'Cruise', sub: 'Swipe left or right to change lane. Pass close to traffic for combos.' }); renderOpts(); hud();
  if (params.get('resume') === '1') { // Resume on the Games screen: say where you are and put Continue under your thumb
    var rcp = getCheckpoint();
    if (rcp) start(rcp, true); // straight back to where you were, after a 3-2-1
  }
  if (DEBUG) {
    // test and gallery hook: draw a still frame at a distance with demo traffic, and drive the game
    window.racerDebug = {
      audio: function () { return A && A.info ? A.info() : null; },
      perf: function () { return { work: perf.work, worst: perf.worst, frame: perf.gap, dprCap: dprCap }; },
      slowDown: function (on) { dprCap = on ? 1 : 2; sizeDirty = true; },
      scene: function (d) { var S = sceneAt(d); return { sunY: S.sunY, sky: S.sky.slice(), rain: S.rain, snow: S.snow, name: S.name }; },
      sprites: function () { return { total: spriteList.length, ready: spriteList.filter(function (e) { return e.ready; }).length }; },
      geo: function (ds) { lastScene = render(); var pb = playerBox(); return { W: W, H: H, dpr: dpr, player: pb, rows: ds.map(function (d) { var r = rowAt(d); return { d: d, y: r.y, ct: r.ct, hw: r.hw }; }), cars: traffic.map(function (c) { var d = c.z - dist; var r = rowAt(Math.max(.5, d)); return { d: d, lane: c.lane, laneF: c.laneF, lc: !!c.lc, knock: c.knock || 0, kind: c.kind, y: r.y, x: r.ct + c.lane * LANE * r.hw, hw: r.hw }; }) }; },
      state: function () { return { flash: flashT, camRoll: camRoll, slope: (elev(dist + 8) - elev(dist)) / 8 / .05, susp: susp.y, laneV: laneV, pitch: pitch, paused: paused, braking: braking, prefs: JSON.parse(JSON.stringify(prefs)), mode: mode, dist: dist, speed: speed, lane: lane, laneTarget: laneTarget, combo: combo, score: score, lives: lives, maxLives: maxLives, shield: shieldT, coins: run.coins, hits: run.hits, traffic: traffic.length, chapter: chapterAt(dist).i, chapterLen: chapterLen, tripMode: tripMode, nextStop: nextStop, checkpoint: getCheckpoint(), stats: JSON.parse(JSON.stringify(stats)) }; },
      still: function (d, t, laneV, withTraffic) {
        mode = 'menu'; dist = d; tAnim = t; lane = laneV || 0; laneTarget = lane; speed = 70; traffic = [];
        if (withTraffic !== false) [[55, -1], [120, 1], [190, 0]].forEach(function (a, i) { traffic.push({ id: ++carId, laneF: a[1], lc: null, z: d + a[0], lane: a[1], v: 0, kind: CAR_KINDS[(i * 3 + Math.floor(d / 300)) % CAR_KINDS.length], col: CAR_COLS[(i * 2 + Math.floor(d / 200)) % CAR_COLS.length], passed: false, minGap: 9 }); });
        $('ov').hidden = true; lastScene = render(); return lastScene;
      },
      start: start, pause: pauseGame, resume: resumeGame, elev: elev, backToMenu: backToMenu,
      teleport: function (d) { dist = d; nextSpawn = d + 300; nextStop = 0; while (nextStop < REST_STOPS.length && REST_STOPS[nextStop] * chapterLen <= d) nextStop++; lastChapter = chapterAt(d).i - 1; traffic = []; },
      addCar: function (ln, ahead, kind, canLc, v) { traffic.push({ id: ++carId, laneF: ln, lc: null, canLc: !!canLc, z: dist + ahead, lane: ln, v: v || 0, kind: kind || 'sedan', col: '#2563eb', passed: false, minGap: 9 }); },
      bridgeAt: function (pos) { return bridgeAt(pos); },
      bridges: function (from, to) { var out = []; for (var b = Math.floor((from - 320) / BRIDGE_EVERY); b <= Math.floor((to - 320) / BRIDGE_EVERY); b++) { var st = bridgeStart(b); if (st != null && st >= from && st <= to) out.push(st); } return out; },
      setLives: function (n) { lives = n; },
      setLane: function (l) { lane = laneTarget = l; },
      stopSpawning: function () { nextSpawn = 1e9; },
      advance: function (sec) { var n = Math.round(sec / .02); for (var i = 0; i < n; i++) step(.02); },
      coinChunk: coinChunk, heartChunk: heartChunk
    };
    if (params.get('still')) { window.racerDebug.still(parseFloat(params.get('still')), parseFloat(params.get('t') || '1'), 0, true); $('ov').hidden = true; }
    else window.requestAnimationFrame(frame);
  } else {
    window.requestAnimationFrame(frame);
  }
})();
