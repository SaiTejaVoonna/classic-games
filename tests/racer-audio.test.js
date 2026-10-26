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
