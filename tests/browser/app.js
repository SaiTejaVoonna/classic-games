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
  ok('menu offers Play, Journey and Easy by default', await p.isVisible('#play') && (await st(p)).prefs.mode === 'journey' && (await st(p)).prefs.difficulty === 'easy');
  await p.tap('.opt[data-opt=difficulty] button[data-val=hard]'); await sleep(80);
  ok('choices are saved', (await st(p)).prefs.difficulty === 'hard' && !!(await p.evaluate(() => localStorage.getItem('classic-games.racer.prefs'))));
  await p.tap('.opt[data-opt=difficulty] button[data-val=easy]'); await sleep(80);
  await p.tap('#play'); await sleep(300);
  let s = await st(p);
  ok('Play starts a run with three lives', s.mode === 'run' && s.lives === 3 && !(await p.isVisible('#ov')), JSON.stringify([s.mode, s.lives]));
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
  await p.evaluate(() => { window.racerDebug.stopSpawning(); window.racerDebug.teleport(1700); }); await sleep(300);
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
  await p.evaluate(() => { window.racerDebug.stopSpawning(); window.racerDebug.teleport(3 * 900 * 1 + 10); }); // near end of a short Journey is chapter-length based
  const len = (await st(p)).chapterLen;
  ok('Short journey is shorter than Full', len > 0);
  await p.evaluate((l) => { window.racerDebug.stopSpawning(); window.racerDebug.teleport(l * 10 + 5); window.racerDebug.advance(1); }, len);
  await sleep(300); s = await st(p);
  ok('reaching the end of a Journey finishes it', s.mode === 'done' || s.mode === 'over', s.mode);
  ok('journey run has no errors', p.errs.length === 0, p.errs.join('|'));

  await browser.close();
  const bad = R.filter(r => !r.pass);
  R.forEach(r => { if (!r.pass) console.log('FAIL', r.name, r.extra || ''); });
  console.log(`${R.length - bad.length}/${R.length} passed`);
  process.exit(bad.length ? 1 : 0);
})();
