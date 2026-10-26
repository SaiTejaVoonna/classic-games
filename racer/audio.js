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

  // Engine model: a 4-cylinder with an automatic gearbox. Each gear covers a band of road speed
  // and revs sweep from 2600 to 5800 rpm across it, so the engine climbs, drops on a shift and
  // climbs again. Below the first band the engine idles up from 900 rpm.
  var BANDS = [0, 40, 70, 100, 130, 165, 400]; // km/h
  function engineModel(kmh) {
    var g = 0; while (g < BANDS.length - 2 && kmh >= BANDS[g + 1]) g++;
    var lo = BANDS[g], hi = BANDS[g + 1], f = clamp((kmh - lo) / (hi - lo), 0, 1);
    var rpm = g === 0 ? 900 + 4900 * f : 2600 + 3200 * f;
    return { gear: g + 1, rpm: rpm };
  }

  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function create(env) {
    env = env || {};
    var Ctor = env.AudioContext;
    var ctx = null, master = null, musicBus = null, fxBus = null, comp = null, reverb = null, rvSend = null;
    var noiseBuf = null, bed = null, eng = null;
    var prefs = { music: true, sfx: true, style: 'auto', volMusic: 0.6, volFx: 0.7, bass: 0.5, calm: false, sound: true, haptics: true };
    var chapter = 0, intensity = 0.3, speed = 0, braking = false, running = false, paused = false;
    var timer = null, nextBar = 0, barIdx = 0, scene = {};
    var made = { notes: 0, events: 0 };

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
    var engWave = null;
    function engineWave() {
      if (engWave) return engWave;
      var n = 28, re = new Float32Array(n), im = new Float32Array(n);
      // engine orders: a 4-cylinder is dominated by orders 2, 4 and 6, with a little of the rest
      for (var k = 1; k < n; k++) im[k] = (k % 2 === 0 ? 1 : .32) / Math.pow(k, k % 2 === 0 ? .72 : 1.1);
      engWave = ctx.createPeriodicWave(re, im);
      return engWave;
    }
    function startEngine() {
      if (!ctx || eng) return;
      var t0 = ctx.currentTime;
      var o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), sub = ctx.createOscillator();
      o1.setPeriodicWave(engineWave()); o2.setPeriodicWave(engineWave()); o2.detune.value = 7; sub.type = 'sine';
      var mix = ctx.createGain(); mix.gain.value = 1;
      var subG = ctx.createGain(); subG.gain.value = .5;
      var am = ctx.createGain(); am.gain.value = .9; // slight uneven-firing wobble
      var lfo = ctx.createOscillator(), lfoG = ctx.createGain(); lfo.type = 'sine'; lfoG.gain.value = .1; lfo.connect(lfoG); lfoG.connect(am.gain);
      var sat = ctx.createWaveShaper(), curve = new Float32Array(257);
      for (var i = 0; i < 257; i++) { var x = i / 128 - 1; curve[i] = Math.tanh(2.4 * x); }
      sat.curve = curve;
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = .9; lp.frequency.value = 900;
      var pk1 = ctx.createBiquadFilter(); pk1.type = 'peaking'; pk1.frequency.value = 240; pk1.gain.value = 4; pk1.Q.value = 1.1;
      var pk2 = ctx.createBiquadFilter(); pk2.type = 'peaking'; pk2.frequency.value = 820; pk2.gain.value = 2; pk2.Q.value = 1.2;
      var body = ctx.createGain(); body.gain.value = 0;
      o1.connect(mix); o2.connect(mix); sub.connect(subG); subG.connect(mix); mix.connect(am); am.connect(sat); sat.connect(lp); lp.connect(pk1); pk1.connect(pk2); pk2.connect(body);
      // intake and road/wind noise
      var ns = ctx.createBufferSource(); ns.buffer = noiseBuf; ns.loop = true;
      var ibp = ctx.createBiquadFilter(); ibp.type = 'bandpass'; ibp.frequency.value = 700; ibp.Q.value = .8; var intake = ctx.createGain(); intake.gain.value = 0;
      ns.connect(ibp); ibp.connect(intake);
      var ns2 = ctx.createBufferSource(); ns2.buffer = noiseBuf; ns2.loop = true; ns2.loopStart = .37;
      var wlp = ctx.createBiquadFilter(); wlp.type = 'lowpass'; wlp.frequency.value = 400; var wind = ctx.createGain(); wind.gain.value = 0;
      ns2.connect(wlp); wlp.connect(wind);
      var wh = ctx.createOscillator(), whG = ctx.createGain(); wh.type = 'triangle'; whG.gain.value = 0; wh.connect(whG);
      var out = ctx.createGain(); out.gain.value = 0;
      body.connect(out); intake.connect(out); wind.connect(out); whG.connect(out);
      route(out, fxBus, 0, .04);
      [o1, o2, sub, lfo, ns, ns2, wh].forEach(function (n) { n.start(t0); });
      eng = { o1: o1, o2: o2, sub: sub, lfo: lfo, ns: ns, ns2: ns2, wh: wh, lp: lp, pk1: pk1, body: body, intake: intake, ibp: ibp, wind: wind, wlp: wlp, whG: whG, out: out, gear: 1, rpm: 900, v: 0, vt: t0, acc: 0, cut: 0 };
      applyVolumes();
    }
    function stopEngine() { if (eng) { ['o1', 'o2', 'sub', 'lfo', 'ns', 'ns2', 'wh'].forEach(function (k) { try { eng[k].stop(); } catch (e) { /* already stopped */ } }); eng = null; } }
    function engineUpdate(vms) {
      if (!eng || !ctx) return;
      var t = ctx.currentTime, kmh = vms * 3.6, m = engineModel(kmh), E = eng;
      var dt = Math.max(.016, t - E.vt); var a = (vms - E.v) / dt; E.acc += (a - E.acc) * .25; E.v = vms; E.vt = t;
      var shifted = m.gear !== E.gear;
      if (shifted && m.gear > E.gear && prefs.sfx && prefs.sound) { // upshift: short torque cut and a soft puff
        E.cut = .12; noise(t, .09, .05 * (prefs.calm ? .4 : 1), fxBus, 'highpass', 2600, 0);
      } else if (shifted && prefs.sfx && prefs.sound && !prefs.calm) { // downshift blip
        noise(t, .05, .03, fxBus, 'bandpass', 900, 0);
      }
      E.gear = m.gear;
      var rpmN = clamp((m.rpm - 900) / 5300, 0, 1);
      var load = braking ? .08 : clamp(.4 + E.acc * .22, .12, 1);
      if (E.cut > 0) { E.cut -= dt; load *= .35; }
      var tc = shifted ? .02 : .07, f1 = m.rpm / 60;
      E.o1.frequency.setTargetAtTime(f1, t, tc); E.o2.frequency.setTargetAtTime(f1 * 1.004, t, tc); E.sub.frequency.setTargetAtTime(f1 * 2, t, tc);
      E.lfo.frequency.setTargetAtTime(f1 * .5, t, tc);
      var calm = prefs.calm ? .62 : 1;
      E.lp.frequency.setTargetAtTime((380 + m.rpm * .5 + load * 900) * calm, t, .06);
      E.pk1.frequency.setTargetAtTime(160 + m.rpm * .03, t, .1);
      E.body.gain.setTargetAtTime((.1 + .22 * load) * (.55 + .45 * rpmN) * calm, t, .05);
      E.ibp.frequency.setTargetAtTime(500 + m.rpm * .12, t, .1);
      E.intake.gain.setTargetAtTime(.035 * load * rpmN * calm, t, .06);
      E.wlp.frequency.setTargetAtTime(260 + kmh * 7, t, .2);
      E.wind.gain.setTargetAtTime(.012 + .09 * Math.pow(clamp(kmh / 200, 0, 1), 1.6), t, .2);
      E.wh.frequency.setTargetAtTime(f1 * 11, t, .1);
      E.whG.gain.setTargetAtTime(prefs.calm ? 0 : .004 * rpmN * rpmN * load, t, .1);
    }
    // a passing car: its own engine tone drops in pitch (Doppler) while it swells and fades on its side
    function passBy(t, side, v) {
      var f0 = 70 + 30 * clamp(v / 50, 0, 1), o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
      o.setPeriodicWave(engineWave()); o.frequency.setValueAtTime(f0 * 1.14, t); o.frequency.exponentialRampToValueAtTime(f0 * .86, t + .8);
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

    return {
      unlock: function () { if (ensure() && ctx.state === 'suspended' && ctx.resume) { try { ctx.resume(); } catch (e) { /* ignore */ } } },
      setPrefs: function (p) {
        if (p) for (var k in p) if (Object.prototype.hasOwnProperty.call(prefs, k)) prefs[k] = p[k];
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
      setIntensity: function (v) { intensity = clamp(v || 0, 0, 1); },
      setBrake: function (b) { braking = !!b; },
      setScene: function (s) { scene = s || {}; },
      event: event,
      info: function () { return { ctx: !!ctx, state: ctx ? ctx.state : 'none', chapter: chapter, kit: kitFor(chapter), bed: bed ? bed.name : null, notes: made.notes, events: made.events, running: running, paused: paused, braking: braking, prefs: prefs, scene: scene }; }
    };
  }

  var exported = { create: create, CHAPTERS: CH, mtof: mtof, engineModel: engineModel };
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
  else root.RacerAudio = exported;
})(typeof window !== 'undefined' ? window : globalThis);
