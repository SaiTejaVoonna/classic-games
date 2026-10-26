// Offline rendering checks for Racer's sound: every effect, every life sound and every chapter's score
// must render without bad values, must not be silent, and must stay at sensible levels.
// Usage: NODE_PATH=<dir with playwright> node tests/browser/audio.js
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const R = []; const ok = (name, cond, extra) => { R.push({ name, pass: !!cond, extra }); };
const src = (f) => fs.readFileSync(path.resolve(__dirname, '../../racer', f), 'utf8');

(async () => {
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const p = await browser.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('about:blank');
  for (const f of ['score.js', 'enginesynth.js', 'audio.js']) await p.addScriptTag({ content: src(f) });
  const racer = src('racer.js');
  const lifeUsed = [...new Set([...racer.matchAll(/life: \[([^\]]*)\]/g)].flatMap((m) => m[1].split(',').map((s) => s.replace(/['\s]/g, '')).filter(Boolean)))];
  const names = await p.evaluate(() => window.RacerAudio.create({}).lifeNames);
  ok('every life sound the scenery lists has a sound', lifeUsed.every((n) => names.includes(n)), JSON.stringify(lifeUsed.filter((n) => !names.includes(n))));

  const measure = (kind, name) => p.evaluate(async ([kind, name]) => {
    const SR = 24000, off = new OfflineAudioContext(2, SR * 7, SR);
    const A = window.RacerAudio.create({ AudioContext: function () { return off; } });
    A.setPrefs({ music: false, sfx: true, sound: true, volFx: .7 }); A.unlock(); A.setChapter(4);
    if (kind === 'life') A.life(name, 0); else A.event(name, { combo: 3, i: 2, side: 1, v: 35 });
    const b = await off.startRendering(), L = b.getChannelData(0); let e = 0, pk = 0, bad = 0;
    for (let i = 0; i < L.length; i++) { if (!isFinite(L[i])) bad++; e += L[i] * L[i]; pk = Math.max(pk, Math.abs(L[i])); }
    return { db: 20 * Math.log10(Math.sqrt(e / L.length) + 1e-12), pk, bad };
  }, [kind, name]);
  const bad = [];
  for (const n of names) { const m = await measure('life', n); if (m.bad || m.db < -75 || m.pk > 1) bad.push(['life', n, m]); }
  for (const n of ['lane', 'coin', 'heart', 'near', 'pass', 'bump', 'crash', 'chapter', 'rest', 'thunder', 'finish']) { const m = await measure('event', n); if (m.bad || m.db < -75 || m.pk > 1.2) bad.push(['event', n, m]); }
  ok('all 23 life sounds and 11 effects render cleanly and are audible', names.length === 23 && bad.length === 0, JSON.stringify(bad));

  const scoreBad = [];
  for (let ch = 0; ch < 10; ch++) {
    const m = await p.evaluate(async (ch) => {
      const SR = 16000, DUR = 26, off = new OfflineAudioContext(2, SR * DUR, SR);
      const A = window.RacerAudio.create({ AudioContext: function () { return off; } });
      A.setPrefs({ music: true, sfx: false, sound: true, volMusic: .6 }); A.start(); A.setChapter(ch); A.setLives(3, 3);
      for (let t = .5; t < DUR - .5; t += .5) off.suspend(+t.toFixed(2)).then(() => { A.setIntensity(t < 8 ? .1 : .8); A.setChapterProgress(t / 40); A.setPrefs({}); off.resume(); });
      const b = await off.startRendering(), L = b.getChannelData(0); let e = 0, pk = 0, bad = 0, e1 = 0, n1 = 0, e2 = 0, n2 = 0;
      for (let i = 0; i < L.length; i++) { const v = L[i]; if (!isFinite(v)) bad++; e += v * v; pk = Math.max(pk, Math.abs(v)); const s = i / SR; if (s > 2 && s < 8) { e1 += v * v; n1++; } if (s > 16) { e2 += v * v; n2++; } }
      return { db: 20 * Math.log10(Math.sqrt(e / L.length) + 1e-12), early: 20 * Math.log10(Math.sqrt(e1 / n1) + 1e-12), late: 20 * Math.log10(Math.sqrt(e2 / n2) + 1e-12), pk, bad, layers: window.RacerScore.THEMES[ch].levels.reduce((a, b2) => a + b2, 0) };
    }, ch);
    // the sparse opening chapters stay light on purpose; the fuller ones must grow
    if (m.bad || m.db < -45 || m.db > -12 || m.pk > 1.2 || (m.layers >= 12 && m.late < m.early - 2)) scoreBad.push([ch + 1, m]);
  }
  ok('every chapter score renders, sits at a sensible level and grows from its quiet opening in the fuller chapters', scoreBad.length === 0, JSON.stringify(scoreBad));
  ok('audio render has no page errors', errs.filter((e) => !/cannot resume an offline context/.test(e)).length === 0, errs.slice(0, 2).join('|'));

  await browser.close();
  const failed = R.filter((r) => !r.pass);
  R.forEach((r) => { if (!r.pass) console.log('FAIL', r.name, r.extra || ''); });
  console.log(`${R.length - failed.length}/${R.length} passed`);
  process.exit(failed.length ? 1 : 0);
})();
