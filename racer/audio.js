/* Racer audio: all sound is synthesised with Web Audio, no files.
   Classic Games prototype choices, not tuned by ear yet. API: RacerAudio.create(env) */
(function (root) {
  'use strict';

  // Ten chapters: root note (MIDI), scale, tempo, music kit, ambience bed.
  var CH = [
    { root: 57, sc: [0, 2, 4, 7, 9], bpm: 84, kit: 'piano', bed: 'meadow' },
    { root: 62, sc: [0, 2, 4, 7, 9], bpm: 88, kit: 'pluck', bed: 'meadow' },
    { root: 55, sc: [0, 2, 3, 7, 9], bpm: 78, kit: 'handpan', bed: 'desert' },
    { root: 60, sc: [0, 2, 4, 7, 9], bpm: 92, kit: 'acoustic', bed: 'waves' },
    { root: 57, sc: [0, 3, 5, 7, 10], bpm: 100, kit: 'electro', bed: 'city' },
    { root: 52, sc: [0, 3, 5, 7, 10], bpm: 108, kit: 'electro', bed: 'city' },
    { root: 50, sc: [0, 2, 3, 7, 8], bpm: 72, kit: 'cinematic', bed: 'rain' },
    { root: 47, sc: [0, 3, 5, 6, 7], bpm: 120, kit: 'cinematic', bed: 'storm' },
    { root: 59, sc: [0, 2, 4, 7, 9], bpm: 70, kit: 'cello', bed: 'snow' },
    { root: 57, sc: [0, 2, 4, 7, 9], bpm: 96, kit: 'epic', bed: 'meadow' }
  ];
  var STYLE_KIT = { cinematic: 'cinematic', piano: 'piano', electronic: 'electro', acoustic: 'acoustic' };
  var PROG = [0, 3, 4, 2];

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
    var timer = null, nextBar = 0, barIdx = 0, scene = {};
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
      comp.connect(hp); hp.connect(mud); mud.connect(air); air.connect(master); master.connect(ctx.destination);
      musicBus = ctx.createGain(); fxBus = ctx.createGain(); musicBus.connect(comp); fxBus.connect(comp);
      reverb = ctx.createConvolver();
      var len = Math.floor(ctx.sampleRate * 2.2), ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (var c = 0; c < 2; c++) { var d = ir.getChannelData(c); for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
      reverb.buffer = ir; rvSend = ctx.createGain(); rvSend.gain.value = 0.28; rvSend.connect(reverb); reverb.connect(comp);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      var nd = noiseBuf.getChannelData(0); for (var j = 0; j < nd.length; j++) nd[j] = Math.random() * 2 - 1;
      applyVolumes();
      return true;
    }
    function applyVolumes() {
      if (!ctx) return;
      var t = ctx.currentTime, m = (prefs.music && prefs.sound ? prefs.volMusic : 0) * (prefs.calm ? 0.6 : 1);
      var f = (prefs.sfx && prefs.sound ? prefs.volFx : 0);
      musicBus.gain.setTargetAtTime(m, t, 0.08); fxBus.gain.setTargetAtTime(f, t, 0.08);
      if (bed) bed.out.gain.setTargetAtTime(prefs.sound ? 0.5 : 0, t, 0.2);
      if (eng) eng.out.gain.setTargetAtTime(running && !paused && f ? 1 : 0, t, 0.1);
    }

    function route(node, bus, pv, wet) {
      var tail = node;
      if (ctx.createStereoPanner) { var p = ctx.createStereoPanner(); p.pan.value = pv || 0; tail.connect(p); tail = p; }
      tail.connect(bus);
      if (wet) { var s = ctx.createGain(); s.gain.value = wet; tail.connect(s); s.connect(rvSend); }
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

    function note(kit, m, t, dur, vol, pv) {
      var f = mtof(m), c = prefs.calm ? 0.7 : 1;
      switch (kit) {
        case 'piano': tone('triangle', f, t, dur * 1.5, vol * c, musicBus, pv, 0.35, 3200); tone('sine', f * 2, t, dur, vol * 0.25 * c, musicBus, pv, 0.3); break;
        case 'pluck': tone('triangle', f, t, 0.5, vol * c, musicBus, pv, 0.3, 2600); break;
        case 'acoustic': tone('sawtooth', f, t, 0.7, vol * 0.5 * c, musicBus, pv, 0.3, 1800); break;
        case 'handpan': tone('sine', f, t, 1.4, vol * c, musicBus, pv, 0.45); tone('sine', f * 2.01, t, 0.6, vol * 0.3 * c, musicBus, pv, 0.45); break;
        case 'cello': tone('sawtooth', f, t, dur * 1.2, vol * 0.45 * c, musicBus, pv, 0.4, 1100); break;
        case 'electro': tone('square', f, t, 0.22, vol * 0.3 * c, musicBus, pv, 0.2, prefs.calm ? 1400 : 2600); break;
        case 'cinematic': tone('sawtooth', f, t, dur * 2, vol * 0.4 * c, musicBus, pv, 0.6, 1500); tone('sine', f / 2, t, dur * 2, vol * 0.5 * c, musicBus, 0, 0.4); break;
        case 'epic': tone('sawtooth', f, t, dur * 1.4, vol * 0.5 * c, musicBus, pv, 0.5, 2200); tone('sawtooth', f * 1.005, t, dur * 1.4, vol * 0.4 * c, musicBus, -pv, 0.5, 2200); break;
        default: tone('triangle', f, t, 0.6, vol * c, musicBus, pv, 0.3);
      }
    }
    function kitFor(ch) { return STYLE_KIT[prefs.style] || CH[ch].kit; }
    function degree(c, d) { var n = c.sc.length; return c.root + c.sc[((d % n) + n) % n] + 12 * Math.floor(d / n); }

    function scheduleBar(t) {
      var c = CH[chapter], beat = 60 / c.bpm, bar = beat * 4, kit = kitFor(chapter), I = intensity, d0 = PROG[barIdx % 4];
      tone('sine', mtof(degree(c, d0) - 24), t, bar * 0.95, 0.35 * (0.4 + prefs.bass * 1.2), musicBus, 0, 0);
      note('cinematic', degree(c, d0) - 12, t, bar, 0.08 + 0.05 * I, 0);
      var steps = I < 0.35 ? [0, 8] : I < 0.7 ? [0, 4, 8, 12] : [0, 2, 4, 6, 8, 10, 12, 14];
      for (var i = 0; i < steps.length; i++) {
        var deg = d0 + [0, 2, 1, 3, 2, 4, 3, 1][(i + barIdx) % 8];
        note(kit, degree(c, deg), t + steps[i] * beat / 4, beat, 0.13, (i % 2) ? 0.35 : -0.35);
      }
      if (I > 0.45 && kit !== 'handpan') {
        for (var b = 0; b < 4; b++) { if (b % 2 === 0 || I > 0.75) kick(t + b * beat, 0.5 + 0.2 * I); }
        if (I > 0.6) { noise(t + beat, 0.12, 0.2, musicBus, 'highpass', 1800, -0.15); noise(t + 3 * beat, 0.12, 0.2, musicBus, 'highpass', 1800, 0.15); }
        if (I > 0.55) for (var h = 0; h < 8; h++) noise(t + h * beat / 2, 0.04, 0.06, musicBus, 'highpass', 7000, (h % 2) ? 0.4 : -0.4);
      }
      barIdx++;
      return bar;
    }
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
        running = true; paused = false; barIdx = 0; nextBar = 0;
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
        chapter = clamp(i | 0, 0, CH.length - 1);
        if (ctx && running && (!bed || bed.name !== CH[chapter].bed)) startBed(CH[chapter].bed);
      },
      setSpeed: function (v) {
        speed = v || 0;
        engineUpdate(speed);
      },
      setEngine: function (name) { engineOverride = ENGINES[name] ? name : null; requestLoops(engineName()); restartEngine(); },
      setIntensity: function (v) { intensity = clamp(v || 0, 0, 1); },
      setBrake: function (b) { braking = !!b; },
      setScene: function (s) { scene = s || {}; },
      event: event,
      info: function () { return { ctx: !!ctx, state: ctx ? ctx.state : 'none', chapter: chapter, kit: kitFor(chapter), bed: bed ? bed.name : null, notes: made.notes, events: made.events, running: running, paused: paused, braking: braking, engine: eng ? eng.name : null, engineMode: eng ? eng.mode : null, loops: Object.keys(loopRaw), prefs: prefs, scene: scene }; }
    };
  }

  var exported = { create: create, CHAPTERS: CH, mtof: mtof, engineModel: engineModel, ENGINES: ENGINES, CAR_ENGINE: CAR_ENGINE };
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
  else root.RacerAudio = exported;
})(typeof window !== 'undefined' ? window : globalThis);
