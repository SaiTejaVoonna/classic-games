'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Score = require('../racer/score.js');

test('ten themes, one per chapter, with the same names as the scenery', () => {
  const src = fs.readFileSync(path.join(__dirname, '../racer/racer.js'), 'utf8');
  const names = [...src.matchAll(/name: '([^']+)', kit: /g)].map((m) => m[1]);
  assert.strictEqual(Score.THEMES.length, 10);
  Score.THEMES.forEach((T, i) => assert.strictEqual(T.name, names[i]));
});

test('every motif and chord stays in a playable range and inside two bars', () => {
  Score.THEMES.forEach((T) => {
    assert.ok(Score.MODES[T.mode], T.name + ' mode');
    assert.strictEqual(T.prog.length, 8); assert.strictEqual(T.progB.length, 8);
    assert.strictEqual(T.levels.length, Score.STEMS.length);
    T.levels.forEach((l) => assert.ok(l >= 0 && l <= 3));
    for (let g = 0; g < 2; g++) {
      const notes = Score.motifNotes(T, g);
      assert.ok(notes.length >= 4 && notes.length <= 9, T.name + ' motif length');
      notes.forEach((n) => { assert.ok(n.beat >= 0 && n.beat + n.len <= 8.01, T.name + ' fits two bars'); assert.ok(n.midi >= 40 && n.midi <= 96, T.name + ' note range ' + n.midi); });
    }
    for (let b = 0; b < 16; b++) Score.chord(T, Score.progression(T, b)).forEach((m) => assert.ok(m >= 40 && m <= 100, T.name + ' chord range'));
  });
});

test('the finale brings back the opening motif of the first chapter', () => {
  assert.deepStrictEqual(Score.THEMES[9].motif, Score.THEMES[0].motif);
});

test('intensity follows the plan and the driving, and stays between 0 and 1', () => {
  for (let c = 0; c < 10; c++) for (const f of [0, .5, 1]) for (const d of [0, .5, 1]) { const I = Score.intensity(c, f, d); assert.ok(I >= 0 && I <= 1); }
  assert.ok(Score.intensity(7, .5, .8) > Score.intensity(0, .5, .8) + .2, 'Storm Pass is more intense than the opening');
  assert.ok(Score.intensity(3, .5, 1) > Score.intensity(3, .5, 0));
});

test('each chapter opens with the lead and the air alone, and the layers come in with intensity', () => {
  const T = Score.THEMES[7], st = { chT: 2, rest: false, calm: false, lives: 3, maxLives: 3 };
  const intro = Score.levels(T, .9, st);
  assert.ok(intro.lead > 0 && intro.air > 0);
  ['pulse', 'strings', 'brass', 'perc', 'choir'].forEach((k) => assert.strictEqual(intro[k], 0, k + ' waits'));
  const late = Score.levels(T, .95, { chT: 30, rest: false, calm: false, lives: 3, maxLives: 3 });
  ['pulse', 'strings', 'brass', 'perc'].forEach((k) => assert.ok(late[k] > .5, k + ' plays at the peak'));
  const calm = Score.levels(Score.THEMES[0], .2, { chT: 30, rest: false, calm: false, lives: 3, maxLives: 3 });
  assert.strictEqual(calm.brass, 0, 'brass is not in the opening chapter');
  assert.ok(calm.lead > 0);
});

test('a rest stop strips the score back and one life left starts the heartbeat', () => {
  const T = Score.THEMES[5];
  const rest = Score.levels(T, .9, { chT: 40, rest: true, calm: false, lives: 3, maxLives: 3 });
  assert.strictEqual(rest.perc, 0); assert.strictEqual(rest.pulse, 0); assert.ok(rest.lead >= .6);
  assert.strictEqual(Score.levels(T, .5, { chT: 40, rest: false, calm: false, lives: 1, maxLives: 3 }).heart, 1);
  assert.strictEqual(Score.levels(T, .5, { chT: 40, rest: false, calm: false, lives: 2, maxLives: 3 }).heart, 0);
});

test('calm mode softens brass and percussion', () => {
  const T = Score.THEMES[7], base = { chT: 40, rest: false, lives: 3, maxLives: 3 };
  const a = Score.levels(T, .95, Object.assign({ calm: false }, base)), b = Score.levels(T, .95, Object.assign({ calm: true }, base));
  assert.ok(b.brass < a.brass * .5 && b.perc < a.perc * .5);
});

test('every chapter has a groove from the start: bass, a pulse and a beat once the short intro is over', () => {
  Score.THEMES.forEach((T, i) => {
    const I = Score.intensity(i, .5, .8 * (i + .5) / 10), L = Score.levels(T, I, { chT: 30, rest: false, calm: false, lives: 3, maxLives: 3, bar: 10 });
    assert.ok(L.bass > .1 && L.pulse > .1 && L.perc > .1, T.name + ' ' + JSON.stringify(L));
  });
  const T = Score.THEMES[0];
  assert.strictEqual(Score.levels(T, .5, { chT: 1, rest: false, calm: false, lives: 3, maxLives: 3 }).perc, 0, 'a moment of lead and air first');
  assert.ok(Score.levels(T, .5, { chT: 7, rest: false, calm: false, lives: 3, maxLives: 3 }).perc > 0, 'and the band is in within seconds');
});

test('a chapter is a song with sections: the break drops the drums, B and the drop add a second melody', () => {
  const names = []; for (let b = 0; b < 32; b++) names.push(Score.section(b).name);
  assert.deepStrictEqual([...new Set(names)], ['A', 'B', 'break', 'drop']);
  assert.strictEqual(Score.section(32).name, 'A', 'the form loops every 32 bars');
  const T = Score.THEMES[7], st = (bar) => ({ chT: 60, rest: false, calm: false, lives: 3, maxLives: 3, bar });
  assert.strictEqual(Score.levels(T, .9, st(17)).perc, 0, 'the break has no drums');
  assert.ok(Score.levels(T, .9, st(22)).perc > .5, 'the drop brings them back');
  assert.ok(Score.section(8).counter && Score.section(20).counter && !Score.section(0).counter);
  assert.ok(Score.section(7).fill && Score.section(19).fill, 'a fill closes each section');
});

test('chapters roll their chords in different patterns', () => {
  const pats = new Set(Score.THEMES.map((T) => JSON.stringify(Score.arp(T))));
  assert.ok(pats.size >= 5, pats.size + ' patterns');
});

test('Drive (phonk-inspired) keeps each chapter key, goes dark, and sits in a half-time tempo', () => {
  Score.THEMES.forEach((T, i) => {
    const D = Score.driveTheme(T, i);
    assert.ok(D.mode !== 'major', T.name + ' is dark');
    assert.ok(D.bpm >= 126 && D.bpm <= 150, T.name + ' tempo ' + D.bpm);
    assert.strictEqual(Math.abs((D.root - T.root) % 12), 0, 'same key');
    assert.ok(D.riff.length >= 6 && D.riff.every((n) => n[0] + n[2] <= 8.01), 'the riff fits two bars');
  });
});
