# Interface specification — proposal for approval
Date: 2026-10-19. Written planning only; no UI implementation authorized.

## Product and scope
Classic Games starts with one game: Snake, inspired by the original Nokia 3310 Snake II. One primary game surface; no catalogue of unavailable games. Future Bounce and Space Impact remain outside this milestone.
The owner-supplied handoff requests Colour, LCD and Night themes, desktop keyboard/mobile touch input, optional synthesized sound and supported-device haptics. These are product requirements; historical engine behavior comes from NOKIA_REFERENCE.md.

## Information hierarchy
Header: small Classic Games wordmark; compact game/menu and Settings actions.
Game area: Snake title, current score and best score, logical playfield, pause/resume affordance.
Pre-game controls: Level, Maze when verified, New game; Continue only when a resumable run exists.
Secondary panels: Top score, Instructions and Settings. Preserve original functions without recreating the phone shell or nesting through many screens.
Do not show a working control for an unimplemented or unverified mode. No fabricated leaderboard, accounts or online services.

## Desktop proposal
At roughly 900 CSS px and above: restrained centered content, maximum width about 1100 px; small heading/score column beside the board when space permits. Controls sit beside or immediately below the board.
Board scales with viewport height and width, retaining its verified logical aspect ratio. Never stretch it to match the generated square mockup. No page scroll required for core controls on a typical 1366×768 viewport when feasible; compact layout takes priority over decorative whitespace.
Use keyboard arrows; WASD and numeric 2/4/6/8 are proposed alternative mappings pending owner approval and original-control verification. Visible Pause button; Escape/P proposed pause shortcuts, never global interception inside form fields.
Focus moves deliberately into the game after explicit start. Prevent browser scrolling only for active game controls while the game surface has focus.

## Mobile proposal
Single column at 320–430 CSS px widths: compact header, score row, board, compact actions, then D-pad. Respect safe-area insets.
Four clearly labeled directional touch buttons, minimum 44×44 CSS px with generous gaps; no requirement to swipe. Swipes are optional pending testing/approval, not the only input.
Fit the board and D-pad in a typical 390×844 portrait viewport; calculate board size from available space and true aspect ratio. Landscape uses a side-control layout when necessary. Avoid an extremely tall page like the generated concept.
Reserve touch-action behavior for the board/control region rather than disabling document scrolling everywhere. Touch buttons and keyboard use the same engine command path.

## State and interaction proposal
States: menu → ready → running → paused → game over, with settings/instructions panels outside engine logic.
New game during a resumable run asks before discarding it. Level/maze edits apply to the next run; exact original semantics remain U11 and cannot be silently substituted.
Continue preserves the current run; cross-reload persistence is not implied. Recommend session-only Continue initially and localStorage for preferences/best scores only, pending approval.
Auto-pause on hidden tab/focus loss is a proposed browser adaptation. Resume requires explicit intent; no background catch-up burst.
Pause freezes score, movement and gameplay bonus time; exact historical bonus timing remains a research gate. Settings, rendering, sounds and themes never change simulation results.

## Visual system proposal
- Colour: warm neutral surface, dark ink text, restrained green snake and amber food.
- LCD: high-contrast monochrome green palette, modern readable text; no mandatory pixel font or physical handset frame.
- Night: near-black background, soft mint snake and warm food accent.
- Use system fonts, CSS properties, simple original geometric artwork, thin dividers, modest corner radii. No downloaded fonts, big raster hero images or decorative animation.
- Distinguish food and obstacles with shape/contrast as well as hue. Keep text contrast at least 4.5:1, visible focus, reduced-motion support and accessible names.
- Announce game status and final score through DOM text; avoid a live-region announcement every movement tick. Menus and controls remain semantic HTML. Canvas-only gameplay is not a claim of full nonvisual playability.
- Sound starts only after a user gesture, can be muted, and uses original synthesized tones. Haptics are optional and feature-detected; unavailable devices still work.
- Generated concepts are discussion references only, not approved production designs or engine specifications. No images have been supplied to Claude.

## Acceptance checklist after implementation is authorized
Check 320×568, 390×844, 768×1024, 1366×768 and 1440×900; no horizontal overflow, readable scores, reachable touch targets, aspect preserved, usable keyboard focus.
Compare identical seeded simulation traces across all themes and input sources.
Exercise ready/pause/continue/game-over, settings open/close, accidental restart, resize/orientation change, hidden-tab resume, disabled storage and unsupported audio/haptics.
Validate on real mobile Safari and Chrome in addition to desktop Chromium; document any inaccessible testing environment.

## Owner decisions
1. Approve this layout and palette direction, or choose revisions; generated concepts alone are not approval.
2. Approve D-pad first, optional swipe later, and proposed keyboard/pause shortcuts.
3. Approve session-only Continue plus automatic pause as explicit browser adaptations.
4. Choose default theme; recommend Colour, with all three available in Settings.
5. Approve best-score grouping by verified level and maze (recommended) rather than comparing incompatible difficulties.
