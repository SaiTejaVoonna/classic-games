// Classic Games Reel: render the soundtrack offline with the game's own audio engine (Cruise's Drive style), then lay
// every sound the game played during the capture on its exact frame, a whoosh on each cut, and the finish at the end.
// Usage: NODE_PATH=<playwright> node reel/soundtrack.js <capture-dir>   (writes music.wav next to the frames)
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..'), DIR = process.argv[2];
const log = JSON.parse(fs.readFileSync(path.join(DIR, 'sounds.json'), 'utf8'));
const CUTS = [0, 2, 3, 4, 6, 7, 8, 9, 10, 12, 13, 14, 15].map((b) => b * 4 * 60 / log.bpm); // scene starts, in seconds
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const p = await b.newPage(); await p.goto('about:blank');
  for (const f of ['score.js', 'enginesynth.js', 'audio.js']) await p.addScriptTag({ content: fs.readFileSync(path.join(ROOT, 'racer', f), 'utf8') });
  const out = await p.evaluate(async ([log, CUTS]) => {
    const SR = 48000, LEAD = .05, DUR = log.frames / log.fps + 1.5, off = new OfflineAudioContext(2, Math.ceil(SR * (DUR + LEAD)), SR);
    const A = window.RacerAudio.create({ AudioContext: function () { return off; } });
    A.setPrefs({ music: true, sfx: true, sound: true, style: 'drive', volMusic: .75, volFx: .6, volEngine: .35, bass: .6 });
    A.setChapter(4); A.setLives(3, 3); A.start(); A.setSpeed(38); A.setIntensity(.85); A.setChapterProgress(.4);
    const at = (t, fn) => off.suspend(+Math.max(.01, t + LEAD).toFixed(3)).then(() => { fn(); off.resume(); });
    const keep = { coin: 1, near: 1, pass: 1, lane: 1, heart: 1, thunder: 1 }, seen = {};
    for (let t = .25; t < DUR - .3; t += .25) at(t, () => { A.setIntensity(t < 3.4 ? .6 : .95); A.setChapterProgress(.4); A.setSpeed(t > CUTS[CUTS.length - 1] ? 12 : 38); A.setPrefs({}); });
    log.sounds.forEach(([fr, kind, name, o]) => {
      const t = fr / log.fps, key = name + Math.round(t * 20); if (seen[key]) return; seen[key] = 1; // the same sound twice in one 50 ms slot is one sound
      if (kind === 'event' && keep[name]) at(t, () => A.event(name, o));
      if (kind === 'life' && t > 3) at(t, () => A.life(name, o));
    });
    at(.6, () => A.event('chapter', {}));
    CUTS.slice(1, -1).forEach((t) => at(t - .08, () => A.event('ui', { whoosh: true })));
    at(CUTS[CUTS.length - 1] + .05, () => A.event('finish', {}));
    const r = await off.startRendering(), L = r.getChannelData(0), R = r.getChannelData(1), s = Math.round(LEAD * SR), n = Math.round((log.frames / log.fps) * SR);
    const fade = SR * 1.2, outL = new Float32Array(n), outR = new Float32Array(n);
    for (let i = 0; i < n; i++) { const g = Math.min(1, (n - i) / fade, i / (SR * .02)); outL[i] = L[i + s] * g; outR[i] = R[i + s] * g; }
    return [Array.from(outL), Array.from(outR)];
  }, [log, CUTS]);
  const n = out[0].length, buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(48000, 24); buf.writeUInt32LE(48000 * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  let pk = 0; for (let i = 0; i < n; i++) { for (let c = 0; c < 2; c++) { const v = out[c][i]; pk = Math.max(pk, Math.abs(v)); buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * 32767))), 44 + i * 4 + c * 2); } }
  fs.writeFileSync(path.join(DIR, 'music.wav'), buf); console.log('music.wav', (n / 48000).toFixed(2) + 's', 'peak', pk.toFixed(2)); await b.close();
})();
