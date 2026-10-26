# QA handoff for the GPT tester

Branch: `claude/classic-games-app`. Test the pinned commit given in the latest report, not the branch head, so results can be compared.

## Open the game

`https://raw.githack.com/SaiTejaVoonna/classic-games/<commit>/racer/index.html`

Useful flags: `?debug=1` (adds `window.racerDebug`), `&boxes=1` (collision boxes), `&seed=N` (repeatable road and traffic), `&len=demo` (900 m chapters).

## Changes since the last tester report (6cd313d)

1. One tuned game: the start screen is the car picker and Play. Speed rises 85 to 150 km/h. About 15 minutes. The label shows minutes left.
2. Keep driving after the finish.
3. Handling: spring lane change, roll, bob, rain and snow softness.
4. Traffic: some far cars signal and change lane. Brake lights flash. The car you hit spins off.
5. Environment: Sunrise Coast brightens from pre-dawn; wet road, spray, snow verge, dust, leaves; calmer rain, snow and neon; no hard haze line.
6. Sound: new score (layers, motifs), new effects, 23 life sounds, engine per car.
7. "CLOSE x2 +10" is a high-contrast pill. Crash and finish panels list the same stats. A one-time swipe hint shows on the first run.

## Please check

- **Early deaths on Easy (earlier report, P2).** Play Journey. Record distance, bumps and lives at each crash. Does the ramp (85 km/h to start) feel fair? Run with `&boxes=1` once and note any crash where the red boxes did not touch.
- **Traffic overlap.** Look for cars touching the player or each other in chapters 4, 5 and 10.
- **Lane-change cars.** Does a signalling car ever move into a lane you were about to use with no time to react?
- **Readability.** City, rain and snow chapters: can you see road edges and traffic?
- **Road edge.** Does the player car ever leave the visible road or screen on bends?
- **Wet road.** Chapter 7: reflections, spray, wheels visible?
- **Sunrise Coast.** Does the sky brighten and the sun rise as you go?
- **Journey end.** Does the finish appear at the end of chapter 10, and does Keep driving work?
- **Pause, resume, Continue** from a checkpoint after a crash.
- **Sound.** On a real device: balance of engine, score and effects; Calm mode; any clicks, glitches or silence. Which cars sound best?
- **Performance.** Frame rate on a mid-range phone, especially in rain and city chapters.

## Report format

Use `gpt-tester/REPORT-TEMPLATE.md` on the tester branch. Separate observations from suspected causes.
