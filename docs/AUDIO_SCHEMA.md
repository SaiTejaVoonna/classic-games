# Classic Games audio schema (design, not built yet)

One plan for the whole site: the launcher, Snake and Racer. Everything is **synthesised in the browser**, so the number of audio files shipped is **0**. "How many sounds" means how many recipes.

## Totals

| Area | Recipes |
|---|---|
| Global (signature, interface, launcher theme) | 11 |
| Snake | 17 |
| Racer | 88 |
| **All** | **116** |

If you later replace synthesis with recorded audio, expect roughly 140 files (music in 4 stems per chapter, loops, one-shots), about 40 MB. That is why synthesis is the default.

## Global (11)

- Signature motif: 1 (four notes, used when the launcher opens and when a journey ends)
- Interface: 9 (tap, back, switch on, switch off, drawer open, drawer close, award unlocked, error, countdown)
- Launcher theme: 1 (calm loop, in the four styles)

## Snake (17)

- Music: 3, quiet, one per theme (Colour: soft lofi, LCD: chiptune, Night: ambient)
- Ambience: 2 (garden by day, night hum)
- Effects: 12 (eat, bonus appears, bonus eaten, bonus expires, turn tick, bump or life lost, game over, new best, board full, pause, resume, setup tick)

## Racer (88)

| Group | Count | What |
|---|---|---|
| Chapter music | 10 | One piece per chapter, each with 4 layers (base, pulse, lead, climax). 4 style kits (Cinematic, Piano, Acoustic, Electronic) play the same music data, so 40 arrangements |
| Menus | 3 | Trip select, pause, journey end |
| Stingers | 12 | One per chapter change, rest stop, crash, journey complete |
| Ambience beds | 10 | Waves, meadow wind, city hum, rain, storm, snow wind, crickets, desert wind, tunnel echo, forest |
| Life sounds | 24 | Balloon burner, songbirds, gulls, owl or crow, crickets, frogs, windmill creak, wind chimes, flag flap, bell buoy, boat horn, church bell, distant train, plane flyover, thunder close, thunder far, rain gust, tunnel whoosh, bridge rumble, siren far, city horns far, foghorn, fireworks, camera shutter |
| Car | 9 | Engine loop, tyre grip loop, tyre squeal, wind loop, pass-by near, pass-by far, horn, ease off, boost whoosh |
| Pickups and events | 20 | Lane, near miss (3 variants), coin, gem, heart, shield on and off, boost on and off, bump, crash, rest stop, finish line, combo up, combo lost, heart lost, best distance, pickup sparkle |

## Songs and vocals

- **None by default.** The music is instrumental, and there is no voice-over.
- **Wordless choir (optional):** 1 recipe, a synthesised formant "ooh" for the cinematic finale. Possible to build.
- **A real song or vocals:** needs a recorded, licensed or commissioned track (for example for the credits). That is outside what I can synthesise.

## Where each sound plays (Racer)

| Chapter | Music kit (default) | Ambience bed | Life sounds |
|---|---|---|---|
| Dawn Meadow | Piano | Wind in grass | Songbirds, balloon burner, windmill creak |
| Sunset Coast | Acoustic (handpan) | Waves | Gulls, bell buoy, boat horn, foghorn, balloon burner |
| Amber Valley | Piano and cello | Autumn wind | Windmill creak, crow, church bell, crickets |
| Dusk City | Electronic (soft) | City hum | Siren far, city horns far, plane, train |
| Neon Quarter | Electronic | Rain | Thunder far, siren far, neon hum |
| Desert Road | Acoustic (plucks) | Desert wind | Wind chimes, flag flap, crickets |
| Northern Lights | Cinematic pads | Snow wind | Owl, distant train, wind chimes |

The three chapters not built yet (Storm Pass, Midnight Tunnel, Sunrise Coast) use the rest: tunnel whoosh, bridge rumble, thunder close, frogs, fireworks, church bell, camera shutter in photo mode.

## Rules

- Every one-shot is placed in 3D (lane or side, distance), quieter and duller when far.
- Life sounds are rare and random in time (every 8 to 25 seconds), never on top of an event.
- Music, ambience and effects share one soft room. Events duck the rest by about 3 dB.
- Calm mode: about 4 dB quieter, softer top end, no hard transients, no sub-bass.
- Sound is off until the first tap (a browser rule), and always has an off switch.
