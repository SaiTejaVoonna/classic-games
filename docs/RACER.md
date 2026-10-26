# Cruise (the `racer/` folder)

A pseudo-3D road game for the Classic Games app. One tuned game, about 15 minutes, no choices before Play except the car.
All rules are Classic Games prototype choices; nothing here copies any original game.

## What the player sees

- **Start screen:** a Speed row (Calm, Normal, Fast, Rush), car picker (Rally, Sport sedan, Electric; Formula is shown locked for later), Play, Continue (if a checkpoint exists), Sound and music, Back to games.
- **Journey:** 10 chapters from Dawn Meadow to Sunrise Coast, 2.8 km each (28 km, about 15 minutes). Speed rises by itself across the Journey. The pace is the player's choice: a multiplier from 1.0x (85 to 150 km/h) to 2.3x, default 1.6x (136 to 240 km/h). The + and - buttons beside the speed readout change it any time (keys: + and -, Up for faster). A faster pace makes the Journey longer in distance, so it still takes about 15 minutes, and puts more road between cars. Rest stops after chapters 2, 4, 6 and 8 slow the car, heal one heart and save a checkpoint. The label under the bar shows the chapter and minutes left.
- **Bridges and boats (coast chapters):** about every 1.4 km the road crosses open water on a 170 m bridge with railings. A small launch crosses under it, side to side, and sailboats sit out on the water. Boats are placed in the world, so they come towards you like everything else.
- **Keep driving:** after the finish arch the player can carry on in Endless, with full hearts.
- **Lives:** 3 hearts, a shield after a bump, a calmer stretch of road after a bump. One lane is always left open.
- **Controls:** swipe or tap left and right, arrow keys or A and D. Hold the button (or Down) to ease off. + and - change the pace. P or Escape pauses.

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

- **Handling:** lane change is a damped spring (about 0.28 s on dry road, softer with a little sway in rain and snow). The body leans into a move (the base stays on the road, so no wheel lifts), the camera banks about one degree into a lane change or a bend, the suspension bobs on bumps and hills, and the nose dips when braking.
- **Lanes:** one definition, `LANE = 2/3` of the road half-width, so lane centres sit at 0 and +-2/3 and the painted lines at +-1/3. Drawing, coin pickup and contact all use it. A vehicle fills 78 percent of its lane (the widest, a truck, 87).
- **Traffic:** each car has its own pace but eases down to the speed of the car in front, so cars in one lane never drive through each other, and a car never joins two others to fill all three lanes. Far cars sometimes signal and change lane (they count in both lanes while moving). Contact is tested at the depth where the cars are drawn, with the real widths of the two vehicles. A close call needs a gap under 0.95 lane, so it takes a real squeeze; passing in the next lane (gap 1) does not count. The car that was hit is knocked aside.
- **Pickups:** coins and hearts are collected where the car is drawn, 9 m ahead of the camera. Things closer to the camera than the car are drawn after it.
- **Road and ground detail:** rumble strips along both edge lines, faint worn tyre tracks in every lane, reflector posts every 30 m, and light and dark bands of ground that rush past (all speed cues). Speed streaks appear only off the road, tapered and warm-tinted, and never over a car. The sun has a warm bloom.
- **Vehicles:** tyres are narrower and tucked under the body in a dark wheel arch, with a faint scrolling tread; each vehicle has a tight contact shadow (the neon underglow is a night-only effect drawn by the game).
- **Environment:** each chapter has its own sky, ridges, ground, roadside set, weather and life. Sunrise Coast starts in pre-dawn and brightens. Rain wets the road and throws spray, snow lines the verge, dust and leaves react to the car.
- **Sound:** see `docs/RACER_AUDIO.md`.

## Debug and test hooks

- `?debug=1` exposes `window.racerDebug` (state, teleport, advance, addCar, geometry, scene, sprites, audio info).
- `&boxes=1` draws the contact boxes and key numbers.
- `&seed=N` makes traffic and the road repeatable.
- `&len=demo` shortens chapters to 900 m for quick looks.
- `&speed=N` sets the pace step (0 to 6) without saving it; `&speed=0` gives the gentlest pace.
- `&fps=1` shows how long a frame takes (average and worst, in milliseconds). `racerDebug.perf()` returns the same numbers.
- Resolution adapts: if frames keep arriving late the picture is rendered at a lower resolution (down to 1x) and goes back up after a long smooth stretch. `racerDebug.slowDown(true)` forces the low setting.

## Storage (local only)

`classic-games.racer.prefs` (car, sound choices), `.stats`, `.bests`, `.checkpoint`, `.hint`. App-wide sound and haptics come from `classic-games.app`.

## Credits and licences

- Engine sound follows the method of Baldan, Lachambre, Delle Monache and Boussard, "Physically informed car engine sound synthesis for virtual and augmented environments" (2015). The MIT-licensed [Antonio-R1/engine-sound-generator](https://github.com/Antonio-R1/engine-sound-generator) was read as a reference; the code in this repository is our own.
- Plucked strings use the Karplus-Strong algorithm.
- No recordings, fonts or images from other projects are used. All sound is synthesised in the browser.
