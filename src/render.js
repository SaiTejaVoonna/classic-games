// Canvas presentation. Reads a game state and draws it; it never changes gameplay. The snake
// is drawn as one connected, rounded body that follows the grid path, with a gently tapered
// tail and a head with small direction aware eyes. Geometry is computed separately from
// drawing so it can be tested without a browser.
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SnakeRender = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var UNIT = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

  // Body and head proportions, as fractions of one cell.
  var BODY_R = 0.42;     // body half width
  var TAIL_R = 0.2;      // half width at the tail tip
  var TAPER_CELLS = 5;   // the taper spans up to this many cells at the tail
  var HEAD_R = 0.5;
  var EYE_R = 0.13;
  var PUPIL_R = 0.065;

  function sgn(v) { return v > 0 ? 1 : v < 0 ? -1 : 0; }

  function layout(cols, rows, w, h) {
    var cell = Math.min(w / cols, h / rows);
    return { cell: cell, ox: (w - cell * cols) / 2, oy: (h - cell * rows) / 2, cols: cols, rows: rows };
  }

  function cellCenter(l, x, y) {
    return { x: l.ox + (x + 0.5) * l.cell, y: l.oy + (y + 0.5) * l.cell };
  }

  // Half width at joint i of an n cell snake. Grows from the tail tip up to full body width.
  function bodyRadius(i, n, cell) {
    var span = Math.min(TAPER_CELLS, Math.max(1, n - 1));
    var f = Math.min(1, (n - 1 - i) / span);
    return (TAIL_R + (BODY_R - TAIL_R) * f) * cell;
  }

  // Pure description of the snake shapes for a state and canvas size.
  function snakeGeometry(state, w, h) {
    var l = layout(state.cols, state.rows, w, h);
    var n = state.snake.length;
    var joints = state.snake.map(function (s, i) {
      var c = cellCenter(l, s.x, s.y);
      return { x: c.x, y: c.y, r: bodyRadius(i, n, l.cell) };
    });
    var links = [];
    var stubs = [];
    for (var i = 0; i < n - 1; i++) {
      var a = state.snake[i];
      var b = state.snake[i + 1];
      var dx = b.x - a.x;
      var dy = b.y - a.y;
      if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
        links.push({ from: i, to: i + 1 });
      } else {
        // The body crosses a board edge: draw a half cell stub on each side, no long link.
        var ux = Math.abs(dx) > 1 ? -sgn(dx) : sgn(dx);
        var uy = Math.abs(dy) > 1 ? -sgn(dy) : sgn(dy);
        stubs.push({ joint: i, ux: ux, uy: uy, len: l.cell * 0.5 });
        stubs.push({ joint: i + 1, ux: -ux + 0, uy: -uy + 0, len: l.cell * 0.5 });
      }
    }
    var u = UNIT[state.dir] || UNIT.right;
    var hc = joints[0];
    var p = { x: -u.y, y: u.x };
    var eyes = [-1, 1].map(function (side) {
      var cx = hc.x + u.x * l.cell * 0.12 + p.x * side * l.cell * 0.22;
      var cy = hc.y + u.y * l.cell * 0.12 + p.y * side * l.cell * 0.22;
      return {
        x: cx, y: cy, r: l.cell * EYE_R,
        pupil: { x: cx + u.x * l.cell * 0.04, y: cy + u.y * l.cell * 0.04, r: l.cell * PUPIL_R }
      };
    });
    return {
      layout: l,
      joints: joints, links: links, stubs: stubs,
      head: { x: hc.x, y: hc.y, r: l.cell * HEAD_R, ux: u.x, uy: u.y },
      eyes: eyes
    };
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function circle(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
    ctx.fill();
  }

  // Filled capsule-like quad between two joints with their own half widths.
  function link(ctx, a, b, dy) {
    var dx = b.x - a.x;
    var dyy = b.y - a.y;
    var len = Math.sqrt(dx * dx + dyy * dyy) || 1;
    var nx = -dyy / len;
    var ny = dx / len;
    ctx.beginPath();
    ctx.moveTo(a.x + nx * a.r, a.y + ny * a.r + dy);
    ctx.lineTo(b.x + nx * b.r, b.y + ny * b.r + dy);
    ctx.lineTo(b.x - nx * b.r, b.y - ny * b.r + dy);
    ctx.lineTo(a.x - nx * a.r, a.y - ny * a.r + dy);
    ctx.closePath();
    ctx.fill();
  }

  function stub(ctx, j, s, dy) {
    var nx = -s.uy;
    var ny = s.ux;
    var ex = j.x + s.ux * s.len;
    var ey = j.y + s.uy * s.len;
    ctx.beginPath();
    ctx.moveTo(j.x + nx * j.r, j.y + ny * j.r + dy);
    ctx.lineTo(ex + nx * j.r, ey + ny * j.r + dy);
    ctx.lineTo(ex - nx * j.r, ey - ny * j.r + dy);
    ctx.lineTo(j.x - nx * j.r, j.y - ny * j.r + dy);
    ctx.closePath();
    ctx.fill();
  }

  function drawBody(ctx, g, dy) {
    g.joints.forEach(function (j) { circle(ctx, j.x, j.y + dy, j.r); });
    g.links.forEach(function (k) { link(ctx, g.joints[k.from], g.joints[k.to], dy); });
    g.stubs.forEach(function (s) { stub(ctx, g.joints[s.joint], s, dy); });
  }

  // palette: { boardLine, snake, snakeHead, snakeEdge, shine, eye, pupil, food, bonus,
  //            obstacle, obstacleEdge }
  function draw(ctx, state, palette, w, h) {
    var g = snakeGeometry(state, w, h);
    var l = g.layout;
    var cell = l.cell;
    ctx.clearRect(0, 0, w, h);

    // faint grid
    ctx.strokeStyle = palette.boardLine;
    ctx.lineWidth = Math.max(1, cell * 0.04);
    ctx.beginPath();
    var c, r;
    for (c = 1; c < l.cols; c++) { ctx.moveTo(l.ox + c * cell, l.oy); ctx.lineTo(l.ox + c * cell, l.oy + l.rows * cell); }
    for (r = 1; r < l.rows; r++) { ctx.moveTo(l.ox, l.oy + r * cell); ctx.lineTo(l.ox + l.cols * cell, l.oy + r * cell); }
    ctx.stroke();

    // a dashed inner edge shows that the edges wrap
    if (state.wrap && ctx.setLineDash) {
      ctx.save();
      ctx.setLineDash([cell * 0.3, cell * 0.2]);
      ctx.strokeStyle = palette.snake;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = Math.max(1, cell * 0.07);
      ctx.strokeRect(l.ox + cell * 0.06, l.oy + cell * 0.06, l.cols * cell - cell * 0.12, l.rows * cell - cell * 0.12);
      ctx.restore();
    }

    // a solid inner edge shows that the walls are solid
    if (!state.wrap) {
      ctx.save();
      ctx.strokeStyle = palette.obstacleEdge;
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = Math.max(1, cell * 0.07);
      ctx.strokeRect(l.ox + cell * 0.06, l.oy + cell * 0.06, l.cols * cell - cell * 0.12, l.rows * cell - cell * 0.12);
      ctx.restore();
    }

    // maze blocks: solid grid aligned squares, used only as real obstacles
    state.obstacles.forEach(function (o) {
      var pad = cell * 0.05;
      ctx.fillStyle = palette.obstacle;
      roundRect(ctx, l.ox + o.x * cell + pad, l.oy + o.y * cell + pad, cell - 2 * pad, cell - 2 * pad, cell * 0.12);
      ctx.fill();
      ctx.strokeStyle = palette.obstacleEdge;
      ctx.lineWidth = Math.max(1, cell * 0.04);
      ctx.stroke();
    });

    // food: a round fruit with a small highlight
    if (state.food) {
      var f = cellCenter(l, state.food.x, state.food.y);
      ctx.fillStyle = palette.food;
      circle(ctx, f.x, f.y, cell * 0.34);
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#ffffff';
      circle(ctx, f.x - cell * 0.1, f.y - cell * 0.12, cell * 0.08);
      ctx.restore();
    }

    // bonus food: a diamond with a ring that empties as its time runs out
    if (state.bonusItem) {
      var b = cellCenter(l, state.bonusItem.x, state.bonusItem.y);
      var d = cell * 0.3;
      ctx.fillStyle = palette.bonus;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y - d);
      ctx.lineTo(b.x + d, b.y);
      ctx.lineTo(b.x, b.y + d);
      ctx.lineTo(b.x - d, b.y);
      ctx.closePath();
      ctx.fill();
      var frac = Math.max(0, Math.min(1, state.bonusItem.ticksLeft / state.bonusTicks));
      ctx.strokeStyle = palette.bonus;
      ctx.lineWidth = Math.max(1.5, cell * 0.08);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(b.x, b.y, cell * 0.44, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
      ctx.stroke();
    }

    // snake: soft shadow for subtle depth, body, highlight, then head and eyes
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = palette.snakeEdge;
    drawBody(ctx, g, cell * 0.06);
    circle(ctx, g.head.x, g.head.y + cell * 0.06, g.head.r);
    ctx.restore();

    ctx.fillStyle = palette.snake;
    drawBody(ctx, g, 0);

    // one continuous highlight along the body (a new subpath starts after a board edge)
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = palette.shine;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1, cell * 0.14);
    ctx.beginPath();
    var open = -1;
    g.links.forEach(function (k) {
      var a = g.joints[k.from];
      var z = g.joints[k.to];
      if (open !== k.from) ctx.moveTo(a.x - cell * 0.08, a.y - cell * 0.1);
      ctx.lineTo(z.x - cell * 0.08, z.y - cell * 0.1);
      open = k.to;
    });
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = palette.snakeHead;
    circle(ctx, g.head.x + g.head.ux * cell * 0.04, g.head.y + g.head.uy * cell * 0.04, g.head.r);
    g.eyes.forEach(function (e) {
      ctx.fillStyle = palette.eye;
      circle(ctx, e.x, e.y, e.r);
      ctx.fillStyle = palette.pupil;
      circle(ctx, e.pupil.x, e.pupil.y, e.pupil.r);
    });
    return g;
  }

  return {
    BODY_R: BODY_R, TAIL_R: TAIL_R, HEAD_R: HEAD_R, TAPER_CELLS: TAPER_CELLS,
    layout: layout, cellCenter: cellCenter, bodyRadius: bodyRadius,
    snakeGeometry: snakeGeometry, draw: draw
  };
});
