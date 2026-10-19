'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../src/storage.js');

const SPEEDS = ['slow', 'medium', 'fast'];

function fake(initial) {
  const m = new Map(Object.entries(initial || {}));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
}
const bestStore = (st) => S.createBestStore(st, SPEEDS, 'fast');
const throwing = () => ({ getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } });

// ---- best scores per speed ----
test('best scores start at zero and persist increases only, per speed', () => {
  const st = fake();
  const b = bestStore(st);
  b.load();
  assert.equal(b.get('medium'), 0);
  assert.equal(b.submit('medium', 3), 3);
  assert.equal(b.submit('medium', 2), 3);
  assert.equal(b.submit('slow', 1), 1);
  assert.deepEqual(JSON.parse(st.m.get(S.BEST_KEY)), { v: 2, best: { slow: 1, medium: 3, fast: 0 } });
  assert.equal(b.isPersistent(), true);
});

test('speeds never share a best score', () => {
  const b = bestStore(fake());
  b.load();
  b.submit('fast', 9);
  assert.equal(b.get('slow'), 0);
  assert.equal(b.get('medium'), 0);
  assert.equal(b.get('fast'), 9);
});

test('stored v2 values load per speed', () => {
  const b = bestStore(fake({ [S.BEST_KEY]: JSON.stringify({ v: 2, best: { slow: 4, medium: 6, fast: 8 } }) }));
  b.load();
  assert.deepEqual(SPEEDS.map((s) => b.get(s)), [4, 6, 8]);
});

test('legacy v1 best migrates to Fast only and v1 data is left untouched', () => {
  const v1 = JSON.stringify({ v: 1, best: 12 });
  const st = fake({ [S.BEST_KEY_V1]: v1 });
  const b = bestStore(st);
  b.load();
  assert.deepEqual(SPEEDS.map((s) => b.get(s)), [0, 0, 12]);
  b.submit('slow', 2);
  assert.equal(st.m.get(S.BEST_KEY_V1), v1); // never rewritten or removed
  assert.deepEqual(JSON.parse(st.m.get(S.BEST_KEY)).best, { slow: 2, medium: 0, fast: 12 });
});

test('legacy migration keeps the higher of v1 and v2 for Fast', () => {
  const st = fake({
    [S.BEST_KEY_V1]: JSON.stringify({ v: 1, best: 5 }),
    [S.BEST_KEY]: JSON.stringify({ v: 2, best: { slow: 0, medium: 0, fast: 9 } })
  });
  const b = bestStore(st);
  b.load();
  assert.equal(b.get('fast'), 9);
});

test('corrupt or invalid stored values are ignored per field', () => {
  const bad = ['not json', '{"v":3,"best":{"fast":5}}', '{"v":2,"best":null}', '{"v":2,"best":{"fast":-1,"slow":1.5,"medium":"9"}}', 'null'];
  for (const raw of bad) {
    const b = bestStore(fake({ [S.BEST_KEY]: raw }));
    b.load();
    assert.deepEqual(SPEEDS.map((s) => b.get(s)), [0, 0, 0], raw);
  }
  const mixed = bestStore(fake({ [S.BEST_KEY]: JSON.stringify({ v: 2, best: { slow: 3, medium: 'x', fast: 7 } }) }));
  mixed.load();
  assert.deepEqual(SPEEDS.map((s) => mixed.get(s)), [3, 0, 7]);
});

test('corrupt v2 does not block v1 migration', () => {
  const b = bestStore(fake({ [S.BEST_KEY]: '{oops', [S.BEST_KEY_V1]: JSON.stringify({ v: 1, best: 4 }) }));
  b.load();
  assert.equal(b.get('fast'), 4);
});

test('storage that throws falls back to memory and reports non-persistent', () => {
  const b = bestStore(throwing());
  b.load();
  assert.equal(b.isPersistent(), false);
  assert.equal(b.submit('medium', 4), 4);
  assert.equal(b.get('medium'), 4);
  assert.equal(b.isPersistent(), false);
});

test('quota error on write keeps the session best', () => {
  const st = fake();
  st.setItem = () => { throw new Error('QuotaExceededError'); };
  const b = bestStore(st);
  b.load();
  assert.equal(b.submit('slow', 7), 7);
  assert.equal(b.isPersistent(), false);
});

test('null storage works in memory', () => {
  const b = bestStore(null);
  b.load();
  assert.equal(b.submit('fast', 2), 2);
  assert.equal(b.isPersistent(), false);
});

test('unknown speeds and non-numeric scores are ignored', () => {
  const b = bestStore(fake());
  b.load();
  assert.equal(b.submit('turbo', 5), 0);
  assert.equal(b.submit('slow', NaN), 0);
  assert.equal(b.submit('slow', '5'), 0);
  assert.equal(b.submit('slow', -2), 0);
  assert.equal(b.submit('slow', 1.5), 0);
});

// ---- speed preference ----
test('speed preference defaults, validates, persists', () => {
  const st = fake();
  const p = S.createSpeedPref(st, SPEEDS, 'medium');
  assert.equal(p.load(), 'medium');
  assert.equal(p.set('fast'), 'fast');
  assert.equal(st.m.get(S.SPEED_KEY), 'fast');
  assert.equal(p.isPersistent(), true);
  const again = S.createSpeedPref(st, SPEEDS, 'medium');
  assert.equal(again.load(), 'fast');
});

test('speed preference ignores unknown stored and set values', () => {
  for (const raw of ['turbo', '', '150', 'FAST', '__proto__']) {
    assert.equal(S.createSpeedPref(fake({ [S.SPEED_KEY]: raw }), SPEEDS, 'medium').load(), 'medium', raw);
  }
  const p = S.createSpeedPref(fake(), SPEEDS, 'medium');
  p.load();
  assert.equal(p.set('turbo'), 'medium');
  assert.equal(p.get(), 'medium');
});

test('speed preference survives unavailable and throwing storage for the session', () => {
  const p = S.createSpeedPref(throwing(), SPEEDS, 'medium');
  assert.equal(p.load(), 'medium');
  assert.equal(p.isPersistent(), false);
  assert.equal(p.set('slow'), 'slow');
  assert.equal(p.get(), 'slow');
  const n = S.createSpeedPref(null, SPEEDS, 'medium');
  n.load();
  assert.equal(n.set('fast'), 'fast');
  assert.equal(n.isPersistent(), false);
});

test('inherited object keys are not treated as speeds', () => {
  const b = bestStore(fake());
  b.load();
  for (const k of ['constructor', '__proto__', 'toString']) {
    assert.equal(b.get(k), 0, k);
    assert.equal(b.submit(k, 5), 0, k);
  }
});
