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
