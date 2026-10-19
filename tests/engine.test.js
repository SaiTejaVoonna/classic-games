'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/engine.js');

// Build a state directly for edge-case scenarios.
function make(over) {
  const base = E.createGame({ seed: 7 });
  return Object.assign({}, base, over);
}
const cells = (arr) => arr.map(([x, y]) => ({ x, y }));
function run(state, inputs) {
  // inputs: array of direction strings or null for "just tick"
  const log = [];
  for (const i of inputs) {
    if (i) state = E.turn(state, i);
    const r = E.step(state);
    state = r.state;
    log.push(...r.events);
  }
  return { state, log };
}

test('initial state is deterministic and valid', () => {
  const a = E.createGame({ seed: 42 });
  const b = E.createGame({ seed: 42 });
  assert.deepEqual(a, b);
  assert.equal(a.snake.length, 3);
  assert.equal(a.status, 'ready');
  assert.ok(!a.snake.some((s) => s.x === a.food.x && s.y === a.food.y));
});

test('same seed + same inputs replay identically; different seeds differ', () => {
  const inputs = ['up', null, null, 'right', null, 'down', null, null, 'left', null];
  const r1 = run(E.createGame({ seed: 5 }), inputs).state;
  const r2 = run(E.createGame({ seed: 5 }), inputs).state;
  assert.deepEqual(r1, r2);
  const foods = new Set();
  for (let s = 1; s <= 20; s++) foods.add(JSON.stringify(E.createGame({ seed: s }).food));
  assert.ok(foods.size > 1);
});

test('does not move before the first accepted input', () => {
  let s = E.createGame({ seed: 1 });
  const before = JSON.stringify(s.snake);
  s = E.step(s).state;
  assert.equal(JSON.stringify(s.snake), before);
  assert.equal(s.status, 'ready');
});

test('first input starts the run: same direction starts, reversal is ignored', () => {
  assert.equal(E.turn(E.createGame({ seed: 1 }), 'left').status, 'ready');
  assert.equal(E.turn(E.createGame({ seed: 1 }), 'right').status, 'running');
  assert.equal(E.turn(E.createGame({ seed: 1 }), 'up').status, 'running');
});

test('moves exactly one cell per tick and keeps length', () => {
  let s = E.turn(E.createGame({ seed: 1 }), 'right');
  const head = s.snake[0];
  const r = E.step(s);
  assert.deepEqual(r.state.snake[0], { x: head.x + 1, y: head.y });
  assert.equal(r.state.snake.length, 3);
  assert.equal(r.state.ticks, 1);
});

test('turn queue: reversal of current heading is ignored', () => {
  let s = E.turn(E.createGame({ seed: 1 }), 'right');
  s = E.turn(s, 'left');
  assert.deepEqual(s.queue, []);
});

test('turn queue: up then down in the same tick keeps only up (no instant reversal)', () => {
  let s = E.turn(E.createGame({ seed: 1 }), 'right');
  s = E.turn(s, 'up');
  s = E.turn(s, 'down');
  assert.deepEqual(s.queue, ['up']);
});

test('turn queue: depth is limited to 2 and turns apply one per tick in order', () => {
  let s = E.turn(E.createGame({ seed: 1 }), 'right');
  s = E.turn(s, 'up');
  s = E.turn(s, 'left');
  s = E.turn(s, 'down'); // third, dropped
  assert.deepEqual(s.queue, ['up', 'left']);
  const h0 = s.snake[0];
  s = E.step(s).state;
  assert.deepEqual(s.snake[0], { x: h0.x, y: h0.y - 1 });
  assert.equal(s.dir, 'up');
  s = E.step(s).state;
  assert.deepEqual(s.snake[0], { x: h0.x - 1, y: h0.y - 1 });
  assert.equal(s.dir, 'left');
});

test('repeating the current direction is not queued', () => {
  let s = E.turn(E.createGame({ seed: 1 }), 'right');
  s = E.turn(s, 'right');
  assert.deepEqual(s.queue, []);
});

test('eating food grows by one, scores one, and respawns food off the body', () => {
  const s0 = make({ status: 'running', snake: cells([[5, 5], [4, 5], [3, 5]]), dir: 'right', food: { x: 6, y: 5 }, rng: 99 });
  const r = E.step(s0);
  assert.equal(r.state.score, 1);
  assert.equal(r.state.snake.length, 4);
  assert.deepEqual(r.state.snake[0], { x: 6, y: 5 });
  assert.deepEqual(r.state.snake[3], { x: 3, y: 5 }); // tail did not move
  assert.deepEqual(r.events[0], { type: 'ate', score: 1 });
  assert.ok(!r.state.snake.some((c) => c.x === r.state.food.x && c.y === r.state.food.y));
});

test('food never spawns on the body across many seeds and positions', () => {
  for (let seed = 0; seed < 300; seed++) {
    const g = E.createGame({ seed, cols: 5, rows: 4 });
    assert.ok(!g.snake.some((c) => c.x === g.food.x && c.y === g.food.y), 'seed ' + seed);
    assert.ok(g.food.x >= 0 && g.food.x < 5 && g.food.y >= 0 && g.food.y < 4);
  }
  const body = cells([[0, 0], [1, 0], [2, 0], [0, 1], [1, 1]]);
  for (let seed = 0; seed < 100; seed++) {
    const [f] = E.placeFood(body, 3, 2, seed);
    assert.deepEqual(f, { x: 2, y: 1 }); // only free cell
  }
});

test('wall collision ends the run on each edge; head does not move', () => {
  const cases = [['left', [0, 5]], ['right', [20, 5]], ['up', [5, 0]], ['down', [5, 13]]];
  for (const [dir, [x, y]] of cases) {
    const s0 = make({ status: 'running', dir, snake: [{ x, y }, { x: x + (dir === 'left' ? 1 : -1) * (dir === 'left' || dir === 'right' ? 1 : 0), y: y + (dir === 'up' ? 1 : dir === 'down' ? -1 : 0) }], queue: [], food: { x: 10, y: 10 } });
    const r = E.step(s0);
    assert.equal(r.state.status, 'over', dir);
    assert.equal(r.state.reason, 'wall', dir);
    assert.deepEqual(r.state.snake[0], { x, y }, dir);
    assert.deepEqual(r.events, [{ type: 'over', reason: 'wall' }]);
  }
});

test('self collision ends the run', () => {
  // head at (2,2) heading left into body cell (1,2); not the tail
  const s0 = make({ status: 'running', dir: 'left', queue: [], food: { x: 15, y: 10 },
    snake: cells([[2, 2], [2, 3], [1, 3], [1, 2], [0, 2], [0, 3]]) });
  const r = E.step(s0);
  assert.equal(r.state.status, 'over');
  assert.equal(r.state.reason, 'self');
});

test('tail rule: moving into the cell the tail vacates is allowed when not eating', () => {
  // 2x2 loop: head (1,0) heading down... snake [(1,0),(0,0),(0,1),(1,1)] head moves to (1,1)=tail
  const s0 = make({ status: 'running', dir: 'down', queue: [], food: { x: 15, y: 10 },
    snake: cells([[1, 0], [0, 0], [0, 1], [1, 1]]) });
  const r = E.step(s0);
  assert.equal(r.state.status, 'running');
  assert.deepEqual(r.state.snake[0], { x: 1, y: 1 });
  assert.equal(r.state.snake.length, 4);
});

test('tail rule: moving into the tail cell while eating is a collision', () => {
  const s0 = make({ status: 'running', dir: 'down', queue: [], food: { x: 1, y: 1 },
    snake: cells([[1, 0], [0, 0], [0, 1], [1, 1]]) });
  const r = E.step(s0);
  assert.equal(r.state.status, 'over');
  assert.equal(r.state.reason, 'self');
});

test('finished runs are frozen: step and turn do nothing', () => {
  const over = make({ status: 'over', reason: 'wall' });
  assert.equal(E.step(over).state, over);
  assert.equal(E.turn(over, 'up'), over);
});

test('filling the board ends the run as won with no food', () => {
  // 3x1 board: snake length 2 at (0,0),(1,0)... head (1,0) heading right, food (2,0)
  const s0 = make({ cols: 3, rows: 1, status: 'running', dir: 'right', queue: [], snake: cells([[1, 0], [0, 0]]), food: { x: 2, y: 0 }, rng: 3 });
  const r = E.step(s0);
  assert.equal(r.state.status, 'won');
  assert.equal(r.state.food, null);
  assert.equal(r.state.score, 1);
  assert.deepEqual(r.events.map((e) => e.type), ['ate', 'won']);
});

test('step does not mutate its input', () => {
  const s0 = E.turn(E.createGame({ seed: 9 }), 'up');
  const snapshot = JSON.stringify(s0);
  E.step(s0);
  E.turn(s0, 'left');
  assert.equal(JSON.stringify(s0), snapshot);
});

test('clock: a normal frame yields at most the due ticks', () => {
  assert.deepEqual(E.advanceClock(0, 16, 150, 2), { steps: 0, acc: 16 });
  assert.deepEqual(E.advanceClock(140, 16, 150, 2), { steps: 1, acc: 6 });
});

test('clock: a long gap (hidden tab / stall) is clamped, not replayed', () => {
  const r = E.advanceClock(0, 60000, 150, 2);
  assert.equal(r.steps, 2);
  assert.ok(r.acc < 150);
  assert.equal(E.advanceClock(0, -5, 150, 2).steps, 0);
});

test('tick count tracks elapsed time across refresh rates', () => {
  for (const frame of [1000 / 30, 1000 / 60, 1000 / 144]) {
    let acc = 0, ticks = 0;
    for (let t = 0; t < 30000; t += frame) {
      const r = E.advanceClock(acc, frame, 150, 2);
      acc = r.acc; ticks += r.steps;
    }
    assert.ok(Math.abs(ticks - 200) <= 1, `frame ${frame.toFixed(1)}: ${ticks}`);
  }
});
