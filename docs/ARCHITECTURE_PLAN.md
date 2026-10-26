# Architecture and implementation plan — proposal
Date: 2026-10-19. No application code, dependencies, build pipeline or deployment added.

## Constraints and technical direction
Use the handoff's preferred HTML, CSS, vanilla JavaScript ES modules and Canvas 2D. No framework, backend, database, paid API, remote fonts, analytics or runtime dependencies. Native browser APIs and localStorage only.
GitHub Pages is the proposed eventual static host; publishing needs separate approval. Use relative resource paths for a project subdirectory.
Aim for approximately 20–35 KB compressed initial application transfer where practical. This is a measured target, not a guarantee or permission to compromise verified mechanics.

## Proposed small module boundary
- index.html and styles.css: semantic menus/controls/status, responsive layout, themes.
- src/main.js: wiring, DOM state transitions and lifecycle.
- src/engine.js: pure integer-cell simulation; inputs/state/rules/seeded RNG in, next state/events out. No DOM, sound, storage or wall clock.
- src/rules.js: one verified handset profile with source IDs, grid, initial state, speed table, maps, growth, scoring and bonus rules. Missing facts stay unresolved rather than defaulting to generic Snake.
- src/input.js: normalize keyboard and pointer commands; engine owns acceptance/order semantics.
- src/render.js: Canvas presentation with logical coordinates and device-pixel-ratio scaling, no gameplay mutation.
- src/storage.js and src/feedback.js: small failure-tolerant adapters for versioned preferences/best scores and synthesized sound/optional vibration.
These are suggested boundaries, not an obligation to create boilerplate files before needed. No generic game framework or event-bus architecture.

## Engine contract and timing
A step takes current state, accepted commands, rules and deterministic RNG state. It advances exactly one logical tick and returns domain events. Drawing is independent.
Use requestAnimationFrame timestamps for an elapsed-time accumulator; never advance once per rendered frame. Validate tick count against elapsed time across refresh rates. MDN documents that callback frequency follows display refresh and hidden tabs may suspend callbacks ([requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)).
Handle document visibility explicitly ([Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)); proposed auto-pause resets the accumulator on explicit resume. Do not choose turn queue semantics, score order or missed-tick gameplay behavior until research/approval settles them.
Rules include topology and maze geometry. Rendering may scale/smooth cosmetic presentation, but cannot alter collision cells or tick boundaries.

## Persistence, feedback and robustness
Store schema-versioned preferences and best scores, with level/maze/profile keys subject to approval. Catch unavailable/quota/corrupt storage and retain an in-memory fallback. No online leaderboard.
Create Web Audio resources lazily after user intent; no copied recordings. Vibration is progressive enhancement because support varies ([Vibration API](https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API)).
Pause retains the in-memory run. Update: a paused run is now also saved to local storage so Continue works after leaving (see A13 in PLAYABLE_PROTOTYPE.md). No service worker/offline cache in the first milestone.

## Verification plan
- Pure engine checks using built-in Node test/assert facilities when implementation begins; no package installation required. Fixtures must derive from source-backed rules and observed traces.
- Deterministic replay tests for food/growth, reversal/queue handling, edge/maze topology, vacating-tail collision, bonus timing/reward, pause/resume and terminal states once each is verified.
- Integration/manual browser checks for input focus, touch, resize, storage failure, audio activation, visibility, theme invariance and responsive layouts.
- Measure engine correctness separately from perception/input latency. Record timing method and test device.
- Codex fetches exact reviewed SHAs and runs independent tests on an accessible checkout; Claude reports are not acceptance.
- Current limitation: Codex's local authenticated clone is unavailable; only GitHub retrieval and local content assertions were demonstrated. Resolve before claiming independent full engine/build/browser validation.
- No engine tests exist or ran in this research phase. Documentation checks validate links, completeness and preserved scope only.

## Size budget and delivery
Measure all initial HTML/CSS/JS/assets with gzip and actual network transfer after deployment is approved; report raw and compressed totals separately. A handful of unbundled small modules is acceptable; avoid adding a bundler solely to meet a speculative estimate.
Use original vector/CSS/Canvas visuals rather than shipping the generated concept PNGs.
[GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) serves static HTML/CSS/JS; it does not require a backend for this design.

## Implementation order and gates
1. Owner reviews this plan and selects exact reference handset/firmware; preserve remaining uncertainties.
2. Gather missing original-device evidence and freeze a source-backed rules matrix. No engine implementation with guessed constants.
3. Owner approves desktop/mobile layout, browser adaptations, default theme and score grouping.
4. Once authorized, Claude implements the deterministic engine in a bounded task with trace tests; Codex independently reviews and reruns them.
5. Implement minimal DOM shell/Canvas renderer and keyboard controls; validate behavior before visual polishing.
6. Add touch controls, three themes, storage and optional feedback without changing engine traces.
7. Codex performs cross-browser/mobile, responsiveness and transfer-size acceptance; owner approves release.
8. Configure deployment only on explicit release instruction. Keep future games outside initial scope.

## Repository and integration
Initial coordination PR #1 remains open. Research/planning is prepared on a separate branch based on its reviewed tip, with a stacked draft PR targeting that branch. No merge is authorized by this handoff.
Codex is the sole writer of planning changes. No additional Claude session or delegation was needed.
