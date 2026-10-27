# Cruise v2: the whole improvement plan

One list of everything agreed or proposed so far, in the order we build it. Every rule is a Classic Games prototype choice, and all art and sound stays our own: drawn and synthesised in code, with no copied music or recordings.

## How we work

- One step at a time. I build it, run the tests once at the end, and send one link and one picture.
- You test on your phone and say "next", or what to fix.
- A mock comes first only where the design changes (marked **mock**).

## Decisions still needed from you

1. After a crash, Resume goes to: **where you crashed** or **the last rest stop**?
2. Rivals (a named car you can overtake for a bonus): yes or no?
3. Boost (a short speed burst, like Asphalt 9): yes or no? If yes: tap a button, or fill a meter from near passes?
4. Coins buy things (car colours, the locked cars): yes or no?

## Step 1. Clean-up (no design change)

- Petals and leaves: real petal and leaf shapes in two tones, fewer, slower, drifting with the wind beside the road, never over the car. No blossoms in Dawn Meadow.
- Rain: softer, shorter drops; splashes on the road; spray behind cars; nothing over the sky or the buttons. Storm Pass less grey.
- Neon Quarter: the far road no longer glows purple; signs sit on buildings instead of floating.
- Amber Valley windmill gets a tower. One balloon per sky. The lighthouse glow is smaller in daylight.
- The − and + speed buttons move off the car.
- Delete the junk `undefined/` image folder and fix the test script that writes it.

**Test on your phone:** Cherry Hills, Amber Valley, Storm Pass, Neon Quarter. Check that nothing covers the car.

## Step 2. Skies and background life (**mock**, 3 chapters first)

Something alive in every sky: birds, clouds, heat shimmer, city windows lighting up, drones and holo billboards, lightning on the mountains, a big aurora, fireworks.

## Step 3. Big moments (sky and horizon)

The first try (boxes beside the road) was removed: on a portrait screen it showed cut-off boxes and flat bars. The new moments play in the sky and along the horizon, centred and large. Each chapter has one, from 30% to 60% of the way through (about 30 s), with its own sound:

| Chapter | Moment | Sound |
|---|---|---|
| Dawn Meadow | balloon festival rising from behind the hills | burners |
| Cherry Hills | steam train on the horizon, smoke trailing | steam whistle, wheels |
| Desert Road | freight train of coloured containers, dust trail | horn, wheels |
| Amber Valley | a big V of geese flying over | honks |
| Sunset Coast | cruise liner crossing the sea, lights in its windows | ship's horn, gulls |
| Dusk City | airship over the skyline, searchlights sweeping | engine drone |
| Neon Quarter | drone light show: ring, heart, star | bell shimmer |
| Storm Pass | the storm breaks: strikes come thick and fast | close thunder |
| Northern Lights | the aurora flares, shooting stars | shimmer, chimes |
| Sunrise Coast | fireworks over the harbour | each burst |

## Step 4. Gameplay v2 (direction C, kept simple and calm)

- Combos and near passes fill a meter. A full meter gives a short boost, if you say yes to boost.
- Rivals: one named car per chapter. Overtake it for bonus coins. No crashes are forced.
- Coins buy car colours and unlock the locked cars, if you say yes.
- Done: Resume goes straight into the drive with a 3-2-1. The game saves your exact place every few seconds and when you leave. Losing your last heart sends you back to the last rest stop. The Games screen's top card shows the chapter you're in.

## Step 5. Smarter traffic

- Driver types: calm, fast (overtakes), slow truck, a bus that stops, a taxi that pulls over, an ambulance with a siren that others make way for.
- Cars signal, then change lane smoothly, brake when cut in on, and never block all three lanes.

## Step 6. Physics feel

- The car leans into a lane change and settles after it.
- Lift over a crest, squash in a dip.
- A small slide on wet roads, and tyre spray in the rain.
- A bump pushes the car sideways instead of only flashing.
- The speed feel grows with pace.

## Step 7. Sound v2 (**preview clips first**)

Music (it still loops, as you asked):

| Chapter | Inspired by (style only) | Sound |
|---|---|---|
| Dawn Meadow | Alto's Adventure, How to Train Your Dragon | airy flute, marimba, warm pad, 92 BPM |
| Cherry Hills | Studio Ghibli | koto-like pluck, strings, 96 BPM |
| Desert Road | Dune, Journey | slide guitar, drones, slow heavy drums, 96 BPM |
| Amber Valley | Journey (cello) | cello over a relaxed groove, 94 BPM |
| Sunset Coast | OutRun, city pop | clean guitar, electric piano, funky bass, 100 BPM |
| Dusk City | Drive (2011) | dreamy synthwave, 104 BPM |
| Neon Quarter | Tron: Legacy, Need for Speed | orchestra plus synth arpeggios, 808, 110 BPM |
| Storm Pass | Mad Max: Fury Road, Dunkirk | taiko drums, low brass, rising tension, 120 BPM |
| Northern Lights | Interstellar | organ-like pads, ticking pulse, 90 BPM |
| Sunrise Coast | Star Wars | brass and strings finale, the main theme returns, 104 BPM |

- One main Cruise theme, played in each chapter's own way.
- Short fanfares at each new chapter, each rest stop and the finish.
- Playing well (combos, boost) pushes the music into its fullest part.
- New instruments, all synthesised: flute, marimba, koto pluck, slide guitar, warm pad, gliding synth lead, taiko, brass swell. At most one "struck" instrument per chapter, so it never all sounds like piano.
- New sound effects: rain splashes and tyre spray, horns for the train, ship and metro, the bridge rumble, the tunnel echo, and boost.

## Step 8. Final pass

Full test run on all suites, docs updated, one last link for a full 15-minute playtest.
