# Racer

A pseudo-3D road game for the Classic Games app. One tuned game, about 15 minutes, no choices before Play except the car.
All rules are Classic Games prototype choices; nothing here copies any original game.

## What the player sees

- **Start screen:** car picker (Rally, Sport sedan, Electric; Formula is shown locked for later), Play, Continue (if a checkpoint exists), Sound and music, Back to games.
- **Journey:** 10 chapters from Dawn Meadow to Sunrise Coast, 2.8 km each (28 km, about 15 minutes). Speed rises by itself from 85 to 150 km/h. Rest stops after chapters 2, 4, 6 and 8 slow the car, heal one heart and save a checkpoint. The label under the bar shows the chapter and minutes left.
- **Keep driving:** after the finish arch the player can carry on in Endless, with full hearts.
- **Lives:** 3 hearts, a shield after a bump, a calmer stretch of road after a bump. One lane is always left open.
- **Controls:** swipe or tap left and right, arrow keys or A and D. Hold the button (or Down) to ease off. P or Escape pauses.

## Code map

| File | What it does |
|---|---|
| `racer/index.html`, `racer/racer.css` | page, HUD, start screen, sheets |
| `racer/racer.js` | game loop, road geometry, scenes and weather, traffic, handling, results |
| `racer/cars.js` | vehicle art as SVG drawn once into small canvases |
| `racer/audio.js` | audio engine: stems, instruments, effects, life sounds, engine, ambience, mixer |
| `racer/score.js` | the music as data (themes) and the rules for which layers play |
| `racer/enginesynth.js` | physical model of an engine, rendered into loops in a worker |

## Systems

- **Handling:** lane change is a damped spring (about 0.28 s on dry road, softer with a little sway in rain and snow), body roll from lane speed, suspension bob from bumps and hills, nose dip when braking.
- **Traffic:** about 82 percent of a lane wide. Far cars sometimes signal and change lane (they count as being in both lanes while moving). Contact is tested at the depth where the cars are drawn. The car that was hit is knocked aside.
- **Environment:** each chapter has its own sky, ridges, ground, roadside set, weather and life. Sunrise Coast starts in pre-dawn and brightens. Rain wets the road and throws spray, snow lines the verge, dust and leaves react to the car.
- **Sound:** see `docs/RACER_AUDIO.md`.

## Debug and test hooks

- `?debug=1` exposes `window.racerDebug` (state, teleport, advance, addCar, geometry, scene, sprites, audio info).
- `&boxes=1` draws the contact boxes and key numbers.
- `&seed=N` makes traffic and the road repeatable.
- `&len=demo` shortens chapters to 900 m for quick looks.

## Storage (local only)

`classic-games.racer.prefs` (car, sound choices), `.stats`, `.bests`, `.checkpoint`, `.hint`. App-wide sound and haptics come from `classic-games.app`.

## Credits and licences

- Engine sound follows the method of Baldan, Lachambre, Delle Monache and Boussard, "Physically informed car engine sound synthesis for virtual and augmented environments" (2015). The MIT-licensed [Antonio-R1/engine-sound-generator](https://github.com/Antonio-R1/engine-sound-generator) was read as a reference; the code in this repository is our own.
- Plucked strings use the Karplus-Strong algorithm.
- No recordings, fonts or images from other projects are used. All sound is synthesised in the browser.
