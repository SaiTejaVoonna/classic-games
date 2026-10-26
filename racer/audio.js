/* Racer audio: all sound is synthesised with Web Audio, no files.
   Classic Games prototype choices, not tuned by ear yet. API: RacerAudio.create(env) */
(function (root) {
  'use strict';

  // Ten chapters: root note (MIDI), scale, tempo, music kit, ambience bed.
  var CH = [ // same order as the chapters in racer.js, so the sound matches the scenery
    { root: 57, sc: [0, 2, 4, 7, 9], bpm: 84, kit: 'piano', bed: 'meadow' },     // Dawn Meadow
    { root: 62, sc: [0, 2, 4, 7, 9], bpm: 88, kit: 'pluck', bed: 'meadow' },     // Cherry Hills
    { root: 55, sc: [0, 2, 3, 7, 9], bpm: 78, kit: 'acoustic', bed: 'desert' },  // Desert Road
    { root: 59, sc: [0, 2, 4, 7, 9], bpm: 76, kit: 'cello', bed: 'meadow' },     // Amber Valley
    { root: 60, sc: [0, 2, 4, 7, 9], bpm: 92, kit: 'handpan', bed: 'waves' },    // Sunset Coast
    { root: 57, sc: [0, 3, 5, 7, 10], bpm: 100, kit: 'electro', bed: 'city' },   // Dusk City
    { root: 52, sc: [0, 3, 5, 7, 10], bpm: 108, kit: 'electro', bed: 'rain' },   // Neon Quarter
    { root: 47, sc: [0, 3, 5, 6, 7], bpm: 120, kit: 'cinematic', bed: 'storm' }, // Storm Pass
    { root: 59, sc: [0, 2, 4, 7, 9], bpm: 70, kit: 'pads', bed: 'snow' },        // Northern Lights
    { root: 57, sc: [0, 2, 4, 7, 9], bpm: 96, kit: 'epic', bed: 'waves' }        // Sunrise Coast
  ];
  var Score = typeof module !== 'undefined' && module.exports ? require('./score.js') : root.RacerScore;

  // Engine models. Each profile is a firing-order spectrum (which engine orders are loud), a rev
  // range and a gearbox: gear n covers road speeds bands[n]..bands[n+1] km/h and revs sweep from lo
  // to hi across it (the first gear from idle), so revs climb, drop on a shift and climb again.
  // dom is the number of firing events per crank turn (a V8 fires 4, a V10 fires 5, and so on).
  function spec(dom, off, pw, extra, n) {
    var im = new Float32Array(n || 48);
    for (var k = 1; k < im.length; k++) im[k] = k % dom === 0 ? 1 / Math.pow(k / dom, pw) : off / Math.pow(k, 1.1);
    for (var e in extra) im[+e] = extra[e];
    return im;
  }
  var ENGINES = {
    i4: { im: spec(2, .32, .72), bands: [0, 40, 70, 100, 130, 165, 400], idle: 900, lo: 2600, hi: 5800, drive: 2.4, lpB: 380, lpK: .5, lpL: 900, sub: .5, am: .1, body: .22, intake: .035, whine: .004 },
    v8: { im: spec(4, .38, .7, { 1: .3, 2: .55 }), bands: [0, 50, 85, 120, 155, 195, 400], idle: 800, lo: 2200, hi: 6600, drive: 3.2, lpB: 300, lpK: .4, lpL: 800, sub: .7, am: .15, body: .27, intake: .03, whine: 0, pops: .5 },
    rally: { im: spec(2, .55, .8, { 1: .6 }), bands: [0, 35, 62, 90, 120, 155, 400], idle: 1000, lo: 3200, hi: 7400, drive: 2.8, lpB: 500, lpK: .42, lpL: 800, sub: .35, am: .13, body: .22, intake: .04, whine: 0, turbo: true, pops: 1 },
    v10: { im: spec(5, .12, .6, { 1: .18 }), bands: [0, 55, 95, 135, 175, 215, 400], idle: 1000, lo: 4200, hi: 9000, drive: 2.2, lpB: 500, lpK: .5, lpL: 900, sub: .3, am: .05, body: .22, intake: .03, whine: 0 },
    v12: { im: spec(6, .08, .55), bands: [0, 55, 95, 135, 175, 215, 400], idle: 900, lo: 3600, hi: 8500, drive: 1.8, lpB: 450, lpK: .55, lpL: 800, sub: .25, am: .03, body: .22, intake: .025, whine: 0 },
    f1: { im: spec(3, .1, .45, null, 60), bands: [0, 60, 100, 140, 180, 230, 400], idle: 4000, lo: 9500, hi: 14500, drive: 1.6, lpB: 900, lpK: .7, lpL: 1200, sub: 0, am: .02, body: .2, intake: .02, whine: 0 },
    ev: { im: spec(8, .04, 1.1), ev: true, idle: 600, perKmh: 40, drive: 1.1, lpB: 2500, lpK: .3, lpL: 1500, sub: 0, am: 0, body: .14, intake: 0, whine: 0 }
  };
  var CAR_ENGINE = { sedan: 'v8', rally: 'rally', ev: 'ev' };
  function engineModel(kmh, prof) {
    prof = prof || ENGINES.i4;
    if (prof.ev) return { gear: 1, rpm: prof.idle + kmh * prof.perKmh };
    var B = prof.bands, g = 0; while (g < B.length - 2 && kmh >= B[g + 1]) g++;
    var f = clamp((kmh - B[g]) / (B[g + 1] - B[g]), 0, 1);
    return { gear: g + 1, rpm: g === 0 ? prof.idle + (prof.hi - prof.idle) * f : prof.lo + (prof.hi - prof.lo) * f };
  }

  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function create(env) {
    env = env || {};
    var Ctor = env.AudioContext;
    var ctx = null, master = null, musicBus = null, fxBus = null, comp = null, reverb = null, rvSend = null;
    var noiseBuf = null, bed = null, eng = null;
    var prefs = { music: true, sfx: true, style: 'auto', volMusic: 0.6, volFx: 0.7, bass: 0.5, calm: false, sound: true, haptics: true, car: 'rally' };
    var chapter = 0, intensity = 0.3, speed = 0, braking = false, running = false, paused = false;
    var timer = null, nextBar = 0, scene = {};
    var stemBus = {}, duckNode = null, chBar = 0, chStart = 0, chapFrac = 0, restUntil = 0, lives = 3, maxLives = 3;
    var made = { notes: 0, events: 0 }, engineOverride = null;

    function audible() { return prefs.sound && !!ctx; }
    function speedN() { return clamp(speed / 70, 0, 1); }
    function ensure() {
      if (ctx || !Ctor) return !!ctx;
      try { ctx = new Ctor(); } catch (e) { ctx = null; return false; }
      comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25;
      master = ctx.createGain(); master.gain.value = 0.9;
      var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 28;
      var mud = ctx.createBiquadFilter(); mud.type = 'peaking'; mud.frequency.value = 280; mud.gain.value = -2.5; mud.Q.value = 0.9;
      var air = ctx.createBiquadFilter(); air.type = 'highshelf'; air.frequency.value = 9000; air.gain.value = 1.5;
      var limiter = ctx.createDynamicsCompressor(); limiter.threshold.value = -2; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = .002; limiter.release.value = .1; // catches anything that would clip
      comp.connect(hp); hp.connect(mud); mud.connect(air); air.connect(master); master.connect(limiter); limiter.connect(ctx.destination);
      musicBus = ctx.createGain(); fxBus = ctx.createGain(); musicBus.connect(comp); fxBus.connect(comp);
      duckNode = ctx.createGain(); duckNode.connect(musicBus); // the whole score dips under big effects
      reverb = ctx.createConvolver(); // a 3.4 s hall: dense early reflections, a tail that darkens as it fades
      var len = Math.floor(ctx.sampleRate * 3.4), ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (var c = 0; c < 2; c++) {
        var d = ir.getChannelData(c), lpv = 0;
        for (var i = 0; i < len; i++) { var u = i / len, a2 = .6 - .52 * Math.pow(u, .5); lpv += a2 * ((Math.random() * 2 - 1) - lpv); d[i] = lpv * Math.pow(1 - u, 2.2) * (i < ctx.sampleRate * .02 ? i / (ctx.sampleRate * .02) : 1); }
      }
      reverb.buffer = ir; rvSend = ctx.createGain(); rvSend.gain.value = 0.32; rvSend.connect(reverb); reverb.connect(comp);
      // each score layer has a dry bus and a reverb bus that share one level, so a muted layer leaves no reverb tail behind
      Score.STEMS.concat(['heart']).forEach(function (k) { var sg = ctx.createGain(), wg = ctx.createGain(); sg.gain.value = 0; wg.gain.value = 0; sg.connect(duckNode); wg.connect(rvSend); sg._wet = wg; stemBus[k] = sg; });
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      var nd = noiseBuf.getChannelData(0); for (var j = 0; j < nd.length; j++) nd[j] = Math.random() * 2 - 1;
      applyVolumes();
      return true;
    }
    function applyVolumes() {
      if (!ctx) return;
      var t = ctx.currentTime, m = (prefs.music && prefs.sound ? prefs.volMusic : 0) * (prefs.calm ? 0.6 : 1) * .38;
      var f = (prefs.sfx && prefs.sound ? prefs.volFx : 0);
      musicBus.gain.setTargetAtTime(m, t, 0.08); fxBus.gain.setTargetAtTime(f, t, 0.08);
      if (bed) bed.out.gain.setTargetAtTime(prefs.sound ? 0.5 : 0, t, 0.2);
      if (eng) eng.out.gain.setTargetAtTime(running && !paused && f ? 1 : 0, t, 0.1);
    }

    function route(node, bus, pv, wet) {
      var tail = node;
      if (ctx.createStereoPanner) { var p = ctx.createStereoPanner(); p.pan.value = pv || 0; tail.connect(p); tail = p; }
      tail.connect(bus);
      if (wet) { var s = ctx.createGain(); s.gain.value = wet; tail.connect(s); s.connect(bus._wet || rvSend); }
    }
    function tone(type, f, t, dur, vol, bus, pv, wet, lp) {
      var o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(0.02, dur / 4)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      var tail = o;
      if (lp) { var b = ctx.createBiquadFilter(); b.type = 'lowpass'; b.frequency.value = lp; o.connect(b); tail = b; }
      tail.connect(g); route(g, bus, pv, wet); o.start(t); o.stop(t + dur + 0.05); made.notes++;
    }
    function noise(t, dur, vol, bus, ftype, ff, pv) {
      var s = ctx.createBufferSource(); s.buffer = noiseBuf; var f = ctx.createBiquadFilter(); f.type = ftype; f.frequency.value = ff;
      var g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); route(g, bus, pv || 0); s.start(t); s.stop(t + dur + 0.05);
    }
    function kick(t, v, bus) {
      var o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); o.connect(g); route(g, bus || musicBus, 0); o.start(t); o.stop(t + 0.35);
    }

    function degree(c, d) { var n = c.sc.length; return c.root + c.sc[((d % n) + n) % n] + 12 * Math.floor(d / n); }
    function rnd() { return Math.random(); }
    function B(name) { return stemBus[name] || musicBus; }
    function shape(g, t, a, peak, hold, rel) { // attack, hold, release gain shape
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a);
      g.gain.setValueAtTime(peak, t + a + hold); g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + rel);
    }

    // ---- instruments. Each takes (midi note, start time, length in seconds, velocity 0..1, layer, pan, reverb send).
    function pianoNote(m, t, dur, v, bus, pv, wet) {
      var f = mtof(m), A = [1, .5, .3, .18, .1, .06], tau = clamp(2.6 - (m - 48) * .03, .6, 2.8) * Math.min(1.5, .6 + dur * .4);
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900 + v * 5200; route(lp, B(bus), pv, wet);
      for (var i = 0; i < 6; i++) {
        var n = i + 1, o = ctx.createOscillator(), g = ctx.createGain(), life = tau / (1 + i * .45);
        o.frequency.value = f * n * Math.sqrt(1 + .0004 * n * n); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(A[i] * v * .45 * (i > 1 ? .6 + v * .6 : 1), t + .004); g.gain.exponentialRampToValueAtTime(0.0001, t + life);
        o.connect(g); g.connect(lp); o.start(t); o.stop(t + life + .05); made.notes++;
      }
      noise(t, .03, .05 * v, B(bus), 'bandpass', 2400, pv);
    }
    var ksCache = {};
    function ksBuffer(m, bright) { // Karplus-Strong: a looped burst of noise that loses its highs as it rings, like a plucked string
      var key = m + '|' + (bright ? 1 : 0); if (ksCache[key]) return ksCache[key];
      var sr = ctx.sampleRate, n = Math.max(2, Math.round(sr / mtof(m))), len = Math.floor(sr * 1.8), buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0), ring = new Float32Array(n), p = 0, seed = (m * 7919) % 2147483647 || 1, i;
      for (i = 0; i < n; i++) { seed = (seed * 16807) % 2147483647; ring[i] = seed / 1073741823.5 - 1; }
      var decay = bright ? .9972 : .9945;
      for (i = 0; i < len; i++) { var a = ring[p], b2 = ring[(p + 1) % n]; d[i] = a; ring[p] = (a + b2) * .5 * decay; p = (p + 1) % n; }
      ksCache[key] = buf; return buf;
    }
    function pluckNote(m, t, dur, v, bus, pv, wet, bright) {
      var s = ctx.createBufferSource(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
      s.buffer = ksBuffer(m, bright); lp.type = 'lowpass'; lp.frequency.value = bright ? 5200 : 2600; g.gain.setValueAtTime(v * .9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(.5, Math.min(1.7, dur * 1.6)));
      s.connect(lp); lp.connect(g); route(g, B(bus), pv, wet); s.start(t); s.stop(t + 1.8); made.notes++;
    }
    function bellNote(m, t, dur, v, bus, pv, wet, ratio, idx) { // FM bell: a modulator that fades quickly leaves a pure tone
      var f = mtof(m), c = ctx.createOscillator(), mo = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
      c.frequency.value = f; mo.frequency.value = f * (ratio || 3.5); mg.gain.setValueAtTime(f * (idx || 2), t); mg.gain.exponentialRampToValueAtTime(f * .05, t + dur * .7);
      mo.connect(mg); mg.connect(c.frequency); shape(g, t, .004, v * .5, 0, dur); c.connect(g); route(g, B(bus), pv, wet);
      c.start(t); mo.start(t); c.stop(t + dur + .05); mo.stop(t + dur + .05); made.notes++;
    }
    function handpanNote(m, t, dur, v, bus, pv, wet) {
      var f = mtof(m), p = [1, 2, 3.01], a = [1, .38, .14];
      p.forEach(function (r, i) { var o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(f * r * 1.012, t); o.frequency.exponentialRampToValueAtTime(f * r, t + .06); shape(g, t, .003, v * .45 * a[i], 0, 1.6 / (1 + i * .8)); o.connect(g); route(g, B(bus), pv, wet); o.start(t); o.stop(t + 1.8); made.notes++; });
    }
    function epianoNote(m, t, dur, v, bus, pv, wet) { // electric piano: gentle FM with a short bright tine
      bellNote(m, t, Math.max(1.2, dur * 1.3), v * .9, bus, pv, wet, 1, 1.4); bellNote(m, t, .25, v * .35, bus, pv, wet, 14, 1.2);
    }
    function synthNote(m, t, dur, v, bus, pv, wet, short) {
      var f = mtof(m), len = short ? .22 : Math.max(.25, dur * .9), lp = ctx.createBiquadFilter(), g = ctx.createGain();
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(short ? 3600 : 3200, t); lp.frequency.exponentialRampToValueAtTime(900, t + len); lp.Q.value = 3;
      [['sawtooth', 0], ['square', 6]].forEach(function (w) { var o = ctx.createOscillator(); o.type = w[0]; o.frequency.value = f; o.detune.value = w[1]; o.connect(lp); o.start(t); o.stop(t + len + .1); made.notes++; });
      shape(g, t, .006, v * .22 * (prefs.calm ? .7 : 1), len * .3, len * .7); lp.connect(g); route(g, B(bus), pv, wet);
    }
    function celloNote(m, t, dur, v, bus, pv, wet) { // bowed: saw with vibrato, a slow attack and a woody body
      var f = mtof(m), o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), lp = ctx.createBiquadFilter(), bp = ctx.createBiquadFilter(), g = ctx.createGain(), len = Math.max(.6, dur);
      o.type = 'sawtooth'; o.frequency.value = f; lfo.frequency.value = 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(7, t + .5); lfo.connect(lg); lg.connect(o.detune);
      lp.type = 'lowpass'; lp.frequency.value = 1300 + v * 900; bp.type = 'peaking'; bp.frequency.value = 520; bp.gain.value = 6; bp.Q.value = 1;
      shape(g, t, .12, v * .35, Math.max(0, len - .3), .35); o.connect(lp); lp.connect(bp); bp.connect(g); route(g, B(bus), pv, wet);
      o.start(t); lfo.start(t); o.stop(t + len + .5); lfo.stop(t + len + .5); made.notes++;
    }
    function stringsChord(notes, t, dur, v, bus, wet, att) { // an ensemble: detuned saws, vibrato, slow swell
      var lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5.4; lg.gain.value = 6; lfo.connect(lg); lfo.start(t); lfo.stop(t + dur + 1.4);
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t); lp.frequency.linearRampToValueAtTime(1500 + v * 2200, t + att);
      var g = ctx.createGain(); shape(g, t, att, v * .16 / Math.sqrt(notes.length), Math.max(0, dur - att), .9);
      lp.connect(g); route(g, B(bus), -.25, wet); var g2 = ctx.createGain(); g2.gain.value = .8; lp.connect(g2); route(g2, B(bus), .3, wet);
      notes.forEach(function (m) { [-9, 0, 9].forEach(function (c) { var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = c; lg.connect(o.detune); o.connect(lp); o.start(t); o.stop(t + dur + 1.4); made.notes++; }); });
    }
    function brassChord(notes, t, dur, v, bus, wet, att) { // low brass swell: the filter opens as the note grows
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2; lp.frequency.setValueAtTime(260, t); lp.frequency.exponentialRampToValueAtTime(2300 * (prefs.calm ? .5 : 1), t + att);
      var g = ctx.createGain(); shape(g, t, att, v * .2 / Math.sqrt(notes.length), Math.max(0, dur - att), .5); lp.connect(g); route(g, B(bus), 0, wet);
      notes.forEach(function (m) { [['sawtooth', 0, m], ['sawtooth', 7, m], ['square', 0, m - 12]].forEach(function (w) { var o = ctx.createOscillator(); o.type = w[0]; o.frequency.value = mtof(w[2]); o.detune.value = w[1]; o.connect(lp); o.start(t); o.stop(t + dur + .6); made.notes++; }); });
    }
    function braam(m, t, v, bus) { // the big low brass hit
      var sh = ctx.createWaveShaper(), cv = new Float32Array(257); for (var i = 0; i < 257; i++) cv[i] = Math.tanh(3 * (i / 128 - 1)); sh.curve = cv;
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(3000, t); lp.frequency.exponentialRampToValueAtTime(500, t + 2.2);
      var g = ctx.createGain(); shape(g, t, .06, v * .3, .3, 2.6); sh.connect(lp); lp.connect(g); route(g, B(bus), 0, .45);
      [[0, 0], [7, 0], [0, -12], [12, 0]].forEach(function (w) { var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m + w[1]); o.detune.value = w[0] * 8 + (rnd() - .5) * 10; o.connect(sh); o.start(t); o.stop(t + 3.2); made.notes++; });
      var sub = ctx.createOscillator(), sg = ctx.createGain(); sub.frequency.value = mtof(m - 12); shape(sg, t, .03, v * .35, 0, 2.2); sub.connect(sg); route(sg, B(bus), 0, 0); sub.start(t); sub.stop(t + 2.4);
    }
    function choirChord(notes, t, dur, v, bus, wet) { // 'aah': saws through three vowel resonances
      var lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5.8; lg.gain.value = 9; lfo.connect(lg); lfo.start(t); lfo.stop(t + dur + 1.6);
      var src = ctx.createGain(), sum = ctx.createGain(); shape(sum, t, Math.min(1.4, dur * .5), v * .2, Math.max(0, dur * .5 - .2), 1.1);
      [[700, 1], [1220, .55], [2600, .22]].forEach(function (fm) { var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fm[0]; bp.Q.value = 7; var gg = ctx.createGain(); gg.gain.value = fm[1]; src.connect(bp); bp.connect(gg); gg.connect(sum); });
      notes.forEach(function (m) { [-8, 0, 8].forEach(function (c) { var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = c; lg.connect(o.detune); o.connect(src); o.start(t); o.stop(t + dur + 1.6); made.notes++; }); });
      route(sum, B(bus), 0, wet);
    }
    function taiko(t, v, bus) {
      var o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(46, t + .22); shape(g, t, .004, v * .6, 0, .9); o.connect(g); route(g, B(bus), 0, .35); o.start(t); o.stop(t + 1);
      noise(t, .14, v * .22, B(bus), 'bandpass', 220, 0);
    }
    function frameDrum(t, v, bus) { var o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(70, t + .12); shape(g, t, .003, v * .35, 0, .35); o.connect(g); route(g, B(bus), 0, .25); o.start(t); o.stop(t + .5); noise(t, .05, v * .06, B(bus), 'bandpass', 800, 0); }
    function swell(t, dur, v, bus) { // a rising wash of noise, used to open a chapter and to lead into peaks
      var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; s.loop = true; f.type = 'bandpass'; f.Q.value = .7; f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(6500, t + dur);
      shape(g, t, dur * .92, v * .16, 0, dur * .12); s.connect(f); f.connect(g); route(g, B(bus), 0, .5); s.start(t); s.stop(t + dur * 1.1);
    }
    function duck(depth, secs) { if (!ctx || !duckNode) return; var t = ctx.currentTime; duckNode.gain.cancelScheduledValues(t); duckNode.gain.setTargetAtTime(depth, t, .03); duckNode.gain.setTargetAtTime(1, t + secs, .18); }

    // ---- the voice a theme uses for its lead and pulse. Style choices in the sound sheet override the lead.
    // Level trims from measuring each voice and layer alone, so every chapter sits at a similar loudness.
    var VOICE_TRIM = { piano: 3.35, pluck: 6, guitar: 5.4, cello: 2.1, handpan: 3.9, epiano: 3.9, synth: 3, staccato: 3, brass: 1.07, bell: 3.5, strings: .08 };
    var KIT_TRIM = { soft: 7.1, electro: 3.5, epic: 1.6 };
    var STYLE_LEAD = { piano: 'piano', electronic: 'synth', acoustic: 'guitar', cinematic: 'strings' };
    function leadVoice(T) { return STYLE_LEAD[prefs.style] || T.lead; }
    function playVoice(voice, m, t, len, v, bus, pv, wet) {
      v *= VOICE_TRIM[voice] || 1;
      switch (voice) {
        case 'piano': pianoNote(m, t, len, v, bus, pv, wet); break;
        case 'pluck': pluckNote(m, t, len, v, bus, pv, wet, true); break;
        case 'guitar': pluckNote(m, t, len, v, bus, pv, wet, false); break;
        case 'cello': celloNote(m, t, len, v, bus, pv, wet); break;
        case 'handpan': handpanNote(m, t, len, v, bus, pv, wet); break;
        case 'epiano': epianoNote(m, t, len, v, bus, pv, wet); break;
        case 'synth': synthNote(m, t, len, v, bus, pv, wet, false); break;
        case 'staccato': synthNote(m, t, len, v, bus, pv, wet, true); break;
        case 'bell': bellNote(m, t, Math.max(1.6, len * 1.4), v, bus, pv, wet, 3.5, 2); break;
        case 'brass': brassChord([m - 12], t, len, v * 1.4, bus, wet, .12); break;
        case 'strings': stringsChord([m, m + 7], t, len * 1.05, v * 1.3, bus, wet, .15); break;
        default: pianoNote(m, t, len, v, bus, pv, wet);
      }
    }

    // ---- one bar of the score. Every layer decides for itself whether to play, from the level the plan gives it.
    function scheduleBar(t) {
      var T = Score.THEMES[chapter], beat = 60 / T.bpm, bar = beat * 4, b = chBar++, r = Score.progression(T, b), ch = Score.chord(T, r);
      var I = Score.intensity(chapter, chapFrac, intensity), L = Score.levels(T, I, { chT: t - chStart, rest: t < restUntil, calm: prefs.calm, lives: lives, maxLives: maxLives });
      var gain = { air: 5.4, lead: 1, pulse: 1.6, strings: .19, brass: 2.9, perc: .9 * (KIT_TRIM[T.kit] || 1), choir: 3.2, bass: .45 + prefs.bass * .8, heart: 1 }, k, i;
      for (k in L) if (stemBus[k]) { var lv = L[k] * (gain[k] || 1), at = Math.max(ctx.currentTime, t - .05); stemBus[k].gain.setTargetAtTime(lv, at, .3); stemBus[k]._wet.gain.setTargetAtTime(lv, at, .3); }
      var vel = .55 + .35 * I;
      // chapter opening: a swell and a bell
      if (b === 0) { swell(t, bar * .9, .5 + TENSIONSAFE(chapter) * .6, 'air'); bellNote(Score.midi(T, 14), t + bar * .9, 3, .09, 'air', 0, .9, 3.5, 2); }
      // air: high, sparse, long-tailed bells
      if (L.air > .04 && b % 2 === 0) for (i = 0; i < 1 + (rnd() > .55 ? 1 : 0); i++) bellNote(Score.midi(T, 14 + [0, 2, 4, 5][Math.floor(rnd() * 4)]), t + rnd() * bar * .8, 2.6, .05, 'air', rnd() * 1.4 - .7, .9, 3.5, 2);
      // lead: the motif every four bars, a long held tone between
      if (L.lead > .04) {
        if (b % 4 === 0) Score.motifNotes(T, Math.floor(b / 4)).forEach(function (n) { playVoice(leadVoice(T), n.midi + (T.lead === 'piano' ? 0 : 0), t + n.beat * beat, n.len * beat * 1.1, vel, 'lead', n.beat % 2 ? .2 : -.2, .35); });
        else if (b % 4 === 2) playVoice(leadVoice(T), ch[1] + 12, t, bar * .9, vel * .6, 'lead', 0, .45);
      }
      // bass: the root held, and from a higher level eighth-note pulses
      if (L.bass > .04) {
        var bm = Score.midi(T, r) - 24, bo = ctx.createOscillator(), bg = ctx.createGain();
        bo.frequency.value = mtof(bm); shape(bg, t, .05, .5, bar * .8, bar * .2); bo.connect(bg); route(bg, B('bass'), 0, 0); bo.start(t); bo.stop(t + bar + .1); made.notes++;
        if (L.bass > .55) for (i = 0; i < 8; i++) { var pa = [1, 0, .6, 0, .8, 0, .6, 0][i]; if (pa) { var po = ctx.createOscillator(), pg = ctx.createGain(); po.type = 'triangle'; po.frequency.value = mtof(bm + 12); shape(pg, t + i * beat / 2, .005, .22 * pa, 0, .16); po.connect(pg); route(pg, B('bass'), 0, 0); po.start(t + i * beat / 2); po.stop(t + i * beat / 2 + .3); } }
      }
      // pulse: a rolling arpeggio of the chord, the ostinato of the score
      if (L.pulse > .04) {
        var steps = L.pulse > .7 && I > .82 ? 16 : 8, pat = [0, 1, 2, 3, 2, 1, 2, 1];
        for (i = 0; i < steps; i++) { var idx = pat[(steps === 16 ? i >> 1 : i) % 8], acc = i % (steps / 2) === 0 ? 1 : (i % 2 ? .45 : .7); playVoice(T.ost, ch[idx] + 12 + (i % 4 === 3 ? 12 : 0), t + i * bar / steps, bar / steps * 1.4, .3 * acc, 'pulse', i % 2 ? .3 : -.3, .3); }
      }
      // strings
      if (L.strings > .04) stringsChord([ch[0] - 12, ch[1], ch[2], ch[3]], t, bar * 1.04, vel, 'strings', .5, Math.min(1.2, bar * .35));
      // brass: a swell every fourth bar, a hit when a big chapter opens
      if (L.brass > .04 && b % 4 === 0) brassChord([Score.midi(T, r - 7), Score.midi(T, r - 3)], t, bar * 1.1, vel, 'brass', .4, bar * .65);
      if (b === 0 && (T.kit === 'epic') && L.brass > .02) braam(Score.midi(T, 0) - 12, t, vel, 'brass');
      // choir
      if (L.choir > .04) choirChord([ch[1] + 12, ch[2] + 12, ch[3] + 12], t, bar * 1.05, vel, 'choir', .7);
      // percussion by kit
      if (L.perc > .04) {
        if (T.kit === 'epic') { taiko(t, 1, 'perc'); if (L.perc > .45) taiko(t + beat * 2, .6, 'perc'); if (L.perc > .7) taiko(t + beat * 3.5, .4, 'perc'); if (b % 8 === 7) swell(t, bar * .95, .6, 'perc'); }
        else if (T.kit === 'electro') {
          for (i = 0; i < 4; i += 2) kick(t + i * beat, .5, B('perc'));
          for (i = 1; i < 4; i += 2) noise(t + i * beat, .12, .13, B('perc'), 'bandpass', 1600, 0);
          if (L.perc > .35) for (i = 0; i < 8; i++) noise(t + i * beat / 2, .035, i % 2 ? .05 : .03, B('perc'), 'highpass', 8000, i % 2 ? .3 : -.3);
        } else {
          frameDrum(t, .8, 'perc'); if (L.perc > .5) frameDrum(t + beat * 2, .5, 'perc');
          if (L.perc > .4) for (i = 0; i < 8; i++) noise(t + i * beat / 2, .04, .025, B('perc'), 'highpass', 6500, i % 2 ? .35 : -.35);
        }
      }
      // heartbeat when one life is left
      if (L.heart) for (i = 0; i < 4; i++) { kick(t + i * beat, .16, B('heart')); kick(t + i * beat + .2, .1, B('heart')); }
      return bar;
    }
    function TENSIONSAFE(c) { return Score.TENSION[clamp(c, 0, Score.TENSION.length - 1)]; }
    function pump() {
      if (!ctx || !running || paused || !prefs.music || !prefs.sound) return;
      var now = ctx.currentTime;
      if (nextBar < now) nextBar = now + 0.05;
      while (nextBar < now + 1.2) nextBar += scheduleBar(nextBar);
    }

    function startBed(name) {
      if (!ctx) return;
      stopBed();
      var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      var f = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      var cfg = { meadow: ['bandpass', 1400, 0.04], desert: ['lowpass', 500, 0.05], waves: ['lowpass', 700, 0.09], city: ['lowpass', 300, 0.05], rain: ['highpass', 3200, 0.07], storm: ['bandpass', 900, 0.09], snow: ['lowpass', 380, 0.035] }[name] || ['lowpass', 500, 0.04];
      f.type = cfg[0]; f.frequency.value = cfg[1]; g.gain.value = cfg[2];
      lfo.frequency.value = name === 'waves' ? 0.12 : 0.07; lg.gain.value = cfg[2] * 0.6; lfo.connect(lg); lg.connect(g.gain);
      var out = ctx.createGain(); out.gain.value = 0;
      s.connect(f); f.connect(g); g.connect(out); route(out, fxBus, 0, 0.1); s.start(); lfo.start();
      bed = { name: name, src: s, lfo: lfo, out: out };
      applyVolumes();
    }
    function stopBed() { if (bed) { try { bed.src.stop(); bed.lfo.stop(); } catch (e) { /* already stopped */ } bed = null; } }
    // Physical-model loops (see enginesynth.js). Raw arrays arrive from a worker; AudioBuffers are made per context.
    var loopRaw = {}, loopBuf = {}, loopAsked = {};
    function requestLoops(name) {
      var ES = root.RacerEngineSynth; if (!ES || !ES.PHYS || !ES.PHYS[name] || loopAsked[name]) return;
      loopAsked[name] = true;
      ES.generate(name, function (set) { if (!set) return; loopRaw[name] = set; if (eng && eng.name === name && eng.mode !== 'loops') restartEngine(); });
    }
    function loopSet(name) {
      if (!loopRaw[name] || !ctx) return null;
      if (!loopBuf[name]) loopBuf[name] = loopRaw[name].map(function (l) {
        var b = ctx.createBuffer(1, l.data.length, 44100); b.copyToChannel(l.data, 0); return { buffer: b, rpm: l.rpm };
      });
      return loopBuf[name];
    }
    var waves = {};
    function engineWave(name) {
      if (waves[name]) return waves[name];
      var im = ENGINES[name].im, re = new Float32Array(im.length);
      waves[name] = ctx.createPeriodicWave(re, im);
      return waves[name];
    }
    function engineName() { return engineOverride || CAR_ENGINE[prefs.car] || 'i4'; }
    function startEngine() {
      if (!ctx || eng) return;
      var name = engineName(), P = ENGINES[name], t0 = ctx.currentTime, LS = loopSet(name);
      var o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), sub = ctx.createOscillator();
      o1.setPeriodicWave(engineWave(name)); o2.setPeriodicWave(engineWave(name)); o2.detune.value = P.ev ? 3 : 7; sub.type = 'sine';
      var mix = ctx.createGain(); mix.gain.value = 1;
      var subG = ctx.createGain(); subG.gain.value = P.sub;
      var am = ctx.createGain(); am.gain.value = 1 - P.am; // uneven-firing wobble
      var lfo = ctx.createOscillator(), lfoG = ctx.createGain(); lfo.type = 'sine'; lfoG.gain.value = P.am; lfo.connect(lfoG); lfoG.connect(am.gain);
      var sat = ctx.createWaveShaper(), curve = new Float32Array(257);
      for (var i = 0; i < 257; i++) { var x = i / 128 - 1; curve[i] = Math.tanh(P.drive * x); }
      sat.curve = curve;
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = .9; lp.frequency.value = 900;
      var pk1 = ctx.createBiquadFilter(); pk1.type = 'peaking'; pk1.frequency.value = 240; pk1.gain.value = P.ev ? 1 : 4; pk1.Q.value = 1.1;
      var body = ctx.createGain(); body.gain.value = 0;
      var loops = null;
      if (LS) { // physical-model loops replace the oscillators; the loops go through the same tone filters
        var loopSum = ctx.createGain(); loopSum.gain.value = 2.4;
        loops = LS.map(function (l) { var src = ctx.createBufferSource(); src.buffer = l.buffer; src.loop = true; var gn = ctx.createGain(); gn.gain.value = 0; src.connect(gn); gn.connect(loopSum); src.start(t0); return { src: src, gain: gn, rpm: l.rpm }; });
        loopSum.connect(sat); sat.connect(lp); lp.connect(pk1); pk1.connect(body); // saturation adds the harmonics that carry the note on a small speaker
        // exciter: the loops are almost all bass, so a hard-clipped, band-passed copy adds the rasp and edge of a real exhaust
        var xhp = ctx.createBiquadFilter(); xhp.type = 'highpass'; xhp.frequency.value = 160;
        var xs = ctx.createWaveShaper(), xc = new Float32Array(257); for (var xi = 0; xi < 257; xi++) { var xx = xi / 128 - 1; xc[xi] = Math.tanh(9 * xx); } xs.curve = xc;
        var xbp = ctx.createBiquadFilter(); xbp.type = 'bandpass'; xbp.frequency.value = 1500; xbp.Q.value = .6;
        var xg = ctx.createGain(); xg.gain.value = P.excite == null ? .35 : P.excite;
        loopSum.connect(xhp); xhp.connect(xs); xs.connect(xbp); xbp.connect(xg); xg.connect(pk1);
      } else {
        o1.connect(mix); o2.connect(mix); sub.connect(subG); subG.connect(mix); mix.connect(am); am.connect(sat); sat.connect(lp); lp.connect(pk1); pk1.connect(body);
      }
      // intake and road/wind noise
      var ns = ctx.createBufferSource(); ns.buffer = noiseBuf; ns.loop = true;
      var ibp = ctx.createBiquadFilter(); ibp.type = 'bandpass'; ibp.frequency.value = 700; ibp.Q.value = .8; var intake = ctx.createGain(); intake.gain.value = 0;
      ns.connect(ibp); ibp.connect(intake);
      var ns2 = ctx.createBufferSource(); ns2.buffer = noiseBuf; ns2.loop = true; ns2.loopStart = .37;
      var wlp = ctx.createBiquadFilter(); wlp.type = 'lowpass'; wlp.frequency.value = 400; var wind = ctx.createGain(); wind.gain.value = 0;
      ns2.connect(wlp); wlp.connect(wind);
      var wh = ctx.createOscillator(), whG = ctx.createGain(); wh.type = P.turbo ? 'sine' : 'triangle'; whG.gain.value = 0; wh.connect(whG);
      var out = ctx.createGain(); out.gain.value = 0;
      body.connect(out); intake.connect(out); wind.connect(out); whG.connect(out);
      route(out, fxBus, 0, .04);
      [o1, o2, sub, lfo, ns, ns2, wh].forEach(function (n) { n.start(t0); });
      eng = { name: name, mode: loops ? 'loops' : 'osc', loops: loops, P: P, o1: o1, o2: o2, sub: sub, lfo: lfo, ns: ns, ns2: ns2, wh: wh, lp: lp, pk1: pk1, body: body, intake: intake, ibp: ibp, wind: wind, wlp: wlp, whG: whG, out: out, gear: 1, rpm: 900, v: 0, vt: t0, acc: 0, cut: 0, popT: 0 };
      applyVolumes();
    }
    function stopEngine() { if (eng) { if (eng.loops) eng.loops.forEach(function (l) { try { l.src.stop(); } catch (e) { /* already stopped */ } });
      ['o1', 'o2', 'sub', 'lfo', 'ns', 'ns2', 'wh'].forEach(function (k) { try { eng[k].stop(); } catch (e) { /* already stopped */ } }); eng = null; } }
    function restartEngine() { if (!eng) return; stopEngine(); startEngine(); }
    function pops(t, n) { for (var i = 0; i < n; i++) noise(t + .05 + i * (.05 + Math.random() * .09), .035, .13, fxBus, 'lowpass', 900 + Math.random() * 700, (Math.random() - .5) * .3); }
    function engineUpdate(vms) {
      if (!eng || !ctx) return;
      var t = ctx.currentTime, kmh = vms * 3.6, E = eng, P = E.P, m = engineModel(kmh, P);
      var dt = Math.max(.016, t - E.vt); var a = (vms - E.v) / dt; E.acc += (a - E.acc) * .25; E.v = vms; E.vt = t;
      var shifted = m.gear !== E.gear, sfx = prefs.sfx && prefs.sound;
      if (shifted && m.gear > E.gear && sfx) { // upshift: short torque cut, a soft puff, blow-off on turbo cars
        E.cut = .12; noise(t, P.turbo ? .3 : .09, P.turbo ? .06 : .05 * (prefs.calm ? .4 : 1), fxBus, 'highpass', P.turbo ? 3400 : 2600, 0);
        if (P.pops && !prefs.calm) pops(t, P.pops > .7 ? 2 : 1);
      } else if (shifted && sfx && !prefs.calm) { // downshift blip
        noise(t, .05, .03, fxBus, 'bandpass', 900, 0);
      }
      E.gear = m.gear;
      var rpmN = clamp((m.rpm - P.idle) / (P.ev ? 6000 : (P.hi - P.idle)), 0, 1);
      var lift = braking || E.acc < -2.5;
      if (lift && P.pops && sfx && !prefs.calm && m.rpm > P.lo && t > E.popT) { E.popT = t + .3; pops(t, P.pops > .7 ? 3 : 1); if (P.turbo) noise(t, .25, .05, fxBus, 'highpass', 3400, 0); }
      var load = braking ? .08 : clamp(.4 + E.acc * .22, .12, 1);
      if (E.cut > 0) { E.cut -= dt; load *= .35; }
      var tc = shifted ? .02 : .07, f1 = m.rpm / 60;
      E.o1.frequency.setTargetAtTime(f1, t, tc); E.o2.frequency.setTargetAtTime(f1 * 1.004, t, tc); E.sub.frequency.setTargetAtTime(f1 * 2, t, tc);
      E.lfo.frequency.setTargetAtTime(f1 * .5, t, tc);
      var calm = prefs.calm ? .62 : 1;
      if (E.loops) { // crossfade the two loops either side of the rpm, each pitched to the exact rpm
        var L = E.loops, n = L.length, lo = 0;
        while (lo < n - 2 && m.rpm >= L[lo + 1].rpm) lo++;
        var wl, wh2, r0 = L[lo].rpm, r1 = L[lo + 1].rpm;
        if (m.rpm <= r0) { wl = 1; wh2 = 0; } else if (m.rpm >= r1 && lo === n - 2) { wl = 0; wh2 = 1; }
        else { var fr = clamp(Math.log(m.rpm / r0) / Math.log(r1 / r0), 0, 1); wl = Math.cos(fr * Math.PI / 2); wh2 = Math.sin(fr * Math.PI / 2); }
        for (var li = 0; li < n; li++) {
          var gw = li === lo ? wl : li === lo + 1 ? wh2 : 0;
          L[li].gain.gain.setTargetAtTime(gw, t, .03);
          if (gw > 0) L[li].src.playbackRate.setTargetAtTime(m.rpm / L[li].rpm, t, tc);
        }
        E.lp.frequency.setTargetAtTime(Math.min(16000, (1200 + m.rpm * .6 + load * 3500) * calm), t, .06);
      } else E.lp.frequency.setTargetAtTime(Math.min(16000, (P.lpB + m.rpm * P.lpK + load * P.lpL) * calm), t, .06);
      E.pk1.frequency.setTargetAtTime(160 + m.rpm * .03, t, .1);
      E.body.gain.setTargetAtTime((P.body * .45 + P.body * .8 * load) * (.55 + .45 * rpmN) * calm, t, .05);
      E.ibp.frequency.setTargetAtTime(500 + m.rpm * .12, t, .1);
      E.intake.gain.setTargetAtTime(E.loops ? 0 : P.intake * load * rpmN * calm, t, .06); // the loops already contain the intake
      E.wlp.frequency.setTargetAtTime(260 + kmh * 7, t, .2);
      E.wind.gain.setTargetAtTime(.012 + .09 * Math.pow(clamp(kmh / 200, 0, 1), 1.6), t, .2);
      if (P.turbo) { E.wh.frequency.setTargetAtTime(1300 + rpmN * 2600, t, .1); E.whG.gain.setTargetAtTime(prefs.calm ? 0 : .007 * rpmN * rpmN * load, t, .1); }
      else { E.wh.frequency.setTargetAtTime(f1 * 11, t, .1); E.whG.gain.setTargetAtTime(prefs.calm ? 0 : P.whine * rpmN * rpmN * load, t, .1); }
    }
    // a passing car: its own engine tone drops in pitch (Doppler) while it swells and fades on its side
    function passBy(t, side, v) {
      var f0 = 70 + 30 * clamp(v / 50, 0, 1), o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
      o.setPeriodicWave(engineWave('i4')); o.frequency.setValueAtTime(f0 * 1.14, t); o.frequency.exponentialRampToValueAtTime(f0 * .86, t + .8);
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(1500, t); lp.frequency.exponentialRampToValueAtTime(420, t + .8);
      g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(.16 * (prefs.calm ? .6 : 1), t + .3); g.gain.exponentialRampToValueAtTime(.0001, t + .85);
      o.connect(lp); lp.connect(g); route(g, fxBus, clamp(side * .6, -.85, .85), .08); o.start(t); o.stop(t + .9);
    }

    function buzz(p) { if (prefs.haptics && prefs.sound && env.vibrate) { try { env.vibrate(p); } catch (e) { /* unsupported */ } } }
    function event(name, o) {
      o = o || {};
      if (!audible() || !prefs.sfx) { if (name === 'bump' || name === 'crash') buzz(60); return; }
      var t = ctx.currentTime + 0.01, c = CH[chapter], pv = clamp((o.side || 0) * 0.5, -0.8, 0.8);
      made.events++;
      if (name === 'near') duck(.72, .35); else if (name === 'bump') duck(.45, .7); else if (name === 'crash') duck(.3, 1.4); else if (name === 'rest') restUntil = t + 11; else if (name === 'heart') duck(.8, .6);
      switch (name) {
        case 'lane': noise(t, 0.12, 0.12, fxBus, 'bandpass', 1400 + 600 * speedN(), (o.dir || 0) * 0.3); break;
        case 'coin': { var d = (o.i || 0) % 7; tone('sine', mtof(degree(c, d) + 24), t, 0.35, 0.18, fxBus, 0, 0.4); tone('sine', mtof(degree(c, d) + 36), t + 0.05, 0.3, 0.1, fxBus, 0, 0.4); break; }
        case 'heart': [0, 2, 4].forEach(function (k, i) { tone('triangle', mtof(degree(c, k) + 24), t + i * 0.09, 0.5, 0.16, fxBus, 0, 0.5); }); break;
        case 'near': tone('sine', mtof(c.root + 24 + clamp(o.combo || 1, 1, 8) * 2), t, 0.25, 0.14, fxBus, 0, 0.3); noise(t, 0.2, 0.06, fxBus, 'highpass', 3000); buzz(10); break;
        case 'pass': passBy(t, o.side || 0, o.v || speed); noise(t, 0.3, 0.07 * (0.4 + speedN()), fxBus, 'bandpass', 700, pv); break;
        case 'bump': kick(t, 0.8, fxBus); noise(t, 0.25, 0.3, fxBus, 'lowpass', 900); tone('sine', 220, t, 0.4, 0.15, fxBus, 0, 0.4); buzz(80); break;
        case 'crash': kick(t, 1, fxBus); noise(t, 0.7, 0.4, fxBus, 'lowpass', 1200); tone('sawtooth', 70, t, 1.2, 0.2, fxBus, 0, 0.6, 400); buzz([120, 60, 120]); break;
        case 'chapter': [0, 2, 4, 7].forEach(function (k, i) { tone('sine', mtof(degree(c, k) + 12), t + i * 0.12, 1.4, 0.1, fxBus, (i - 1.5) * 0.3, 0.6); }); break;
        case 'rest': [0, 4, 7].forEach(function (k, i) { tone('triangle', mtof(degree(c, k) + 12), t + i * 0.15, 1.6, 0.1, fxBus, 0, 0.6); }); break;
        case 'thunder': noise(t, 1.8, 0.4, fxBus, 'lowpass', 220); tone('sine', 45, t, 1.6, 0.3, fxBus, 0, 0.7); break;
        case 'finish': [0, 2, 4, 7, 9].forEach(function (k, i) { tone('sawtooth', mtof(degree(c, k) + 12), t + i * 0.2, 2.4, 0.08, fxBus, (i - 2) * 0.25, 0.7, 2400); }); kick(t, 0.7, fxBus); break;
        default: break;
      }
    }

    requestLoops(engineName());
    return {
      unlock: function () { if (ensure() && ctx.state === 'suspended' && ctx.resume) { try { ctx.resume(); } catch (e) { /* ignore */ } } },
      setPrefs: function (p) {
        var carBefore = prefs.car;
        if (p) for (var k in p) if (Object.prototype.hasOwnProperty.call(prefs, k)) prefs[k] = p[k];
        if (prefs.car !== carBefore && !engineOverride) { requestLoops(engineName()); restartEngine(); }
        applyVolumes();
        if (ctx && running && !paused && prefs.music && prefs.sound) pump();
      },
      start: function () {
        if (!ensure()) return;
        running = true; paused = false; chBar = 0; nextBar = 0; chStart = ctx.currentTime; restUntil = 0;
        startBed(CH[chapter].bed); startEngine(); applyVolumes();
        if (timer && env.clearInterval) env.clearInterval(timer);
        timer = env.setInterval ? env.setInterval(pump, 250) : null; pump();
      },
      stop: function () {
        running = false; if (timer && env.clearInterval) env.clearInterval(timer); timer = null;
        stopBed(); stopEngine();
      },
      pause: function () { paused = true; if (ctx && ctx.suspend) { try { ctx.suspend(); } catch (e) { /* ignore */ } } },
      resume: function () { paused = false; nextBar = 0; if (ctx && ctx.resume) { try { ctx.resume(); } catch (e) { /* ignore */ } } },
      setChapter: function (i) {
        chapter = clamp(i | 0, 0, CH.length - 1); chBar = 0; chStart = ctx ? Math.max(ctx.currentTime, nextBar) : 0; chapFrac = 0;
        if (ctx && running && (!bed || bed.name !== CH[chapter].bed)) startBed(CH[chapter].bed);
      },
      setSpeed: function (v) {
        speed = v || 0;
        engineUpdate(speed);
      },
      setEngine: function (name) { engineOverride = ENGINES[name] ? name : null; requestLoops(engineName()); restartEngine(); },
      setIntensity: function (v) { intensity = clamp(v || 0, 0, 1); },
      setChapterProgress: function (f) { chapFrac = clamp(f || 0, 0, 1); },
      setLives: function (n, max) { lives = n; maxLives = max || maxLives; },
      setBrake: function (b) { braking = !!b; },
      setScene: function (s) { scene = s || {}; },
      event: event,
      info: function () { return { ctx: !!ctx, state: ctx ? ctx.state : 'none', chapter: chapter, kit: Score.THEMES[chapter].lead, bed: bed ? bed.name : null, notes: made.notes, events: made.events, running: running, paused: paused, braking: braking, engine: eng ? eng.name : null, engineMode: eng ? eng.mode : null, loops: Object.keys(loopRaw), prefs: prefs, scene: scene }; }
    };
  }

  var exported = { create: create, CHAPTERS: CH, mtof: mtof, engineModel: engineModel, ENGINES: ENGINES, CAR_ENGINE: CAR_ENGINE };
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
  else root.RacerAudio = exported;
})(typeof window !== 'undefined' ? window : globalThis);
