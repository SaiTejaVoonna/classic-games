// Browser checks for rules settings: edges, mazes, lives, bonus food. Requires an existing
// Playwright install (not a project dependency) and a Chromium binary.
// Usage: NODE_PATH=<dir with playwright> node tests/browser/rules.js <output dir>
const { chromium } = require('playwright');
const INDEX = require('url').pathToFileURL(require('path').resolve(__dirname, '../../index.html')).href;
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const R = []; const ok = (name, cond, extra) => { R.push({ name, pass: !!cond, extra }); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const st = (p) => p.evaluate(() => window.classicGamesDebug.state());
const waitMode = (p, m, t = 8000) => p.waitForFunction((mm) => window.classicGamesDebug.state().mode === mm, m, { timeout: t });
const waitFor = (p, fn, arg, t = 8000) => p.waitForFunction(fn, arg, { timeout: t, polling: 20 });

async function open(browser, { rules, speed, query, viewport, touch } = {}) {
  const ctx = await browser.newContext({ viewport: viewport || { width: 1366, height: 768 }, hasTouch: !!touch });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.addInitScript(([r, sp]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    if (r) localStorage.setItem('classic-games.rules', JSON.stringify(Object.assign({ v: 1 }, r)));
    if (sp) localStorage.setItem('classic-games.speed', sp);
  }, [rules || null, speed || null]);
  await p.goto(INDEX + '?debug=1' + (query || ''));
  return { ctx, p, errs };
}
const openSettings = (p) => p.click('[data-open=dlg-settings]');
const pick = (p, name, value) => p.click(`label.radio:has(input[name=${name}][value=${value}])`);

(async () => {
  const browser = await chromium.launch({ executablePath: CHROMIUM });

  // ---- defaults, persistence, visibility ----
  {
    const { ctx, p, errs } = await open(browser, { query: '&seed=3' });
    ok('defaults: 1 life, clear field, solid walls, bonus on (rules summary visible before a run)', (await p.textContent('#rules-line')) === '1 life, clear field, solid walls, bonus food on.', await p.textContent('#rules-line'));
    ok('defaults: Lives shows 1; Unlimited is off by default', (await p.textContent('#lives')) === '1' && await p.isChecked('input[name=lives][value=classic]') && !(await p.isChecked('input[name=lives][value=unlimited]')));
    ok('nothing stored until the user changes a rule', await p.evaluate(() => localStorage.getItem('classic-games.rules')) === null);
    await openSettings(p);
    await pick(p, 'board', 'pillars'); await pick(p, 'edges', 'wrap'); await pick(p, 'lives', 'extra'); await pick(p, 'bonus', 'off');
    const saved = JSON.parse(await p.evaluate(() => localStorage.getItem('classic-games.rules')));
    ok('rules saved', saved.board === 'pillars' && saved.edges === 'wrap' && saved.lives === 'extra' && saved.bonus === 'off', JSON.stringify(saved));
    ok('menu adopts the rules at once (summary and Lives update)', (await p.textContent('#rules-line')) === '3 lives, pillars maze, wrap around edges, bonus food off.' && (await p.textContent('#lives')) === '3', await p.textContent('#rules-line'));
    await p.keyboard.press('Escape');
    await p.reload(); await p.waitForFunction(() => window.classicGamesDebug);
    await openSettings(p);
    ok('rules survive reload and radios match', await p.isChecked('input[name=board][value=pillars]') && await p.isChecked('input[name=edges][value=wrap]') && await p.isChecked('input[name=lives][value=extra]') && await p.isChecked('input[name=bonus][value=off]'));
    await p.keyboard.press('Escape');
    await p.click('#btn-new');
    const s = await st(p);
    ok('New game uses the saved rules', s.game.board === 'pillars' && s.game.wrap === true && s.game.livesMode === 'extra' && s.game.bonusEnabled === false && s.game.obstacles.length === 16);
    ok('no errors (settings)', errs.length === 0, errs.join('|'));
    await ctx.close();
  }
  {
    const { ctx, p } = await open(browser, { rules: { lives: 'bogus', board: 'nowhere', edges: 'wrap', bonus: 5 } });
    ok('invalid saved rule values fall back per field, valid ones are kept', (await p.textContent('#rules-line')) === '1 life, clear field, wrap around edges, bonus food on.', await p.textContent('#rules-line'));
    await ctx.close();
  }

  // ---- a change applies to the next New game ----
  {
    const { ctx, p } = await open(browser, { speed: 'fast', query: '&seed=3' });
    await p.click('#btn-new'); await p.keyboard.press('ArrowRight');
    await openSettings(p); await pick(p, 'board', 'gate'); await pick(p, 'edges', 'wrap');
    ok('note says the run keeps its rules', (await p.textContent('#rules-note')).startsWith('This run keeps its board, edges, lives and bonus.'), await p.textContent('#rules-note'));
    let s = await st(p);
    ok('the run in progress is unchanged', s.game.board === 'clear' && s.game.wrap === false && (await p.textContent('#rules-line')) === '1 life, clear field, solid walls, bonus food on.');
    await p.keyboard.press('Escape');
    await p.click('#btn-continue'); await p.click('#btn-new'); await p.click('#dlg-confirm button[value=confirm]');
    await waitMode(p, 'ready');
    s = await st(p);
    ok('the next New game uses the new rules', s.game.board === 'gate' && s.game.wrap === true && (await p.textContent('#rules-line')).includes('gate maze'));
    await ctx.close();
  }

  // ---- edge wrap ----
  {
    const { ctx, p } = await open(browser, { speed: 'fast', rules: { edges: 'wrap' }, query: '&seed=3' });
    await p.click('#btn-new'); await p.keyboard.press('ArrowRight');
    await waitFor(p, () => window.classicGamesDebug.state().game.snake[0].x === 20);
    await waitFor(p, () => window.classicGamesDebug.state().game.snake[0].x === 0, null, 2000);
    const s = await st(p);
    ok('wrap on: leaving the right edge returns at the left edge, run continues', s.mode === 'running' && s.game.snake[0].x === 0 && s.game.status === 'running');
    await ctx.close();
  }
  {
    const { ctx, p } = await open(browser, { speed: 'fast', rules: { edges: 'walls' }, query: '&seed=3' });
    await p.click('#btn-new'); await p.keyboard.press('ArrowRight');
    await waitMode(p, 'over', 6000);
    const s = await st(p);
    ok('wrap off: the right edge is a wall and ends a classic run', s.game.reason === 'wall' && s.game.snake[0].x === 20);
    await ctx.close();
  }

  // ---- maze collision ----
  {
    const { ctx, p } = await open(browser, { speed: 'fast', rules: { board: 'gate' }, query: '&seed=3' });
    await p.click('#btn-new'); await p.keyboard.press('ArrowUp');
    await waitFor(p, () => window.classicGamesDebug.state().game.snake[0].y <= 3);
    await p.keyboard.press('ArrowRight');
    await waitMode(p, 'over', 5000);
    const s = await st(p);
    ok('maze block ends a classic run (reason obstacle) with the head in front of the block', s.game.reason === 'obstacle' && s.game.snake[0].x === 9);
    ok('game over copy after a maze crash', /^Game over\. Score \d+\.$/.test(await p.textContent('#overlay-text')));
    await ctx.close();
  }

  // ---- extra lives ----
  {
    const { ctx, p } = await open(browser, { speed: 'fast', rules: { lives: 'extra', bonus: 'off' }, query: '&seed=3' });
    ok('extra lives: Lives shows 3 before the run', (await p.textContent('#lives')) === '3');
    await p.click('#btn-new');
    const crashOnce = async () => { await p.keyboard.press('ArrowUp'); await waitFor(p, () => window.classicGamesDebug.state().mode !== 'running', null, 6000); };
    await crashOnce();
    let s = await st(p);
    ok('first crash: mode ready, 2 lives left, snake restarted, run continues', s.mode === 'ready' && s.game.lives === 2 && s.game.status === 'ready' && (await p.textContent('#lives')) === '2');
    ok('status tells the player what happened', (await p.textContent('#status')) === 'Life lost. 2 lives left. Press a direction to continue.', await p.textContent('#status'));
    ok('direction buttons work again after a lost life', !(await p.isDisabled('.dpad .up')));
    await crashOnce();
    s = await st(p); ok('second crash: 1 life left', s.mode === 'ready' && s.game.lives === 1 && (await p.textContent('#status')).startsWith('Life lost. 1 life left.'));
    await crashOnce();
    await waitMode(p, 'over', 3000);
    s = await st(p); ok('third crash ends the run', s.mode === 'over' && s.game.lives === 0 && (await p.textContent('#lives')) === '0');
    await ctx.close();
  }

  // ---- unlimited assist ----
  {
    const { ctx, p } = await open(browser, { speed: 'fast', rules: { lives: 'unlimited' }, query: '&seed=3' });
    ok('unlimited is labelled as an assist during play and before', (await p.textContent('#rules-line')).startsWith('Assist: unlimited lives') && (await p.textContent('#lives')) === 'Unlimited');
    await p.click('#btn-new');
    for (let i = 0; i < 3; i++) {
      await p.keyboard.press('ArrowUp');
      await waitFor(p, () => window.classicGamesDebug.state().mode === 'ready' && window.classicGamesDebug.state().game.ticks > 0, null, 6000);
      await sleep(100);
    }
    const s = await st(p);
    ok('unlimited: three collisions, the run never ends, lives stay Unlimited', s.mode === 'ready' && s.game.status === 'ready' && s.game.lives === null && (await p.textContent('#lives')) === 'Unlimited');
    ok('still labelled as an assist after collisions', (await p.textContent('#rules-line')).startsWith('Assist: unlimited lives'));
    ok('unlimited status is a plain sentence', (await p.textContent('#status')) === 'Back at the start. Press a direction to continue.');
    await ctx.close();
  }

  // ---- bonus food (test hooks: bonusEvery, bonusTicks, bonusPoints) ----
  {
    const { ctx, p, errs } = await open(browser, { speed: 'fast', query: '&seed=11&bonusEvery=1&bonusTicks=80' });
    await p.click('#btn-new');
    const key = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
    const opp = { up: 'down', down: 'up', left: 'right', right: 'left' };
    const steer = async (target, s) => {
      const h = s.game.snake[0];
      let want = target.x > h.x ? 'right' : target.x < h.x ? 'left' : target.y > h.y ? 'down' : 'up';
      if (want === opp[s.game.dir]) want = h.y < s.game.rows - 1 ? 'down' : 'up';
      if (want !== s.game.dir || s.mode === 'ready') await p.keyboard.press(key[want]);
    };
    let s = await st(p); const t0 = Date.now();
    while (s.mode !== 'over' && !s.game.bonusItem && Date.now() - t0 < 30000) { await steer(s.game.food, s); await sleep(40); s = await st(p); }
    ok('eating a regular food made the bonus appear', !!s.game.bonusItem && s.game.score === 1, JSON.stringify(s.game.bonusItem));
    ok('bonus timer is shown near the board', !(await p.locator('#bonus-item').isHidden()) && /^\d+ s$/.test(await p.textContent('#bonus-time')), await p.textContent('#bonus-time'));
    const left0 = s.game.bonusItem.ticksLeft;
    await p.keyboard.press(' '); await sleep(700);
    s = await st(p); ok('the bonus timer is frozen while paused', s.mode === 'paused' && s.game.bonusItem.ticksLeft <= left0 && s.game.bonusItem.ticksLeft >= left0 - 2, `${left0} -> ${s.game.bonusItem.ticksLeft}`);
    const frozen = s.game.bonusItem.ticksLeft; await sleep(600);
    ok('and stays frozen', (await st(p)).game.bonusItem.ticksLeft === frozen);
    await p.keyboard.press('p');
    const len0 = s.game.snake.length, lives0 = s.game.lives;
    const t1 = Date.now();
    while ((await st(p)).game.bonusItem && (await st(p)).mode !== 'over' && Date.now() - t1 < 15000) { s = await st(p); if (s.game.bonusItem) await steer(s.game.bonusItem, s); await sleep(40); }
    s = await st(p);
    ok('eating the bonus: +5 points, no growth, lives unchanged', s.game.score >= 6 && s.game.snake.length <= len0 + 1 && s.game.lives === lives0 && s.mode !== 'over', `score=${s.game.score} len=${s.game.snake.length}/${len0}`);
    await sleep(100);
    ok('timer hides after the bonus is gone', await p.locator('#bonus-item').isHidden() || !!(await st(p)).game.bonusItem);
    ok('bonus: no errors', errs.length === 0, errs.join('|'));
    await ctx.close();
  }
  {
    // expiry without penalty (assist mode keeps the run alive while we wait)
    const { ctx, p } = await open(browser, { speed: 'fast', rules: { lives: 'unlimited' }, query: '&seed=11&bonusEvery=1&bonusTicks=8' });
    await p.click('#btn-new');
    const key = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
    const opp = { up: 'down', down: 'up', left: 'right', right: 'left' };
    let s = await st(p); const t0 = Date.now();
    while (!s.game.bonusItem && Date.now() - t0 < 30000) {
      const h = s.game.snake[0], f = s.game.food;
      let want = f.x > h.x ? 'right' : f.x < h.x ? 'left' : f.y > h.y ? 'down' : 'up';
      if (want === opp[s.game.dir]) want = h.y < s.game.rows - 1 ? 'down' : 'up';
      if (want !== s.game.dir || s.mode === 'ready') await p.keyboard.press(key[want]);
      await sleep(40); s = await st(p);
    }
    const score = s.game.score;
    // time only passes while the snake is moving, so keep it moving through any assist restarts
    const t2 = Date.now();
    while ((await st(p)).game.bonusItem && Date.now() - t2 < 20000) {
      if ((await st(p)).mode === 'ready') await p.keyboard.press('ArrowUp');
      await sleep(40);
    }
    s = await st(p);
    ok('the bonus ran out', !s.game.bonusItem);
    const eaten = s.game.score !== score;
    ok('the bonus disappears after its time; a miss changes nothing (an eaten one adds 5)', eaten ? s.game.score === score + 5 : s.game.score === score, `score ${score}->${s.game.score}`);
    ok('the timer hides when the bonus is gone', await p.locator('#bonus-item').isHidden());
    await ctx.close();
  }

  // ---- touch with maze + wrap ----
  {
    const { ctx, p, errs } = await open(browser, { speed: 'fast', rules: { board: 'pillars', edges: 'wrap', lives: 'extra' }, viewport: { width: 390, height: 844 }, touch: true, query: '&seed=3' });
    const tap = async (sel) => { const b = await p.locator(sel).boundingBox(); await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); };
    await tap('#btn-new'); await tap('.dpad .up');
    let s = await st(p); ok('touch: D-pad starts a maze run with wrap and extra lives', s.mode === 'running' && s.game.board === 'pillars' && s.game.wrap && s.game.lives === 3);
    await tap('#btn-pause'); await tap('#btn-continue'); s = await st(p); ok('touch: pause and continue still work', s.mode === 'running');
    ok('touch: rules summary fits and Lives shows', (await p.textContent('#rules-line')).includes('pillars maze') && (await p.textContent('#lives')) === '3');
    ok('touch: no horizontal overflow', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await p.screenshot({ path: process.argv[2] + '/rules-touch-390x844.png' });
    ok('no errors (touch)', errs.length === 0, errs.join('|'));
    await ctx.close();
  }

  await browser.close();
  const failed = R.filter(r => !r.pass);
  R.forEach(r => console.log((r.pass ? 'PASS ' : 'FAIL ') + r.name + (r.extra && !r.pass ? '  [' + r.extra + ']' : '')));
  console.log(`\n${R.length - failed.length}/${R.length} passed`);
})();
