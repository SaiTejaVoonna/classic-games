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

  // ---- launcher (the Games screen)
  const CHECK = { v: 1, chapter: 3, mode: 'journey', difficulty: 'easy', speed: 'relaxed', length: 'demo', score: 10, coins: 5 };
  const STATS = { runs: 3, near: 12, nearBest: 6, coins: 120, journeys: 1, noHitJourneys: 1, maxChapter: 7, bestDistance: 5000 };
  let p = await mk(390, 844);
  await p.goto(href('index.html') + '?debug=1');
  ok('Games screen: a featured card, two game tiles and four bottom tabs', await p.isVisible('#hero') && (await p.$$('.tile')).length === 2 && (await p.$$('.tab')).length === 4);
  ok('the tiles link to the games', (await p.getAttribute('#tile-racer', 'href')) === 'racer/' && (await p.getAttribute('#tile-snake', 'href')) === 'snake/');
  const h0 = await p.evaluate(() => window.launcherDebug.hero());
  ok('with nothing saved the top card is plain Play, with no Continue', !h0.cont && h0.game === 'racer' && (await p.textContent('#hero-main')) === 'Play' && !(await p.isVisible('#hero-alt')), JSON.stringify(h0));
  ok('no horizontal overflow at 390', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await p.setViewportSize({ width: 320, height: 568 });
  ok('no horizontal overflow at 320', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await p.setViewportSize({ width: 390, height: 844 });
  ok('the page is dark by default', (await p.getAttribute('html', 'data-theme')) === 'dark');
  await p.emulateMedia({ colorScheme: 'light' }); await p.reload();
  ok('and stays dark on a phone set to light (Dark is the default, not Auto)', (await p.getAttribute('html', 'data-theme')) === 'dark');
  await p.tap('.tab[data-go=awards]'); await sleep(150);
  ok('the Awards tab opens the awards, and the Games view is hidden', await p.isVisible('#view-awards') && !(await p.isVisible('#view-games')) && (await p.getAttribute('.tab[data-go=awards]', 'aria-current')) === 'page');
  await p.goBack(); await sleep(200);
  ok('the browser back button returns to Games', await p.isVisible('#view-games'));
  await p.tap('.tab[data-go=settings]'); await sleep(150);
  await p.evaluate(() => localStorage.setItem('classic-games.theme', 'lcd'));
  await p.tap('.seg[data-pref=theme] button[data-val=light]'); await sleep(100);
  ok('Settings: choosing Light switches the whole app and hands Snake back to the app look', (await p.getAttribute('html', 'data-theme')) === 'light' && (await p.evaluate(() => localStorage.getItem('classic-games.theme'))) === null);
  await p.tap('.seg[data-pref=theme] button[data-val=auto]'); await sleep(100);
  ok('Auto follows the phone', (await p.getAttribute('html', 'data-theme')) === 'light');
  ok('launcher has no errors', p.errs.length === 0, p.errs.join('|'));

  p = await mk(390, 844);
  await p.addInitScript(([c, st]) => { localStorage.setItem('classic-games.racer.checkpoint', JSON.stringify(c)); localStorage.setItem('classic-games.racer.stats', JSON.stringify(st)); }, [Object.assign({ at: 5000 }, CHECK), STATS]);
  await p.goto(href('index.html') + '?debug=1');
  const h1 = await p.evaluate(() => window.launcherDebug.hero());
  ok('a saved Racer checkpoint makes the top card Continue Racer, with Resume and New run', h1.cont && h1.game === 'racer' && (await p.getAttribute('#hero-main', 'href')) === 'racer/?resume=1' && (await p.getAttribute('#hero-alt', 'href')) === 'racer/?new=1' && /Chapter 4 of 10/.test(await p.textContent('#hero-sub')), JSON.stringify(h1) + await p.textContent('#hero-sub'));
  const aw = await p.evaluate(() => window.launcherDebug.awards());
  ok('awards are computed from stats', JSON.stringify(aw).indexOf('first-drive') >= 0, JSON.stringify(aw).slice(0, 200));

  // a Snake game saved by the game itself
  const snap = await (async () => { const q = await mk(390, 844); await q.goto(href('snake/index.html') + '?debug=1&seed=4'); await q.click('#ov-primary'); await q.keyboard.press('ArrowDown'); await sleep(700); await q.click('#btn-pause'); const raw = await q.evaluate(() => localStorage.getItem('classic-games.snake.save')); await q.context().close(); return raw; })();
  ok('Snake writes its saved game when paused', !!snap && JSON.parse(snap).v === 1 && JSON.parse(snap).snap.snake.length >= 3);
  const withSnake = (racerAt, snakeAt, raw) => async () => {
    const q = await mk(390, 844);
    const d = JSON.parse(raw); d.at = snakeAt;
    await q.addInitScript(([c, st, sv]) => { localStorage.setItem('classic-games.racer.checkpoint', JSON.stringify(c)); localStorage.setItem('classic-games.racer.stats', JSON.stringify(st)); localStorage.setItem('classic-games.snake.save', sv); }, [Object.assign({ at: racerAt }, CHECK), STATS, JSON.stringify(d)]);
    await q.goto(href('index.html') + '?debug=1'); return q;
  };
  let q2 = await withSnake(1000, 9000, snap)();
  const h2 = await q2.evaluate(() => window.launcherDebug.hero());
  ok('Snake played last: the top card is Continue Snake and Racer shows a rest-stop chip', h2.game === 'snake' && h2.cont && (await q2.getAttribute('#hero-main', 'href')) === 'snake/?resume=1' && (await q2.getAttribute('#hero-alt', 'href')) === 'snake/?new=1' && /REST STOP/.test(await q2.textContent('#racer-chip')), JSON.stringify(h2));
  q2 = await withSnake(9000, 1000, snap)();
  const h3 = await q2.evaluate(() => window.launcherDebug.hero());
  ok('Racer played last: the top card is Racer and Snake shows a paused chip', h3.game === 'racer' && /PAUSED/.test(await q2.textContent('#snake-chip')), JSON.stringify(h3));
  const badSave = JSON.parse(snap); badSave.snap.snake[1] = [0, 0];
  q2 = await withSnake(1000, 9000, JSON.stringify(badSave))();
  const h4 = await q2.evaluate(() => window.launcherDebug.hero());
  ok('a damaged Snake save is ignored', h4.game === 'racer' && !(await q2.isVisible('#snake-chip')), JSON.stringify(h4));

  // ---- racer entry points from the Games screen
  p = await mk(390, 760);
  await p.addInitScript((c) => localStorage.setItem('classic-games.racer.checkpoint', JSON.stringify(c)), CHECK);
  await p.goto(href('racer/index.html') + '?debug=1&speed=0&resume=1');
  ok('Racer Resume: the start screen welcomes you back with Continue ready', (await p.textContent('#ov-title')) === 'Welcome back' && await p.isVisible('#cont') && /chapter 4 of 10/i.test(await p.textContent('#ov-sub')), await p.textContent('#ov-sub'));
  ok('Racer start screen has a Games button and an Exit to Games link', await p.isVisible('.backpill') && (await p.textContent('#ov a.link')) === 'Exit to Games');
  await p.goto(href('racer/index.html') + '?debug=1&speed=0&new=1');
  ok('Racer New run: the start screen does not offer the old checkpoint', !(await p.isVisible('#cont')) && await p.isVisible('#play'));
  await p.goto(href('racer/index.html') + '?debug=1&speed=0&len=demo&seed=2');
  await p.evaluate(() => localStorage.removeItem('classic-games.racer.checkpoint'));
  await p.click('#play'); await sleep(150);
  await p.evaluate(() => { const D = window.racerDebug; D.stopSpawning(); D.teleport(1790); D.advance(1.5); });
  const cpSaved = await p.evaluate(() => window.racerDebug.state().checkpoint);
  ok('Racer saves a timestamped checkpoint at a rest stop, so the Games screen knows what you played last', cpSaved && cpSaved.chapter === 2 && typeof cpSaved.at === 'number' && cpSaved.at > 1e12, JSON.stringify(cpSaved));
  await p.evaluate(() => window.racerDebug.pause());
  ok('the pause menu has Exit to Games', (await p.textContent('#ps a.out')) === 'Exit to Games' && (await p.getAttribute('#ps a.out', 'href')) === '../');

  // ---- racer
  p = await mk(390, 760);
  await p.goto(href('racer/index.html') + '?debug=1&seed=11&speed=0');
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
  ok('the very first run shows a one-time swipe hint', await p.isVisible('#hint'));
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
  const crashText = await p.textContent('#ov-stats');
  ok('the crash panel reports distance, score, chapter reached, coins, close calls and bumps', ['Distance', 'Score', 'Reached', 'Coins', 'Close calls', 'Bumps'].every((k) => crashText.includes(k)), crashText);
  ok('racer has no errors', p.errs.length === 0, p.errs.join('|'));

  p = await mk(390, 760);
  await p.goto(href('racer/index.html') + '?debug=1&seed=3&speed=0');
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
    const g = await p.evaluate(() => window.racerDebug.geo([9])); const pl = g.player, r = g.rows[0], half = pl.w * 1.05 / 2;
    n++; if (Math.max(r.ct - r.hw * .955 - (pl.x - half), pl.x + half - (r.ct + r.hw * .955)) > 0) edge++; if (pl.x - half < 0 || pl.x + half > g.W) scr++;
    if (Math.abs(pl.y - r.y) > 0.01) edge++;
  }
  ok('the player car stays inside the edge lines and the screen in every lane, on bends and hills', n > 100 && edge === 0 && scr === 0, `${n} samples, ${edge} off road, ${scr} off screen`);
  let overlap = 0;
  for (const kind of ['hatch', 'suv', 'van', 'truck']) for (const cl of [-1, 1]) {
    await p.evaluate(([k, l]) => { window.racerDebug.teleport(1500); window.racerDebug.setLane(0); window.racerDebug.addCar(l, 9, k); }, [kind, cl]);
    const g = await p.evaluate(() => window.racerDebug.geo([9])); const c = g.cars[g.cars.length - 1], r = g.rows[0];
    const f = { hatch: 1, suv: 1.04, van: 1.07, truck: 1.12 }[kind];
    if (Math.abs(c.x - g.player.x) - (r.hw * 2 / 3 * .78 * f + g.player.w * 1.05) / 2 <= 0) overlap++;
  }
  ok('a car in the next lane never overlaps the player', overlap === 0, String(overlap));
  await p.evaluate(() => { const D = window.racerDebug; D.teleport(1500); D.setLane(0); D.advance(4); D.addCar(0, 14, 'sedan'); D.advance(.5); });
  const g2 = await p.evaluate(() => window.racerDebug.geo([9])); const s2 = await st(p);
  ok('hitting a car costs a life and the car that was hit stays visible, knocked aside', s2.lives === 2 && g2.cars.some(c => c.knock), JSON.stringify([s2.lives, g2.cars.map(c => c.knock)]));
  const sim = await p.evaluate(() => {
    const D = window.racerDebug; let three = 0, steps = 0, stack = 0;
    for (let i = 0; i < 4000; i++) {
      D.advance(.02); const s = D.state(); if (s.mode !== 'run') break;
      const g = D.geo([9]); const lanes = new Set(g.cars.filter((c) => c.d > 9 && c.d < 60 && !c.knock).map((c) => c.lane)); steps++; if (lanes.size >= 3) three++;
      const live = g.cars.filter((c) => c.d > 1 && !c.knock); for (const a of live) for (const b of live) if (a !== b && a.lane === b.lane && Math.abs(a.laneF - b.laneF) < .5 && b.d > a.d && b.d - a.d < 9) stack++;
      const ahead = g.cars.filter((c) => c.d > 2 && c.d < 70);
      if (ahead.some((c) => c.lane === s.laneTarget) && i % 5 === 0) { const cand = [-1, 0, 1].filter((l) => Math.abs(l - s.laneTarget) <= 1 && !ahead.some((c) => c.lane === l)); if (cand.length) { const k = cand[0] > s.laneTarget ? 'ArrowRight' : 'ArrowLeft'; document.dispatchEvent(new KeyboardEvent('keydown', { key: k, code: k, bubbles: true })); } }
    }
    return { threeShare: three / Math.max(1, steps), stack, mode: D.state().mode, dist: Math.round(D.state().dist) };
  });
  ok('on Easy a simple driver can play 80 s; all three lanes are never filled ahead and cars in one lane never run into each other', sim.mode === 'run' && sim.threeShare === 0 && sim.stack === 0, JSON.stringify(sim));
  // lane centres match the painted lines, and everything is picked up and touched where the car is drawn
  const lanePos = await p.evaluate(() => { const D = window.racerDebug; D.stopSpawning(); D.teleport(1500); const out = []; for (const l of [-1, 0, 1]) { D.setLane(l); const g = D.geo([9]); out.push((g.player.x - g.rows[0].ct) / g.rows[0].hw); } return out; });
  ok('lane centres sit at -2/3, 0 and +2/3 of the road half-width, the middle of each painted lane', Math.abs(lanePos[0] + 2 / 3) < .002 && Math.abs(lanePos[1]) < .002 && Math.abs(lanePos[2] - 2 / 3) < .002, JSON.stringify(lanePos));
  const coinTest = await p.evaluate(() => {
    const D = window.racerDebug; D.stopSpawning(); let cn = 20; while (!D.coinChunk(cn)) cn++; const ck = D.coinChunk(cn); D.setLane(ck.lane);
    const before = D.state().coins, out = {};
    D.teleport(ck.start - 9 - 6.5); D.advance(.02); out.early = D.state().coins - before;
    D.teleport(ck.start - 9 - .5); D.advance(.02); out.atCar = D.state().coins - before;
    return out;
  });
  ok('a coin is collected when it reaches the car, not when it is under the camera', coinTest.early === 0 && coinTest.atCar >= 1, JSON.stringify(coinTest));
  const follow = await p.evaluate(() => {
    const D = window.racerDebug; D.stopSpawning(); D.teleport(1500); D.setLives(3); D.setLane(1); D.advance(.3);
    D.addCar(0, 80, 'sedan', false, 18); D.addCar(0, 40, 'sedan', false, 34); // the rear car is much faster and would drive through the front one
    let minGap = 1e9, wall = 0;
    for (let i = 0; i < 250; i++) { D.advance(.02); const cs = D.geo([9]).cars.filter((c) => c.lane === 0 && !c.knock); if (cs.length === 2) minGap = Math.min(minGap, Math.abs(cs[0].d - cs[1].d)); }
    D.teleport(3000); D.advance(.5);
    D.addCar(-1, 70, 'sedan', false, 24); D.addCar(1, 70, 'sedan', false, 24); D.addCar(0, 30, 'sedan', false, 36); // a faster car arrives between two others
    for (let i = 0; i < 400; i++) { D.advance(.02); const cs = D.geo([9]).cars.filter((c) => c.d > 1 && !c.knock); const rear = cs.slice().sort((a, b) => a.d - b.d); for (const c of rear) { const l = new Set(cs.filter((o) => Math.abs(o.d - c.d) < 20).map((o) => o.lane)); if (l.size >= 3) { wall++; break; } } }
    return { minGap: Math.round(minGap), wall };
  });
  ok('a faster car slows behind a slower one instead of driving through it, and never forms a wall of three', follow.minGap >= 12 && follow.wall === 0, JSON.stringify(follow));
  const wide = await p.evaluate(() => {
    const D = window.racerDebug, out = {}; D.stopSpawning();
    for (const kind of ['truck', 'hatch']) { D.teleport(1500); D.setLives(3); D.setLane(0); D.advance(.5); D.addCar(1, 9, kind); D.advance(.1); out[kind] = D.state().lives; }
    return out;
  });
  ok('a vehicle in the next lane is a near miss, not a crash, for the widest one too', wide.truck === 3 && wide.hatch === 3, JSON.stringify(wide));
  const squeeze = await p.evaluate(() => {
    const D = window.racerDebug; D.stopSpawning(); D.teleport(1500); D.setLives(3); D.setLane(.3); D.addCar(1, 9, 'sedan'); D.advance(.1); return D.state().lives;
  });
  ok('drifting into a car does cost a life', squeeze === 2, String(squeeze));
  const near2 = await p.evaluate(() => {
    const D = window.racerDebug; D.stopSpawning(); D.teleport(1500); D.setLives(3); D.setLane(0); D.advance(.3); D.addCar(1, 40, 'sedan'); D.advance(2.5); const plain = D.state().combo;
    D.teleport(1500); D.setLane(0); D.advance(.3); D.addCar(1, 30, 'sedan'); D.advance(.3); D.setLane(.2); D.advance(2.5); return { plain, squeezed: D.state().combo, lives: D.state().lives };
  });
  ok('passing in the next lane is no longer a combo, but squeezing past a car is', near2.plain === 0 && near2.squeezed >= 1 && near2.lives === 3, JSON.stringify(near2));
  const keys = await p.evaluate(() => {
    const D = window.racerDebug; D.stopSpawning(); D.setLane(0); const i0 = D.state().prefs.speedIdx;
    const k1 = new KeyboardEvent('keydown', { key: '+', ctrlKey: true, bubbles: true, cancelable: true }); document.dispatchEvent(k1);
    const i1 = D.state().prefs.speedIdx;
    const k2 = new KeyboardEvent('keydown', { key: 'D', bubbles: true, cancelable: true }); document.dispatchEvent(k2); D.advance(.5);
    return { ctrlBlocked: k1.defaultPrevented, sameSpeed: i1 === i0, capitalMoved: D.state().laneTarget === 1 };
  });
  ok('Ctrl+plus (browser zoom) is left to the browser, and a capital D still steers', !keys.ctrlBlocked && keys.sameSpeed && keys.capitalMoved, JSON.stringify(keys));
  const crash = await p.evaluate(() => { const D = window.racerDebug; D.stopSpawning(); D.teleport(1500); D.setLane(0); D.setLives(1); D.addCar(0, 9, 'sedan'); D.advance(.04); return { mode: D.state().mode, flash: D.state().flash }; });
  ok('a crash flashes the screen red even though the run has ended', crash.mode === 'over' && crash.flash > 0, JSON.stringify(crash));
  p = await mk(390, 760);
  await p.goto(href('racer/index.html') + '?debug=1&seed=5&speed=0');
  await p.click('#play'); await sleep(150);
  const quit = await p.evaluate(() => { const D = window.racerDebug; D.stopSpawning(); const r0 = D.state().stats.runs; D.advance(5); D.backToMenu(); return D.state().stats.runs - r0; });
  ok('leaving a run through the menu still counts it in the stats', quit === 1, String(quit));
  // the engine has its own volume: the Effects slider does not scale it
  const eng = await (async () => {
    await p.click('#play'); await sleep(200);
    await p.evaluate(() => { const f = document.getElementById('vol-fx'); f.value = 0; f.dispatchEvent(new Event('input', { bubbles: true })); const D = window.racerDebug; D.stopSpawning(); D.advance(.5); });
    await sleep(900); const q = await p.evaluate(() => window.racerDebug.audio()); return q;
  })();
  ok('the engine keeps its level when the Effects volume is turned to zero', eng && eng.engine && eng.engineGain > .5, JSON.stringify(eng && { engine: eng.engine, gain: eng.engineGain, state: eng.state }));
  const res = await p.evaluate(() => { const D = window.racerDebug, c = document.getElementById('c'); Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true }); D.slowDown(false); D.geo([]); const full = c.width; D.slowDown(true); D.geo([]); const low = c.width; D.slowDown(false); D.geo([]); return { full, low, back: c.width, css: c.getBoundingClientRect().width, dpr: devicePixelRatio }; });
  ok('a slow device renders at a lower resolution and can go back', res.low === Math.round(res.css) && res.full === 2 * res.low && res.back === res.full, JSON.stringify(res));
  await p.evaluate(() => { window.racerDebug.stopSpawning(); window.racerDebug.teleport(5000); window.racerDebug.advance(.1); });
  ok('the Journey bar says which chapter and how much time is left', /Chapter \d+ of 10 .*(min left|a minute and a half left)/.test(await p.textContent('#trip-label')), await p.textContent('#trip-label'));
  ok('road tests have no errors', p.errs.length === 0, p.errs.join('|'));

  // ---- handling and traffic behaviour
  p = await mk(390, 760);
  await p.goto(href('racer/index.html') + '?debug=1&seed=9');
  await p.click('#play'); await sleep(150);
  await p.evaluate(() => { const D = window.racerDebug; D.stopSpawning(); D.teleport(14000); D.setLane(-1); D.advance(1); });
  const step = await p.evaluate(() => {
    const D = window.racerDebug, out = []; document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    for (let i = 0; i < 40; i++) { D.advance(.02); out.push(D.state().lane); } return out;
  });
  const t95 = step.findIndex((v) => v >= -1 + 2 * .95) * .02;
  ok('a lane change takes about 0.28 s and does not overshoot on dry road', t95 > .2 && t95 < .36 && Math.max(...step) <= 1.001, `t95 ${t95}, max ${Math.max(...step)}`);
  const sus = await p.evaluate(() => { const D = window.racerDebug; let mn = 9, mx = -9; for (let i = 0; i < 400; i++) { D.advance(.02); const y = D.state().susp; mn = Math.min(mn, y); mx = Math.max(mx, y); } return [mn, mx]; });
  ok('the suspension bobs a little at speed and stays within a few pixels', sus[1] - sus[0] > .3 && sus[0] > -4 && sus[1] < 4, JSON.stringify(sus));
  const lc = await p.evaluate(() => {
    const D = window.racerDebug; D.teleport(3000); D.setLane(0); D.addCar(0, 170, 'sedan', true, 18); D.advance(.1);
    let sawSignal = false, moved = false, both = true;
    for (let i = 0; i < 300; i++) { D.advance(.02); const c = D.geo([9]).cars[0]; if (c.lc) sawSignal = true; if (Math.abs(c.laneF - c.lane) > .05) moved = true; if (c.lc && c.laneF === c.lane && c.lane === 0 && false) both = false; }
    const c = D.geo([9]).cars[0]; return { sawSignal, moved, lane: c.lane, laneF: c.laneF };
  });
  ok('a car far ahead signals, changes lane smoothly, and ends in the new lane', lc.sawSignal && lc.moved && lc.lane !== 0 && lc.lane === lc.laneF, JSON.stringify(lc));
  const hitSpin = await p.evaluate(() => { const D = window.racerDebug; D.teleport(3000); D.setLane(0); D.addCar(0, 14, 'sedan'); D.advance(.5); const c = D.geo([9]).cars.find((x) => x.knock); return !!c; });
  ok('the car that was hit is knocked aside', hitSpin);
  ok('handling tests have no errors', p.errs.length === 0, p.errs.join('|'));

  // ---- environment
  p = await mk(390, 760);
  await p.goto(href('racer/index.html') + '?debug=1&seed=9&speed=0');
  await sleep(300);
  const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return ((n >> 16) * .3 + ((n >> 8) & 255) * .59 + (n & 255) * .11); };
  const dawn = await p.evaluate(() => [0.02, .3, .6, .9].map((f) => window.racerDebug.scene((9 + f) * 2800)));
  ok('Sunrise Coast brightens as you drive: the sun climbs and the sky gets lighter', dawn[0].sunY > dawn[3].sunY + .2 && lum(dawn[3].sky[0]) > lum(dawn[0].sky[0]) + 40, JSON.stringify(dawn.map((d) => [d.sunY.toFixed(2), d.sky[0]])));
  const names = await p.evaluate(() => [8, 9].map((i) => window.racerDebug.scene((i + .5) * 2800).name));
  ok('the last two chapters are Northern Lights and Sunrise Coast', names[0] === 'Northern Lights' && names[1] === 'Sunrise Coast', names.join());
  ok('environment tests have no errors', p.errs.length === 0, p.errs.join('|'));

  // ---- speed control
  p = await mk(390, 760);
  await p.goto(href('racer/index.html') + '?debug=1&seed=9');
  await sleep(300);
  ok('the start screen has a Speed row with four choices', (await p.$$('[data-speedidx]')).length === 4);
  await p.tap('[data-speedidx="0"]'); await sleep(80);
  ok('choosing Cruise is remembered', (await st(p)).prefs.speedIdx === 0 && (await p.getAttribute('[data-speedidx="0"]', 'aria-pressed')) === 'true');
  await p.tap('[data-speedidx="3"]'); await sleep(80);
  await p.tap('#play'); await sleep(250);
  s = await st(p);
  ok('the default pace starts at about 136 km/h and makes the Journey longer so it still takes 15 minutes', Math.round(s.speed * 3.6) === 136 && s.chapterLen === 4480 && /about 15 min left/.test(await p.textContent('#trip-label')), JSON.stringify([s.speed * 3.6, s.chapterLen]));
  await p.evaluate(() => { window.racerDebug.stopSpawning(); });
  await p.tap('#spd-plus'); await p.tap('#spd-plus'); await sleep(60);
  await p.evaluate(() => window.racerDebug.advance(10)); const fast = await st(p);
  ok('+ makes the car faster, live', fast.prefs.speedIdx === 5 && fast.speed * 3.6 > 165, JSON.stringify([fast.prefs.speedIdx, fast.speed * 3.6]));
  await p.keyboard.press('-'); await p.keyboard.press('-'); await p.keyboard.press('-'); await p.keyboard.press('-'); await p.keyboard.press('-'); await sleep(60);
  await p.evaluate(() => window.racerDebug.advance(10)); const slow = await st(p);
  ok('the - key slows it down and stops at the gentlest pace', slow.prefs.speedIdx === 0 && slow.speed * 3.6 < 100 + 5 && await p.isDisabled('#spd-minus'), JSON.stringify([slow.prefs.speedIdx, slow.speed * 3.6]));
  ok('speed control has no errors', p.errs.length === 0, p.errs.join('|'));

  await browser.close();
  const bad = R.filter(r => !r.pass);
  R.forEach(r => { if (!r.pass) console.log('FAIL', r.name, r.extra || ''); });
  console.log(`${R.length - bad.length}/${R.length} passed`);
  process.exit(bad.length ? 1 : 0);
})();
