/* Racer score: the music as data, plus the small pure functions that decide which layers play.
   One theme per chapter, written as: key, mode, tempo, a two-bar motif (question and answer), an
   eight-bar chord loop, the lead voice, and how loud each layer may get in that chapter.
   Layers: air, lead, pulse, strings, brass, perc, choir, bass. The audio engine plays them.
   Classic Games prototype music, not tuned by ear yet. */
(function (root) {
  'use strict';

  var MODES = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10]
  };
  var STEMS = ['air', 'lead', 'pulse', 'strings', 'brass', 'perc', 'choir', 'bass'];
  // Each layer enters when the music intensity passes its threshold (0 to 1).
  var THRESH = { air: 0, lead: 0, pulse: .22, strings: .36, brass: .7, perc: .48, choir: .4, bass: .1 };

  function rot(a, n) { return a.slice(n).concat(a.slice(0, n)); }
  // m(root, mode, bpm, lead, ost, kit, prog, motif, levels): levels are 0..3 per layer, in STEMS order.
  function theme(o) { o.progB = rot(o.prog, 4); return o; }
  // motif entries are [beat, scale degree, length in beats] across two bars (8 beats): question, then answer.
  var THEMES = [
    theme({ name: 'Dawn Meadow', root: 57, mode: 'major', bpm: 84, lead: 'piano', ost: 'pluck', kit: 'soft', prog: [0, 4, 5, 3, 0, 4, 3, 4],
      motif: [[0, 4, 1], [1, 5, 1], [2, 4, 1], [3, 2, 2], [4, 1, 1], [5, 2, 1], [6, 1, 1], [7, 0, 1]], levels: [3, 3, 1, 0, 0, 0, 0, 1] }),
    theme({ name: 'Cherry Hills', root: 62, mode: 'major', bpm: 88, lead: 'pluck', ost: 'pluck', kit: 'soft', prog: [0, 4, 3, 0, 5, 3, 4, 0],
      motif: [[0, 2, .5], [.5, 4, .5], [1, 7, 1], [2.5, 6, .5], [3, 4, 1], [4, 5, 1], [5, 4, 1], [6, 2, 2]], levels: [3, 3, 1, 1, 0, 0, 0, 1] }),
    theme({ name: 'Desert Road', root: 55, mode: 'dorian', bpm: 78, lead: 'guitar', ost: 'guitar', kit: 'soft', prog: [0, 6, 3, 0, 0, 6, 4, 0],
      motif: [[0, 0, 1.5], [1.5, 2, .5], [2, 4, 1], [3, 3, 1], [4, 2, 1.5], [5.5, 1, .5], [6, 0, 2]], levels: [2, 3, 2, 1, 0, 1, 0, 1] }),
    theme({ name: 'Amber Valley', root: 59, mode: 'major', bpm: 76, lead: 'cello', ost: 'pluck', kit: 'soft', prog: [0, 5, 3, 4, 0, 5, 1, 4],
      motif: [[0, 4, 2], [2, 3, 1], [3, 2, 1], [4, 0, 3], [7, 1, 1]], levels: [2, 3, 2, 2, 0, 1, 1, 1] }),
    theme({ name: 'Sunset Coast', root: 60, mode: 'major', bpm: 92, lead: 'handpan', ost: 'handpan', kit: 'soft', prog: [0, 5, 3, 4, 0, 2, 3, 4],
      motif: [[0, 2, 1], [1, 4, 1], [2, 7, 1], [3, 6, 1], [4, 4, 2], [6, 2, 1], [7, 4, 1]], levels: [3, 3, 2, 2, 1, 1, 1, 2] }),
    theme({ name: 'Dusk City', root: 57, mode: 'minor', bpm: 100, lead: 'epiano', ost: 'synth', kit: 'electro', prog: [0, 5, 2, 6, 0, 5, 3, 4],
      motif: [[0, 0, .5], [.5, 2, .5], [1, 4, .5], [1.5, 7, .5], [2, 4, 1], [4, 6, .5], [4.5, 4, .5], [5, 2, 1.5]], levels: [2, 2, 3, 2, 1, 2, 1, 2] }),
    theme({ name: 'Neon Quarter', root: 52, mode: 'minor', bpm: 108, lead: 'synth', ost: 'synth', kit: 'electro', prog: [0, 5, 6, 4, 0, 5, 3, 4],
      motif: [[0, 0, .5], [.5, 0, .5], [1, 2, .5], [1.5, 4, .5], [2, 3, 1], [4, 0, .5], [4.5, 2, .5], [5, 4, 1], [6, 2, 2]], levels: [3, 2, 3, 2, 1, 2, 1, 3] }),
    theme({ name: 'Storm Pass', root: 47, mode: 'phrygian', bpm: 120, lead: 'brass', ost: 'staccato', kit: 'epic', prog: [0, 1, 0, 6, 0, 1, 5, 0],
      motif: [[0, 0, 2], [2, 1, 1], [3, 0, 1], [4, 0, 2], [6, 1, 1], [7, 6, 1]], levels: [3, 2, 3, 3, 3, 3, 2, 3] }),
    theme({ name: 'Northern Lights', root: 59, mode: 'major', bpm: 70, lead: 'bell', ost: 'bell', kit: 'soft', prog: [0, 3, 4, 0, 5, 3, 4, 0],
      motif: [[0, 4, 2], [2, 6, 2], [4, 5, 2], [6, 4, 2]], levels: [3, 3, 1, 2, 0, 0, 3, 1] }),
    theme({ name: 'Sunrise Coast', root: 57, mode: 'major', bpm: 96, lead: 'strings', ost: 'pluck', kit: 'epic', prog: [0, 4, 5, 3, 0, 4, 3, 4],
      // the opening motif of Dawn Meadow comes back, an octave higher and played by everything
      motif: [[0, 4, 1], [1, 5, 1], [2, 4, 1], [3, 2, 2], [4, 1, 1], [5, 2, 1], [6, 1, 1], [7, 0, 1]], levels: [2, 3, 3, 3, 3, 3, 3, 3], gain: .42 })
  ];
  // Planned intensity of each chapter (0 to 1): climbs, drops at rest stops, peaks in Storm Pass and the finale.
  var TENSION = [.15, .25, .3, .4, .5, .6, .7, .95, .4, 1];

  function smooth(x) { x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // MIDI note of scale degree d (0 is the tonic, 7 is an octave up, negatives go below).
  function midi(T, d) { var sc = MODES[T.mode], n = sc.length, i = Math.floor(d / n); return T.root + sc[d - i * n] + 12 * i; }
  // Triad plus an octave on top, as scale degrees above chord root r.
  function chord(T, r) { return [r, r + 2, r + 4, r + 7].map(function (d) { return midi(T, d); }); }
  function progression(T, bar) { return (bar % 16 < 8 ? T.prog : T.progB)[bar % 8]; }
  // The motif as notes: bar 0 of each four plays the question and answer, later groups lift by a third.
  function motifNotes(T, group) {
    var lift = group % 2 ? 2 : 0;
    return T.motif.map(function (n) { return { beat: n[0], midi: midi(T, n[1] + lift), len: n[2] }; });
  }
  // Intensity of the music (0 to 1): the plan for this chapter blended with how fast and how close the
  // player is driving right now (d is 0 to 1, from road speed and the combo of close calls).
  function intensity(chapter, frac, d) {
    var base = TENSION[chapter] * (.8 + .2 * clamp(frac, 0, 1));
    return clamp(.55 * base + .45 * clamp(d, 0, 1), 0, 1);
  }
  // How loud each layer is (0..1) now. st: { chT seconds since the chapter began, rest, calm, lives, maxLives }.
  function levels(T, I, st) {
    var out = {};
    STEMS.forEach(function (k, i) {
      var cap = T.levels[i] / 3, th = THRESH[k];
      out[k] = cap * (th === 0 ? 1 : smooth((I - th) / .25));
    });
    var intro = clamp((st.chT - 10) / 8, 0, 1); // each chapter opens with the lead and the air alone
    ['pulse', 'strings', 'brass', 'perc', 'choir'].forEach(function (k) { out[k] *= intro; });
    if (st.rest) { out.pulse = 0; out.perc = 0; out.brass = 0; out.strings *= .25; out.choir *= .5; out.bass *= .3; out.lead = Math.max(out.lead, .6); }
    if (st.calm) { out.brass *= .3; out.perc *= .4; out.pulse *= .7; }
    var g = T.gain || 1; STEMS.forEach(function (k) { out[k] *= g; }); // the finale plays every layer, so it is trimmed to sit with the rest
    out.heart = st.maxLives > 1 && st.lives === 1 ? 1 : 0; // a low heartbeat when one life is left
    return out;
  }

  var exported = { MODES: MODES, STEMS: STEMS, THRESH: THRESH, THEMES: THEMES, TENSION: TENSION, midi: midi, chord: chord, progression: progression, motifNotes: motifNotes, intensity: intensity, levels: levels };
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
  else root.RacerScore = exported;
})(typeof window !== 'undefined' ? window : globalThis);
