// Browser checks for how the pages work together: Snake's look, saved game and exits. Requires Playwright and Chromium.
// Usage: NODE_PATH=<dir with playwright> node tests/browser/site.js
const { chromium } = require('playwright');
const path = require('path'); const url = require('url');
const href = (f) => url.pathToFileURL(path.resolve(__dirname, '../..', f)).href;
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const R = []; const ok = (name, cond, extra) => { R.push({ name, pass: !!cond, extra }); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const mk = async (init) => { const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }); const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(String(e))); if (init) await p.addInitScript(init); return p; };
  const state = (p) => p.evaluate(() => window.classicGamesDebug.state());
  const SNAKE = href('snake/index.html') + '?debug=1&seed=4';

  // ---- look: Snake follows the app Appearance, and a look chosen inside Snake wins
  let p = await mk();
  await p.goto(SNAKE);
  ok('Snake is dark by default', (await p.getAttribute('html', 'data-theme')) === 'night');
  p = await mk(() => localStorage.setItem('classic-games.launcher', JSON.stringify({ v: 1, chosen: { theme: 'light' } })));
  await p.goto(SNAKE);
  ok('Snake is light when the app Appearance is Light', (await p.getAttribute('html', 'data-theme')) === 'colour');
  p = await mk(() => { localStorage.setItem('classic-games.launcher', JSON.stringify({ v: 1, chosen: { theme: 'light' } })); localStorage.setItem('classic-games.theme', 'lcd'); });
  await p.goto(SNAKE);
  ok('a look chosen inside Snake wins over the app Appearance', (await p.getAttribute('html', 'data-theme')) === 'lcd');

  // the choice made on the real Settings tab (not a hand-written value) is what Snake follows
  p = await mk();
  await p.goto(href('index.html') + '#settings'); await p.tap('.seg[data-pref=theme] button[data-val=light]'); await sleep(100);
  await p.goto(SNAKE);
  ok('Light chosen on the Settings tab reaches Snake', (await p.getAttribute('html', 'data-theme')) === 'colour');
  await p.goto(href('index.html') + '#settings'); await p.tap('.seg[data-pref=theme] button[data-val=dark]'); await sleep(100);
  await p.goto(SNAKE);
  ok('and Dark brings it back', (await p.getAttribute('html', 'data-theme')) === 'night');

  // ---- leaving: a Games button and an Exit to Games link
  p = await mk();
  await p.goto(SNAKE);
  ok('the top bar has a visible Games button that goes back to the Games screen', await p.isVisible('#btn-back') && (await p.getAttribute('#btn-back', 'href')) === '../' && /Games/.test(await p.textContent('#btn-back')));
  ok('the start screen offers Exit to Games', await p.isVisible('#ov-exit'));
  const pad = await p.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.site-footer')).paddingBottom));
  ok('the page leaves room under the controls for the phone\'s own browser bar', pad >= 80, String(pad));
  ok('no horizontal overflow with the Games button', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

  // ---- saved game: written on pause, brought back by Resume, cleared by New game and by the end of a run
  p = await mk();
  await p.goto(SNAKE);
  await p.click('#ov-primary'); await p.keyboard.press('ArrowDown'); await sleep(1500);
  const before = await state(p);
  await p.click('#btn-pause'); await sleep(100);
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('classic-games.snake.save')));
  ok('pausing saves the game', saved && saved.v === 1 && saved.snap.score === before.game.score && saved.snap.snake.length === before.game.snake.length);
  await p.goto(SNAKE + '&resume=1'); await sleep(300);
  const back = await state(p);
  ok('Resume brings back the same board, paused, with a welcome', back.mode === 'paused' && JSON.stringify(back.game.snake.map(c => [c.x, c.y])) === JSON.stringify(saved.snap.snake) && /Welcome back/.test(await p.textContent('#overlay-text')), JSON.stringify([back.mode, await p.textContent('#overlay-text')]));
  await p.click('#btn-continue'); await sleep(500);
  ok('Continue then plays on from that position', (await state(p)).mode === 'running');
  await p.goto(SNAKE); await sleep(300);
  ok('opening Snake normally with a saved game offers Play and Continue', await p.isVisible('#ov-primary') && (await p.textContent('#ov-secondary')) === 'Continue');
  await p.goto(SNAKE + '&new=1'); await sleep(300);
  const fresh = await state(p);
  ok('New game from the Games screen starts a fresh game and clears the save', fresh.mode === 'ready' && fresh.game.score === 0 && (await p.evaluate(() => localStorage.getItem('classic-games.snake.save'))) === null, fresh.mode);
  // a run that ends clears the save
  await p.goto(SNAKE + '&bonus=0'); await p.evaluate(() => localStorage.setItem('classic-games.rules.v2', JSON.stringify({ v: 2, chosen: { board: 'clear', edges: 'walls', lives: 'classic', bonus: 'off' } })));
  await p.goto(SNAKE); await p.click('#ov-primary'); await p.keyboard.press('ArrowDown'); await sleep(1500);
  await p.evaluate(() => window.dispatchEvent(new Event('pagehide'))); await sleep(100);
  ok('leaving the page mid-run saves it', (await p.evaluate(() => localStorage.getItem('classic-games.snake.save'))) !== null);
  await p.goto(SNAKE + '&resume=1'); await sleep(300); await p.click('#btn-continue');
  let m = 'running'; for (let i = 0; i < 40 && m === 'running'; i++) { await sleep(250); m = (await state(p)).mode; }
  ok('when the run ends the save is cleared', m === 'over' && (await p.evaluate(() => localStorage.getItem('classic-games.snake.save'))) === null, m);
  ok('no page errors', p.errs.length === 0, p.errs.join('|'));

  await browser.close();
  const failed = R.filter(r => !r.pass);
  R.forEach(r => console.log((r.pass ? 'ok   ' : 'FAIL ') + r.name + (r.pass ? '' : '  ' + (r.extra || ''))));
  console.log(`${R.length - failed.length}/${R.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
