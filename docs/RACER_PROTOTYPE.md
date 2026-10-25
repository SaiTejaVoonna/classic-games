# Racer prototype (Classic Games prototype choices)

An early playable road game in `racer/`. Open `racer/index.html`; it needs no build step and no dependencies. It has its own sound file, `racer/audio.js`.

The original phone racing game is not verified here, so every rule below is a Classic Games prototype choice, not a claim about the original.

| # | Choice |
|---|---|
| R1 | Three lanes. One swipe, tap on a side, or arrow key changes lane by one. A long drag chains lane changes. |
| R2 | Traffic drives the same way, slower than you. Hitting a car ends the run. There are no lives. |
| R3 | Speed rises from 44 to 92 (metres per second in game units) over the first 8,000 metres. |
| R4 | Score is distance plus near-miss bonuses. Passing a car within one lane gives a combo (the ring shows its 3 second timer). |
| R5 | Seven chapters of 900 m each (short on purpose so the prototype shows every look), then the road loops back to the first. A real build would make chapters longer. |
| R6 | Each chapter has its own sky, light, scenery, weather and traffic look. Looks blend over the last 22 percent of a chapter. |
| R8 | Speed choice in the menu: Relaxed (34 to 72), Normal (44 to 92) or Fast (56 to 110); Relaxed is the default. Holding the Brake button (or the Down key) eases off to about 55 percent. The run can be paused, and pauses itself when the tab is hidden. |
| R9 | Traffic is deliberately sparse: one car per wave, a wave about every 95 to 155 m, and a calm stretch at the start of each chapter. Two cars at once only appear after 1,800 m, and never block all three lanes. |
| R7 | The best score is stored on the device only (`classic-games.racer.best`). The sound switch is stored the same way. |

## Technique

The road is projected with simple perspective, with a curve offset and a hill offset accumulated row by row (the classic pseudo-3D approach, written from scratch here). It is drawn as smooth filled shapes, so edges are anti-aliased and nothing flickers. It is not real 3D. Sprites are drawn with canvas paths: no images.

Reference read while planning: [jakesgordon/javascript-racer](https://github.com/jakesgordon/javascript-racer) (MIT, plain HTML and JS). No code or art from it is used.

## Checks

`tests/browser/racer.js` (Playwright and Chromium, same way as the other browser suites). `docs/screenshots/racer-24-frames.png` is a contact sheet of 24 real frames from the game.

## Limits

- Not tested on a real phone. Frame rate on older phones is unknown.
- Sound is generated in the browser (`racer/audio.js`): soft music per chapter with a bass note and a gentle pulse in the neon chapter, wind that follows speed, a whoosh and bass for a near miss, and a low boom with glassy chimes for a crash. It has been tested by code only, not by ear, so the mix and loudness are untuned.
- Jump, boost, awards, camera options and the launcher are not built.
