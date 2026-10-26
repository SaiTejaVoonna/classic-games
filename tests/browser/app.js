// Browser checks for the launcher and the Racer prototype. Requires Playwright and Chromium.
// Usage: NODE_PATH=<dir with playwright> node tests/browser/app.js
const { chromium } = require('playwright');
const path = require('path'); const url = require('url');
const href = (f) => url.pathToFileURL(path.resolve(__dirname, '../..', f)).href;
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const R = []; const ok = (name, cond, extra) => { R.push({ name, pass: !!cond, extra }); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const st = (p) => p.evaluate(() => window.racerDebug.state());

(async () => {
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const mk = async (w, h) => { const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true }); const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(String(e))); p.on('console', m => m.type() === 'error' && p.errs.push(m.text())); return p; };

  // ---- launcher
  let p = await mk(390, 844);
  await p.goto(href('index.html') + '?debug=1');
  ok('launcher has two game cards', (await p.$$('#card-racer, #card-snake')).length === 2);
  ok('cards link to the games', (await p.getAttribute('#card-racer a', 'href')) === 'racer/' && (await p.getAttribute('#card-snake a', 'href')) === 'snake/');
  ok('no resume card without a checkpoint', !(await p.isVisible('#resume')));
  ok('no horizontal overflow at 390', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await p.setViewportSize({ width: 320, height: 568 });
  ok('no horizontal overflow at 320', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await p.setViewportSize({ width: 390, height: 844 });
  await p.evaluate(() => window.launcherDebug.openDrawer());
  ok('menu opens a drawer', await p.isVisible('#drawer'));
  await p.keyboard.press('Escape'); await sleep(250);
  ok('Escape closes the drawer', !(await p.isVisible('#drawer')));
  ok('launcher has no errors', p.errs.length === 0, p.errs.join('|'));
  p = await mk(390, 844);
  await p.addInitScript(() => { localStorage.setItem('classic-games.racer.checkpoint', JSON.stringify({ v: 1, chapter: 3, mode: 'journey', difficulty: 'easy', speed: 'relaxed', length: 'demo', score: 10, coins: 5 })); localStorage.setItem('classic-games.racer.stats', JSON.stringify({ runs: 3, near: 12, nearBest: 6, coins: 120, journeys: 1, noHitJourneys: 1, maxChapter: 7, bestDistance: 5000 })); });
  await p.goto(href('index.html') + '?debug=1');
  ok('a saved checkpoint shows the resume link', await p.isVisible('#resume'));
  const aw = await p.evaluate(() => window.launcherDebug.awards());
  ok('awards are computed from stats', JSON.stringify(aw).indexOf('first-drive') >= 0, JSON.stringify(aw).slice(0, 200));

  // ---- racer
  p = await mk(390, 760);
  await p.goto(href('racer/index.html') + '?debug=1&seed=11');
  ok('the start screen is just the car picker and Play, with no level, speed or length choices', await p.isVisible('#play') && (await p.$$('.opt[data-opt=difficulty], .opt[data-opt=speed], .opt[data-opt=length], .opt[data-opt=mode]')).length === 0);
  await sleep(800);
  const sp = await p.evaluate(() => window.racerDebug.sprites());
  ok('all vehicle sprites are drawn and ready', sp.total >= 30 && sp.ready === sp.total, JSON.stringify(sp));
  ok('the car picker offers Rally, Sedan and Electric, with Formula locked', (await p.$$('.carsel button:not([disabled])')).length === 3 && await p.isDisabled('.carsel button.soon'));
  await p.tap('.carsel button[data-val=ev]'); await sleep(80);
  ok('choosing a car is saved', (await st(p)).prefs.car === 'ev');
  await p.tap('.carsel button[data-val=rally]'); await sleep(80);
  ok('the car pick is written to storage', !!(await p.evaluate(() => localStorage.getItem('classic-games.racer.prefs'))));
  await p.tap('#play'); await sleep(300);
  let s = await st(p);
  ok('Play starts a run with three lives, at 85 km/h, in a 28 km Journey', s.mode === 'run' && s.lives === 3 && !(await p.isVisible('#ov')) && Math.round(s.speed * 3.6) === 85 && s.chapterLen === 2800, JSON.stringify([s.mode, s.lives, s.speed, s.chapterLen]));
  await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowLeft'); s = await st(p);
  ok('lane changes stop at the edge', s.laneTarget === -1);
  await p.evaluate(() => { window.racerDebug.stopSpawning(); window.racerDebug.setLane(0); window.racerDebug.addCar(0, 8); });
  await p.evaluate(() => window.racerDebug.advance(1.2)); s = await st(p);
  ok('hitting a car costs one life and gives a shield', s.lives === 2 && s.shield > 0, JSON.stringify([s.lives, s.shield]));
  await p.tap('#pause'); await sleep(150);
  ok('pause opens the sheet and holds the run', await p.isVisible('#ps') && (await st(p)).paused);
  const d0 = (await st(p)).dist; await sleep(300);
  ok('distance does not move while paused', Math.abs((await st(p)).dist - d0) < 0.01);
  await p.tap('#ps-resume'); await sleep(150);
  ok('resume continues', !(await st(p)).paused);
  await p.evaluate(() => { window.racerDebug.stopSpawning(); window.racerDebug.teleport(3000); }); await sleep(300);
  const L = (await st(p)).chapterLen;
  await p.evaluate((l) => { window.racerDebug.stopSpawning(); window.racerDebug.teleport(2 * l - 3); window.racerDebug.advance(1); }, L);
  s = await st(p);
  ok('crossing chapter lengths advances the chapter', s.chapter >= 1, String(s.chapter));
  ok('a rest stop saves a checkpoint', !!s.checkpoint && s.checkpoint.chapter === 2, JSON.stringify(s.checkpoint));
  await p.evaluate(() => { window.racerDebug.stopSpawning(); window.racerDebug.advance(4); window.racerDebug.setLives(1); }); await p.evaluate(() => { window.racerDebug.setLane(0); window.racerDebug.addCar(0, 8); window.racerDebug.advance(1.5); });
  await sleep(1000); s = await st(p);
  ok('losing the last life ends the run', s.mode === 'over' && (await p.isVisible('#ov')), s.mode);
  ok('the end screen can continue from the checkpoint', await p.isVisible('#cont'));
  ok('racer has no errors', p.errs.length === 0, p.errs.join('|'));

  p = await mk(390, 760);
  await p.goto(href('racer/index.html') + '?debug=1&seed=3');
  await p.tap('#play'); await sleep(200);
  const len = (await st(p)).chapterLen;
  await p.evaluate(() => { window.racerDebug.stopSpawning(); window.racerDebug.teleport(14000); window.racerDebug.advance(8); });
  s = await st(p);
  ok('speed rises by itself: about 118 km/h in the middle of the Journey', Math.abs(s.speed * 3.6 - 118) < 6, String(s.speed * 3.6));
  ok('the trip label estimates minutes left', /about \d+ min left/.test(await p.textContent('#trip-label')), await p.textContent('#trip-label'));
  await p.evaluate((l) => { window.racerDebug.stopSpawning(); window.racerDebug.teleport(l * 10 + 5); window.racerDebug.advance(1); }, len);
  await sleep(300); s = await st(p);
  ok('reaching the end of a Journey finishes it', s.mode === 'done' || s.mode === 'over', s.mode);
  await sleep(1600);
  ok('the finish offers Keep driving, which continues in Endless with full hearts', await p.isVisible('#keep'));
  await p.tap('#keep'); await sleep(250); s = await st(p);
  ok('Keep driving starts Endless', s.mode === 'run' && s.tripMode === 'endless' && s.lives === 3, JSON.stringify([s.mode, s.tripMode, s.lives]));
  ok('journey run has no errors', p.errs.length === 0, p.errs.join('|'));


  // ---- road anchoring and traffic (Easy)
  p = await mk(390, 760);
  await p.goto(href('racer/index.html') + '?debug=1&seed=5');
  await p.click('#play'); await sleep(150);
  await p.evaluate(() => window.racerDebug.stopSpawning());
  let edge = 0, scr = 0, n = 0;
  for (let d = 300; d < 9000; d += 97) for (const ln of [-1, 0, 1]) {
    await p.evaluate(([dd, l]) => { window.racerDebug.teleport(dd); window.racerDebug.setLane(l); }, [d, ln]);
    const g = await p.evaluate(() => window.racerDebug.geo([9])); const pl = g.player, r = g.rows[0], half = pl.w * 1.06 / 2;
    n++; if (Math.max(r.ct - r.hw - (pl.x - half), pl.x + half - (r.ct + r.hw)) > 0) edge++; if (pl.x - half < 0 || pl.x + half > g.W) scr++;
    if (Math.abs(pl.y - r.y) > 0.01) edge++;
  }
  ok('the player car stays inside the road and the screen in every lane, on bends and hills', n > 100 && edge === 0 && scr === 0, `${n} samples, ${edge} off road, ${scr} off screen`);
  let overlap = 0;
  for (const kind of ['hatch', 'suv', 'van', 'truck']) for (const cl of [-1, 1]) {
    await p.evaluate(([k, l]) => { window.racerDebug.teleport(1500); window.racerDebug.setLane(0); window.racerDebug.addCar(l, 9, k); }, [kind, cl]);
    const g = await p.evaluate(() => window.racerDebug.geo([9])); const c = g.cars[g.cars.length - 1], r = g.rows[0];
    const f = { hatch: 1, suv: 1.08, van: 1.1, truck: 1.15 }[kind];
    if (Math.abs(c.x - g.player.x) - (g.W * 0.255 * (r.hw / (g.W * 0.9)) * 1.7 * f + g.player.w * 1.06) / 2 <= 0) overlap++;
  }
  ok('a car in the next lane never overlaps the player', overlap === 0, String(overlap));
  await p.evaluate(() => { const D = window.racerDebug; D.teleport(1500); D.setLane(0); D.advance(4); D.addCar(0, 14, 'sedan'); D.advance(.5); });
  const g2 = await p.evaluate(() => window.racerDebug.geo([9])); const s2 = await st(p);
  ok('hitting a car costs a life and the car that was hit stays visible, knocked aside', s2.lives === 2 && g2.cars.some(c => c.knock), JSON.stringify([s2.lives, g2.cars.map(c => c.knock)]));
  const sim = await p.evaluate(() => {
    const D = window.racerDebug; let worst = 0;
    for (let i = 0; i < 4000; i++) {
      D.advance(.02); const s = D.state(); if (s.mode !== 'run') break;
      const g = D.geo([9]); const lanes = new Set(g.cars.filter(c => c.d > 9 && c.d < 60 && !c.knock).map(c => c.lane)); worst = Math.max(worst, lanes.size);
      const ahead = g.cars.filter(c => c.d > 2 && c.d < 70);
      if (ahead.some(c => c.lane === s.laneTarget) && i % 5 === 0) { const cand = [-1, 0, 1].filter(l => Math.abs(l - s.laneTarget) <= 1 && !ahead.some(c => c.lane === l)); if (cand.length) { const k = cand[0] > s.laneTarget ? 'ArrowRight' : 'ArrowLeft'; document.dispatchEvent(new KeyboardEvent('keydown', { key: k, code: k, bubbles: true })); } }
    }
    return { worst, mode: D.state().mode, dist: Math.round(D.state().dist) };
  });
  ok('on Easy a simple driver can play 80 s, and spawns never fill all three lanes ahead', sim.mode === 'run' && sim.worst <= 2, JSON.stringify(sim));
  await p.evaluate(() => { window.racerDebug.stopSpawning(); window.racerDebug.teleport(5000); window.racerDebug.advance(.1); });
  ok('the Journey bar says which chapter and how much time is left', /Chapter \d+ of 10 .*(min left|a minute and a half left)/.test(await p.textContent('#trip-label')), await p.textContent('#trip-label'));
  ok('road tests have no errors', p.errs.length === 0, p.errs.join('|'));

  await browser.close();
  const bad = R.filter(r => !r.pass);
  R.forEach(r => { if (!r.pass) console.log('FAIL', r.name, r.extra || ''); });
  console.log(`${R.length - bad.length}/${R.length} passed`);
  process.exit(bad.length ? 1 : 0);
})();
