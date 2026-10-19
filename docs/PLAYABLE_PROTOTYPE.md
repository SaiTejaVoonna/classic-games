# Playable prototype (early, provisional rules)

Status: implemented by Claude Code on the owner-authorized "playable game" request. **Not independently accepted**; Codex review pending. The game is labelled "Early prototype" in the UI.

**Fidelity statement.** Nothing in this prototype is claimed to match any original game. Every rule and number below is a *development assumption* chosen so the game is playable. None is historically verified, and none may be marked verified without evidence (`docs/NOKIA_REFERENCE.md`, unresolved items U01–U12 still apply).

## Evidence revisit
The primary sources listed in `docs/NOKIA_REFERENCE.md` (S1 manual, S2 related-model manual) could not be re-fetched from this container: the hosts did not resolve (DNS failure), so nothing new was verified in this pass. No historical constants were taken from memory, clones or recollection. Consequently speed levels, mazes, bonus food, original scoring, wrap/wall rules and turn-buffer behaviour remain **unavailable** (the Level and Maze selectors stay disabled).

## Scope
- `src/engine.js`: deterministic, pure simulation (state in, next state and events out). No DOM, storage, sound or wall clock. Seeded RNG.
- `src/storage.js`: failure-tolerant best-score store (injectable storage).
- `src/main.js`: wiring, canvas rendering, frame loop, input, dialogs, themes.
- `index.html`, `styles.css`: existing UI, updated for gameplay. Codex's wording change (`2bb935f`, generic "Inspired by classic mobile games." tagline and footer) is preserved.
- `tests/engine.test.js`, `tests/storage.test.js`: Node built-in test runner. `tests/browser/play.js`, `tests/browser/sweep.js`: browser checks (need an existing Playwright install; not a project dependency).

Controls: arrow keys or WASD while the board has focus; Space or P pauses/resumes (board focus only); D-pad buttons on touch. New game and Continue move focus to the board. Three themes (Colour, LCD, Night) unchanged; themes never touch the engine.

## Development assumptions (for owner review)
| ID | Choice | Where |
| --- | --- | --- |
| A1 | Board 21×14 cells (3:2). Carried over from the UI mock; not historical (U01). | `DEFAULTS` |
| A2 | Start length 3, heading right, fixed start cell (head at x=7, middle row) (U03). | `createGame` |
| A3 | One fixed speed: 150 ms per tick. No levels, no acceleration (U02). | `DEFAULTS.tickMs` |
| A4 | Turn queue depth 2. A repeat or reversal of the most recent queued/current direction is ignored; extra inputs are dropped (U04). | `turn` |
| A5 | At most 2 ticks per rendered frame; long gaps are clamped, not replayed. | `advanceClock` |
| A6 | See A2 (start cell). | |
| A7 | The run starts on the first accepted direction input after New game; before that nothing moves. A reversal of the initial heading does not start it (U03). | `turn` |
| A8 | Walls are lethal; no wrap (U05). | `step` |
| A9 | The cell the tail is vacating this tick is free when not eating; moving into it while eating is a collision (U09). | `step` |
| A10 | +1 point and +1 segment per food, applied immediately (U07). Food is placed uniformly on cells not occupied by the snake. | `step`, `placeFood` |
| A11 | A full board ends the run as "Board full" (U10). | `step` |
| A12 | Browser adaptation: the run auto-pauses when the tab is hidden or when an Instructions/Top score/Settings panel opens; resuming is always explicit and never replays elapsed time. The spec lists auto-pause as proposed, not approved. | `main.js` |
| A13 | "Continue" resumes a paused in-memory run only; nothing persists across reload. | `main.js` |
| A14 | New game during a running or paused run asks for confirmation. | `main.js` |
| A15 | Best score is one value for this provisional ruleset, stored under key `classic-games.best.prototype-v1` as `{v:1,best:n}`, written at game over. Not grouped by level or maze because none exist. If storage fails it is kept for the session and labelled "(this session)". | `storage.js` |
| A16 | WASD and Space/P keys are proposed alternatives from the interface spec and not approved; Escape is unused. | `main.js` |

Not implemented: levels, mazes, bonus creatures/food, sound, vibration, swipe input, persistence of an in-progress run.

## Test hooks
`?seed=<int>` fixes the RNG seed; `?debug=1` exposes a read-only snapshot at `window.classicGamesDebug.state()`. Both are used by the browser checks only.

## Run and test
Open `index.html` in a browser (works from `file://`; scripts are plain deferred scripts, not modules), or serve the folder with any static server.

- Unit tests: `node --test tests/engine.test.js tests/storage.test.js` (no install).
- Browser checks (Playwright and Chromium preinstalled in the cloud container): `NODE_PATH=<playwright dir> node tests/browser/play.js <outdir>` and `... sweep.js <outdir>`.

## Results (this container, final source)
| Check | Result |
| --- | --- |
| `node --check` on `src/*.js`, ESLint (temporary config outside repo: `no-undef`, `no-unused-vars`, `eqeqeq`) | pass |
| Engine tests (21): determinism and seed replay; no movement before first input; start/reversal; one cell per tick; queue depth, ordering and reversal; food respawn off the body (300 seeds + single-free-cell case); growth and score; each wall; self collision; tail-vacating allowed / blocked while eating; frozen after game over; board-full win; no input mutation; clock clamping and tick count across 30/60/144 Hz | 21/21 pass |
| Storage tests (7): persist increases only, load, corrupt/invalid values, throwing reads and writes, quota error, null storage, non-numeric scores | 7/7 pass |
| Browser `play.js` (49 checks, Chromium, `file://`; 6 consecutive runs all 49/49): menu/ready/running flow; real key presses with no board click (ArrowLeft ignored, ArrowUp starts, WASD, Space and P pause/resume, P on a non-board button ignored); movement over time; frozen while paused/over; hidden-tab auto-pause and no auto-resume; no catch-up burst after resume; confirm dialog cancel/confirm and focus; wall game-over text; a key-driven bot eating food (score, length = 3 + score, DOM score); best stored, shown, survives reload, shown in Top score; throwing storage and corrupt stored value; touch taps on New game, D-pad, Pause, Continue; D-pad disabled outside ready/running; touch targets at least 44 px | 49/49 pass |
| Responsive sweep (`sweep.js`): 320×568, 390×844, 768×1024, 1366×768, 1440×900 × Colour/LCD/Night, menu and paused-mid-run states | no console errors, no horizontal overflow, all enabled buttons at least 44×44, no header/score overlap |
| 390×844 fit | board and D-pad inside the viewport (D-pad bottom 772 of 844) |
| 1366×768, 1440×900 | no page scroll |
| Contrast (computed from theme variables, all themes; text 4.5:1, non-text 3:1) | 0 failures; unchanged palette |
| Size: HTML+CSS+JS gzip (5 files) | about 12.2 KB (35.7 KB raw) |

## Limits
- Chromium only. Safari, Firefox, real phones, screen readers and real device touch/haptics were **not** tested. "Touch" tests use Playwright's touch emulation.
- Timing was checked by tick counts against elapsed time, not by perceived latency on a real device.
- At 320×568 and 768×1024 the page scrolls vertically and the D-pad is below the fold at 320×568 (unchanged from the UI prototype).
- No test of audio/haptics (not implemented), resize during play, or orientation change beyond layout sweeps.
- Game feel, speed and difficulty are untuned development guesses.
- `docs/UI_PROTOTYPE.md` and the older screenshots describe the earlier non-playable preview; `docs/screenshots/playable-*.png` show the playable build (paused mid-run).

## Decisions needed from the owner
1. Accept, change or reject the provisional rules A1–A16, knowing they are not historical.
2. Which reference handset/firmware to verify against, and how evidence will be gathered (U01–U12), before any rule is called faithful.
3. Whether auto-pause (A12), session-only Continue (A13) and the extra key mappings (A16) are approved.

## Link status (GitHack)
The repository is private. GitHack cannot fetch private repositories, so no testing link is live. A link would take the form `https://raw.githack.com/SaiTejaVoonna/classic-games/<commit-sha>/index.html`, pinned to a reviewed commit, and must be verified before being shared. The `preview/ui-prototype` branch was not updated by this change.
