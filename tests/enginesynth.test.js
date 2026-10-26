'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { renderLoops, PHYS } = require('../racer/enginesynth.js');

test('every physical engine renders stable, seamless loops at whole crank cycles', () => {
  Object.keys(PHYS).forEach((name) => {
    const loops = renderLoops(name, 44100, .6);
    assert.strictEqual(loops.length, PHYS[name].rpms.length, name);
    loops.forEach((l, i) => {
      let peak = 0, rms = 0;
      for (const v of l.data) { assert.ok(Number.isFinite(v), name + ' finite'); peak = Math.max(peak, Math.abs(v)); rms += v * v; }
      rms = Math.sqrt(rms / l.data.length);
      assert.ok(Math.abs(rms - .1) < .01, name + ' loop level is normalised');
      assert.ok(peak < 2, name + ' does not blow up');
      const cycles = l.data.length * l.rpm / (120 * 44100);
      assert.ok(Math.abs(cycles - Math.round(cycles)) < 1e-6, name + ' loop holds whole crank cycles at ' + i);
      const step = Math.abs(l.data[0] - l.data[l.data.length - 1]);
      assert.ok(step < 6 * rms, name + ' loop seam is continuous');
    });
    assert.ok(loops[0].rpm < loops[loops.length - 1].rpm, name + ' rpm points rise');
  });
});

test('the loops carry the firing note above 800 Hz, where a phone speaker can play it', () => {
  ['rally', 'v8'].forEach((name) => {
    const l = renderLoops(name, 44100, .6)[4], x = l.data, fc = l.rpm / 120;
    let all = 0, hi = 0;
    for (let k = 1; k * fc < 5000; k++) {
      const f = k * fc; let re = 0, im = 0;
      for (let i = 0; i < x.length; i += 2) { const a = 2 * Math.PI * f * i / 44100; re += x[i] * Math.cos(a); im += x[i] * Math.sin(a); }
      const m = re * re + im * im; all += m; if (f > 800) hi += m;
    }
    assert.ok(hi / all > .05, name + ' upper harmonics share ' + (hi / all).toFixed(3));
  });
});
