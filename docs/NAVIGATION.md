# Navigation, look and saved games

## Screens
- **Games** (home): the top card is the game you played last if it has something to continue (Resume and New run or New game); otherwise Racer is featured with a plain Play. Below it, a tile for each game (a small chip shows when the other game also has something saved) and an Awards strip.
- **Awards, Scores, Settings:** bottom tabs on the Games screen. They are views of one page (`#awards`, `#scores`, `#settings`), so the browser's back button works.
- **Inside a game:** Snake has a Games button at the top left of its bar. Racer shows a Games button on its start and end screens. Both pause menus end with Exit to Games.
- Layout reserves room under the controls for the phone's own browser bar.

## One look
- Appearance (Dark, Light or Auto) is one app-wide setting, stored under `classic-games.launcher`. **Dark is the default.**
- Snake follows it (Dark is its night look, Light is its colour look). A look chosen inside Snake (Colour, LCD or Night) wins until the Appearance is changed on the Settings tab, which hands control back to the app.
- Racer is always dark. Chrome is neutral (near-black, warm white buttons); green belongs to Snake's board and snake only.

## Continue and New
| Link | What it does |
|---|---|
| `racer/?resume=1` | Racer start screen says Welcome back, with Continue ready (checkpoint from the last rest stop) |
| `racer/?new=1` | Racer start screen without the old checkpoint |
| `snake/?resume=1` | Snake brings back the saved board, paused, with Welcome back |
| `snake/?new=1` | Snake starts a new game at once (waits for a swipe) and clears the save |

## What is saved (local only)
- Racer: `classic-games.racer.checkpoint` at each rest stop (chapter, hearts, score, `at` time). Damaged values fall back to safe ones.
- Snake: `classic-games.snake.save`, written when a run is paused or the page is left. It holds the exact board and is only used if `SnakeEngine.restore` accepts it. Cleared when a run ends or a New game starts.
- The Games screen decides which game is on top from the `at` time of each save.

## Tests
`tests/browser/app.js` (launcher and Racer), `tests/browser/site.js` (Snake look, exits and saved game), `tests/engine.test.js` (snapshot and restore).
