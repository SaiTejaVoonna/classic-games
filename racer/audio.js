// Racer sound: soft generated music per chapter, wind that follows speed, and calm effects
// (whoosh and bass for a near miss, a low boom with glassy chimes for a crash). Everything is
// synthesised with the Web Audio API, so there are no audio files, and everything fails soft:
// no audio support or a blocked context simply means silence. Written for a calm, cozy feel,
// not tuned by ear yet.
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RacerAudio = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MAJ = [0, 4, 7]; var MAJ7 = [0, 4, 7, 11]; var MIN = [0, 3, 7]; var MIN7 = [0, 3, 7, 10]; var SUS = [0, 5, 7];
  var PENT_MAJ = [0, 2, 4, 7, 9]; var PENT_MIN = [0, 3, 5, 7, 10];

  // One theme per chapter. root is a MIDI note, prog is a list of chords (offset and shape).
  var THEMES = [
    { name: 'Dawn Meadow', root: 48, bpm: 76, style: 'piano', scale: PENT_MAJ, arp: .55, oct: 24, kick: 0, prog: [{ r: 0, q: MAJ7 }, { r: 5, q: MAJ }, { r: 9, q: MIN7 }, { r: 7, q: SUS }] },
    { name: 'Sunset Coast', root: 50, bpm: 84, style: 'pluck', scale: PENT_MAJ, arp: .6, oct: 24, kick: 0, prog: [{ r: 0, q: MAJ }, { r: 7, q: MAJ }, { r: 9, q: MIN7 }, { r: 5, q: MAJ7 }] },
    { name: 'Amber Valley', root: 52, bpm: 72, style: 'piano', scale: PENT_MIN, arp: .5, oct: 24, kick: 0, prog: [{ r: 0, q: MIN7 }, { r: 8, q: MAJ7 }, { r: 3, q: MAJ }, { r: 10, q: MAJ }] },
    { name: 'Dusk City', root: 45, bpm: 90, style: 'synth', scale: PENT_MIN, arp: .5, oct: 24, kick: 0, prog: [{ r: 0, q: MIN7 }, { r: 5, q: MIN7 }, { r: 8, q: MAJ7 }, { r: 7, q: MIN }] },
    { name: 'Neon Quarter', root: 41, bpm: 100, style: 'synth', scale: PENT_MIN, arp: .6, oct: 24, kick: 1, prog: [{ r: 0, q: MIN7 }, { r: 8, q: MAJ7 }, { r: 10, q: MAJ }, { r: 7, q: MIN7 }] },
    { name: 'Desert Road', root: 47, bpm: 80, style: 'pluck', scale: PENT_MIN, arp: .5, oct: 24, kick: 0, prog: [{ r: 0, q: MIN }, { r: 1, q: MAJ }, { r: 0, q: MIN }, { r: 10, q: MAJ }] },
    { name: 'Northern Lights', root: 48, bpm: 60, style: 'ambient', scale: PENT_MAJ, arp: .25, oct: 36, kick: 0, prog: [{ r: 0, q: MAJ7 }, { r: 2, q: MAJ }, { r: 0, q: MAJ7 }, { r: 7, q: SUS }] }
  ];

  var SFX_VIBES = { near: 12, lane: 0, crash: [80, 40, 120], chapter: 0 };

  function midiFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  // env: { AudioContext, vibrate, setInterval, clearInterval, random }
  function create(env) {
    env = env || {};
    var AC = env.AudioContext;
    var rnd = env.random || Math.random;
    var ctx = null; var master = null; var musicBus = null; var sfxBus = null; var reverbSend = null; var delaySend = null;
    var noiseBuf = null; var wind = null;
    var musicOn = true; var sfxOn = true; var hapticsOn = true;
    var theme = 0; var timer = null; var running = false;
    var nextTime = 0; var step = 0; var speedV = 0;

    function ensure() {
      if (ctx || !AC) return ctx;
      try {
        ctx = new AC();
        var comp = ctx.createDynamicsCompressor();
        master = ctx.createGain(); master.gain.value = .85;
        master.connect(comp); comp.connect(ctx.destination);
        musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
        sfxBus = ctx.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
        // a soft room: generated reverb and a gentle echo for the plucked notes
        var conv = ctx.createConvolver(); var len = Math.floor(ctx.sampleRate * 2.4);
        var buf = ctx.createBuffer(2, len, ctx.sampleRate);
        for (var c = 0; c < 2; c++) { var d = buf.getChannelData(c); for (var i = 0; i < len; i++) d[i] = (rnd() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
        conv.buffer = buf; reverbSend = ctx.createGain(); reverbSend.gain.value = .5; reverbSend.connect(conv); conv.connect(musicBus);
        var dl = ctx.createDelay(1); dl.delayTime.value = .375; var fb = ctx.createGain(); fb.gain.value = .32; var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
        delaySend = ctx.createGain(); delaySend.gain.value = .5; delaySend.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(musicBus);
        var nlen = ctx.sampleRate * 2; noiseBuf = ctx.createBuffer(1, nlen, ctx.sampleRate); var nd = noiseBuf.getChannelData(0); for (var n = 0; n < nlen; n++) nd[n] = rnd() * 2 - 1;
      } catch (e) { ctx = null; }
      return ctx;
    }
    function unlock() { var c = ensure(); if (c && c.state === 'suspended' && c.resume) { try { c.resume(); } catch (e) { /* silent */ } } }
    function live() { return ctx && ctx.state !== 'suspended'; }

    function env2(g, t, a, peak, dec, end) {
      g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(peak, t + a);
      g.gain.exponentialRampToValueAtTime(.0001, t + a + dec); void end;
    }
    function voice(type, freq, t, a, peak, dec, bus, filt, detune) {
      var o = ctx.createOscillator(); var g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t); if (detune) o.detune.value = detune;
      env2(g, t, a, peak, dec); var out = g;
      if (filt) { var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filt; o.connect(f); f.connect(g); } else o.connect(g);
      g.connect(bus || musicBus); o.start(t); o.stop(t + a + dec + .05); return out;
    }

    function schedule(t) {
      var th = THEMES[theme]; var eighth = 60 / th.bpm / 2; var bar = Math.floor(step / 8); var ch = th.prog[bar % th.prog.length]; var sInBar = step % 8;
      var rootM = th.root + ch.r;
      if (sInBar === 0) { // pad: a slow soft chord
        var dur = eighth * 8;
        ch.q.slice(0, 3).forEach(function (q, i) {
          var f = midiFreq(rootM + q + 12);
          voice('triangle', f, t, .9, .05 / (1 + i * .15), dur + .8, musicBus, 1100, 0);
          voice('sine', f, t, 1.1, .035, dur + 1, musicBus, null, 7);
        });
        if (th.style === 'ambient') voice('sine', midiFreq(rootM + 24), t, 1.5, .02, dur + 2, reverbSend);
      }
      if (sInBar === 0 || (sInBar === 4 && rnd() < .45)) { // bass: a soft low note, the felt thump
        var bf = midiFreq(rootM - 12);
        if (th.style === 'synth') voice('sawtooth', bf, t, .02, .07, 1, musicBus, 240, 0);
        voice('sine', bf, t, .02, .16, 1.1, musicBus);
      }
      if (th.kick && sInBar % 2 === 0) { // gentle pulse on each beat in the night city
        var k = ctx.createOscillator(); var kg = ctx.createGain(); k.frequency.setValueAtTime(110, t); k.frequency.exponentialRampToValueAtTime(42, t + .14);
        env2(kg, t, .005, .2, .22); k.connect(kg); kg.connect(musicBus); k.start(t); k.stop(t + .3);
      }
      if (rnd() < th.arp) { // arpeggio: a few notes of the scale, favouring the chord
        var pool = rnd() < .6 ? ch.q.map(function (q) { return q % 12; }) : th.scale;
        var note = rootM + pool[Math.floor(rnd() * pool.length)] + th.oct;
        var f2 = midiFreq(note);
        var type = th.style === 'synth' ? 'square' : 'triangle';
        var g1 = voice(type, f2, t, .006, th.style === 'synth' ? .02 : .05, th.style === 'ambient' ? 2 : .9, musicBus, th.style === 'synth' ? 1800 : 3200);
        voice('sine', f2 * 2, t, .004, .012, .5, musicBus);
        void g1;
        if (delaySend) { var sg = ctx.createGain(); sg.gain.value = .35; var so = ctx.createOscillator(); so.type = 'sine'; so.frequency.setValueAtTime(f2, t); var sge = ctx.createGain(); env2(sge, t, .006, .03, .8); so.connect(sge); sge.connect(delaySend); so.start(t); so.stop(t + 1); }
      }
    }

    function tick() {
      if (!live() || !running || !musicOn) return;
      var th = THEMES[theme]; var eighth = 60 / th.bpm / 2;
      if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + .05;
      while (nextTime < ctx.currentTime + .4) { schedule(nextTime); nextTime += eighth; step++; }
    }

    function windStart() {
      if (wind || !ctx || !noiseBuf) return;
      var src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 400; bp.Q.value = .6;
      var g = ctx.createGain(); g.gain.value = 0; src.connect(bp); bp.connect(g); g.connect(sfxBus); src.start();
      wind = { src: src, bp: bp, g: g };
    }
    function windUpdate() {
      if (!wind) return;
      var t = ctx.currentTime; var on = running && sfxOn;
      wind.bp.frequency.setTargetAtTime(260 + speedV * 8, t, .2);
      wind.g.gain.setTargetAtTime(on ? .006 + speedV * .00048 : 0, t, .25);
    }

    function noiseBurst(t, dur, f0, f1, q, peak, type) {
      var s = ctx.createBufferSource(); s.buffer = noiseBuf; var f = ctx.createBiquadFilter(); f.type = type || 'bandpass'; f.Q.value = q;
      f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
      var g = ctx.createGain(); env2(g, t, dur * .25, peak, dur * .75); s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t, rnd()); s.stop(t + dur + .05);
    }
    function sfxVoice(type, f0, f1, t, dur, peak) {
      var o = ctx.createOscillator(); var g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      env2(g, t, .008, peak, dur); o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + dur + .05);
    }

    function play(name) {
      if (sfxOn && live() && noiseBuf) {
        var t = ctx.currentTime;
        try {
          if (name === 'near') { noiseBurst(t, .38, 500, 2600, 1.2, .1); sfxVoice('sine', 90, 48, t, .3, .22); sfxVoice('sine', 880, 880, t + .05, .5, .035); sfxVoice('sine', 1320, 1320, t + .12, .5, .03); }
          else if (name === 'lane') { noiseBurst(t, .16, 700, 1500, .9, .05); }
          else if (name === 'chapter') { sfxVoice('sine', 523, 523, t, 1.1, .04); sfxVoice('sine', 784, 784, t + .18, 1.3, .035); }
          else if (name === 'crash') {
            noiseBurst(t, .7, 2400, 160, .7, .3, 'lowpass'); sfxVoice('sine', 80, 32, t, .9, .5); sfxVoice('triangle', 140, 50, t, .5, .22);
            for (var i = 0; i < 9; i++) sfxVoice('sine', 1800 + rnd() * 3200, 1500 + rnd() * 2400, t + rnd() * .35, .35 + rnd() * .3, .03 + rnd() * .03);
          }
        } catch (e) { /* silent */ }
      }
      if (hapticsOn && env.vibrate && SFX_VIBES[name]) { try { env.vibrate(SFX_VIBES[name]); } catch (e) { /* not supported */ } }
    }

    function start() {
      unlock(); if (!ensure()) return;
      running = true; step = 0; nextTime = 0;
      if (musicBus) { var t = ctx.currentTime; musicBus.gain.cancelScheduledValues(t); musicBus.gain.setTargetAtTime(musicOn ? .9 : 0, t, .6); }
      windStart(); windUpdate();
      if (env.setInterval && !timer) timer = env.setInterval(tick, 120);
      tick();
    }
    function stop() {
      running = false;
      if (ctx && musicBus) { musicBus.gain.setTargetAtTime(0, ctx.currentTime, .35); }
      windUpdate();
      if (timer && env.clearInterval) { env.clearInterval(timer); timer = null; }
    }
    function setMusic(on) { musicOn = !!on; if (ctx && musicBus) musicBus.gain.setTargetAtTime(musicOn && running ? .9 : 0, ctx.currentTime, .4); }
    function setSfx(on) { sfxOn = !!on; windUpdate(); }
    function setHaptics(on) { hapticsOn = !!on; }
    function setChapter(i) { var n = ((i % THEMES.length) + THEMES.length) % THEMES.length; if (n !== theme) { theme = n; step = Math.ceil(step / 8) * 8; } if (live() && running && sfxOn) play('chapter'); }
    function setSpeed(v) { speedV = v; windUpdate(); }

    return { unlock: unlock, start: start, stop: stop, tick: tick, play: play, setMusic: setMusic, setSfx: setSfx, setHaptics: setHaptics, setChapter: setChapter, setSpeed: setSpeed, theme: function () { return theme; } };
  }

  return { create: create, THEMES: THEMES, SFX_VIBES: SFX_VIBES, midiFreq: midiFreq };
});
