'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../src/storage.js');

function fake(initial) {
  const m = new Map(initial ? [[S.BEST_KEY, initial]] : []);
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), m };
}

test('starts at zero and persists increases only', () => {
  const st = fake();
  const b = S.createBestStore(st);
  assert.equal(b.load(), 0);
  assert.equal(b.submit(3), 3);
  assert.equal(b.submit(2), 3);
  assert.equal(JSON.parse(st.m.get(S.BEST_KEY)).best, 3);
  assert.equal(b.isPersistent(), true);
});

test('loads a stored best', () => {
  const b = S.createBestStore(fake(JSON.stringify({ v: 1, best: 12 })));
  assert.equal(b.load(), 12);
});

test('corrupt or invalid stored values are ignored', () => {
  for (const raw of ['not json', '{"v":2,"best":5}', '{"v":1,"best":-1}', '{"v":1,"best":1.5}', '{"v":1,"best":"9"}', 'null']) {
    assert.equal(S.createBestStore(fake(raw)).load(), 0, raw);
  }
});

test('storage that throws on read falls back to memory', () => {
  const bad = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  const b = S.createBestStore(bad);
  assert.equal(b.load(), 0);
  assert.equal(b.isPersistent(), false);
  assert.equal(b.submit(4), 4);
  assert.equal(b.get(), 4);
  assert.equal(b.isPersistent(), false);
});

test('quota error on write keeps the session best and reports non-persistent', () => {
  const st = fake();
  st.setItem = () => { throw new Error('QuotaExceededError'); };
  const b = S.createBestStore(st);
  b.load();
  assert.equal(b.submit(7), 7);
  assert.equal(b.isPersistent(), false);
});

test('null storage (unavailable) works in memory', () => {
  const b = S.createBestStore(null);
  assert.equal(b.load(), 0);
  assert.equal(b.submit(2), 2);
  assert.equal(b.isPersistent(), false);
});

test('non-numeric scores are ignored', () => {
  const b = S.createBestStore(fake());
  b.load();
  assert.equal(b.submit(NaN), 0);
  assert.equal(b.submit('5'), 0);
});
