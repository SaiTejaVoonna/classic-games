// Classic Games Reel: frame-by-frame capture of the real game with a motion-graphics overlay drawn in the same page.
// Usage: NODE_PATH=<playwright> node reel/capture.js <out-dir>
// Each scene drives the real game (teleport to a place, an autopilot that steers for coins and around traffic), steps it
// exactly 1/30 s per frame and screenshots at 1080x1920. Every sound the game asks for is logged with its frame, so the
// soundtrack can be rendered later with the effects exactly where they happen on screen.
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..'), OUT = process.argv[2] || path.join(__dirname, 'out');
const FPS = 30, BPM = 139, BAR = 4 * 60 / BPM, L = 4480; // music: Cruise's Drive style in Sunset Coast's key (139 BPM)
const f = (bars) => Math.round(bars * BAR * FPS);
// scenes: [bars, chapter position (chapter + fraction), hud on?, caption, kind]
const SCENES = [
  [2, 0.42, false, '', 'title'],
  [1, 1.36, false, '10 places', 'cap'],
  [1, 2.42, false, 'one road', 'cap'],
  [2, 3.15, true, 'collect coins', 'cap'],
  [1, 5.66, true, 'thread the traffic', 'cap'],
  [1, 4.4, false, 'big moments', 'cap'],
  [1, 6.42, false, '', 'cap'],
  [1, 7.45, false, 'weather that changes', 'cap'],
  [1, 8.4, false, '', 'cap'],
  [2, 9.42, false, 'a 15-minute journey\nto the coast', 'cap2'],
  [1, 0, false, 'an original soundtrack\nfor every place', 'music'],
  [1, -1, false, 'and Snake', 'snake'],
  [2, 9.5, false, '', 'end']
];
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.addInitScript(() => {
    window.requestAnimationFrame = () => 0; localStorage.setItem('classic-games.racer.hint', '1');
    localStorage.setItem('classic-games.racer.prefs', JSON.stringify({ car: 'rally', speedIdx: 3, style: 'drive' }));
    window.__snd = []; window.__frame = 0;
    Object.defineProperty(window, 'RacerAudio', { configurable: true, set(v) { const c = v.create; v.create = (e) => { const a = c(e); const ev = a.event, li = a.life; a.event = (n, o) => { window.__snd.push([window.__frame, 'event', n, o || {}]); return ev(n, o); }; a.life = (n, pv) => { window.__snd.push([window.__frame, 'life', n, pv || 0]); return li(n, pv); }; return a; }; Object.defineProperty(window, 'RacerAudio', { value: v, writable: true, configurable: true }); }, get() { return undefined; } });
  });
  await p.goto('file://' + ROOT + '/racer/index.html?debug=1&seed=12&speed=3');
  await p.addStyleTag({ content: `
    .spd, #chapter, .backpill, #near, .hint { display: none !important; }
    body.nohud .hud { display: none !important; }
    #c { transform-origin: 50% 58%; }
    #reel { position: absolute; inset: 0; pointer-events: none; z-index: 50; font-family: Inter, system-ui, sans-serif; color: #fff; }
    #reel .cap { position: absolute; left: 0; right: 0; top: 30%; text-align: center; font-weight: 800; font-size: 46px; letter-spacing: -.5px; line-height: 1.08; white-space: pre-line; text-shadow: 0 4px 28px #0009, 0 1px 3px #0008; }
    #reel .kick { position: absolute; left: 0; right: 0; top: calc(30% - 34px); text-align: center; font-weight: 600; font-size: 15px; letter-spacing: 6px; opacity: .9; text-shadow: 0 2px 12px #0009; }
    #reel .flash { position: absolute; inset: 0; background: #fff; opacity: 0; }
    #reel .end { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; background: radial-gradient(#0a0c14aa, #0a0c14ee); opacity: 0; }
    #reel .end b { font-size: 60px; font-weight: 800; letter-spacing: -1px; } #reel .end i { font-style: normal; font-size: 20px; opacity: .85; margin-top: 10px; }
    #reel .end u { text-decoration: none; margin-top: 30px; font-size: 18px; font-weight: 600; padding: 14px 24px; border-radius: 99px; background: #f3efe6; color: #0a0b10; }
    #reel .vig { position: absolute; inset: 0; background: linear-gradient(#0006, transparent 22%, transparent 70%, #0007); }
  ` });
  await p.evaluate(() => { const r = document.createElement('div'); r.id = 'reel'; r.innerHTML = '<div class="vig"></div><div class="kick"></div><div class="cap"></div><div class="end"><b>Classic Games</b><i>Cruise · Snake</i><u>Play free in your browser</u><i style="margin-top:18px;font-size:15px">saitejavoonna.github.io/classic-games</i></div><div class="flash"></div>'; document.querySelector('.stage').appendChild(r); window.racerDebug.start(); });
  let frame = 0;
  const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
  for (let si = 0; si < SCENES.length; si++) {
    const [bars, pos, hud, cap, kind] = SCENES[si], n = f(bars);
    if (kind === 'snake') { frame = await snakeScene(b, n, frame, cap); continue; }
    await p.evaluate(([pos, hud, kind, L]) => {
      const D = window.racerDebug; document.body.classList.toggle('nohud', !hud);
      if (kind !== 'music' && kind !== 'end') { D.teleport(L * pos); D.setLives(3); D.advance(2.5); }
      if (kind === 'end') { D.teleport(L * pos); D.advance(1); }
    }, [pos, hud, kind, L]);
    for (let i = 0; i < n; i++, frame++) {
      const u = i / n, t = i / FPS;
      await p.evaluate(([frame, u, t, i, n, cap, kind, si]) => {
        window.__frame = frame; const D = window.racerDebug, st = D.state(), g = D.geo([]);
        // autopilot: every 0.25 s pick a lane: the coin lane if it is clear, else the clearest lane
        if (i % 7 === 0 && kind !== 'end') {
          const busy = [-1, 0, 1].map((l) => g.cars.some((c) => !c.knock && Math.abs(c.laneF - l) < .6 && c.d > 4 && c.d < 34));
          let want = Math.round(st.lane); const dist = st.dist;
          for (let cn = Math.floor((dist + 12) / 90); cn <= Math.floor((dist + 70) / 90); cn++) { const ck = D.coinChunk(cn); if (ck && ck.start + ck.count * 7 > dist + 12 && !busy[ck.lane + 1]) { want = ck.lane; break; } }
          if (busy[want + 1]) want = [0, -1, 1].find((l) => !busy[l + 1]) ?? want;
          const cur = Math.round(st.lane); if (want !== cur && Math.abs(st.lane - cur) < .15) document.dispatchEvent(new KeyboardEvent('keydown', { key: want < cur ? 'ArrowLeft' : 'ArrowRight' }));
        }
        if (kind !== 'end') D.advance(1 / 30); else D.advance(1 / 60);
        D.setLives(3); D.geo([]);
        // camera: a punch-in on the cut that settles, then a slow push in
        const punch = Math.max(0, 1 - i / 7), cam = 1.0 + .05 * u + .07 * punch * punch;
        document.getElementById('c').style.transform = 'scale(' + cam + ')';
        document.getElementById('c').style.filter = kind === 'end' ? 'blur(' + Math.min(10, i / 3) + 'px) brightness(.8)' : '';
        const R = document.getElementById('reel'), C = R.querySelector('.cap'), K = R.querySelector('.kick'), E = R.querySelector('.end'), F = R.querySelector('.flash');
        F.style.opacity = i < 3 && si > 0 && kind !== 'end' ? (1 - i / 3) * .55 : 0;
        const inT = Math.min(1, t / .35), e = 1 - Math.pow(1 - inT, 3), out = Math.min(1, Math.max(0, (n - i) / 6));
        if (kind === 'title') {
          K.textContent = u < .45 ? 'CLASSIC GAMES' : 'CLASSIC GAMES PRESENTS';
          const tu = Math.max(0, (u - .18) / .3), te = 1 - Math.pow(1 - Math.min(1, tu), 3);
          C.textContent = 'Cruise'; C.style.fontSize = '84px'; C.style.letterSpacing = (20 - 21 * te) + 'px';
          C.style.opacity = te * out; C.style.transform = 'translateY(' + (30 * (1 - te)) + 'px) scale(' + (1.25 - .25 * te) + ')';
          K.style.opacity = Math.min(1, t / .5) * out;
        } else if (kind === 'end') {
          C.style.opacity = 0; K.style.opacity = 0; E.style.opacity = Math.min(1, i / 10); E.style.transform = 'scale(' + (1.06 - .06 * Math.min(1, i / 14)) + ')';
        } else {
          K.textContent = ''; C.textContent = cap; C.style.fontSize = cap.length > 18 ? '40px' : '50px'; C.style.letterSpacing = '-.5px';
          C.style.opacity = cap ? e * out : 0; C.style.transform = 'translateY(' + (24 * (1 - e)) + 'px)';
        }
      }, [frame, u, t, i, n, cap, kind, si]);
      await p.screenshot({ path: path.join(OUT, 'f' + String(frame).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 92 });
    }
    console.log('scene', si, kind, 'frames to', frame);
  }
  const snd = await p.evaluate(() => window.__snd);
  fs.writeFileSync(path.join(OUT, 'sounds.json'), JSON.stringify({ fps: FPS, bpm: BPM, frames: frame, sounds: snd }));
  console.log('done', frame, 'frames,', snd.length, 'sounds');
  await b.close();
})();

// Snake: the real game in real time, sampled to 30 fps (it moves in steps, so held frames look natural).
async function snakeScene(b, n, frame, cap) {
  const ctx = await b.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 }); const p = await ctx.newPage();
  await p.goto('file://' + ROOT + '/snake/index.html?seed=4'); await p.click('#ov-primary'); await p.keyboard.press('ArrowDown'); await p.waitForTimeout(900);
  await p.addStyleTag({ content: `#rcap { position: fixed; left: 0; right: 0; top: 36%; text-align: center; font: 800 50px Inter, system-ui, sans-serif; color: #fff; text-shadow: 0 4px 28px #000a; z-index: 99; pointer-events: none; }` });
  await p.evaluate((c) => { const d = document.createElement('div'); d.id = 'rcap'; d.textContent = c; document.body.appendChild(d); }, cap);
  const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp'];
  const t0 = Date.now(); let k = 0, last = null;
  for (let i = 0; i < n; i++, frame++) {
    const want = t0 + i * 1000 / 30; while (Date.now() < want) await p.waitForTimeout(4);
    if (i % 9 === 4) await p.keyboard.press(keys[k++ % keys.length]);
    await p.evaluate(([i, n]) => { const e = Math.min(1, i / 10); const r = document.getElementById('rcap'); r.style.opacity = e * Math.min(1, (n - i) / 6); r.style.transform = 'translateY(' + (20 * (1 - e)) + 'px)'; }, [i, n]);
    last = path.join(OUT, 'f' + String(frame).padStart(5, '0') + '.jpg');
    await p.screenshot({ path: last, type: 'jpeg', quality: 92 });
  }
  console.log('snake to', frame); await ctx.close(); return frame;
}
