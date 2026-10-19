// Early playable prototype. Wiring, rendering and lifecycle only; all game rules live in
// engine.js and are provisional development assumptions (see docs/PLAYABLE_PROTOTYPE.md).
(function () {
  'use strict';

  var E = window.SnakeEngine;
  var S = window.SnakeStorage;

  var THEME_KEY = 'classic-games.theme';
  var THEMES = ['colour', 'lcd', 'night'];

  var $ = function (id) { return document.getElementById(id); };
  var root = document.documentElement;
  var canvas = $('canvas');
  var ctx = canvas.getContext('2d');
  var params = new URLSearchParams(window.location.search);

  function safeStorage() {
    try { return window.localStorage; } catch { return null; }
  }
  var storage = safeStorage();

  // ---------- Theme ----------
  function readTheme() {
    try {
      var t = storage && storage.getItem(THEME_KEY);
      return THEMES.indexOf(t) >= 0 ? t : 'colour';
    } catch { return 'colour'; }
  }
  function saveTheme(t) {
    try { if (storage) storage.setItem(THEME_KEY, t); } catch { /* storage unavailable: fine */ }
  }
  function applyTheme(t) {
    root.setAttribute('data-theme', t);
    var radio = document.querySelector('input[name="theme"][value="' + t + '"]');
    if (radio) radio.checked = true;
    draw();
  }

  // ---------- Game state ----------
  // mode: menu | ready | running | paused | over | won
  var mode = 'menu';
  var game;
  // Best scores are kept per prototype speed; v1 data (recorded at 150 ms) migrates to "fast".
  var best = S.createBestStore(storage, E.SPEED_ORDER, 'fast');
  best.load();
  var speedPref = S.createSpeedPref(storage, E.SPEED_ORDER, E.DEFAULT_SPEED);
  speedPref.load();
  var SPEED_LABELS = { slow: 'Slow', medium: 'Medium', fast: 'Fast' };
  var rafId = 0;
  var lastTime = null;
  var acc = 0;
  var MAX_STEPS = E.DEFAULTS.maxCatchUpSteps;

  function newSeed() {
    var q = parseInt(params.get('seed'), 10);
    if (isFinite(q)) return q; // test hook for deterministic runs
    return ((Date.now() ^ Math.floor(Math.random() * 4294967296)) >>> 0);
  }

  // ---------- Drawing ----------
  function cssVar(name) { return getComputedStyle(root).getPropertyValue(name).trim(); }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function resizeCanvas() {
    var rect = canvas.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    var w = Math.max(1, Math.round(rect.width * dpr));
    var h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    draw();
  }

  function draw() {
    if (!game) return;
    var cols = game.cols;
    var rows = game.rows;
    var w = canvas.width;
    var h = canvas.height;
    var cell = Math.min(w / cols, h / rows);
    var ox = (w - cell * cols) / 2;
    var oy = (h - cell * rows) / 2;
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = cssVar('--board-line');
    ctx.lineWidth = Math.max(1, cell * 0.04);
    ctx.beginPath();
    for (var c = 1; c < cols; c++) { ctx.moveTo(ox + c * cell, oy); ctx.lineTo(ox + c * cell, oy + rows * cell); }
    for (var r = 1; r < rows; r++) { ctx.moveTo(ox, oy + r * cell); ctx.lineTo(ox + cols * cell, oy + r * cell); }
    ctx.stroke();

    var pad = cell * 0.08;
    for (var i = game.snake.length - 1; i >= 0; i--) {
      ctx.fillStyle = cssVar(i === 0 ? '--snake-head' : '--snake');
      roundRect(ox + game.snake[i].x * cell + pad, oy + game.snake[i].y * cell + pad,
                cell - 2 * pad, cell - 2 * pad, cell * 0.28);
      ctx.fill();
    }

    if (game.food) { // diamond: distinct from the square snake segments by shape
      var fx = ox + (game.food.x + 0.5) * cell;
      var fy = oy + (game.food.y + 0.5) * cell;
      var d = cell * 0.4;
      ctx.fillStyle = cssVar('--food');
      ctx.beginPath();
      ctx.moveTo(fx, fy - d);
      ctx.lineTo(fx + d, fy);
      ctx.lineTo(fx, fy + d);
      ctx.lineTo(fx - d, fy);
      ctx.closePath();
      ctx.fill();
    }
  }

  // ---------- UI ----------
  var btnNew = $('btn-new');
  var btnPause = $('btn-pause');
  var btnContinue = $('btn-continue');
  var dpadButtons = document.querySelectorAll('.dpad-btn');
  var overlay = $('overlay');

  var LABELS = { menu: 'Menu', ready: 'Ready', running: 'Running', paused: 'Paused', over: 'Game over', won: 'Board full' };

  function statusText() {
    switch (mode) {
      case 'menu': return 'Press New game to start.';
      case 'ready': return 'Ready. Press an arrow key, WASD or a direction button to start.';
      case 'running': return 'Playing.';
      case 'paused': return 'Paused. Press Continue, or Space or P on the board, to resume.';
      case 'over': return 'Game over. Score ' + game.score + '.';
      default: return 'Board full. Score ' + game.score + '.';
    }
  }

  function overlayText() {
    switch (mode) {
      case 'menu': return 'Press New game';
      case 'ready': return 'Press a direction to start';
      case 'paused': return 'Paused';
      case 'over': return 'Game over. Score ' + game.score + '.';
      case 'won': return 'Board full. Score ' + game.score + '.';
      default: return '';
    }
  }

  function renderBest() {
    var b = best.get(game.speed);
    $('best').textContent = String(b);
    $('best-note').textContent = '(' + SPEED_LABELS[game.speed] + (best.isPersistent() ? '' : ', this session') + ')';
  }

  function updateUI(announce) {
    $('state-name').textContent = LABELS[mode];
    $('speed-name').textContent = SPEED_LABELS[game.speed];
    if (announce !== false) $('status').textContent = statusText();
    var text = overlayText();
    overlay.hidden = !text;
    overlay.setAttribute('data-kind', mode);
    $('overlay-text').textContent = text;
    $('score').textContent = String(game.score);
    $('length').textContent = String(game.snake.length);
    btnPause.disabled = mode !== 'running';
    btnContinue.disabled = mode !== 'paused';
    var active = mode === 'ready' || mode === 'running';
    Array.prototype.forEach.call(dpadButtons, function (b) { b.disabled = !active; });
    renderBest();
    draw();
  }

  // ---------- Loop ----------
  function stopLoop() {
    if (rafId) { window.cancelAnimationFrame(rafId); rafId = 0; }
  }

  function startLoop() {
    stopLoop();
    lastTime = null; // never replay time spent paused, hidden or not yet started
    acc = 0;
    rafId = window.requestAnimationFrame(frame);
  }

  function frame(t) {
    rafId = 0;
    if (mode !== 'running') return;
    var dt = lastTime === null ? 0 : t - lastTime;
    lastTime = t;
    var r = E.advanceClock(acc, dt, game.tickMs, MAX_STEPS);
    acc = r.acc;
    for (var i = 0; i < r.steps && game.status === 'running'; i++) {
      game = E.step(game).state;
    }
    if (game.status === 'over' || game.status === 'won') {
      finish();
      return;
    }
    $('score').textContent = String(game.score);
    $('length').textContent = String(game.snake.length);
    draw();
    rafId = window.requestAnimationFrame(frame);
  }

  function finish() {
    var before = best.get(game.speed);
    mode = game.status;
    best.submit(game.speed, game.score);
    updateUI();
    if (game.score > before && game.score > 0) {
      $('status').textContent = statusText() + ' New best.';
    }
  }

  // ---------- Commands ----------
  function startNewGame() {
    stopLoop();
    game = E.createGame({ seed: newSeed(), speed: speedPref.get() });
    mode = 'ready';
    updateUI();
    $('board').focus(); // so keys work immediately after an explicit start
  }

  function pause() {
    if (mode !== 'running') return false;
    mode = 'paused';
    stopLoop();
    updateUI();
    return true;
  }

  function resume() {
    if (mode !== 'paused') return false;
    mode = 'running';
    updateUI();
    startLoop();
    return true;
  }

  function input(dir) {
    if (mode !== 'ready' && mode !== 'running') return;
    var next = E.turn(game, dir);
    var started = mode === 'ready' && next.status === 'running';
    game = next;
    if (started) {
      mode = 'running';
      updateUI();
      startLoop();
    }
  }

  function requestNewGame() {
    if (mode === 'running' || mode === 'paused') {
      var wasRunning = pause();
      var dlg = $('dlg-confirm');
      if (typeof dlg.showModal === 'function') {
        dlg.returnValue = '';
        dlg.showModal();
        dlg.addEventListener('close', function onClose() {
          dlg.removeEventListener('close', onClose);
          if (dlg.returnValue === 'confirm') startNewGame();
          else if (wasRunning || mode === 'paused') btnContinue.focus();
        });
        return;
      }
    }
    startNewGame();
  }

  btnNew.addEventListener('click', requestNewGame);
  btnPause.addEventListener('click', function () {
    if (pause()) btnContinue.focus();
  });
  btnContinue.addEventListener('click', function () {
    if (resume()) $('board').focus();
  });

  // Auto-pause when the tab is hidden; resuming is always explicit and never catches up.
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) pause();
  });

  // ---------- Input ----------
  var DIRS = { up: 'up', down: 'down', left: 'left', right: 'right' };
  Array.prototype.forEach.call(dpadButtons, function (b) {
    b.addEventListener('click', function () { input(DIRS[b.getAttribute('data-dir').toLowerCase()]); });
  });

  var KEYS = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', a: 'left', s: 'down', d: 'right'
  };
  // Keys act only while the board has focus, so form fields and the rest of the page keep
  // their normal behaviour.
  $('board').addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    var dir = KEYS[k];
    if (dir && (mode === 'ready' || mode === 'running')) {
      e.preventDefault();
      input(dir);
    } else if ((k === ' ' || k === 'p') && (mode === 'running' || mode === 'paused')) {
      e.preventDefault();
      if (mode === 'running') pause(); else resume();
    }
  });

  // ---------- Dialogs and settings ----------
  Array.prototype.forEach.call(document.querySelectorAll('[data-open]'), function (b) {
    b.addEventListener('click', function () {
      var id = b.getAttribute('data-open');
      var dlg = $(id);
      if (!dlg || typeof dlg.showModal !== 'function') return;
      if (id === 'dlg-top') {
        var any = E.SPEED_ORDER.some(function (k) { return best.get(k) > 0; });
        var parts = E.SPEED_ORDER.map(function (k) { return SPEED_LABELS[k] + ' ' + best.get(k); });
        $('top-text').textContent = any ? 'Best scores: ' + parts.join(', ') + '.' : 'No score yet.';
        $('top-note').textContent = best.isPersistent()
          ? 'Scores are kept separately for each speed and saved on this device.'
          : 'Storage is unavailable, so best scores last for this session only.';
      }
      if (id === 'dlg-settings') syncSpeedControls();
      // Opening a panel mid-run pauses it; resuming stays explicit.
      pause();
      dlg.showModal();
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll('input[name="theme"]'), function (r) {
    r.addEventListener('change', function () {
      if (r.checked) { applyTheme(r.value); saveTheme(r.value); }
    });
  });

  // ---------- Speed setting ----------
  // The speed applies to the next New game so a run's timing never changes mid-run. With no
  // run started yet (menu or ready) the pending game adopts it immediately.
  function syncSpeedControls() {
    var sel = speedPref.get();
    var radio = document.querySelector('input[name="speed"][value="' + sel + '"]');
    if (radio) radio.checked = true;
    var note = 'Applies to new games.';
    if ((mode === 'running' || mode === 'paused') && game.speed !== sel) {
      note = 'This run keeps ' + SPEED_LABELS[game.speed] + '. ' + SPEED_LABELS[sel] + ' starts with your next new game.';
    }
    if (!speedPref.isPersistent()) note += ' Not saved on this device.';
    $('speed-note').textContent = note;
  }

  Array.prototype.forEach.call(document.querySelectorAll('input[name="speed"]'), function (r) {
    r.addEventListener('change', function () {
      if (!r.checked) return;
      speedPref.set(r.value);
      if (mode === 'menu' || mode === 'ready') {
        game = E.createGame({ seed: newSeed(), speed: speedPref.get() });
        updateUI(false);
      }
      syncSpeedControls();
    });
  });

  // ---------- Init ----------
  if (params.get('debug') === '1') {
    // Test hook (read-only snapshot); not used by the app.
    window.classicGamesDebug = {
      state: function () { return JSON.parse(JSON.stringify({ game: game, mode: mode })); }
    };
  }
  game = E.createGame({ seed: newSeed(), speed: speedPref.get() });
  applyTheme(readTheme());
  syncSpeedControls();
  updateUI();
  if (window.ResizeObserver) {
    new ResizeObserver(resizeCanvas).observe(canvas);
  } else {
    window.addEventListener('resize', resizeCanvas);
  }
  resizeCanvas();
})();
