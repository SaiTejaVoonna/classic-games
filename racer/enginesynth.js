/* Racer engine loops: a small physical model of a combustion engine, rendered offline into short
   seamless loops that the audio engine plays back at the right pitch and crossfades by RPM.
   The model follows the published method of Baldan, Lachambre, Delle Monache and Boussard,
   "Physically informed car engine sound synthesis for virtual and augmented environments" (2015):
   every cylinder opens an intake and an exhaust valve and fires once per cycle, and the pressure
   waves travel through intake, exhaust, collector, pipe and muffler, which are modelled as
   waveguides. The pipes give the engine its voice. This is our own implementation of that idea;
   the MIT-licensed Antonio-R1/engine-sound-generator was read as a reference.
   Classic Games prototype sound, not tuned by ear yet. */
(function (root) {
  'use strict';

  // The renderer is a closure so its source can also be handed to a Worker unchanged.
  function createRenderer() {
    function WG(n, rl, rr) { this.n = Math.max(1, n | 0); this.up = new Float32Array(this.n); this.lo = new Float32Array(this.n); this.i = 0; this.rl = rl; this.rr = rr; this.outL = 0; this.outR = 0; }
    // inL travels right along the upper line, inR travels left along the lower line; the ends reflect
    WG.prototype.add = function (inL, inR) {
      var a = this.lo[this.i], b = this.up[this.i];
      this.outL = a * (1 - this.rl); this.outR = b * (1 - this.rr);
      this.up[this.i] = inL + a * this.rl; this.lo[this.i] = inR + b * this.rr;
      if (++this.i >= this.n) this.i = 0;
    };
    function lpAlpha(hz, fs) { var w = 2 * Math.PI * hz / fs; return w / (w + 1); }

    function Engine(P, fs) {
      this.P = P; this.fs = fs; this.N = P.cyl; this.phase = 0;
      this.cyl = [];
      for (var i = 0; i < this.N; i++) {
        var ex = P.exhLens ? P.exhLens[i % P.exhLens.length] : P.exhLen;
        this.cyl.push({
          body: new WG(10, .75, .75), intake: new WG(P.intakeLen, .01, P.openI),
          exhaust: new WG(ex, P.closedE, .01), extractor: new WG(P.extLen, .01, .01),
          off: P.offs ? P.offs[i] : i / this.N, iv: 0, ev: 0
        });
      }
      this.pipe = new WG(P.pipeLen, .1, .1);
      this.muf = []; for (var m = 0; m < P.muffler.length; m++) this.muf.push(new WG(P.muffler[m], 0, P.mufAction));
      this.mufL = 0; this.mufR = 0; this.outlet = new WG(5, .01, .01);
      this.aIn = lpAlpha(11000, fs); this.aCr = lpAlpha(75, fs); this.aBody = lpAlpha(125, fs);
      this.nIn = 0; this.nCr = 0; this.nBody = 0;
    }
    Engine.prototype.sample = function (rpm) {
      var P = this.P, N = this.N, c, i, x, t;
      this.nIn += this.aIn * ((2 * Math.random() - 1) - this.nIn);
      this.nCr += this.aCr * (.25 * Math.random() - this.nCr);
      var intakeNoise = this.nIn, bodySum = 0, intakeSum = 0, pipeIn = 0;
      for (i = 0; i < N; i++) {
        c = this.cyl[i]; x = (this.phase + c.off + this.nCr * i) % 1; if (x < 0) x += 1;
        c.ev = x > .75 ? -Math.sin(4 * Math.PI * x) : 0;
        c.iv = x < .25 ? Math.sin(4 * Math.PI * x) : 0;
        var piston = Math.cos(4 * Math.PI * x);
        t = P.ignition; var fire = x < .5 * t ? Math.sin(2 * Math.PI * (x / t)) : 0;
        c.intake.rr = P.openI * c.iv + P.closedI * (1 - c.iv); c.body.rl = c.intake.rr;
        c.exhaust.rl = P.openE * c.ev + P.closedE * (1 - c.ev); c.body.rr = c.exhaust.rl;
        var amp = piston * 1.5 + fire * 5;
        var exL = c.extractor.outL, bodyOutR = c.body.outR, bodyOutL = c.body.outL, inR = c.intake.outR;
        c.extractor.add(c.exhaust.outR, this.pipe.outL);
        c.exhaust.add(bodyOutR, exL);
        c.body.add(amp + inR * (1 - c.intake.rr), exL * (1 - c.exhaust.rl));
        c.intake.add(intakeNoise * c.iv, bodyOutL * (1 - c.intake.rr));
        bodySum += c.body.outR; intakeSum += c.intake.outL; pipeIn += c.body.outR;
      }
      this.phase += rpm / 120 / this.fs; if (this.phase >= 1) this.phase -= 1;
      this.pipe.add(pipeIn, this.mufL);
      this.outlet.add(this.mufR, 0);
      var k = 1 / this.muf.length, mi = this.pipe.outR * k, mo = this.outlet.outL * k, sl = 0, sr = 0;
      for (i = 0; i < this.muf.length; i++) { sl += this.muf[i].outL; sr += this.muf[i].outR; this.muf[i].add(mi, mo); }
      this.mufL = sl; this.mufR = sr;
      this.nBody += this.aBody * (bodySum - this.nBody);
      this.parts = [this.nBody, intakeSum, this.outlet.outR];
      return this.nBody * P.mixBody + intakeSum * P.mixIntake + this.outlet.outR * P.mixOutlet;
    };

    // One seamless loop at (about) the given rpm. Whole crank cycles fit the loop, and the seam is
    // crossfaded. Returns { rpm, data } with the rpm the loop really represents.
    function renderLoop(P, rpm, fs, seconds) {
      var cycles = Math.max(1, Math.round(seconds * rpm / 120)), len = Math.round(cycles * 120 * fs / rpm);
      var exact = cycles * 120 * fs / len, XF = Math.min(2048, len >> 2), eng = new Engine(P, fs), n, i;
      for (n = 0; n < fs * .35; n++) eng.sample(exact); // let the pipes settle
      var y = new Float32Array(len + XF); for (n = 0; n < y.length; n++) y[n] = eng.sample(exact);
      var out = new Float32Array(len);
      for (i = 0; i < len; i++) out[i] = i < XF ? y[i] * (i / XF) + y[len + i] * (1 - i / XF) : y[i];
      var mean = 0; for (i = 0; i < len; i++) mean += out[i]; mean /= len;
      var rms = 0; for (i = 0; i < len; i++) { out[i] -= mean; rms += out[i] * out[i]; }
      rms = Math.sqrt(rms / len) || 1; var g = .1 / rms;
      for (i = 0; i < len; i++) out[i] *= g;
      return { rpm: exact, data: out };
    }
    return { renderLoop: renderLoop, Engine: Engine };
  }

  // Physical settings per engine. Lengths are in samples at 44.1 kHz. exhLens gives the cylinders
  // different exhaust lengths, which is what makes a flat-four rumble and a V8 burble.
  var DEF = { intakeLen: 100, exhLen: 100, extLen: 100, openI: .25, closedI: .95, openE: .25, closedE: .95, ignition: .016, pipeLen: 128, muffler: [10, 15, 20, 25], mufAction: .25, mixBody: 1.6, mixIntake: .6, mixOutlet: 1.2 };
  function make(o) { var P = {}, k; for (k in DEF) P[k] = DEF[k]; for (k in o) P[k] = o[k]; return P; }
  var PHYS = {
    v8: make({ cyl: 8, exhLens: [90, 125, 90, 125], mufAction: .14, rpms: [800, 1300, 2000, 2900, 3900, 5000, 6000, 6700] }),
    rally: make({ cyl: 4, exhLens: [60, 60, 125, 125], mufAction: .3, ignition: .02, rpms: [1000, 1700, 2600, 3600, 4700, 5800, 6700, 7400] }),
    v10: make({ cyl: 10, exhLen: 70, intakeLen: 80, mufAction: .08, rpms: [1000, 1800, 2800, 4000, 5400, 6800, 8000, 9000] }),
    v12: make({ cyl: 12, exhLen: 80, intakeLen: 80, mufAction: .1, rpms: [900, 1600, 2600, 3800, 5100, 6400, 7500, 8500] }),
    f1: make({ cyl: 6, exhLen: 45, intakeLen: 60, extLen: 60, ignition: .012, mufAction: .04, muffler: [8, 12], rpms: [4000, 5200, 6600, 8200, 9800, 11400, 13000, 14500] }),
    i4: make({ cyl: 4, rpms: [900, 1500, 2300, 3200, 4200, 5000, 5800] })
  };

  var R = createRenderer();
  // renderLoops(name, fs, seconds) renders all the loops of one engine, synchronously.
  function renderLoops(name, fs, seconds) {
    var P = PHYS[name]; if (!P) return null;
    return P.rpms.map(function (r) { return R.renderLoop(P, r, fs || 44100, seconds || 1.1); });
  }
  // generate(name, done): renders in a Worker when there is one (built from a Blob, so it also
  // works from file://), otherwise in the page.
  function generate(name, done) {
    var P = PHYS[name]; if (!P) { done(null); return; }
    var W = root.Worker, U = root.URL, B = root.Blob;
    if (W && U && U.createObjectURL && B) {
      try {
        var src = 'var R=(' + createRenderer.toString() + ')();onmessage=function(e){var d=e.data,out=[],tr=[];for(var i=0;i<d.P.rpms.length;i++){var l=R.renderLoop(d.P,d.P.rpms[i],d.fs,d.sec);out.push({rpm:l.rpm,data:l.data});tr.push(l.data.buffer);}postMessage(out,tr);};';
        var url = U.createObjectURL(new B([src], { type: 'text/javascript' })), w = new W(url);
        w.onmessage = function (e) { w.terminate(); U.revokeObjectURL(url); done(e.data); };
        w.onerror = function () { w.terminate(); done(renderLoops(name)); };
        w.postMessage({ P: P, fs: 44100, sec: 1.1 }); return;
      } catch (err) { /* fall through to the page */ }
    }
    done(renderLoops(name));
  }
  var exported = { renderLoops: renderLoops, generate: generate, PHYS: PHYS, createRenderer: createRenderer };
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
  else root.RacerEngineSynth = exported;
})(typeof window !== 'undefined' ? window : globalThis);
