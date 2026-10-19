// Browser checks. Requires an existing Playwright install (not a project dependency) and a
// Chromium binary. Usage: NODE_PATH=<dir with playwright> node tests/browser/play.js <output dir>
// Optional: CHROMIUM_PATH (default /opt/pw-browsers/chromium).
const { chromium } = require('playwright');
const INDEX = require('url').pathToFileURL(require('path').resolve(__dirname, '../../index.html')).href;
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const url = (q) => INDEX + (q || '');
const R = []; const ok = (name, cond, extra) => { R.push({ name, pass: !!cond, extra }); };
const st = (p) => p.evaluate(() => window.classicGamesDebug.state());
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: CHROMIUM });

  // ---- Desktop keyboard path ----
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(String(e))); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
    await p.goto(url('?seed=3&debug=1'));
    let s = await st(p);
    ok('initial mode menu', s.mode === 'menu');
    ok('dpad disabled in menu', await p.evaluate(() => [...document.querySelectorAll('.dpad-btn')].every(b => b.disabled)));
    await p.click('#btn-new');
    ok('New game focuses board', await p.evaluate(() => document.activeElement.id) === 'board');
    s = await st(p); ok('mode ready, ticks 0', s.mode === 'ready' && s.game.ticks === 0);
    await sleep(400); s = await st(p); ok('no movement before first input', s.game.ticks === 0);
    await p.keyboard.press('ArrowLeft'); s = await st(p);
    ok('reversal at start ignored (still ready)', s.mode === 'ready');
    await p.keyboard.press('ArrowUp'); s = await st(p);
    ok('first valid key starts run', s.mode === 'running');
    await sleep(520); s = await st(p);
    ok('time-based movement (3-4 ticks in ~520ms)', s.game.ticks >= 2 && s.game.ticks <= 5, 'ticks=' + s.game.ticks);
    ok('moving up after ArrowUp', s.game.dir === 'up');
    await p.keyboard.press('d'); await sleep(200); s = await st(p); ok('WASD d turns right', s.game.dir === 'right');
    await p.keyboard.press(' '); s = await st(p); ok('Space pauses', s.mode === 'paused');
    const t1 = s.game.ticks; await sleep(600); s = await st(p); ok('no ticks while paused', s.game.ticks === t1);
    ok('dpad disabled while paused', await p.evaluate(() => [...document.querySelectorAll('.dpad-btn')].every(b => b.disabled)));
    ok('Continue enabled, Pause disabled while paused', !(await p.isDisabled('#btn-continue')) && await p.isDisabled('#btn-pause'));
    await p.keyboard.press('p'); s = await st(p); ok('P resumes', s.mode === 'running');
    // hidden tab: auto-pause, no catch-up
    await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    s = await st(p); ok('hidden tab auto-pauses', s.mode === 'paused'); const t2 = s.game.ticks;
    await sleep(1500);
    await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
    s = await st(p); ok('becoming visible does not auto-resume', s.mode === 'paused' && s.game.ticks === t2);
    await p.click('#btn-continue');
    ok('Continue focuses board', await p.evaluate(() => document.activeElement.id) === 'board');
    await sleep(120); s = await st(p); ok('no catch-up burst after resume (<=1 tick in 120ms)', s.game.ticks - t2 <= 1, 'delta=' + (s.game.ticks - t2));
    // Space outside the board must not pause
    await p.focus('#btn-new'); await p.keyboard.press('KeyP'); s = await st(p); ok('P on a button (not board) does not pause', s.mode === 'running');
    // new game confirmation
    await p.click('#btn-new');
    s = await st(p); ok('New game mid-run pauses and asks to confirm', s.mode === 'paused' && await p.evaluate(() => document.getElementById('dlg-confirm').open));
    await p.click('#dlg-confirm button[value=cancel]');
    await p.waitForFunction(() => document.activeElement && document.activeElement.id === 'btn-continue', null, { timeout: 2000 }).catch(() => {});
    s = await st(p); ok('Cancel keeps the paused run', s.mode === 'paused' && s.game.ticks > 0);
    ok('Cancel returns focus to Continue', await p.evaluate(() => document.activeElement.id) === 'btn-continue');
    await p.click('#btn-new'); await p.click('#dlg-confirm button[value=confirm]');
    await p.waitForFunction(() => window.classicGamesDebug.state().mode === 'ready', null, { timeout: 2000 }).catch(() => {});
    s = await st(p); ok('Confirm starts fresh ready game', s.mode === 'ready' && s.game.score === 0 && s.game.ticks === 0);
    // run into wall (wait until the board has focus again after the dialog closes)
    await p.waitForFunction(() => document.activeElement && document.activeElement.id === 'board');
    await p.keyboard.press('ArrowRight');
    await p.waitForFunction(() => window.classicGamesDebug.state().mode === 'over', null, { timeout: 5000 });
    s = await st(p); ok('wall collision ends run', s.mode === 'over' && s.game.reason === 'wall');
    ok('game-over overlay + status text', (await p.textContent('#overlay-text')).includes('Game over') && (await p.textContent('#status')).includes('Game over'));
    await sleep(500); const tOver = (await st(p)).game.ticks; await sleep(400); ok('frozen after game over', (await st(p)).game.ticks === tOver);
    ok('errors', errs.length === 0, errs.join('|'));
    await ctx.close();
  }

  // ---- Scoring + best persistence via bot with real key presses ----
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const p = await ctx.newPage();
    await p.goto(url('?seed=11&debug=1'));
    await p.click('#btn-new');
    const key = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
    const opp = { up: 'down', down: 'up', left: 'right', right: 'left' };
    const t0 = Date.now(); let s = await st(p);
    while (s.mode !== 'over' && s.game.score < 3 && Date.now() - t0 < 30000) {
      const h = s.game.snake[0], f = s.game.food; if (!f) break;
      let want = f.x > h.x ? 'right' : f.x < h.x ? 'left' : f.y > h.y ? 'down' : 'up';
      if (want === opp[s.game.dir]) want = h.y < s.game.rows - 1 ? 'down' : 'up';
      if (want !== s.game.dir || s.mode === 'ready') await p.keyboard.press(key[want]);
      await sleep(70); s = await st(p);
    }
    ok('bot ate food: score >= 1 and length = 3 + score', s.game.score >= 1 && s.game.snake.length === 3 + s.game.score, `score=${s.game.score} len=${s.game.snake.length}`);
    ok('score shown in DOM', (await p.textContent('#score')) === String(s.game.score));
    const sc = s.game.score;
    // finish run by steering into the wall
    await p.keyboard.press('ArrowUp'); await p.waitForFunction(() => window.classicGamesDebug.state().mode === 'over', null, { timeout: 8000 }).catch(() => {});
    s = await st(p);
    if (s.mode !== 'over') { await p.keyboard.press('ArrowLeft'); await p.waitForFunction(() => window.classicGamesDebug.state().mode === 'over', null, { timeout: 8000 }).catch(() => {}); s = await st(p); }
    ok('run ended', s.mode === 'over');
    const stored = await p.evaluate(() => localStorage.getItem('classic-games.best.prototype-v1'));
    ok('best stored with versioned key', stored && JSON.parse(stored).best === s.game.score && s.game.score >= sc, stored);
    ok('best shown', (await p.textContent('#best')) === String(s.game.score));
    await p.reload(); ok('best survives reload', (await p.textContent('#best')) === String(s.game.score));
    await p.click('[data-open=dlg-top]'); ok('top score dialog shows best', (await p.textContent('#top-text')).includes(String(s.game.score)));
    await ctx.close();
  }

  // ---- Storage failure ----
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(String(e)));
    await p.addInitScript(() => {
      const thrower = () => { throw new DOMException('denied', 'SecurityError'); };
      Storage.prototype.getItem = thrower; Storage.prototype.setItem = thrower;
    });
    await p.goto(url('?seed=11&debug=1'));
    ok('page loads with throwing storage', errs.length === 0, errs.join('|'));
    await p.click('#btn-new'); await p.keyboard.press('ArrowRight');
    await p.waitForFunction(() => window.classicGamesDebug.state().mode === 'over', null, { timeout: 6000 });
    ok('game playable and ends; no errors', errs.length === 0, errs.join('|'));
    ok('best labelled session-only when storage fails', (await p.textContent('#best-note')).includes('session'));
    await ctx.close();
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(String(e)));
    await p.addInitScript(() => { localStorage.setItem('classic-games.best.prototype-v1', '{corrupt'); });
    await p.goto(url('?debug=1'));
    ok('corrupt stored best ignored', errs.length === 0 && (await p.textContent('#best')) === '—');
    await ctx.close();
  }

  // ---- Mobile touch path (Playwright touch emulation) ----
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(String(e)));
    await p.goto(url('?seed=3&debug=1'));
    const tap = async (sel) => { const b = await p.locator(sel).boundingBox(); await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); };
    await tap('#btn-new');
    let s = await st(p); ok('touch: New game', s.mode === 'ready');
    await tap('.dpad .up'); s = await st(p); ok('touch: D-pad Up starts run', s.mode === 'running' && s.game.dir !== 'down');
    await sleep(350); await tap('.dpad .right'); await sleep(350); s = await st(p); ok('touch: D-pad Right turns', s.game.dir === 'right');
    await tap('.dpad .left'); s = await st(p); ok('touch: reversal via D-pad ignored', s.game.queue.length === 0);
    await tap('#btn-pause'); s = await st(p); ok('touch: Pause', s.mode === 'paused');
    ok('touch: D-pad disabled while paused', await p.evaluate(() => [...document.querySelectorAll('.dpad-btn')].every(b => b.disabled)));
    await tap('#btn-continue'); s = await st(p); ok('touch: Continue', s.mode === 'running');
    const sizes = await p.evaluate(() => [...document.querySelectorAll('.dpad-btn,.actions .btn,.header-actions .btn')].map(b => { const r = b.getBoundingClientRect(); return Math.round(r.width) + 'x' + Math.round(r.height); }));
    ok('touch targets >= 44px', sizes.every(z => z.split('x').every(n => +n >= 44)), sizes.join(','));
    ok('page does not scroll horizontally', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    ok('errors (touch)', errs.length === 0, errs.join('|'));
    await p.screenshot({ path: process.argv[2] + '/play-touch-390x844.png' });
    await ctx.close();
  }
  await browser.close();
  const failed = R.filter(r => !r.pass);
  R.forEach(r => console.log((r.pass ? 'PASS ' : 'FAIL ') + r.name + (r.extra && !r.pass ? '  [' + r.extra + ']' : '')));
  console.log(`\n${R.length - failed.length}/${R.length} passed`);
})();
