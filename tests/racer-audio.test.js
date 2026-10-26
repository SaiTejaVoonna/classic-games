'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { create, CHAPTERS, mtof } = require('../racer/audio.js');

test('ten chapters with a scale, tempo, kit and bed each', () => {
  assert.strictEqual(CHAPTERS.length, 10);
  CHAPTERS.forEach((c) => { assert.ok(c.sc.length >= 5 && c.bpm > 60 && c.kit && c.bed); });
});
test('mtof maps A4 to 440 Hz', () => { assert.strictEqual(mtof(69), 440); });
test('without Web Audio every call is silent and safe', () => {
  const a = create({});
  a.unlock(); a.start(); a.setSpeed(40); a.setIntensity(0.5); a.event('coin', { i: 2 }); a.pause(); a.resume(); a.stop();
  assert.strictEqual(a.info().ctx, false);
});

const { engineModel } = require('../racer/audio.js');
test('engine revs climb within a gear, drop on an upshift and idle when stopped', () => {
  assert.strictEqual(Math.round(engineModel(0).rpm), 900);
  let last = engineModel(1), drops = 0;
  for (let k = 2; k <= 260; k++) {
    const m = engineModel(k);
    if (m.gear === last.gear) assert.ok(m.rpm >= last.rpm, 'revs rise inside a gear at ' + k);
    else { assert.ok(m.gear > last.gear && m.rpm < last.rpm - 1500, 'upshift drops revs at ' + k); drops++; }
    assert.ok(m.rpm <= 6000 && m.rpm >= 800);
    last = m;
  }
  assert.strictEqual(drops, 5);
});

const { ENGINES, CAR_ENGINE } = require('../racer/audio.js');
test('every player car has an engine and each engine model stays inside its rev range', () => {
  ['rally', 'sedan', 'ev'].forEach((c) => assert.ok(ENGINES[CAR_ENGINE[c]], c));
  Object.keys(ENGINES).forEach((name) => {
    const P = ENGINES[name]; let last = engineModel(0, P), shifts = 0;
    assert.strictEqual(Math.round(last.rpm), P.idle, name);
    for (let k = 1; k <= 300; k++) {
      const m = engineModel(k, P);
      if (P.ev) assert.ok(m.rpm >= last.rpm, name + ' whine rises with speed');
      else {
        assert.ok(m.rpm <= P.hi + 1 && m.rpm >= P.idle - 1, name + ' revs in range at ' + k);
        if (m.gear > last.gear) { shifts++; assert.ok(m.rpm < last.rpm, name + ' upshift drops revs'); }
      }
      last = m;
    }
    assert.strictEqual(shifts, P.ev ? 0 : 5, name);
  });
});

test('each chapter plays the music kit and ambience that its scenery names', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '../racer/racer.js'), 'utf8');
  const scenes = [...src.matchAll(/name: '([^']+)', kit: '([^']+)', bed: '([^']+)'/g)];
  assert.strictEqual(scenes.length, CHAPTERS.length);
  scenes.forEach((m, i) => {
    assert.strictEqual(CHAPTERS[i].kit, m[2] === 'electro-soft' ? 'electro' : m[2], m[1] + ' kit');
    assert.strictEqual(CHAPTERS[i].bed, m[3], m[1] + ' bed');
  });
});
