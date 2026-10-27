/* Racer audio: all sound is synthesised with Web Audio, no files.
   Classic Games prototype choices, not tuned by ear yet. API: RacerAudio.create(env) */
(function (root) {
  'use strict';

  // Ten chapters: music kit and ambience bed, in the same order as the chapters in racer.js so the sound matches the
  // scenery. Notes, scale and tempo live in score.js; the effects use the same theme as the music.
  var CH = [
    { kit: 'piano', bed: 'meadow' },     // Dawn Meadow
    { kit: 'pluck', bed: 'meadow' },     // Cherry Hills
    { kit: 'acoustic', bed: 'desert' },  // Desert Road
    { kit: 'cello', bed: 'meadow' },     // Amber Valley
    { kit: 'handpan', bed: 'waves' },    // Sunset Coast
    { kit: 'electro', bed: 'city' },   // Dusk City
    { kit: 'electro', bed: 'rain' },   // Neon Quarter
    { kit: 'cinematic', bed: 'storm' }, // Storm Pass
    { kit: 'pads', bed: 'snow' },        // Northern Lights
    { kit: 'epic', bed: 'waves' }        // Sunrise Coast
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
    v8: { im: spec(4, .38, .7, { 1: .3, 2: .55 }), bands: [0, 40, 75, 110, 145, 180, 215, 255, 600], idle: 800, lo: 2200, hi: 6600, drive: 3.2, lpB: 300, lpK: .4, lpL: 800, sub: .7, am: .15, body: .27, intake: .03, whine: 0, pops: .5 },
    rally: { im: spec(2, .55, .8, { 1: .6 }), bands: [0, 35, 65, 100, 135, 170, 205, 245, 600], idle: 1000, lo: 3200, hi: 7400, drive: 2.8, lpB: 500, lpK: .42, lpL: 800, sub: .35, am: .13, body: .22, intake: .04, whine: 0, turbo: true, pops: 1 },
    v10: { im: spec(5, .12, .6, { 1: .18 }), bands: [0, 50, 90, 130, 170, 210, 250, 290, 600], idle: 1000, lo: 4200, hi: 9000, drive: 2.2, lpB: 500, lpK: .5, lpL: 900, sub: .3, am: .05, body: .22, intake: .03, whine: 0 },
    v12: { im: spec(6, .08, .55), bands: [0, 50, 90, 130, 170, 210, 250, 290, 600], idle: 900, lo: 3600, hi: 8500, drive: 1.8, lpB: 450, lpK: .55, lpL: 800, sub: .25, am: .03, body: .22, intake: .025, whine: 0 },
    f1: { im: spec(3, .1, .45, null, 60), bands: [0, 60, 100, 140, 180, 220, 260, 300, 600], idle: 4000, lo: 9500, hi: 14500, drive: 1.6, lpB: 900, lpK: .7, lpL: 1200, sub: 0, am: .02, body: .2, intake: .02, whine: 0 },
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
    var noiseBuf = null, bed = null, bed2 = null, eng = null, engBus = null, pumpNode = null;
    var prefs = { music: true, sfx: true, style: 'auto', volMusic: 0.6, volFx: 0.7, bass: 0.5, calm: false, sound: true, haptics: true, car: 'rally', volEngine: .7 };
    var chapter = 0, intensity = 0.3, speed = 0, braking = false, running = false, paused = false;
    var timer = null, nextBar = 0, scene = {}, driveSlope = 0, driveSteer = 0;
    var nextLife = 0, duckedUntil = 0, stemBus = {}, duckNode = null, chBar = 0, chStart = 0, chapFrac = 0, restUntil = 0, lives = 3, maxLives = 3;
    var made = { notes: 0, events: 0 }, engineOverride = null, lastEngine = -1;

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
      engBus = ctx.createGain(); engBus.gain.value = .7; engBus.connect(comp); // the engine is mixed on its own, so Engine volume is all that scales it
      duckNode = ctx.createGain(); duckNode.connect(musicBus); // the whole score dips under big effects
      reverb = ctx.createConvolver(); // a 3.4 s hall: dense early reflections, a tail that darkens as it fades
      var len = Math.floor(ctx.sampleRate * 3.4), ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (var c = 0; c < 2; c++) {
        var d = ir.getChannelData(c), lpv = 0;
        for (var i = 0; i < len; i++) { var u = i / len, a2 = .6 - .52 * Math.pow(u, .5); lpv += a2 * ((Math.random() * 2 - 1) - lpv); d[i] = lpv * Math.pow(1 - u, 2.2) * (i < ctx.sampleRate * .02 ? i / (ctx.sampleRate * .02) : 1); }
      }
      reverb.buffer = ir; rvSend = ctx.createGain(); rvSend.gain.value = 0.32; rvSend.connect(reverb); reverb.connect(comp);
      // each score layer has a dry bus and a reverb bus that share one level, so a muted layer leaves no reverb tail behind
      pumpNode = ctx.createGain(); pumpNode.connect(duckNode); // the Drive style ducks everything but the drums on each kick
      Score.STEMS.concat(['heart']).forEach(function (k) { var sg = ctx.createGain(), wg = ctx.createGain(); sg.gain.value = 0; wg.gain.value = 0; sg.connect(k === 'perc' || k === 'heart' ? duckNode : pumpNode); wg.connect(rvSend); sg._wet = wg; stemBus[k] = sg; });
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      var nd = noiseBuf.getChannelData(0); for (var j = 0; j < nd.length; j++) nd[j] = Math.random() * 2 - 1;
      applyVolumes();
      return true;
    }
    function applyVolumes() {
      if (!ctx) return;
      var t = ctx.currentTime, m = (prefs.music && prefs.sound ? prefs.volMusic : 0) * (prefs.calm ? 0.6 : 1) * .47; // measured in game: about 2 dB over the engine at the default sliders, so the music is not masked
      var f = (prefs.sfx && prefs.sound ? prefs.volFx : 0);
      musicBus.gain.setTargetAtTime(m, t, 0.08); fxBus.gain.setTargetAtTime(f, t, 0.08);
      if (bed) bed.out.gain.setTargetAtTime(bedLevel(bed), t, 0.8); // a new bed fades in over a couple of seconds
      if (bed2) bed2.out.gain.setTargetAtTime(bedLevel(bed2), t, 0.8);
      if (eng) eng.out.gain.setTargetAtTime(running && !paused && prefs.sfx && prefs.sound ? prefs.volEngine / .7 : 0, t, 0.1);
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
      var g = ctx.createGain(), at = Math.min(.004, dur * .25); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + at); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, at + .005)); // a 2-4 ms attack, so no burst clicks
      s.connect(f); f.connect(g); route(g, bus, pv || 0); s.start(t); s.stop(t + dur + 0.05);
    }
    function kick(t, v, bus) {
      var o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); o.connect(g); route(g, bus || musicBus, 0); o.start(t); o.stop(t + 0.35);
    }

    function degree(T, d) { return Score.midi(T, d); } // scale degree d of the chapter's own theme (0 is the tonic, 7 an octave up)
    function rnd() { return Math.random(); }
    var curFx = null; // while an effect is being built, 'fx' means its own trimmed bus
    function B(name) { return name === 'fx' ? curFx || fxBus : stemBus[name] || musicBus; }
    function shape(g, t, a, peak, hold, rel) { // attack, hold, release gain shape
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a);
      g.gain.setValueAtTime(peak, t + a + hold); g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + rel);
    }

    // ---- instruments. Each takes (midi note, start time, length in seconds, velocity 0..1, layer, pan, reverb send).
    function pianoNote(m, t, dur, v, bus, pv, wet) {
      var f = mtof(m), A = [1, .5, .3, .18, .1, .06], tau = clamp(2.6 - (m - 48) * .03, .6, 2.8) * Math.min(1.5, .6 + dur * .4);
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900 + v * 5200; route(lp, B(bus), pv, wet);
      for (var i = 0, np = dur < .6 ? 4 : 6; i < np; i++) { // short notes (the rolling pulse) need fewer partials
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
    // ---- drums and Drive instruments (all synthesised)
    function clap(t, v, bus) { for (var i = 0; i < 3; i++) noise(t + i * .011, i === 2 ? .16 : .02, v * (i === 2 ? .5 : .35), B(bus), 'bandpass', 1500, 0); }
    function snare(t, v, bus) { noise(t, .16, v * .32, B(bus), 'bandpass', 2200, 0); var o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(160, t + .08); shape(g, t, .002, v * .22, 0, .11); o.connect(g); route(g, B(bus), 0, .15); o.start(t); o.stop(t + .15); made.notes++; }
    function hat(t, v, bus, open, pv) { noise(t, open ? .2 : .035, v * .1, B(bus), 'highpass', 7600, pv || 0); }
    function shaker(t, v, bus, pv) { noise(t, .05, v * .06, B(bus), 'bandpass', 5800, pv || 0); }
    function kick808(t, v, bus) { // a deep kick with a click on top
      var o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(44, t + .09);
      shape(g, t, .002, v * .8, .02, .42); o.connect(g); route(g, B(bus), 0, 0); o.start(t); o.stop(t + .5); noise(t, .012, v * .2, B(bus), 'highpass', 3000, 0); made.notes++;
    }
    var bassCurve = null;
    function bass808(m, t, dur, v, bus, slideTo) { // the sliding, slightly distorted 808 bass of the Drive style
      if (!bassCurve) { bassCurve = new Float32Array(257); for (var i = 0; i < 257; i++) { var x = i / 128 - 1; bassCurve[i] = Math.tanh(4.2 * x); /* strong drive: the harmonics are what a phone speaker can play */ } }
      var o = ctx.createOscillator(), sh = ctx.createWaveShaper(), lp = ctx.createBiquadFilter(), g = ctx.createGain(); sh.curve = bassCurve;
      o.frequency.setValueAtTime(mtof(m), t); if (slideTo != null) { o.frequency.setValueAtTime(mtof(m), t + dur * .7); o.frequency.exponentialRampToValueAtTime(mtof(slideTo), t + dur); }
      lp.type = 'lowpass'; lp.frequency.value = 1500; shape(g, t, .006, v * .55, Math.max(0, dur - .25), .2);
      o.connect(sh); sh.connect(lp); lp.connect(g); route(g, B(bus), 0, 0); o.start(t); o.stop(t + dur + .3); made.notes++;
    }
    function cowbell(m, t, dur, v, bus, pv) { // two square tones a fifth-and-a-bit apart through a band-pass: the classic drum-machine bell, here pitched to the melody
      var f = mtof(m), bp = ctx.createBiquadFilter(), g = ctx.createGain(); bp.type = 'bandpass'; bp.frequency.value = f * 1.6; bp.Q.value = 2.2;
      [1, 1.48].forEach(function (r) { var o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f * r; o.connect(bp); o.start(t); o.stop(t + Math.max(.3, dur) + .1); made.notes++; });
      shape(g, t, .002, v * .26, .015, Math.max(.18, dur * .6)); bp.connect(g); route(g, B(bus), pv || 0, .18);
    }
    function pumpAt(t, depth) { if (!pumpNode) return; var p = pumpNode.gain; p.setValueAtTime(1, t); p.linearRampToValueAtTime(depth, t + .012); p.setTargetAtTime(1, t + .03, .09); }

    function swell(t, dur, v, bus) { // a rising wash of noise, used to open a chapter and to lead into peaks
      var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; s.loop = true; f.type = 'bandpass'; f.Q.value = .7; f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(6500, t + dur);
      shape(g, t, dur * .92, v * .16, 0, dur * .12); s.connect(f); f.connect(g); route(g, B(bus), 0, .5); s.start(t); s.stop(t + dur * 1.1);
    }
    function duckAt(t0, depth, secs) { if (!ctx || !duckNode) return; var t = Math.max(ctx.currentTime, t0); duckedUntil = t + secs + 2.5; duckNode.gain.setTargetAtTime(depth, t, .06); duckNode.gain.setTargetAtTime(1, t + secs, .25); }
    function duck(depth, secs) { if (!ctx || !duckNode) return; var t = ctx.currentTime; duckedUntil = t + secs + 2.5; duckNode.gain.cancelScheduledValues(t); duckNode.gain.setTargetAtTime(depth, t, .03); duckNode.gain.setTargetAtTime(1, t + secs, .18); }

    // ---- the voice a theme uses for its lead and pulse. Style choices in the sound sheet override the lead.
    // Level trims from measuring each voice and layer alone, so every chapter sits at a similar loudness.
    var VOICE_TRIM = { piano: 3.35, pluck: 6, guitar: 5.4, cello: 2.1, handpan: 3.9, epiano: 3.9, synth: 3, staccato: 3, brass: 1.07, bell: 3.5, strings: .08 };
    var KIT_TRIM = { soft: 7.1, electro: 3.5, epic: 1.6 };
    // A style changes the band: lead voice, the rolling pulse and the drum kit. Auto uses each chapter's own choice.
    var STYLE_ARR = { piano: { lead: 'piano', ost: 'pluck', kit: 'soft' }, electronic: { lead: 'synth', ost: 'synth', kit: 'electro' },
      acoustic: { lead: 'guitar', ost: 'guitar', kit: 'soft' }, cinematic: { lead: 'strings', ost: 'staccato', kit: 'epic' } };
    function arrangement(T) { return STYLE_ARR[prefs.style] || { lead: T.lead, ost: T.ost, kit: T.kit }; }
    function leadVoice(T) { return arrangement(T).lead; }
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

    // ---- one bar of the score. Every layer decides for itself whether to play, from the level the plan gives it,
    // and the section of the song (A, B, break, drop) shapes what it plays.
    function setStems(L, gain, t) {
      for (var k in L) if (stemBus[k]) { var lv = L[k] * (gain[k] || 1), at = Math.max(ctx.currentTime, t - .05); stemBus[k].gain.setTargetAtTime(lv, at, .3); stemBus[k]._wet.gain.setTargetAtTime(lv, at, .3); }
    }
    function stState(t, b) { return { chT: t - chStart, rest: t < restUntil, calm: prefs.calm, lives: lives, maxLives: maxLives, bar: b }; }
    function scheduleBar(t) {
      if (prefs.style === 'drive') return scheduleDriveBar(t);
      var T = Score.THEMES[chapter], A = arrangement(T), beat = 60 / T.bpm, bar = beat * 4, b = chBar++, r = Score.progression(T, b), ch = Score.chord(T, r);
      var sec = Score.section(b), I = Score.intensity(chapter, chapFrac, intensity), L = Score.levels(T, I, stState(t, b));
      var gain = { air: 5.4, lead: 1, pulse: 1.6, strings: .19, brass: 2.9, perc: .9 * (KIT_TRIM[A.kit] || 1), choir: 3.2, bass: .45 + prefs.bass * .8, heart: 1 }, i;
      setStems(L, gain, t);
      var vel = .55 + .35 * I, drop = sec.name === 'drop';
      // chapter opening: a swell and a bell
      if (b === 0) { swell(t, bar * .9, .5 + TENSIONSAFE(chapter) * .6, 'air'); bellNote(Score.midi(T, 14), t + bar * .9, 3, .09, 'air', 0, .9, 3.5, 2); }
      // air: high, sparse, long-tailed bells (every bar in the drop)
      if (L.air > .04 && (drop || b % 2 === 0)) for (i = 0; i < 1 + (rnd() > .55 ? 1 : 0); i++) bellNote(Score.midi(T, 14 + [0, 2, 4, 5][Math.floor(rnd() * 4)]), t + rnd() * bar * .8, 2.6, .05, 'air', rnd() * 1.4 - .7, .9, 3.5, 2);
      // lead: the motif every four bars; in B and the drop it answers itself two bars later, a step higher
      if (L.lead > .04) {
        var grp = Math.floor(b / 4);
        if (b % 4 === 0) Score.motifNotes(T, grp).forEach(function (n) { playVoice(A.lead, n.midi, t + n.beat * beat, n.len * beat * 1.1, vel, 'lead', n.beat % 2 ? .2 : -.2, .35); });
        else if (b % 4 === 2 && sec.counter) Score.motifNotes(T, grp + 1).forEach(function (n) { playVoice(A.lead, n.midi, t + n.beat * beat, n.len * beat * 1.05, vel * .8, 'lead', n.beat % 2 ? -.2 : .2, .4); });
        else if (b % 4 === 2) playVoice(A.lead, ch[1] + 12, t, bar * .9, vel * .6, 'lead', 0, .45);
        // a second melody under it in B and the drop: two long notes from the chord, an octave down
        if (sec.counter && b % 2 === 1) { var cv = A.kit === 'electro' ? 'epiano' : 'cello'; playVoice(cv, ch[2] - 12, t, beat * 2, vel * .45, 'lead', .35, .4); playVoice(cv, ch[1] - 12, t + beat * 2, beat * 2, vel * .4, 'lead', .35, .4); }
      }
      // bass: each kit has its own figure
      if (L.bass > .04) {
        var bm = Score.midi(T, r) - 24, b5 = Score.midi(T, r + 4) - 24;
        var notes = A.kit === 'electro' ? [[0, .45, bm], [.5, .4, bm], [1, .45, bm + 12], [1.5, .4, bm], [2, .45, bm], [2.5, .4, bm], [3, .45, b5], [3.5, .4, bm]]
          : A.kit === 'epic' ? [[0, 2.8, bm], [3, .9, b5]] : (L.bass > .3 ? [[0, 1.5, bm], [2, .9, b5], [3, .7, bm]] : [[0, 3.6, bm]]);
        notes.forEach(function (nn) { var bo = ctx.createOscillator(), bg = ctx.createGain(); bo.type = A.kit === 'electro' ? 'triangle' : 'sine'; bo.frequency.value = mtof(nn[2]); shape(bg, t + nn[0] * beat, .01, .45, nn[1] * beat * .8, nn[1] * beat * .3); bo.connect(bg); route(bg, B('bass'), 0, 0); bo.start(t + nn[0] * beat); bo.stop(t + (nn[0] + nn[1]) * beat + .3); made.notes++; });
      }
      // pulse: the chord rolled in the chapter's own pattern
      if (L.pulse > .04) {
        var steps = drop && I > .6 ? 16 : 8, pat = Score.arp(T);
        for (i = 0; i < steps; i++) { var idx = pat[(steps === 16 ? i >> 1 : i) % 8], acc = i % (steps / 2) === 0 ? 1 : (i % 2 ? .45 : .7); playVoice(A.ost, ch[idx] + 12 + (i % 4 === 3 ? 12 : 0), t + i * bar / steps, bar / steps * 1.4, .3 * acc, 'pulse', (i % 2 ? .3 : -.3), .25); }
      }
      if (L.strings > .04) stringsChord([ch[0] - 12, ch[1], ch[2], ch[3]], t, bar * 1.04, vel, 'strings', .5, Math.min(1.2, bar * .35));
      if (L.brass > .04 && b % 4 === 0) brassChord([Score.midi(T, r - 7), Score.midi(T, r - 3)], t, bar * 1.1, vel, 'brass', .4, bar * .65);
      if (b === 0 && A.kit === 'epic' && L.brass > .02) braam(Score.midi(T, 0) - 12, t, vel, 'brass');
      if (L.choir > .04) choirChord([ch[1] + 12, ch[2] + 12, ch[3] + 12], t, bar * 1.05, vel, 'choir', .7);
      // percussion by kit, with a fill at the end of every section
      if (L.perc > .04) {
        if (A.kit === 'epic') {
          taiko(t, 1, 'perc'); if (L.perc > .45) taiko(t + beat * 2, .6, 'perc'); if (L.perc > .7) taiko(t + beat * 3.5, .4, 'perc');
          if (drop) for (i = 1; i < 4; i += 2) snare(t + i * beat, .7, 'perc');
          if (sec.fill) for (i = 0; i < 6; i++) taiko(t + beat * 2.5 + i * beat / 4, .35 + i * .08, 'perc');
        } else if (A.kit === 'electro') {
          kick(t, .5, B('perc')); kick(t + 2 * beat, .5, B('perc')); if (drop) kick(t + 2.5 * beat, .35, B('perc'));
          for (i = 1; i < 4; i += 2) snare(t + i * beat, .8, 'perc');
          var hs = drop ? 16 : 8; for (i = 0; i < hs; i++) hat(t + i * bar / hs, i % 2 ? .7 : 1, 'perc', i === hs - 2 && drop, i % 2 ? .3 : -.3);
          if (sec.fill) for (i = 0; i < 4; i++) snare(t + beat * 3 + i * beat / 4, .3 + i * .12, 'perc');
        } else { // soft: frame drum on 1 and 3, a clap on 2 and 4 once it builds, and a shaker
          frameDrum(t, .8, 'perc'); frameDrum(t + beat * 2, .55, 'perc');
          if (L.perc > .35) { clap(t + beat, .45, 'perc'); clap(t + beat * 3, .45, 'perc'); }
          for (i = 0; i < 8; i++) shaker(t + i * beat / 2, i % 2 ? .7 : 1, 'perc', i % 2 ? .35 : -.35);
          if (sec.fill) for (i = 0; i < 3; i++) frameDrum(t + beat * 3 + i * beat / 3, .35 + i * .15, 'perc');
        }
      }
      // heartbeat when one life is left
      if (L.heart) for (i = 0; i < 4; i++) { kick(t + i * beat, .16, B('heart')); kick(t + i * beat + .2, .1, B('heart')); }
      return bar;
    }

    // ---- Drive (phonk-inspired): half-time beat, sliding 808, cowbell riff, hat rolls and a pumping mix
    function scheduleDriveBar(t) {
      var D = Score.driveTheme(Score.THEMES[chapter], chapter), beat = 60 / D.bpm, bar = beat * 4, st16 = beat / 4, b = chBar++, sec = Score.section(b);
      var r = Score.progression(D, b), rn = Score.progression(D, b + 1), I = Score.intensity(chapter, chapFrac, intensity), i;
      var st = stState(t, b), intro = clamp((st.chT - 2) / 4, 0, 1), brk = sec.name === 'break', drop = sec.name === 'drop';
      var L = { air: .25, lead: brk ? .45 : 1, pulse: (brk ? .3 : 1) * intro, strings: (sec.name === 'A' ? .35 : .7), brass: 0, perc: (brk ? 0 : 1) * intro, choir: 0, bass: (brk ? .45 : 1) * Math.max(.4, intro), heart: st.maxLives > 1 && st.lives === 1 ? 1 : 0 };
      if (st.rest) { L.perc = 0; L.pulse = 0; L.bass *= .3; }
      if (prefs.calm) { L.perc *= .5; L.pulse *= .6; }
      setStems(L, { air: 4, lead: 2.4, pulse: 3.2, strings: .2, perc: 1.2, bass: .32 + prefs.bass * .5, heart: 1 }, t); // balanced for phone speakers, not only headphones
      var bm = Score.midi(D, r) - 24;
      // drums: kick on 1 and the "and" of 2 (and more in the drop), clap on 3, hats with a roll every second bar
      var kicks = drop ? [0, 6, 10, 11] : [0, 6, 10];
      if (L.perc > .02) {
        kicks.forEach(function (k) { kick808(t + k * st16, .6, 'perc'); pumpAt(t + k * st16, .45); });
        clap(t + 8 * st16, .8, 'perc'); if (drop && b % 2) clap(t + 15 * st16, .35, 'perc');
        for (i = 0; i < 16; i += (drop ? 1 : 2)) { if (b % 2 === 1 && i >= 12) break; hat(t + i * st16, i % 4 === 0 ? 3 : 2, 'pulse', false, i % 2 ? .25 : -.25); }
        if (b % 2 === 1) for (i = 0; i < 6; i++) hat(t + 12 * st16 + i * beat / 6, 1.6 + i * .3, 'pulse', false, (i - 2.5) * .12); // the roll
        if (sec.fill) hat(t + 14 * st16, 3, 'pulse', true, 0);
      }
      // 808: the root, an answer on the "and" of 3, and a slide into the next bar's root
      if (L.bass > .02) { bass808(bm, t, 5 * st16, 1, 'bass'); bass808(bm + (b % 2 ? 12 : 7), t + 10 * st16, 6 * st16, .85, 'bass', Score.midi(D, rn) - 24); }
      // cowbell riff over two bars, an octave up from the key
      if (b % 2 === 0) D.riff.forEach(function (n) { cowbell(Score.midi(D, n[1] + 7) + (drop ? 12 : 0), t + n[0] * beat, n[2] * beat, brk ? .9 : 1.7, 'lead', n[0] % 2 ? .25 : -.25); });
      // a dark pad under it
      stringsChord(Score.chord(D, r).map(function (m) { return m - 12; }), t, bar * 1.02, .5, 'strings', .6, bar * .4);
      if (b % 4 === 0) bellNote(Score.midi(D, 14), t + beat * (rnd() * 3), 2.4, .04, 'air', rnd() - .5, .9, 3.5, 2);
      if (L.heart) for (i = 0; i < 4; i++) { kick(t + i * beat, .16, B('heart')); kick(t + i * beat + .2, .1, B('heart')); }
      return bar;
    }
    function TENSIONSAFE(c) { return Score.TENSION[clamp(c, 0, Score.TENSION.length - 1)]; }
    function pump() {
      if (!ctx || !running || paused) return;
      lifeTick();
      if (!prefs.music || !prefs.sound) return;
      var now = ctx.currentTime;
      if (nextBar < now) nextBar = now + 0.05;
      while (nextBar < now + 1.2) nextBar += scheduleBar(nextBar);
    }

    // Ambience beds (filtered noise that breathes). Two can play at once: as the scenery blends into the next
    // chapter, the next bed fades in with it, so the sound never cuts when the chapter changes.
    function makeBed(name) {
      var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.loopStart = Math.random() * 1.5;
      var f = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      var cfg = { meadow: ['bandpass', 1400, 0.04], desert: ['lowpass', 500, 0.05], waves: ['lowpass', 700, 0.09], city: ['lowpass', 300, 0.05], rain: ['highpass', 3200, 0.07], storm: ['bandpass', 900, 0.09], snow: ['lowpass', 380, 0.035] }[name] || ['lowpass', 500, 0.04];
      f.type = cfg[0]; f.frequency.value = cfg[1]; g.gain.value = cfg[2];
      lfo.frequency.value = name === 'waves' ? 0.12 : 0.07; lg.gain.value = cfg[2] * 0.6; lfo.connect(lg); lg.connect(g.gain);
      var out = ctx.createGain(); out.gain.value = 0;
      s.connect(f); f.connect(g); g.connect(out); route(out, fxBus, 0, 0.1); s.start(); lfo.start();
      return { name: name, src: s, lfo: lfo, out: out, mix: 0 };
    }
    function dropBed(x, secs) { // fade a bed out, then stop it
      if (!x) return; var t = ctx.currentTime; x.out.gain.cancelScheduledValues(t); x.out.gain.setTargetAtTime(0, t, secs / 4);
      try { x.src.stop(t + secs + .2); x.lfo.stop(t + secs + .2); } catch (e) { /* already stopped */ }
    }
    function bedLevel(x) { return x ? (prefs.sound ? 0.5 : 0) * x.mix : 0; }
    function startBed(name) {
      if (!ctx) return;
      if (bed && bed.name === name) return;
      if (bed2 && bed2.name === name) { dropBed(bed, 2); bed = bed2; bed2 = null; bed.mix = 1; applyVolumes(); return; } // the next bed is already fading in
      dropBed(bed, 3); dropBed(bed2, 3); bed2 = null;
      bed = makeBed(name); bed.mix = 1;
      applyVolumes();
    }
    function stopBed() { if (bed) { dropBed(bed, .3); bed = null; } if (bed2) { dropBed(bed2, .3); bed2 = null; } }
    function blendBeds(sc) { // follow the scenery blend: at t the next chapter's bed is at t, the current one at 1 - t
      if (!ctx || !running || !bed || !sc) return;
      if (sc.nextBed && sc.nextBed !== bed.name && sc.t > 0) {
        if (!bed2 || bed2.name !== sc.nextBed) { dropBed(bed2, 1); bed2 = makeBed(sc.nextBed); }
        bed2.mix = sc.t; bed.mix = 1 - sc.t;
      } else { bed.mix = 1; if (bed2) { dropBed(bed2, 2); bed2 = null; } }
      var t = ctx.currentTime; bed.out.gain.setTargetAtTime(bedLevel(bed), t, .5); if (bed2) bed2.out.gain.setTargetAtTime(bedLevel(bed2), t, .5);
    }
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
        var xg = ctx.createGain(); xg.gain.value = P.excite == null ? .1 : P.excite; // the loops now carry their own upper harmonics, so only a touch of rasp is added
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
      route(out, engBus, 0, .04);
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
      // Load is what the engine is doing: pulling up a hill, holding speed, swinging through a lane change, lifting off.
      // At a steady speed it still moves a little, as a driver's foot does.
      var steer = Math.min(1, Math.abs(driveSteer) / 2.5);
      var load = braking ? .08 : clamp(.58 + clamp(E.acc * .35, -.3, .4) + driveSlope * .28 - steer * .12 + .05 * Math.sin(t * 1.1) + .035 * Math.sin(t * 2.9 + 1.3), .15, 1);
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
          if (gw > 0 || L[li].on) { L[li].gain.gain.setTargetAtTime(gw, t, .03); L[li].on = gw > 0; }
          if (gw > 0 || (li >= lo - 1 && li <= lo + 2)) L[li].src.playbackRate.setTargetAtTime(m.rpm / L[li].rpm, t, tc); // the loops next to the one playing already follow the pitch, so one fading in never glides from an old one
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
      o.connect(lp); lp.connect(g); route(g, curFx || fxBus, clamp(side * .6, -.85, .85), .08); o.start(t); o.stop(t + .9);
    }

    // ---- effects. Each one is built from layers (an attack, a body, a tail) with a little random variation,
    // so repeated sounds do not sound identical. Nothing here uses recordings.
    function pit(f, cents) { return f * Math.pow(2, ((rnd() - .5) * 2 * (cents || 10)) / 1200); }
    function metalHit(t, f, v, bus, pv, wet) { // inharmonic partials: bells, glass, clanks
      [[1, 1, 1.6], [2.76, .5, 1], [5.4, .3, .6], [8.9, .15, .35]].forEach(function (p) { var g = ctx.createGain(), o = ctx.createOscillator(); o.frequency.value = pit(f * p[0], 6); shape(g, t, .002, v * .3 * p[1], 0, p[2]); o.connect(g); route(g, bus, pv, wet); o.start(t); o.stop(t + p[2] + .1); made.notes++; });
    }
    function sub(t, f0, f1, dur, v, bus) { var o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur * .7); shape(g, t, .004, v, 0, dur); o.connect(g); route(g, bus, 0, .15); o.start(t); o.stop(t + dur + .1); }
    function sweep(t, dur, f0, f1, v, bus, pv, type, q) { // filtered noise that moves: whooshes, risers, wind gusts
      var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; f.type = type || 'bandpass'; f.Q.value = q || .8;
      f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur); shape(g, t, dur * .35, v, 0, dur * .65); s.connect(f); f.connect(g); route(g, bus, pv, .2); s.start(t); s.stop(t + dur + .05);
    }
    function rattle(t, n, span, v, bus) { for (var i = 0; i < n; i++) noise(t + rnd() * span, .02 + rnd() * .04, v * (.3 + rnd() * .7), bus, 'bandpass', 700 + rnd() * 3500, rnd() * 1.2 - .6); }
    function buzz(p) { if (prefs.haptics && prefs.sound && env.vibrate) { try { env.vibrate(p); } catch (e) { /* unsupported */ } } }
    function event(name, o) {
      o = o || {};
      var now = ctx ? ctx.currentTime : 0;
      if (name === 'rest') restUntil = now + 11; // the score eases back whether or not effects are on
      if (!audible() || !prefs.sfx) { if (name === 'bump' || name === 'crash') buzz(60); return; }
      var t = now + 0.01, c = Score.THEMES[chapter], pv = clamp((o.side || 0) * 0.5, -0.8, 0.8), F = trimBus(EVENT_TRIM[name] || 1), k;
      curFx = F;
      made.events++;
      if (name === 'near') duck(.72, .35); else if (name === 'bump') duck(.45, .7); else if (name === 'crash') duck(.3, 1.4); else if (name === 'heart') duck(.8, .6);
      switch (name) {
        case 'lane': sweep(t, .16, 900 + 500 * speedN(), 2400, .1, F, (o.dir || 0) * .35); sub(t, 90, 60, .08, .05, F); break;
        case 'coin': { // click, a bell in the chapter's key stepping up a scale, and a sparkle
          var d = (o.i || 0) % 7, m = degree(c, d) + 24;
          noise(t, .012, .08, F, 'highpass', 4500, 0); bellNote(m, t, .5, .26, 'fx', 0, .35, 2.76, 1.2); bellNote(m + 12, t + .045, .4, .13, 'fx', .15, .45, 3.5, 1);
          if (rnd() > .5) bellNote(m + 19, t + .09, .3, .06, 'fx', -.2, .5, 5.4, 1); break; }
        case 'heart': // a warm rising chord, a chime and a soft double thump
          [0, 2, 4, 7].forEach(function (s, i) { var f = mtof(degree(c, s) + 12), g = ctx.createGain(), q = ctx.createOscillator(); q.type = 'triangle'; q.frequency.value = f; shape(g, t + i * .07, .12, .13, .1, .7); q.connect(g); route(g, F, (i - 1.5) * .2, .5); q.start(t + i * .07); q.stop(t + i * .07 + 1.1); });
          bellNote(degree(c, 7) + 24, t + .25, .9, .14, 'fx', 0, .6, 3.5, 1.4); sub(t, 80, 55, .22, .18, F); sub(t + .16, 80, 55, .22, .12, F); break;
        case 'near': { // a rising whoosh, a bell that climbs with the combo, a sparkle and a low push
          var cb = clamp(o.combo || 1, 1, 8);
          sweep(t, .3, 500, 3400, .15, F, pv * .6); bellNote(Score.midi(c, 7 + cb), t + .05, .45, .2, 'fx', 0, .35, 3.5, 1.4); noise(t + .08, .08, .05, F, 'highpass', 5200, 0); sub(t, 110, 70, .15, .08, F); buzz(10); break; }
        case 'pass': passBy(t, o.side || 0, o.v || speed); sweep(t, .35, 400, 1500, .08 * (.4 + speedN()), F, pv); break;
        case 'bump': // impact, body thump, a glass tinkle and a rattle
          sub(t, 150, 40, .5, .55, F); noise(t, .28, .3, F, 'lowpass', 1100, 0); metalHit(t + .01, 1400 + rnd() * 400, .2, F, rnd() - .5, .25); rattle(t + .05, 6, .4, .12, F); sweep(t, .35, 2400, 500, .1, F, 0, 'bandpass'); buzz(80); break;
        case 'crash': // a big boom, a roaring burst, scattered debris and a long tail
          sub(t, 120, 28, 1.2, .8, F); sub(t + .02, 220, 60, .5, .4, F); sweep(t, .9, 3600, 160, .4, F, 0, 'lowpass', .6); noise(t, .35, .35, F, 'bandpass', 700, 0);
          for (k = 0; k < 3; k++) metalHit(t + .02 + k * .07, 900 + rnd() * 1800, .16, F, rnd() * 1.4 - .7, .4); rattle(t + .1, 18, 1, .2, F); buzz([120, 60, 120]); break;
        case 'chapter': [0, 2, 4, 7].forEach(function (s, i) { bellNote(degree(c, s) + 24, t + i * .12, 1.6, .12, 'fx', (i - 1.5) * .3, .7, 3.5, 1.6); }); sweep(t, .9, 400, 4200, .08, F, 0); break;
        case 'rest': [0, 4, 7, 9].forEach(function (s, i) { bellNote(degree(c, s) + 12, t + i * .16, 2.2, .1, 'fx', (i - 1.5) * .25, .7, 1, 1.2); }); break;
        case 'thunder': // o.close: a strike you can see, heard o.delay seconds later; otherwise a distant rumble
          if (o.close) lifeSound('thunderclose', t + (o.delay || 0), (rnd() - .5) * .8, 1); else lifeSound('thunderfar', t + (o.delay || 0), (rnd() - .5) * 1.2, .9); break;
        case 'finish': // a fanfare: brass and choir on the tonic, bells climbing, a taiko hit
          brassChord([degree(c, 0) - 12, degree(c, 4) - 12, degree(c, 0)], t, 3.2, .8, 'fx', .5, .5); choirChord([degree(c, 0) + 12, degree(c, 2) + 12, degree(c, 4) + 12], t + .1, 3, .8, 'fx', .7);
          [0, 2, 4, 7, 9, 11].forEach(function (s, i) { bellNote(degree(c, s) + 24, t + .2 + i * .14, 1.8, .12, 'fx', (i - 2.5) * .25, .7, 3.5, 1.6); }); taiko(t, 1, 'fx'); sweep(t, 1.2, 300, 5000, .2, F, 0); break;
        default: break;
      }
      curFx = null;
    }

    // Level trims from measuring each sound alone: life sounds sit quietly under everything, effects stand out.
    var LIFE_TRIM = { whistle: 1, metro: 1, songbirds: 3.5, balloon: 5, windmill: .4, windchimes: 1.4, butterflies: 1.8, flag: 4, crickets: 3.2, crow: 2.8, churchbell: 1, gulls: 1, bellbuoy: 1.4, boathorn: .4, siren: 1, cityhorns: 1, plane: 1.4, train: 4, thunderfar: .7, raingust: 1, thunderclose: .7, tunnel: 1.25, owl: 1, foghorn: .3, fireworks: 1 };
    var EVENT_TRIM = { lane: 3.5, coin: 5.6, heart: 1.6, near: 4, pass: 1.8, bump: 4, crash: 2.8, chapter: 2.2, rest: 2, thunder: 1, finish: 1 };
    var trimBuses = {};
    function trimBus(trim) { // one bus per level, reused by every sound with that level (making a new one each time would leave a node behind per sound)
      if (trimBuses[trim]) return trimBuses[trim];
      var g = ctx.createGain(), w = ctx.createGain(); g.gain.value = w.gain.value = trim; g.connect(fxBus); w.connect(rvSend); g._wet = w; trimBuses[trim] = g; return g;
    }
    // ---- life sounds: the small sounds of each place. Every chapter lists its own (see racer.js).
    var LIFE_LEVEL = { songbirds: 1, balloon: 1, windmill: 1, windchimes: 1, butterflies: 1, flag: 1, crickets: 1, crow: 1, churchbell: 1, gulls: 1, bellbuoy: 1, boathorn: 1, siren: 1, cityhorns: 1, plane: 1, train: 1, thunderfar: 1, raingust: 1, thunderclose: 1, tunnel: 1, owl: 1, foghorn: 1, fireworks: 1 };
    function lifeSound(name, t, pv, v) {
      var F = trimBus(LIFE_TRIM[name] || 1), i, f, T = Score.THEMES[chapter];
      v = (v == null ? 1 : v);
      switch (name) {
        case 'songbirds': for (i = 0; i < 3 + Math.floor(rnd() * 3); i++) { var bt = t + i * (.14 + rnd() * .1), bf = 2600 + rnd() * 1800, o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(bf, bt); o.frequency.exponentialRampToValueAtTime(bf * (1.3 + rnd() * .4), bt + .07); shape(g, bt, .006, .05 * v, 0, .08); o.connect(g); route(g, F, pv, .35); o.start(bt); o.stop(bt + .2); made.notes++; } break;
        case 'balloon': for (i = 0; i < 3; i++) sweep(t + i * .38, .34, 500, 1100, .05 * v, F, pv, 'bandpass', 1.2); break;
        case 'windmill': { var wo = ctx.createOscillator(), wl = ctx.createOscillator(), wg = ctx.createGain(), wf = ctx.createBiquadFilter(), wa = ctx.createGain(); wo.type = 'sawtooth'; wo.frequency.value = 58; wl.frequency.value = 1.3; wa.gain.value = .5; wl.connect(wa); wa.connect(wg.gain); wf.type = 'bandpass'; wf.frequency.value = 220; wf.Q.value = 2.2; shape(wg, t, .5, .03 * v, 2, .6); wo.connect(wf); wf.connect(wg); route(wg, F, pv, .2); wo.start(t); wl.start(t); wo.stop(t + 3.8); wl.stop(t + 3.8); break; }
        case 'windchimes': for (i = 0; i < 4 + Math.floor(rnd() * 4); i++) metalHit(t + i * (.2 + rnd() * .35), mtof(Score.midi(T, 14 + [0, 2, 4, 5, 7][Math.floor(rnd() * 5)])), .1 * v, F, pv + (rnd() - .5) * .4, .6); break;
        case 'butterflies': noise(t, .9, .04 * v, F, 'highpass', 5200, pv); sweep(t, .8, 3000, 6000, .015 * v, F, pv, 'bandpass', 3); break;
        case 'flag': for (i = 0; i < 6; i++) noise(t + i * (.1 + rnd() * .05), .07, .06 * v, F, 'bandpass', 1300 + rnd() * 600, pv); break;
        case 'crickets': for (i = 0; i < 6; i++) for (var cc = 0; cc < 3; cc++) { var co = ctx.createOscillator(), cg = ctx.createGain(), ct = t + i * .42 + cc * .045; co.frequency.value = 4200 + i * 40; shape(cg, ct, .004, .018 * v, 0, .03); co.connect(cg); route(cg, F, pv, .1); co.start(ct); co.stop(ct + .06); } break;
        case 'crow': for (i = 0; i < 2; i++) { var kt = t + i * .42, ko = ctx.createOscillator(), kf = ctx.createBiquadFilter(), kg = ctx.createGain(); ko.type = 'sawtooth'; ko.frequency.setValueAtTime(720, kt); ko.frequency.exponentialRampToValueAtTime(430, kt + .26); kf.type = 'bandpass'; kf.frequency.value = 850; kf.Q.value = 3; shape(kg, kt, .02, .1 * v, .1, .14); ko.connect(kf); kf.connect(kg); route(kg, F, pv, .3); ko.start(kt); ko.stop(kt + .35); made.notes++; } break;
        case 'churchbell': for (i = 0; i < 3; i++) metalHit(t + i * 1.5, 196, .3 * v, F, pv, .7); break;
        case 'gulls': for (i = 0; i < 2 + Math.floor(rnd() * 2); i++) { var gt = t + i * (.5 + rnd() * .3), go = ctx.createOscillator(), gg = ctx.createGain(); go.frequency.setValueAtTime(1300, gt); go.frequency.linearRampToValueAtTime(2300, gt + .18); go.frequency.linearRampToValueAtTime(1500, gt + .45); shape(gg, gt, .03, .06 * v, .15, .22); go.connect(gg); route(gg, F, pv, .35); go.start(gt); go.stop(gt + .6); noise(gt, .4, .012 * v, F, 'bandpass', 2200, pv); } break;
        case 'bellbuoy': for (i = 0; i < 2; i++) { metalHit(t + i * 1.1, 330, .22 * v, F, pv, .5); noise(t + i * 1.1, .03, .05 * v, F, 'bandpass', 1500, pv); } break;
        case 'boathorn': case 'foghorn': { var low = name === 'foghorn', hf = low ? 98 : 150, ho = ctx.createOscillator(), h2 = ctx.createOscillator(), hl = ctx.createBiquadFilter(), hg = ctx.createGain(); ho.type = 'sawtooth'; h2.type = 'square'; ho.frequency.value = hf; h2.frequency.value = hf / 2; hl.type = 'lowpass'; hl.frequency.value = low ? 320 : 520; shape(hg, t, .35, .13 * v, low ? 1.6 : .8, .7); ho.connect(hl); h2.connect(hl); hl.connect(hg); route(hg, F, pv, .5); ho.start(t); h2.start(t); ho.stop(t + 3.2); h2.stop(t + 3.2); break; }
        case 'siren': for (i = 0; i < 6; i++) { var so = ctx.createOscillator(), sg = ctx.createGain(), st = t + i * .42; so.type = 'triangle'; so.frequency.value = i % 2 ? 930 : 700; shape(sg, st, .02, .035 * v, .36, .02); var spf = ctx.createBiquadFilter(); spf.type = 'lowpass'; spf.frequency.value = 1800; so.connect(spf); spf.connect(sg); route(sg, F, pv + (i - 3) * .06, .3); so.start(st); so.stop(st + .45); } break;
        case 'cityhorns': for (i = 0; i < 2; i++) { var hh = ctx.createGain(), hlp = ctx.createBiquadFilter(); hlp.type = 'lowpass'; hlp.frequency.value = 1100; shape(hh, t + i * .38, .01, .04 * v, .16, .05); hlp.connect(hh); route(hh, F, pv, .3); [400, 503].forEach(function (fr) { var ho2 = ctx.createOscillator(); ho2.type = 'square'; ho2.frequency.value = fr; ho2.connect(hlp); ho2.start(t + i * .38); ho2.stop(t + i * .38 + .3); }); } break;
        case 'plane': sweep(t, 5, 250, 800, .09 * v, F, pv, 'bandpass', .6); sub(t, 70, 60, 4, .03 * v, F); break;
        case 'train': for (i = 0; i < 26; i++) { noise(t + i * .15, .04, .05 * v, F, 'lowpass', 900, pv); if (i % 2) noise(t + i * .15 + .06, .03, .03 * v, F, 'bandpass', 1500, pv); } break;
        case 'thunderfar': sweep(t, 3.6, 120, 60, .3 * v, F, pv, 'lowpass', .5); sub(t + .3, 48, 32, 2.8, .12 * v, F); break;
        case 'thunderclose': noise(t, .07, .26 * v, F, 'highpass', 900, pv); noise(t + .03, .35, .14 * v, F, 'bandpass', 500, pv); sweep(t + .03, 3, 400, 70, .4 * v, F, pv, 'lowpass', .5); sub(t + .02, 60, 30, 2.4, .3 * v, F); duckAt(t, .78, 1.1); break; // a crack with a short attack, then the roll; the music only dips
        case 'raingust': sweep(t, 1.6, 2400, 5200, .07 * v, F, pv, 'highpass', .6); break;
        case 'tunnel': sweep(t, 2.2, 200, 700, .09 * v, F, pv, 'lowpass', .6); sub(t, 65, 60, 2.2, .05 * v, F); break;
        case 'whistle': { // a steam whistle: two reedy tones a third apart, with a breathy start
          [523, 659].forEach(function (wf) { var wo = ctx.createOscillator(), wb = ctx.createBiquadFilter(), wg = ctx.createGain(), wv = ctx.createOscillator(), wd = ctx.createGain(); wo.type = 'sawtooth'; wo.frequency.setValueAtTime(wf * .96, t); wo.frequency.linearRampToValueAtTime(wf, t + .15); wv.frequency.value = 6; wd.gain.value = wf * .006; wv.connect(wd); wd.connect(wo.frequency); wb.type = 'bandpass'; wb.frequency.value = wf * 2; wb.Q.value = 4; shape(wg, t, .08, .05 * v, 1.1, .5); wo.connect(wb); wb.connect(wg); route(wg, F, pv, .45); wo.start(t); wv.start(t); wo.stop(t + 2); wv.stop(t + 2); });
          noise(t, .35, .03 * v, F, 'highpass', 3000, pv); break; }
        case 'metro': sweep(t, 2.6, 300, 1400, .1 * v, F, pv, 'bandpass', .8); for (i = 0; i < 14; i++) noise(t + .5 + i * .11, .03, .045 * v, F, 'bandpass', 1800, pv); sub(t + .3, 70, 55, 2, .05 * v, F); break;
        case 'owl': for (i = 0; i < 2; i++) { var oo = ctx.createOscillator(), og = ctx.createGain(), ot = t + i * .55; oo.frequency.setValueAtTime(i ? 330 : 390, ot); oo.frequency.linearRampToValueAtTime(i ? 300 : 360, ot + .4); shape(og, ot, .08, .06 * v, .2, .2); oo.connect(og); route(og, F, pv, .5); oo.start(ot); oo.stop(ot + .6); } break;
        case 'fireworks': { var fo = ctx.createOscillator(), fg = ctx.createGain(); fo.frequency.setValueAtTime(700, t); fo.frequency.exponentialRampToValueAtTime(3200, t + .9); shape(fg, t, .05, .035 * v, .7, .1); fo.connect(fg); route(fg, F, pv, .3); fo.start(t); fo.stop(t + 1.1); noise(t + .9, .2, .12 * v, F, 'bandpass', 900, pv); sub(t + .9, 110, 50, .35, .1 * v, F); for (i = 0; i < 12; i++) noise(t + 1 + rnd() * .9, .02, .05 * v, F, 'highpass', 4000 + rnd() * 3000, pv + (rnd() - .5) * .3); break; }
        default: break;
      }
    }
    // Every few seconds one of the current chapter's life sounds plays somewhere in the stereo field.
    function lifeTick() {
      if (!prefs.sfx || !prefs.sound || !scene.life || !scene.life.length) return;
      var now = ctx.currentTime; if (now < nextLife) return;
      nextLife = now + 6 + rnd() * 8;
      if (now < duckedUntil) return; // keep clear of big moments
      lifeSound(scene.life[Math.floor(rnd() * scene.life.length)], now + .05, rnd() * 1.6 - .8, .7 + rnd() * .5);
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
      resume: function () { paused = false; if (ctx && ctx.resume) { try { ctx.resume(); } catch (e) { /* ignore */ } } },
      setChapter: function (i) {
        chapter = clamp(i | 0, 0, CH.length - 1); chBar = 0; chStart = ctx ? Math.max(ctx.currentTime, nextBar) : 0; chapFrac = 0;
        if (ctx && running && (!bed || bed.name !== CH[chapter].bed)) startBed(CH[chapter].bed);
      },
      setSpeed: function (v) {
        speed = v || 0;
        var tn = ctx ? ctx.currentTime : 0;
        if (!ctx || tn - lastEngine >= .03 || tn < lastEngine) { lastEngine = tn; engineUpdate(speed); } // about 30 times a second is plenty for the engine
      },
      setEngine: function (name) { engineOverride = ENGINES[name] ? name : null; requestLoops(engineName()); restartEngine(); },
      setIntensity: function (v) { intensity = clamp(v || 0, 0, 1); },
      setChapterProgress: function (f) { chapFrac = clamp(f || 0, 0, 1); },
      setLives: function (n, max) { lives = n; maxLives = max || maxLives; },
      setBrake: function (b) { braking = !!b; },
      setDrive: function (slope, steer) { driveSlope = clamp(slope || 0, -1, 1); driveSteer = steer || 0; },
      setScene: function (s) { scene = s || {}; blendBeds(scene); },
      life: function (name, pv) { if (audible()) lifeSound(name, ctx.currentTime + .02, pv || 0, 1); },
      lifeNames: Object.keys(LIFE_LEVEL),
      event: event,
      info: function () { return { ctx: !!ctx, state: ctx ? ctx.state : 'none', chapter: chapter, kit: Score.THEMES[chapter].lead, bed: bed ? bed.name : null, bed2: bed2 ? bed2.name : null, style: prefs.style, notes: made.notes, events: made.events, running: running, paused: paused, braking: braking, engine: eng ? eng.name : null, engineGain: eng ? eng.out.gain.value : null, engineMode: eng ? eng.mode : null, loops: Object.keys(loopRaw), prefs: prefs, scene: scene }; }
    };
  }

  var exported = { create: create, CHAPTERS: CH, mtof: mtof, engineModel: engineModel, ENGINES: ENGINES, CAR_ENGINE: CAR_ENGINE };
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
  else root.RacerAudio = exported;
})(typeof window !== 'undefined' ? window : globalThis);
