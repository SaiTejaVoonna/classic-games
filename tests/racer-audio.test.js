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
