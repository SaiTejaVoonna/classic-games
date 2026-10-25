// Browser checks for the Racer prototype. Requires an existing Playwright install and Chromium.
// Usage: NODE_PATH=<dir with playwright> node tests/browser/racer.js <output dir>
const { chromium } = require('playwright');
const INDEX = require('url').pathToFileURL(require('path').resolve(__dirname, '../../racer/index.html')).href;
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const R = []; const ok = (name, cond, extra) => { R.push({ name, pass: !!cond, extra }); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const st = (p) => p.evaluate(() => window.racerDebug.state());

(async () => {
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e))); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto(INDEX + '?debug=1&seed=11');
  ok('menu shows the Play button', await p.isVisible('#play') && (await st(p)).mode === 'menu');
  ok('canvas fills the stage at device resolution', await p.evaluate(() => { const c = document.getElementById('c'); const r = c.getBoundingClientRect(); return c.width === Math.round(r.width * 2) && c.height === Math.round(r.height * 2); }));
  ok('the menu offers speed, music and effects choices with Relaxed as the default', await p.isVisible('#opts') && (await p.getAttribute('.opt[data-opt=speed] button[data-val=relaxed]', 'aria-pressed')) === 'true' && (await p.getAttribute('.opt[data-opt=music] button[data-val=on]', 'aria-pressed')) === 'true');
  await p.tap('.opt[data-opt=speed] button[data-val=normal]'); await sleep(80);
  ok('choosing a speed is saved', JSON.parse(await p.evaluate(() => localStorage.getItem('classic-games.racer.prefs'))).speed === 'normal');
  await p.tap('.opt[data-opt=speed] button[data-val=relaxed]'); await sleep(80);
  await p.tap('#play'); await sleep(300);
  let s = await st(p);
  ok('Play starts a run', s.mode === 'run' && !(await p.isVisible('#ov')));
  await p.keyboard.press('ArrowLeft'); await sleep(150); s = await st(p);
  ok('ArrowLeft moves to the left lane', s.laneTarget === -1);
  await p.keyboard.press('ArrowLeft'); s = await st(p);
  ok('the left lane is the limit', s.laneTarget === -1);
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight'); s = await st(p);
  ok('two rights reach the right lane and stop there', s.laneTarget === 1);
  const cdp = await ctx.newCDPSession(p);
  const b = await p.evaluate(() => window.racerDebug.stage());
  const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
  const drag = async (x0, x1) => { const pt = (x) => [{ x, y: cy, id: 1 }]; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(x0) }); for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(x0 + (x1 - x0) * i / 6) }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
  await drag(cx + 20, cx - 20); await sleep(120); s = await st(p);
  ok('a swipe left moves one lane', s.laneTarget === 0, String(s.laneTarget));
  await drag(cx - 20, cx + 20); await sleep(120); s = await st(p);
  ok('a swipe right moves one lane', s.laneTarget === 1, String(s.laneTarget));
  // keep the player alive while checking progress: stand in a lane and let traffic come; chapters change with distance
  await drag(cx, cx + 10); await sleep(100); const keep = (await st(p)).laneTarget;
  ok('a tiny movement is ignored', keep === 1, String(keep));
  await drag(cx + 60, cx - 60); await sleep(120); s = await st(p);
  ok('a long drag can change two lanes (it chains)', s.laneTarget === -1, String(s.laneTarget));
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight'); await sleep(50);
  const d0 = s.dist; await sleep(800); s = await st(p);
  ok('distance and speed grow while running', s.dist > d0 && s.speed > 30, JSON.stringify(s));
  // pause and brake
  await p.tap('#pause'); await sleep(150); s = await st(p);
  ok('Pause freezes the run and shows Resume', s.paused && (await p.textContent('#play')) === 'Resume' && await p.isVisible('#ov'));
  const dp = s.dist; await sleep(400);
  ok('nothing moves while paused', (await st(p)).dist === dp);
  await p.tap('#play'); await sleep(200); s = await st(p);
  ok('Resume continues the same run', !s.paused && s.mode === 'run' && s.dist >= dp);
  const hold = await p.locator('#brake').boundingBox();
  await p.evaluate(() => window.racerDebug.state());
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: hold.x + hold.width / 2, y: hold.y + hold.height / 2, id: 2 }] });
  await sleep(250); s = await st(p);
  ok('holding the brake button eases off', s.braking === true);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(100); s = await st(p);
  ok('letting go releases the brake', s.braking === false);
  // hills move the road up and down
  const el = await p.evaluate(() => [0, 150, 300, 450, 600, 750, 900, 1050].map(d => window.racerDebug.elev(d)));
  ok('the road really has hills (elevation changes by several metres)', Math.max(...el) - Math.min(...el) > 5, el.join(','));
  // crash it
  await p.evaluate(() => window.racerDebug.crashNow()); await sleep(900); s = await st(p);
  ok('a crash ends the run and shows Play again', s.mode === 'crash' && (await p.isVisible('#ov')) && (await p.textContent('#play')) === 'Play again');
  await p.tap('#play'); await sleep(250); s = await st(p);
  ok('Play again starts a fresh run', s.mode === 'run' && s.dist < 60 && s.score < 10);
  ok('best score is stored', await p.evaluate(() => window.localStorage.getItem('classic-games.racer.best') !== null));
  // every chapter renders without errors and with real pixels
  const looks = [];
  for (const d of [0, 900, 1800, 2700, 3600, 4500, 5400, 6300]) {
    const sum = await p.evaluate((dd) => { window.racerDebug.still(dd, 1.2, 0, true); const c = document.getElementById('c'); const g = c.getContext('2d'); const a = g.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < a.length; i += 4000) n += a[i] + a[i + 1] + a[i + 2]; return n; }, d);
    looks.push(sum);
  }
  ok('eight distances draw (seven chapters and the loop back to the first)', looks.every(v => v > 0));
  ok('chapters look different from each other', new Set(looks.slice(0, 7).map(v => Math.round(v / 2000))).size >= 5, looks.join(','));
  ok('the loop returns to chapter 1 after seven chapters', Math.abs(looks[0] - looks[7]) < looks[0] * 0.2, looks[0] + ' vs ' + looks[7]);
  ok('no page errors', errs.length === 0, errs.join('|'));
  await browser.close();
  let fail = 0;
  for (const r of R) { if (!r.pass) fail++; console.log((r.pass ? 'PASS ' : 'FAIL ') + r.name + (r.pass ? '' : '  ' + (r.extra || ''))); }
  console.log(`${R.length - fail}/${R.length} passed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
