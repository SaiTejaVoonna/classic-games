// Early playable prototype. Wiring and lifecycle only; game rules live in engine.js and
// drawing lives in render.js. All rules are Classic Games prototype choices (see
// docs/PLAYABLE_PROTOTYPE.md).
(function () {
  'use strict';

  var E = window.SnakeEngine;
  var S = window.SnakeStorage;
  var R = window.SnakeRender;

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
  var SPEED_LABELS = { slow: 'Slow', medium: 'Medium', fast: 'Fast' };
  var BOARD_LABELS = { clear: 'Clear field', pillars: 'Pillars maze', gate: 'Gate maze', frame: 'Frame maze' };
  var LIVES_LABELS = { classic: 'Classic', extra: 'Extra lives', unlimited: 'Unlimited' };
  var EDGES_LABELS = { walls: 'Solid walls', wrap: 'Wrap around' };
  var RULE_SCHEMA = {
    board: E.MAZE_ORDER,
    edges: E.EDGES_ORDER,
    lives: E.LIVES_ORDER,
    bonus: ['on', 'off']
  };
  var RULE_DEFAULTS = { board: E.DEFAULT_BOARD, edges: E.DEFAULT_EDGES, lives: E.DEFAULT_LIVES, bonus: 'on' };

  // Best scores are kept per rules profile. Older data (one value per speed, recorded with
  // classic lives, a clear field, solid walls and no bonus) migrates to that profile.
  var best = S.createBestStore(storage, {
    isKey: E.isProfileKey,
    legacyKey: function (speed) {
      return E.isProfileKey(speed + '|classic|clear|walls|nobonus') ? speed + '|classic|clear|walls|nobonus' : '';
    }
  });
  best.load();
  var speedPref = S.createSpeedPref(storage, E.SPEED_ORDER, E.DEFAULT_SPEED);
  speedPref.load();
  var rulesPref = S.createRulesPref(storage, RULE_SCHEMA, RULE_DEFAULTS);
  rulesPref.load();
  var readyNote = ''; // set after a lost life
  var rafId = 0;
  var lastTime = null;
  var acc = 0;
  var MAX_STEPS = E.DEFAULTS.maxCatchUpSteps;

  // Options for a new run from the saved speed and rules choices.
  function gameOptions() {
    var r = rulesPref.get();
    var o = { speed: speedPref.get(), board: r.board, wrap: r.edges === 'wrap', lives: r.lives, bonus: r.bonus === 'on' };
    if (params.get('debug') === '1') { // test hooks: bonus tuning for browser checks
      ['bonusEvery', 'bonusTicks', 'bonusPoints'].forEach(function (k) {
        var v = parseInt(params.get(k), 10);
        if (isFinite(v)) o[k] = v;
      });
      if (params.get('bonusGrows') === '1') o.bonusGrows = true;
    }
    return o;
  }
  function newGame() {
    var o = gameOptions();
    o.seed = newSeed();
    return E.createGame(o);
  }

  function newSeed() {
    var q = parseInt(params.get('seed'), 10);
    if (isFinite(q)) return q; // test hook for deterministic runs
    return ((Date.now() ^ Math.floor(Math.random() * 4294967296)) >>> 0);
  }

  // ---------- Drawing ----------
  function cssVar(name) { return getComputedStyle(root).getPropertyValue(name).trim(); }

  function palette() {
    return {
      boardLine: cssVar('--board-line'), snake: cssVar('--snake'), snakeHead: cssVar('--snake-head'),
      snakeEdge: cssVar('--snake-edge'), shine: cssVar('--shine'), eye: cssVar('--eye'),
      pupil: cssVar('--pupil'), food: cssVar('--food'), bonus: cssVar('--bonus'),
      obstacle: cssVar('--obstacle'), obstacleEdge: cssVar('--obstacle-edge')
    };
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
    R.draw(ctx, game, palette(), canvas.width, canvas.height);
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
      case 'ready': return readyNote || 'Ready. Press an arrow key, WASD or a direction button to start.';
      case 'running': return 'Playing.';
      case 'paused': return 'Paused. Press Continue, or Space or P on the board, to resume.';
      case 'over': return 'Game over. Score ' + game.score + '.';
      default: return 'Board full. Score ' + game.score + '.';
    }
  }

  function overlayText() {
    switch (mode) {
      case 'menu': return 'Press New game';
      case 'ready': return readyNote ? 'Press a direction to continue' : 'Press a direction to start';
      case 'paused': return 'Paused';
      case 'over': return 'Game over. Score ' + game.score + '.';
      case 'won': return 'Board full. Score ' + game.score + '.';
      default: return '';
    }
  }

  function renderBest() {
    $('best').textContent = String(best.get(game.profile));
    $('best-note').textContent = '(this setup' + (best.isPersistent() ? '' : ', this session') + ')';
  }

  function rulesText(g) {
    var parts = [];
    parts.push(g.livesMode === 'unlimited' ? 'Assist: unlimited lives' : g.livesMode === 'extra' ? '3 lives' : '1 life');
    parts.push(g.board === 'clear' ? 'clear field' : BOARD_LABELS[g.board].toLowerCase());
    parts.push(g.wrap ? 'wrap around edges' : 'solid walls');
    parts.push(g.bonusEnabled ? 'bonus food on' : 'bonus food off');
    return parts.join(', ') + '.';
  }

  function bonusSeconds(g) {
    return Math.max(1, Math.ceil(g.bonusItem.ticksLeft * g.tickMs / 1000));
  }

  function renderBonus() {
    var item = $('bonus-item');
    if (game.bonusItem && (mode === 'running' || mode === 'paused' || mode === 'ready')) {
      item.hidden = false;
      var t = bonusSeconds(game) + ' s';
      if ($('bonus-time').textContent !== t) $('bonus-time').textContent = t;
    } else {
      item.hidden = true;
    }
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
    $('lives').textContent = game.lives === null ? 'Unlimited' : String(game.lives);
    $('rules-line').textContent = rulesText(game);
    renderBonus();
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
    var lifeLost = false;
    for (var i = 0; i < r.steps && game.status === 'running'; i++) {
      var res = E.step(game);
      game = res.state;
      res.events.forEach(function (e) { if (e.type === 'lifeLost') lifeLost = true; });
    }
    if (game.status === 'over' || game.status === 'won') {
      finish();
      return;
    }
    if (lifeLost) { // the snake is back at the start and waits for a direction
      mode = 'ready';
      readyNote = game.lives === null
        ? 'Back at the start. Press a direction to continue.'
        : 'Life lost. ' + game.lives + (game.lives === 1 ? ' life left' : ' lives left') + '. Press a direction to continue.';
      updateUI();
      return;
    }
    $('score').textContent = String(game.score);
    $('length').textContent = String(game.snake.length);
    renderBonus();
    draw();
    rafId = window.requestAnimationFrame(frame);
  }

  function finish() {
    var before = best.get(game.profile);
    mode = game.status;
    best.submit(game.profile, game.score);
    updateUI();
    if (game.score > before && game.score > 0) {
      $('status').textContent = statusText() + ' New best.';
    }
  }

  // ---------- Commands ----------
  function startNewGame() {
    stopLoop();
    game = newGame();
    readyNote = '';
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
      readyNote = '';
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
        var list = $('top-list');
        list.textContent = '';
        best.entries().slice(0, 8).forEach(function (e) {
          var li = document.createElement('li');
          li.textContent = profileLabel(e[0]) + ': ' + e[1];
          list.appendChild(li);
        });
        $('top-text').textContent = best.entries().length ? 'Best scores by setup:' : 'No score yet.';
        $('top-note').textContent = best.isPersistent()
          ? 'Scores are kept separately for each speed and rules setup, and saved on this device.'
          : 'Storage is unavailable, so best scores last for this session only.';
      }
      if (id === 'dlg-settings') syncSettingsControls();
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

  // ---------- Speed and rules settings ----------
  function profileLabel(key) {
    var p = key.split('|');
    return [SPEED_LABELS[p[0]], LIVES_LABELS[p[1]], BOARD_LABELS[p[2]], EDGES_LABELS[p[3]],
            p[4] === 'bonus' ? 'Bonus on' : 'Bonus off'].join(', ');
  }

  // A change applies to the next New game so a run's rules and timing never change mid-run.
  // With no run started yet (menu or a fresh ready state) the pending game adopts it at once.
  function runInProgress() {
    return mode === 'running' || mode === 'paused' || mode === 'over' || mode === 'won' ||
      (mode === 'ready' && readyNote !== '');
  }

  function syncSettingsControls() {
    var sel = speedPref.get();
    var rules = rulesPref.get();
    var checks = { speed: sel, board: rules.board, edges: rules.edges, lives: rules.lives, bonus: rules.bonus };
    Object.keys(checks).forEach(function (name) {
      var radio = document.querySelector('input[name="' + name + '"][value="' + checks[name] + '"]');
      if (radio) radio.checked = true;
    });
    var note = 'Applies to new games.';
    if ((mode === 'running' || mode === 'paused') && game.speed !== sel) {
      note = 'This run keeps ' + SPEED_LABELS[game.speed] + '. ' + SPEED_LABELS[sel] + ' starts with your next new game.';
    }
    if (!speedPref.isPersistent()) note += ' Not saved on this device.';
    $('speed-note').textContent = note;
    var rulesNote = 'Board, edges, lives and bonus apply to new games. Mazes, wrap, lives and bonus food are Classic Games choices, not verified original rules.';
    var now = gameOptions();
    var same = game.board === now.board && game.wrap === now.wrap && game.livesMode === now.lives && game.bonusEnabled === now.bonus;
    if ((mode === 'running' || mode === 'paused') && !same) {
      rulesNote = 'This run keeps its board, edges, lives and bonus. Changes start with your next new game.';
    }
    if (!rulesPref.isPersistent()) rulesNote += ' Not saved on this device.';
    $('rules-note').textContent = rulesNote;
  }

  function adoptSettings() {
    if (!runInProgress()) {
      game = newGame();
      updateUI(false);
    }
    syncSettingsControls();
  }

  Array.prototype.forEach.call(document.querySelectorAll('input[name="speed"]'), function (r) {
    r.addEventListener('change', function () {
      if (!r.checked) return;
      speedPref.set(r.value);
      adoptSettings();
    });
  });
  ['board', 'edges', 'lives', 'bonus'].forEach(function (field) {
    Array.prototype.forEach.call(document.querySelectorAll('input[name="' + field + '"]'), function (r) {
      r.addEventListener('change', function () {
        if (!r.checked) return;
        rulesPref.set(field, r.value);
        adoptSettings();
      });
    });
  });

  // ---------- Init ----------
  if (params.get('debug') === '1') {
    // Test hook (read-only snapshot); not used by the app.
    window.classicGamesDebug = {
      state: function () { return JSON.parse(JSON.stringify({ game: game, mode: mode })); }
    };
  }
  game = newGame();
  applyTheme(readTheme());
  syncSettingsControls();
  updateUI();
  if (window.ResizeObserver) {
    new ResizeObserver(resizeCanvas).observe(canvas);
  } else {
    window.addEventListener('resize', resizeCanvas);
  }
  resizeCanvas();
})();
