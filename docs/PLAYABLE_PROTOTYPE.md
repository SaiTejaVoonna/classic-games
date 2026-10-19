# Playable prototype (Classic Games prototype choices)

Status: implemented by Claude Code on the owner authorized requests. **Not independently accepted**; Codex review pending. The page shows one About note in Instructions ("An early version of Classic Games. Gameplay may differ from the originals."). The full rule details live here, not in the interface.

**Fidelity statement.** Nothing in this prototype is claimed to match any original game. Every rule and number below is a *Classic Games prototype choice* made so the game is playable and varied. None is historically verified, and none may be marked verified without evidence (`docs/NOKIA_REFERENCE.md`, unresolved items U01 to U12).

## Evidence revisit
The primary sources in `docs/NOKIA_REFERENCE.md` (S1 manual, S2 related model manual, S3 replica article) could not be re-fetched from this container (the hosts did not resolve), so nothing new was verified. No historical constants were taken from memory, clones or recollection. The classification below restates only what `docs/NOKIA_REFERENCE.md` already records.

| Feature in this prototype | Evidence status (from `docs/NOKIA_REFERENCE.md`) | What the prototype does |
| --- | --- | --- |
| New game, Continue, Level, Top score, Instructions | Verified for the 3310 (S1). | New game, Continue, Top score and Instructions exist. Level is replaced by browser speed settings. |
| Speed levels | A Level function is verified (S1). Number of levels and exact timing are unknown (U02). | Slow, Medium and Fast are comfort settings of 300, 220 and 150 ms. They are not original level values. |
| Food, growth, death on own body, keys 2/4/6/8 | Corroborated by the 3395 manual (S2), not verified for the 3310 (U04, U07, U09). | Food grows the snake by one. Arrow keys and WASD are modern browser controls. |
| Clear field and mazes | Corroborated by the 3395 manual: clear field plus five mazes (S2). The 3310 count, layouts and menu location are unknown (U06). | A clear field and three original prototype layouts (Pillars, Gate, Frame). They are not copies of any original map. |
| Wraparound and wall rules | Unknown for the target (U05). | Solid walls by default. Edge wrap is an optional Classic Games rule. |
| Temporary bonus creature or item | A replica article describes temporary bonus creatures (S3, replica corroboration). Trigger, duration, formula and growth are unknown (U08). | An optional timed bonus that gives extra points only. All numbers are prototype choices. |
| Score values | Unknown (U07). | +1 per food, +5 per bonus (prototype choices). |
| Lives | Not described in the sources. | Classic is one life. Extra lives and Unlimited are optional modern style assists, not original rules. |
| Themes, rounded snake art, swipe ideas | Presentation only. | Three themes. The snake is drawn as a connected rounded body. |

Google Snake style modes are not used as evidence for any Nokia behavior. Their ideas (for example variants of walls or extra modes) appear here only as clearly labelled optional prototype settings.

## Scope
- `src/engine.js`: deterministic, pure simulation (state in, next state and events out). No DOM, storage, sound or wall clock. Seeded RNG. Edge wrap, maze blocks, lives modes and the bonus item live here and are covered by tests.
- `src/render.js`: Canvas drawing of the board, maze blocks, fruit, bonus item and snake. Geometry is computed separately from drawing so it can be tested without a browser.
- `src/storage.js`: failure tolerant stores for best scores (per rules setup), the speed choice and the rules choices.
- `src/main.js`: wiring, frame loop, input, dialogs, settings, themes.
- `index.html`, `styles.css`: existing site structure, menus and layout. Codex's wording (`2bb935f`) and the earlier copy cleanup are preserved. The mock icon navigation in the concept image was not adopted.
- `tests/*.test.js` (Node built-in runner) and `tests/browser/*.js` (Playwright checks; need an existing Playwright install, not a project dependency).

Controls are unchanged: arrow keys or WASD while the board has focus, Space or P to pause and resume, D-pad buttons on touch, New game and Continue focus the board. Swipe input is not part of this change.

## Prototype choices (for owner review)
| ID | Choice |
| --- | --- |
| A1 | Board 21×14 cells (3:2), carried over from the UI mock. Not historical (U01). |
| A2 | Start length 3, heading right, fixed start cell (head at x=7, middle row) (U03). |
| A3 | Superseded by A17. Still no original levels and no acceleration (U02). |
| A4 | Turn queue depth 2. A repeat or reversal of the most recent queued or current direction is ignored; extra inputs are dropped (U04). |
| A5 | At most 2 ticks per rendered frame; long gaps are clamped, not replayed. |
| A7 | The run starts on the first accepted direction input. A reversal of the initial heading does not start it (U03). |
| A8 | Walls are lethal by default (no wrap) (U05). See A20 for the wrap option. |
| A9 | The cell the tail is vacating this tick is free when not growing. Moving into it while growing is a collision (U09). |
| A10 | +1 point and +1 segment per food, applied immediately (U07). Food is placed uniformly on free cells (not on the snake, a maze block or the bonus item). |
| A11 | A full board ends the run as "Board full" (U10). |
| A12 | Browser adaptation: the run auto-pauses when the tab is hidden or a panel (Instructions, Top score, Settings) opens. Resuming is explicit and never replays elapsed time. |
| A13 | Continue resumes a paused in-memory run only. Nothing persists across reload. |
| A14 | New game during a running or paused run asks for confirmation. |
| A16 | WASD and Space/P are proposed alternatives from the interface spec and are not approved. |
| A17 | **Speed settings** (Settings → Speed): Slow 300 ms (default), Medium 220 ms, Fast 150 ms per tick. Comfort choices from owner testing, not original level values. Stored under `classic-games.speed`; unknown stored values fall back to Slow; explicit choices are kept. The Settings copy says: "Speed choices are comfort settings, not original game levels." |
| A18 | A change to speed or any rule below **applies to the next New game**. A run records its settings at creation, so a run in progress keeps them and the Settings note says so. With no run started (menu or a fresh ready state) the pending game adopts the change at once. |
| A20 | **Edge wrap** (Settings → Edges): Solid walls (default) or Wrap around. With wrap, leaving one edge re-enters at the opposite edge in the same row or column. Maze blocks stay solid. A dashed inner edge is drawn while wrap is on, and the rules line shows "wrap around edges". |
| A21 | **Board** (Settings → Board): Clear field (default) or one of three prototype mazes made of solid grid aligned squares: Pillars (four 2×2 blocks), Gate (a wall at x=10 with a gap on rows 5 to 8), Frame (two horizontal bars). The start cells and the start row up to x=14 stay clear. Tests check that every free cell is reachable and that food and bonus never land on a block. Hitting a block is a collision with reason `obstacle`. |
| A22 | **Lives** (Settings → Lives): Classic one life (default); Extra lives, three lives in total; Unlimited, an optional assist that is off by default and labelled "assist mode". A collision costs a life. After a lost life, or any collision in Unlimited, the snake restarts at the start cells with the start length, the score is kept, food or bonus on the restart cells is moved or cleared, and the game waits for a direction. The last life, or any collision in Classic, ends the run. Lives are never added during a run. The Lives readout and the rules line ("Assist: unlimited lives") stay visible during play. |
| A23 | **Bonus food** (Settings → Bonus food: On by default). After every 5th regular food a bonus appears on a free cell for 24 ticks (about 7.2 s at Slow, 5.3 s at Medium, 3.6 s at Fast). It is worth 5 points and does not grow the snake. It is not a life, shield or invincibility. Missing it costs nothing. Only one is active at a time. Its timer runs only while the snake is moving (it is frozen while paused or waiting after a lost life) and is shown as a ring around the item and as seconds next to the Lives readout. `bonusEvery`, `bonusTicks`, `bonusPoints` and `bonusGrows` are engine options with tests. |
| A24 | **Best scores are kept per rules setup**: key `speed|lives|board|walls or wrap|bonus or nobonus` under `classic-games.best.prototype-v3`. Older data (v1 one value; v2 one value per speed) is migrated to the setup it was recorded under (classic lives, clear field, solid walls, no bonus; v1 as Fast). Older keys are never rewritten or deleted. Top score lists up to eight setups. |
| A25 | Board, edges, lives and bonus choices are stored under `classic-games.rules`. Nothing is written until the user changes one; invalid fields fall back individually. |
| A26 | **Visuals.** The snake is one rounded body that follows the grid path, with a tapered tail (tip about 0.2 cell half width, full width 0.42 over the last 5 cells), a larger head and two small eyes at the front that follow the current direction. A soft shadow and one continuous highlight add subtle depth. Fruit is a round shape, bonus food a diamond with a timer ring, so shape differs as well as colour. Themes only change colours: Colour (warm neutral, green, amber), LCD (monochrome) and Night (dark navy, mint snake, the modern arcade direction). No scenery, rocks or stars. |

Not implemented: original levels, bonus creatures, sound, vibration, swipe steering, persistence of an in progress run, icon navigation. Unlimited and Extra lives are assists and are never described as original rules.

## Test hooks
`?seed=<int>` fixes the RNG seed. `?debug=1` exposes a read only snapshot at `window.classicGamesDebug.state()` and allows `bonusEvery`, `bonusTicks`, `bonusPoints` and `bonusGrows=1` query values. They are used by the browser checks only.

## Run and test
Open `index.html` in a browser (works from `file://`; scripts are plain deferred scripts, not modules), or serve the folder with any static server.

- Unit tests: `node --test tests/*.test.js` (no install).
- Browser checks (Playwright and Chromium preinstalled in the cloud container): `NODE_PATH=<playwright dir> node tests/browser/<name>.js <outdir>` for `play`, `rules`, `rendering` and `sweep`.

## Results (this container, final source of this revision)
| Check | Result |
| --- | --- |
| `node --check` on `src/*.js`; ESLint on `src` and `tests/*.js` (temporary config outside the repo: `no-undef`, `no-unused-vars`, `eqeqeq`) | pass |
| Unit tests, `node --test tests/*.test.js` | 115/115 pass |
| - engine (66): earlier simulation tests plus edge wrap on all four edges, wrap with food, self collision across the edge, maze layout validity (inside the board, start clear, every free cell reachable, no duplicates), food never on a block, obstacle collision, passable gate, wrap with mazes, unknown board names, lives table, classic/extra/unlimited collisions, score kept, restart rules, no instant repeat crash, respawn safety for food and bonus, lives never changing movement, profile keys, bonus schedule, full timer of 24 ticks, countdown and expiry without penalty, points and growth configuration, tail rule with growing bonus, one active bonus, bonus off, determinism, frozen timer, no free cell | pass |
| - storage (22): per setup best scores (unlike runs never share), entries, v3 load, v2 and v1 migration with the old keys untouched, highest wins, corrupt and foreign keys, throwing, quota and null storage, speed preference, rules preference (defaults, Unlimited off by default, persistence, per field fallback, copies) | pass |
| - render (17): body radius taper, straight path, bends, wrap stubs (all four edges), head and eyes for all four directions, eye geometry, purity, scaling, draw order, subtle shadow and highlight, food/obstacle/wrap edge only when present, bonus ring sweep, linear cost | pass |
| - copy (10): wording, no dashes, one About note, no unimplemented controls, settings groups and defaults, Unlimited labelled as an assist, instructions explain bonus, wrap, mazes and lives | pass |
| Browser `play.js` (115 checks) | pass |
| Browser `rules.js` (41 checks): defaults and rules summary before a run, persistence and reload, invalid saved values, changes apply to the next New game, wrap on and off, maze collision, extra lives (status text, HUD, three crashes), Unlimited assist labelling and endless play, bonus appearance, visible timer, freeze while paused, +5 points without growth, expiry without penalty, touch with maze plus wrap | pass |
| Browser `rendering.js` (58 checks, all three themes plus a 2x retina case): pixel probes of the real canvas show no gaps along straight paths, bends or live gameplay frames, a rounded outer corner on bends, a tapered tail, a distinct head and two eyes at the front for all four directions, solid maze blocks, round fruit, diamond bonus with a ring that shrinks, and wrap stubs at both edges. Contrast of snake, head, fruit, bonus and blocks against the board is at least 3:1 | pass |
| Responsive sweep: 320×568, 390×844, 768×1024, 1366×768, 1440×900 × three themes | no console errors, no horizontal overflow, enabled buttons at least 44×44 |
| 390×844 fit | board and D-pad inside the viewport (D-pad bottom 671 of 844) |
| 1366×768, 1440×900 | no page scroll |
| Contrast from theme variables (text 4.5:1, non text 3:1, including new snake, eye, bonus and block pairs) | 0 failures |
| Size: HTML+CSS+JS gzip (6 files) | about 20.6 KB |

## Limits
- Chromium only. Safari, Firefox, real phones, screen readers and real device touch were **not** tested. "Touch" tests use Playwright's touch emulation.
- Timing is checked by tick counts against elapsed time, not by perceived latency on a real device.
- At 320×568 the D-pad ends at 651 px on a 568 px viewport, so it is slightly below the fold. The Settings dialog is long and scrolls on small screens.
- After a lost life the snake restarts at the start length (a length reset is part of A22). Whether that suits the owner is a design question.
- Bonus timing is counted in ticks, so its length in seconds depends on the speed (A23).
- Game feel, difficulty, maze difficulty and the lives numbers are untuned guesses.
- `docs/UI_PROTOTYPE.md` and older screenshots describe the earlier non playable preview.

## Decisions needed from the owner
1. Accept, change or reject the prototype choices above (A1 to A26), knowing none is historical.
2. Whether bonus food should default to On, and whether the bonus length should be in seconds rather than ticks.
3. Whether a lost life should keep the snake length instead of resetting it.
4. Which reference handset and firmware to verify against, and how evidence will be gathered (U01 to U12), before any rule is called faithful.
5. Whether auto-pause (A12), session only Continue (A13) and the extra key mappings (A16) are approved.

## Link status (GitHack)
The repository is public (verified by Codex). Links take the form `https://raw.githack.com/SaiTejaVoonna/classic-games/<commit-sha>/index.html`, pinned to a commit. The report for each commit gives the current link and says whether it was verified. The `preview/ui-prototype` branch is not updated by this work.
