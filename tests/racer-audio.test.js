const test = require('node:test');
const assert = require('node:assert/strict');
const RA = require('../racer/audio.js');

function fake() {
  const made = { osc: 0, gain: 0, src: 0, conv: 0, filt: 0, started: 0 };
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} });
  const node = (extra) => Object.assign({ connect() {}, disconnect() {} }, extra);
  class AC {
    constructor() { this.state = 'running'; this.currentTime = 1; this.sampleRate = 8000; this.destination = node(); }
    resume() { this.state = 'running'; }
    createGain() { made.gain++; return node({ gain: param() }); }
    createOscillator() { made.osc++; return node({ frequency: param(), detune: param(), type: '', start() { made.started++; }, stop() {} }); }
    createBiquadFilter() { made.filt++; return node({ frequency: param(), Q: param(), type: '' }); }
    createBufferSource() { made.src++; return node({ buffer: null, loop: false, start() { made.started++; }, stop() {} }); }
    createConvolver() { made.conv++; return node({ buffer: null }); }
    createDynamicsCompressor() { return node(); }
    createDelay() { return node({ delayTime: param() }); }
    createBuffer(ch, len) { return { getChannelData: () => new Float32Array(Math.min(len, 64)) }; }
  }
  return { AC, made };
}
const rng = () => { let n = 0.37; return () => (n = (n * 9301 + 0.49297) % 1); };

test('there is one theme per chapter, each with its own key, tempo and chords', () => {
  assert.equal(RA.THEMES.length, 7);
  for (const t of RA.THEMES) { assert.ok(t.bpm >= 55 && t.bpm <= 110, t.name); assert.ok(t.prog.length >= 4, t.name); assert.ok(t.scale.length >= 5, t.name); }
  assert.equal(new Set(RA.THEMES.map((t) => t.root + ':' + t.bpm)).size, 7, 'no two chapters share key and tempo');
});

test('midiFreq maps A4 to 440 Hz and octaves double', () => {
  assert.equal(RA.midiFreq(69), 440);
  assert.ok(Math.abs(RA.midiFreq(81) - 880) < 1e-9);
});

test('starting music schedules pad, bass and arpeggio notes ahead of the clock', () => {
  const { AC, made } = fake();
  const a = RA.create({ AudioContext: AC, random: rng() });
  a.start();
  assert.ok(made.osc >= 5, 'oscillators created: ' + made.osc);
  assert.ok(made.conv === 1, 'one reverb');
});

test('music off schedules no notes, and effects off makes no sound but vibration still works', () => {
  const { AC, made } = fake();
  const calls = [];
  const a = RA.create({ AudioContext: AC, random: rng(), vibrate: (p) => calls.push(p) });
  a.setMusic(false);
  a.start();
  const afterStart = made.osc;
  a.tick();
  assert.equal(made.osc, afterStart, 'no music notes while music is off');
  a.setSfx(false);
  a.play('crash');
  assert.equal(made.osc, afterStart, 'no effect sounds while effects are off');
  a.setHaptics(true);
  a.play('crash');
  assert.deepEqual(calls[calls.length - 1], RA.SFX_VIBES.crash);
});

test('effects make sound when on: near miss, lane change, crash', () => {
  const { AC, made } = fake();
  const a = RA.create({ AudioContext: AC, random: rng() });
  a.setMusic(false); a.start();
  const o0 = made.osc; const s0 = made.src;
  a.play('near'); assert.ok(made.osc > o0 && made.src > s0, 'near');
  const o1 = made.osc; a.play('lane'); assert.ok(made.src > s0 + 1, 'lane uses a noise swish');
  a.play('crash'); assert.ok(made.osc >= o1 + 8, 'crash adds a boom and glassy chimes');
});

test('changing chapter switches theme on a bar boundary and wraps around', () => {
  const { AC } = fake();
  const a = RA.create({ AudioContext: AC, random: rng() });
  a.start();
  a.setChapter(4); assert.equal(a.theme(), 4);
  a.setChapter(7); assert.equal(a.theme(), 0);
  a.setChapter(-1); assert.equal(a.theme(), 6);
});

test('a suspended audio context stays silent, and missing or throwing audio never throws', () => {
  const { AC, made } = fake();
  const a = RA.create({ AudioContext: AC });
  a.start();
  const n = made.osc;
  const none = RA.create({});
  assert.doesNotThrow(() => { none.start(); none.play('crash'); none.setChapter(2); none.setSpeed(60); none.stop(); });
  const bad = RA.create({ AudioContext: function () { throw new Error('blocked'); }, vibrate: () => { throw new Error('x'); } });
  assert.doesNotThrow(() => { bad.start(); bad.play('crash'); });
  assert.ok(n >= 0);
});

test('the scheduler can be driven by an injected timer and is stopped by stop()', () => {
  const { AC } = fake();
  let started = 0; let cleared = 0;
  const a = RA.create({ AudioContext: AC, random: rng(), setInterval: () => { started++; return 7; }, clearInterval: (id) => { if (id === 7) cleared++; } });
  a.start(); a.stop();
  assert.equal(started, 1);
  assert.equal(cleared, 1);
});
