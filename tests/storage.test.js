'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../src/storage.js');
const E = require('../src/engine.js');

const SPEEDS = ['slow', 'medium', 'fast'];
const legacyKey = (s) => (E.isProfileKey(s + '|classic|clear|walls|nobonus') ? s + '|classic|clear|walls|nobonus' : '');
const OPTS = { isKey: E.isProfileKey, legacyKey };
const K = (speed, lives, board, edges, bonus) => [speed, lives, board, edges, bonus].join('|');
const DEFAULT_KEY = 'slow|classic|clear|walls|bonus';

function fake(initial) {
  const m = new Map(Object.entries(initial || {}));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
}
const bestStore = (st) => S.createBestStore(st, OPTS);
const throwing = () => ({ getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } });

// ---- best scores per rules profile ----
test('best scores start at zero and persist increases only, per profile', () => {
  const st = fake();
  const b = bestStore(st);
  b.load();
  assert.equal(b.get(DEFAULT_KEY), 0);
  assert.equal(b.submit(DEFAULT_KEY, 3), 3);
  assert.equal(b.submit(DEFAULT_KEY, 2), 3);
  const other = K('slow', 'extra', 'clear', 'walls', 'bonus');
  assert.equal(b.submit(other, 1), 1);
  assert.deepEqual(JSON.parse(st.m.get(S.BEST_KEY)), { v: 3, best: { [DEFAULT_KEY]: 3, [other]: 1 } });
  assert.equal(b.isPersistent(), true);
});

test('unlike runs never share a best score (lives, board, edges, bonus, speed)', () => {
  const b = bestStore(fake());
  b.load();
  const variants = [
    K('slow', 'classic', 'clear', 'walls', 'bonus'),
    K('medium', 'classic', 'clear', 'walls', 'bonus'),
    K('slow', 'extra', 'clear', 'walls', 'bonus'),
    K('slow', 'unlimited', 'clear', 'walls', 'bonus'),
    K('slow', 'classic', 'gate', 'walls', 'bonus'),
    K('slow', 'classic', 'clear', 'wrap', 'bonus'),
    K('slow', 'classic', 'clear', 'walls', 'nobonus')
  ];
  variants.forEach((k, i) => b.submit(k, i + 1));
  variants.forEach((k, i) => assert.equal(b.get(k), i + 1, k));
});

test('entries lists recorded profiles, highest first', () => {
  const b = bestStore(fake());
  b.load();
  b.submit(K('fast', 'classic', 'clear', 'walls', 'bonus'), 4);
  b.submit(DEFAULT_KEY, 9);
  b.submit(K('slow', 'extra', 'clear', 'walls', 'bonus'), 4);
  const e = b.entries();
  assert.equal(e[0][0], DEFAULT_KEY);
  assert.equal(e.length, 3);
  assert.ok(e.every(([k]) => E.isProfileKey(k)));
});

test('stored v3 values load', () => {
  const k = K('medium', 'extra', 'frame', 'wrap', 'nobonus');
  const b = bestStore(fake({ [S.BEST_KEY]: JSON.stringify({ v: 3, best: { [k]: 8 } }) }));
  b.load();
  assert.equal(b.get(k), 8);
});

test('v2 per speed data migrates to the classic clear walls no bonus profile; v2 is untouched', () => {
  const v2 = JSON.stringify({ v: 2, best: { slow: 4, medium: 6, fast: 8 } });
  const st = fake({ [S.BEST_KEY_V2]: v2 });
  const b = bestStore(st);
  b.load();
  assert.equal(b.get(K('slow', 'classic', 'clear', 'walls', 'nobonus')), 4);
  assert.equal(b.get(K('medium', 'classic', 'clear', 'walls', 'nobonus')), 6);
  assert.equal(b.get(K('fast', 'classic', 'clear', 'walls', 'nobonus')), 8);
  assert.equal(b.get(DEFAULT_KEY), 0, 'not merged into the bonus profile');
  b.submit(DEFAULT_KEY, 2);
  assert.equal(st.m.get(S.BEST_KEY_V2), v2);
});

test('v1 legacy best migrates to the Fast legacy profile; v1 is untouched', () => {
  const v1 = JSON.stringify({ v: 1, best: 12 });
  const st = fake({ [S.BEST_KEY_V1]: v1 });
  const b = bestStore(st);
  b.load();
  assert.equal(b.get(K('fast', 'classic', 'clear', 'walls', 'nobonus')), 12);
  b.submit(DEFAULT_KEY, 1);
  assert.equal(st.m.get(S.BEST_KEY_V1), v1);
  const stored = JSON.parse(st.m.get(S.BEST_KEY));
  assert.equal(stored.best[K('fast', 'classic', 'clear', 'walls', 'nobonus')], 12);
});

test('migration keeps the highest of v1, v2 and v3 for the same profile', () => {
  const k = K('fast', 'classic', 'clear', 'walls', 'nobonus');
  const b = bestStore(fake({
    [S.BEST_KEY_V1]: JSON.stringify({ v: 1, best: 5 }),
    [S.BEST_KEY_V2]: JSON.stringify({ v: 2, best: { fast: 9 } }),
    [S.BEST_KEY]: JSON.stringify({ v: 3, best: { [k]: 7 } })
  }));
  b.load();
  assert.equal(b.get(k), 9);
});

test('corrupt, invalid or foreign keys are ignored', () => {
  const bad = ['not json', '{"v":4,"best":{}}', '{"v":3,"best":null}', JSON.stringify({ v: 3, best: { nonsense: 5, [DEFAULT_KEY]: -1, 'slow|classic|clear|walls|maybe': 3, 'slow|classic|clear|walls|bonus ': 2 } }), 'null'];
  for (const raw of bad) {
    const b = bestStore(fake({ [S.BEST_KEY]: raw }));
    b.load();
    assert.equal(b.entries().length, 0, raw);
  }
  const mixed = bestStore(fake({ [S.BEST_KEY]: JSON.stringify({ v: 3, best: { [DEFAULT_KEY]: 7, nonsense: 5, '__proto__': 4 } }) }));
  mixed.load();
  assert.deepEqual(mixed.entries(), [[DEFAULT_KEY, 7]]);
});

test('corrupt v3 does not block migration of older data', () => {
  const b = bestStore(fake({ [S.BEST_KEY]: '{oops', [S.BEST_KEY_V1]: JSON.stringify({ v: 1, best: 4 }) }));
  b.load();
  assert.equal(b.get(K('fast', 'classic', 'clear', 'walls', 'nobonus')), 4);
});

test('storage that throws falls back to memory and reports non-persistent', () => {
  const b = bestStore(throwing());
  b.load();
  assert.equal(b.isPersistent(), false);
  assert.equal(b.submit(DEFAULT_KEY, 4), 4);
  assert.equal(b.get(DEFAULT_KEY), 4);
  assert.equal(b.isPersistent(), false);
});

test('quota error on write keeps the session best', () => {
  const st = fake();
  st.setItem = () => { throw new Error('QuotaExceededError'); };
  const b = bestStore(st);
  b.load();
  assert.equal(b.submit(DEFAULT_KEY, 7), 7);
  assert.equal(b.isPersistent(), false);
});

test('null storage works in memory', () => {
  const b = bestStore(null);
  b.load();
  assert.equal(b.submit(DEFAULT_KEY, 2), 2);
  assert.equal(b.isPersistent(), false);
});

test('unknown profiles and bad scores are ignored', () => {
  const b = bestStore(fake());
  b.load();
  for (const k of ['turbo', '', 'constructor', '__proto__', 'slow|classic|clear|walls|maybe']) assert.equal(b.submit(k, 5), 0, k);
  for (const v of [NaN, '5', -2, 1.5, Infinity]) assert.equal(b.submit(DEFAULT_KEY, v), 0, String(v));
  assert.equal(b.get('constructor'), 0);
});

// ---- speed preference ----
test('speed preference defaults, validates, persists', () => {
  const st = fake();
  const p = S.createSpeedPref(st, SPEEDS, 'slow');
  assert.equal(p.load(), 'slow');
  assert.equal(st.m.has(S.SPEED_KEY), false, 'nothing written until the user chooses');
  assert.equal(p.set('fast'), 'fast');
  assert.equal(st.m.get(S.SPEED_KEY), 'fast');
  assert.equal(S.createSpeedPref(st, SPEEDS, 'slow').load(), 'fast');
});

test('speed preference ignores unknown stored and set values', () => {
  for (const raw of ['turbo', '', '150', 'FAST', '__proto__']) {
    assert.equal(S.createSpeedPref(fake({ [S.SPEED_KEY]: raw }), SPEEDS, 'slow').load(), 'slow', raw);
  }
  const p = S.createSpeedPref(fake(), SPEEDS, 'slow');
  p.load();
  assert.equal(p.set('turbo'), 'slow');
});

test('speed preference survives unavailable and throwing storage for the session', () => {
  const p = S.createSpeedPref(throwing(), SPEEDS, 'slow');
  assert.equal(p.load(), 'slow');
  assert.equal(p.isPersistent(), false);
  assert.equal(p.set('medium'), 'medium');
  const n = S.createSpeedPref(null, SPEEDS, 'slow');
  n.load();
  assert.equal(n.set('fast'), 'fast');
  assert.equal(n.isPersistent(), false);
});

// ---- rules preference ----
const SCHEMA = { board: E.MAZE_ORDER, edges: E.EDGES_ORDER, lives: E.LIVES_ORDER, bonus: ['on', 'off'] };
const DEFAULTS = { board: 'clear', edges: 'walls', lives: 'classic', bonus: 'on' };
const rulesPref = (st) => S.createRulesPref(st, SCHEMA, DEFAULTS);

test('rules preference: defaults are classic, clear, solid walls, bonus on; Unlimited is off by default', () => {
  const st = fake();
  const p = rulesPref(st);
  p.load();
  assert.deepEqual(p.get(), DEFAULTS);
  assert.notEqual(p.get().lives, 'unlimited');
  assert.equal(st.m.has(S.RULES_KEY), false, 'nothing is written until the user chooses');
});

test('rules preference: each choice persists and reloads', () => {
  const st = fake();
  const p = rulesPref(st);
  p.load();
  p.set('board', 'gate'); p.set('edges', 'wrap'); p.set('lives', 'unlimited'); p.set('bonus', 'off');
  assert.deepEqual(JSON.parse(st.m.get(S.RULES_KEY)), { v: 1, board: 'gate', edges: 'wrap', lives: 'unlimited', bonus: 'off' });
  const again = rulesPref(st);
  again.load();
  assert.deepEqual(again.get(), { board: 'gate', edges: 'wrap', lives: 'unlimited', bonus: 'off' });
  assert.equal(again.isPersistent(), true);
});

test('rules preference: invalid fields fall back individually', () => {
  const st = fake({ [S.RULES_KEY]: JSON.stringify({ v: 1, board: 'frame', edges: 'bogus', lives: 5, bonus: 'off', extra: 'x' }) });
  const p = rulesPref(st);
  p.load();
  assert.deepEqual(p.get(), { board: 'frame', edges: 'walls', lives: 'classic', bonus: 'off' });
  for (const raw of ['not json', '{"v":2,"board":"gate"}', 'null', '[]']) {
    const q = rulesPref(fake({ [S.RULES_KEY]: raw }));
    q.load();
    assert.deepEqual(q.get(), DEFAULTS, raw);
  }
});

test('rules preference: unknown fields and values are ignored on set', () => {
  const p = rulesPref(fake());
  p.load();
  p.set('board', 'maze9'); p.set('colour', 'red'); p.set('lives', '__proto__'); p.set('constructor', 'x');
  assert.deepEqual(p.get(), DEFAULTS);
});

test('rules preference: throwing and null storage keep the choice for the session', () => {
  for (const st of [throwing(), null]) {
    const p = rulesPref(st);
    p.load();
    assert.equal(p.isPersistent(), false);
    p.set('lives', 'extra');
    assert.equal(p.get().lives, 'extra');
    assert.equal(p.isPersistent(), false);
  }
});

test('rules preference: get returns a copy', () => {
  const p = rulesPref(fake());
  p.load();
  p.get().board = 'frame';
  assert.equal(p.get().board, 'clear');
});
