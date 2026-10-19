# Playable prototype (early, provisional rules)

Status: implemented by Claude Code on the owner-authorized "playable game" request. **Not independently accepted**; Codex review pending. The page shows a single About note in Instructions ("An early version of Classic Games. Gameplay may differ from the originals."); the full provisional-rule details live here, not in the interface.

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
| A3 | Superseded by A17: the first build used one fixed 150 ms tick, which owner testing found too fast. Still no levels and no acceleration (U02). | `SPEEDS` |
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
| A15 | Superseded by A19. The first build stored one best value under `classic-games.best.prototype-v1`; that data is preserved and migrated. If storage fails the best is kept for the session and labelled. | `storage.js` |
| A16 | WASD and Space/P keys are proposed alternatives from the interface spec and not approved; Escape is unused. | `main.js` |
| A17 | **Prototype speed settings** (Settings → Speed): Slow 300 ms, Medium 220 ms, Fast 150 ms per tick. **Slow 300 ms is the default** when no valid saved choice exists (the first speed build wrongly defaulted to Medium). These are comfort choices from owner testing, not the original game's levels and not verified (U02). The Level selector stays disabled and unavailable. The choice is stored under `classic-games.speed`; unknown stored values fall back to Slow; explicitly saved choices are kept, and if storage fails the choice lasts for the session and the dialog says "Not saved on this device". | `SPEEDS`, `storage.js`, `main.js` |
| A18 | A speed change **applies to the next New game**. A run records its `speed` and `tickMs` at creation, so a run in progress (running or paused) keeps its timing; the Settings note says so. When no run has started (menu or ready) the pending game adopts the new speed immediately. The HUD shows the speed of the run on screen. | `createGame`, `main.js` |
| A19 | **Best scores are kept per prototype speed**: `classic-games.best.prototype-v2` = `{v:2,best:{slow,medium,fast}}`. Existing v1 data (`classic-games.best.prototype-v1`, one value recorded at the old fixed 150 ms) is migrated by reading it as the **Fast** best (the same 150 ms); the v1 key is never rewritten or deleted. Top score lists the three speeds separately. | `storage.js` |

Not implemented and **not shown in the interface**: original levels, mazes, bonus creatures/food, sound, vibration, swipe input, persistence of an in-progress run.

## Test hooks
`?seed=<int>` fixes the RNG seed; `?debug=1` exposes a read-only snapshot at `window.classicGamesDebug.state()`. Both are used by the browser checks only.

## Run and test
Open `index.html` in a browser (works from `file://`; scripts are plain deferred scripts, not modules), or serve the folder with any static server.

- Unit tests: `node --test tests/engine.test.js tests/storage.test.js` (no install).
- Browser checks (Playwright and Chromium preinstalled in the cloud container): `NODE_PATH=<playwright dir> node tests/browser/play.js <outdir>` and `... sweep.js <outdir>`.

## Results (this container, final source of this revision)
| Check | Result |
| --- | --- |
| `node --check` on `src/*.js`; ESLint on `src` and `tests/*.js` (temporary config outside the repo: `no-undef`, `no-unused-vars`, `eqeqeq`) | pass |
| Unit tests, `node --test tests/engine.test.js tests/storage.test.js tests/copy.test.js` | 50/50 pass |
| Engine tests (29): determinism and seed replay; no movement before first input; start/reversal; one cell per tick; queue depth, ordering and reversal; food respawn off the body; growth and score; each wall; self collision; tail rule; frozen after game over; board-full win; no input mutation; clock clamping and tick counts across 30/60/144 Hz. Speed tests: exact table 300/220/150 with Medium default; a run records `speed` and `tickMs` at creation; unknown or inherited keys (`constructor`, `__proto__`, numbers) fall back to Medium; speed changes tick length only, not the simulation; a run keeps its timing through `step`; 30 s at 60 Hz yields 100/136/200 ticks; the catch-up clamp holds at every speed; Settings markup lists exactly the engine's speeds and "Applies to new games" | pass |
| Copy tests (6, `tests/copy.test.js`): title, heading, tagline and footer wording; no em or en dashes in the markup or in `main.js` code; no badge or board disclaimer and exactly one About note, inside Instructions; no Level, Maze, Sound, Vibration, "unavailable" or "why disabled" text; score copy uses 0 or "No score yet."; Slow is the default in markup | pass |
| Storage tests (15): per-speed best (increase only, no sharing between speeds); v2 load; **legacy v1 best migrates to Fast only and the v1 key is never rewritten**; higher of v1/v2 wins; corrupt/invalid fields ignored per field; corrupt v2 does not block v1 migration; throwing, quota-failing and null storage; inherited keys; speed preference default, validation, persistence, throwing/null storage | pass |
| Browser `tests/browser/play.js` (114 checks, Chromium, `file://`; 5 consecutive runs all 114/114) | pass |
| - copy checks in the page: title `Snake | Classic Games`, heading, tagline, footer; no em or en dashes in any visible text including every dialog; no badge or board disclaimer; one About note inside Instructions; no Level, Maze, Sound or Vibration controls; game-over text is `Game over. Score N.`; Top score shows `No score yet.` for a fresh profile | pass |
| - existing flow checks: keyboard with no board click, WASD, Space/P, hidden tab, no catch-up, confirm dialog, game over, bot scoring, storage failures, touch taps, 44 px targets | pass |
| - speed checks: Slow default at 300 ms with nothing written to storage until the user chooses; Settings list 300/220/150 with "Applies to new games."; keyboard ArrowDown moves the radio; choice saved under `classic-games.speed` and survives reload; explicitly saved Slow, Medium and Fast are each kept on load; measured ticks in real time: Slow about 5 per 1.5 s, a run switched to Fast in Settings keeps ticking at 300 ms, next New game 150 ms about 10 per 1.5 s; opening Settings pauses; note "This run keeps Slow. Fast starts with your next new game."; pause/resume intact | pass |
| - best by speed: bot score at Fast stored in v2 Fast only; Slow run shows 0; Top score lists the speeds separately; legacy v1 value 5 appears under Fast and not Slow, v1 left byte-identical | pass |
| - preference failure: throwing storage keeps the choice for the session with "Not saved on this device"; invalid stored speed falls back to Slow | pass |
| - Settings dialog at 320×568 (Colour, Night), 390×844 (LCD), 768×1024, 1366×768: dialog inside the viewport, radios and Close at least 44 px high, Close reachable (the dialog scrolls when taller than 90% of the viewport), touch tap selects Fast, no console errors | pass |
| Responsive sweep (`sweep.js`): 320×568, 390×844, 768×1024, 1366×768, 1440×900 × Colour/LCD/Night, menu and paused states | no console errors, no horizontal overflow, enabled buttons at least 44×44, no header/score overlap |
| 390×844 fit | board and D-pad inside the viewport (D-pad bottom 624 of 844, after the disabled Level and Maze controls were removed) |
| 1366×768, 1440×900 | no page scroll |
| Contrast, computed from theme variables for all themes | 0 failures; palette unchanged |
| Size: HTML+CSS+JS gzip (5 files) | about 13.1 KB |

## Limits
- Chromium only. Safari, Firefox, real phones, screen readers and real device touch/haptics were **not** tested. "Touch" tests use Playwright's touch emulation.
- Timing was checked by tick counts against elapsed time, not by perceived latency on a real device.
- At 320×568 the page scrolls vertically: the D-pad ends at 597 px on a 568 px viewport, so it is slightly below the fold.
- No test of audio/haptics (not implemented), resize during play, or orientation change beyond layout sweeps.
- Game feel, speed and difficulty are untuned development guesses.
- `docs/UI_PROTOTYPE.md` and the older screenshots describe the earlier non-playable preview; `docs/screenshots/playable-*.png` show the playable build (paused mid-run) and the Settings dialog.

## Decisions needed from the owner
1. Accept, change or reject the provisional rules A1–A19 (including the speed values and the Slow default), knowing they are not historical.
2. Which reference handset/firmware to verify against, and how evidence will be gathered (U01–U12), before any rule is called faithful.
3. Whether auto-pause (A12), session-only Continue (A13) and the extra key mappings (A16) are approved.

## Link status (GitHack)
The repository is now public (verified by Codex). Links take the form `https://raw.githack.com/SaiTejaVoonna/classic-games/<commit-sha>/index.html`, pinned to a reviewed commit and verified before being shared (the report for each commit gives the current one). The `preview/ui-prototype` branch was not updated by this change.
