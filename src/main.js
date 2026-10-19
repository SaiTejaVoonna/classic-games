// UI prototype only. No game engine: nothing moves, scores, grows or collides.
// The board below is a static illustration; its grid and proportions are provisional
// and make no claim about the original handset.
(function () {
  'use strict';

  var THEME_KEY = 'classic-games.theme';
  var THEMES = ['colour', 'lcd', 'night'];

  // Provisional illustrative grid (columns x rows). Not historical data.
  var COLS = 21;
  var ROWS = 14;
  // Static illustrative snake, tail first, head last. Purely decorative.
  var SNAKE = [
    [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9], [10, 8], [10, 7], [11, 7], [12, 7], [13, 7]
  ];
  var FOOD = [16, 4];

  var $ = function (id) { return document.getElementById(id); };
  var root = document.documentElement;
  var canvas = $('canvas');
  var ctx = canvas.getContext('2d');

  // ---------- Theme ----------
  function readTheme() {
    try {
      var t = window.localStorage.getItem(THEME_KEY);
      return THEMES.indexOf(t) >= 0 ? t : 'colour';
    } catch { return 'colour'; }
  }
  function saveTheme(t) {
    try { window.localStorage.setItem(THEME_KEY, t); } catch { /* storage unavailable: fine */ }
  }
  function applyTheme(t) {
    root.setAttribute('data-theme', t);
    var radio = document.querySelector('input[name="theme"][value="' + t + '"]');
    if (radio) radio.checked = true;
    draw();
  }

  // ---------- Drawing ----------
  function cssVar(name) {
    return getComputedStyle(root).getPropertyValue(name).trim();
  }

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
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    draw();
  }

  function draw() {
    var w = canvas.width;
    var h = canvas.height;
    var cell = Math.min(w / COLS, h / ROWS);
    var ox = (w - cell * COLS) / 2;
    var oy = (h - cell * ROWS) / 2;
    ctx.clearRect(0, 0, w, h);

    // faint grid
    ctx.strokeStyle = cssVar('--board-line');
    ctx.lineWidth = Math.max(1, cell * 0.04);
    ctx.beginPath();
    for (var c = 1; c < COLS; c++) { ctx.moveTo(ox + c * cell, oy); ctx.lineTo(ox + c * cell, oy + ROWS * cell); }
    for (var r = 1; r < ROWS; r++) { ctx.moveTo(ox, oy + r * cell); ctx.lineTo(ox + COLS * cell, oy + r * cell); }
    ctx.stroke();

    // snake
    var pad = cell * 0.08;
    for (var i = 0; i < SNAKE.length; i++) {
      var isHead = i === SNAKE.length - 1;
      ctx.fillStyle = cssVar(isHead ? '--snake-head' : '--snake');
      roundRect(ox + SNAKE[i][0] * cell + pad, oy + SNAKE[i][1] * cell + pad,
                cell - 2 * pad, cell - 2 * pad, cell * 0.28);
      ctx.fill();
    }

    // food: a diamond, distinct from the square snake segments by shape
    var fx = ox + (FOOD[0] + 0.5) * cell;
    var fy = oy + (FOOD[1] + 0.5) * cell;
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

  // ---------- Interface-preview states (no gameplay) ----------
  var STATES = {
    menu: {
      name: 'Menu',
      status: 'Interface preview only. No game is running.',
      overlay: ''
    },
    ready: {
      name: 'Ready (preview)',
      status: 'Ready state shown for interface review. Gameplay is not implemented.',
      overlay: 'Ready — interface preview only'
    },
    paused: {
      name: 'Paused (preview)',
      status: 'Paused state shown for interface review. Continue returns to the ready preview.',
      overlay: 'Paused — interface preview only'
    }
  };

  var btnNew = $('btn-new');
  var btnPause = $('btn-pause');
  var btnContinue = $('btn-continue');

  var currentState = 'menu';
  var dpadButtons = document.querySelectorAll('.dpad-btn');

  function setState(key) {
    var s = STATES[key];
    currentState = key;
    $('state-name').textContent = s.name;
    $('status').textContent = s.status;
    var overlay = $('overlay');
    overlay.hidden = !s.overlay;
    $('overlay-text').textContent = s.overlay;
    btnPause.disabled = key !== 'ready';
    btnContinue.disabled = key !== 'paused';
    // Direction preview only registers in the ready preview state.
    Array.prototype.forEach.call(dpadButtons, function (b) { b.disabled = key !== 'ready'; });
  }

  btnNew.addEventListener('click', function () {
    setState('ready');
    showInput('none');
    $('board').focus(); // so arrow keys work immediately after an explicit start
  });
  btnPause.addEventListener('click', function () {
    setState('paused');
    btnContinue.focus();
  });
  btnContinue.addEventListener('click', function () {
    setState('ready');
    $('board').focus();
  });

  // ---------- Direction input preview ----------
  function showInput(dir) {
    $('last-input').textContent = dir;
  }
  Array.prototype.forEach.call(dpadButtons, function (b) {
    b.addEventListener('click', function () { showInput(b.getAttribute('data-dir')); });
  });
  var ARROWS = { ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right' };
  $('board').addEventListener('keydown', function (e) {
    if (ARROWS[e.key] && currentState === 'ready') {
      e.preventDefault(); // only while the board has focus
      showInput(ARROWS[e.key]);
    }
  });

  // ---------- Dialogs ----------
  Array.prototype.forEach.call(document.querySelectorAll('[data-open]'), function (b) {
    b.addEventListener('click', function () {
      var dlg = $(b.getAttribute('data-open'));
      if (dlg && typeof dlg.showModal === 'function') dlg.showModal();
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll('input[name="theme"]'), function (r) {
    r.addEventListener('change', function () {
      if (r.checked) { applyTheme(r.value); saveTheme(r.value); }
    });
  });

  // ---------- Init ----------
  applyTheme(readTheme());
  setState('menu');
  if (window.ResizeObserver) {
    new ResizeObserver(resizeCanvas).observe(canvas);
  } else {
    window.addEventListener('resize', resizeCanvas);
  }
  resizeCanvas();
})();
