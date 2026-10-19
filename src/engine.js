// Deterministic Snake simulation. No DOM, storage, sound or wall clock.
// All rules and constants here are PROVISIONAL DEVELOPMENT ASSUMPTIONS for an early
// prototype; none are verified against any original handset. See docs/PLAYABLE_PROTOTYPE.md.
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SnakeEngine = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // assumption A3/A17: prototype speed settings (ms per tick). These are NOT the original
  // game's levels; their values are comfort choices from owner testing.
  var SPEEDS = { slow: 300, medium: 220, fast: 150 };
  var SPEED_ORDER = ['slow', 'medium', 'fast'];
  var DEFAULT_SPEED = 'medium';

  var DEFAULTS = {
    cols: 21,        // assumption A1: provisional board size
    rows: 14,
    startLength: 3,  // assumption A2
    maxQueuedTurns: 2, // assumption A4
    maxCatchUpSteps: 2 // assumption A5: bound on steps per rendered frame
  };

  var DELTA = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  };
  var OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

  // mulberry32 as a pure step: returns [value in [0,1), nextState]
  function nextRandom(s) {
    s = (s + 0x6D2B79F5) | 0;
    var t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return [((t ^ (t >>> 14)) >>> 0) / 4294967296, s];
  }

  function hasOwn(obj, k) { return Object.prototype.hasOwnProperty.call(obj, k); }

  function key(x, y) { return x + ',' + y; }

  // Uniform choice among cells not occupied by the snake. Returns [cell|null, rngState].
  function placeFood(snake, cols, rows, rngState) {
    var occupied = {};
    for (var i = 0; i < snake.length; i++) occupied[key(snake[i].x, snake[i].y)] = true;
    var free = [];
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        if (!occupied[key(x, y)]) free.push({ x: x, y: y });
      }
    }
    if (free.length === 0) return [null, rngState];
    var r = nextRandom(rngState);
    return [free[Math.floor(r[0] * free.length)], r[1]];
  }

  function opts(o) {
    var out = {};
    for (var k in DEFAULTS) out[k] = o && o[k] !== undefined ? o[k] : DEFAULTS[k];
    return out;
  }

  // status: 'ready' (not started), 'running', 'over', 'won' (board full)
  function createGame(options) {
    var o = opts(options);
    var seed = options && options.seed !== undefined ? options.seed | 0 : 1;
    var headX = Math.min(o.cols - 1, o.startLength + 4); // assumption A6: fixed start cell
    var y = Math.floor(o.rows / 2);
    var snake = [];
    for (var i = 0; i < o.startLength; i++) snake.push({ x: headX - i, y: y });
    var f = placeFood(snake, o.cols, o.rows, seed);
    var speed = options && hasOwn(SPEEDS, options.speed) ? options.speed : DEFAULT_SPEED;
    return {
      cols: o.cols, rows: o.rows,
      speed: speed, tickMs: SPEEDS[speed], // fixed for the life of the run
      maxQueuedTurns: o.maxQueuedTurns,
      snake: snake, dir: 'right', queue: [],
      food: f[0], rng: f[1],
      score: 0, ticks: 0, status: 'ready', reason: null
    };
  }

  function copy(state, changes) {
    var out = {};
    for (var k in state) out[k] = state[k];
    for (var c in changes) out[c] = changes[c];
    return out;
  }

  // Queue a direction. A reversal of the most recent (queued or current) direction and a
  // repeat of it are ignored; at most maxQueuedTurns are kept. The first accepted input
  // in 'ready' starts the run (assumption A7).
  function turn(state, dir) {
    if (!DELTA[dir]) return state;
    if (state.status === 'ready') {
      if (dir === OPPOSITE[state.dir]) return state;
      return copy(state, { status: 'running', queue: dir === state.dir ? [] : [dir] });
    }
    if (state.status !== 'running') return state;
    var last = state.queue.length ? state.queue[state.queue.length - 1] : state.dir;
    if (dir === last || dir === OPPOSITE[last]) return state;
    if (state.queue.length >= state.maxQueuedTurns) return state;
    return copy(state, { queue: state.queue.concat(dir) });
  }

  // Advance exactly one logical tick. Returns { state, events }.
  function step(state) {
    if (state.status !== 'running') return { state: state, events: [] };
    var dir = state.queue.length ? state.queue[0] : state.dir;
    var queue = state.queue.slice(1);
    var d = DELTA[dir];
    var head = state.snake[0];
    var nx = head.x + d.x;
    var ny = head.y + d.y;

    // assumption A8: walls are lethal (no wrap)
    if (nx < 0 || ny < 0 || nx >= state.cols || ny >= state.rows) {
      return { state: copy(state, { status: 'over', reason: 'wall', dir: dir, queue: queue }),
               events: [{ type: 'over', reason: 'wall' }] };
    }

    var eating = !!state.food && nx === state.food.x && ny === state.food.y;
    // assumption A9: a cell being vacated by the tail this tick is free unless growing
    var limit = eating ? state.snake.length : state.snake.length - 1;
    for (var i = 0; i < limit; i++) {
      if (state.snake[i].x === nx && state.snake[i].y === ny) {
        return { state: copy(state, { status: 'over', reason: 'self', dir: dir, queue: queue }),
                 events: [{ type: 'over', reason: 'self' }] };
      }
    }

    var snake = [{ x: nx, y: ny }].concat(eating ? state.snake : state.snake.slice(0, -1));
    var changes = { snake: snake, dir: dir, queue: queue, ticks: state.ticks + 1 };
    var events = [];
    if (eating) {
      changes.score = state.score + 1; // assumption A10: +1 per food, +1 segment per food
      events.push({ type: 'ate', score: changes.score });
      var f = placeFood(snake, state.cols, state.rows, state.rng);
      changes.food = f[0];
      changes.rng = f[1];
      if (!f[0]) { // assumption A11: a full board ends the run as complete
        changes.status = 'won';
        events.push({ type: 'won' });
      }
    }
    return { state: copy(state, changes), events: events };
  }

  // Frame-clock helper: converts elapsed time to a bounded number of ticks. Large gaps
  // (hidden tab, stalls) are clamped instead of replayed, so there is no catch-up burst.
  function advanceClock(acc, dtMs, tickMs, maxSteps) {
    var dt = Math.min(Math.max(dtMs, 0), tickMs * maxSteps);
    var total = acc + dt;
    var steps = Math.min(Math.floor(total / tickMs), maxSteps);
    var rest = total - steps * tickMs;
    return { steps: steps, acc: rest >= tickMs ? 0 : rest };
  }

  return {
    SPEEDS: SPEEDS,
    SPEED_ORDER: SPEED_ORDER,
    DEFAULT_SPEED: DEFAULT_SPEED,
    DEFAULTS: DEFAULTS,
    createGame: createGame,
    turn: turn,
    step: step,
    placeFood: placeFood,
    advanceClock: advanceClock
  };
});
