# Cruise v3: a living, anime-inspired world

This plan combines the last two reviews: one hundred game frames (10 per chapter) checked as an animator would, and the empty-space and backdrop review. Status: built (road rules, middle ground, skies, world objects, rising transitions, one hero at a time, matching sound); all test suites pass. Every rule is a Classic Games prototype choice, and all art and sound stay our own, drawn and synthesised in code.

## Where we are: 64 / 100

| Chapter | /10 | Main problems |
|---|---|---|
| 1 Dawn Meadow | 7 | Road looks like it forks on S-bends; strong haze; bare grass inside bends |
| 2 Cherry Hills | 6 | Fork on S-bends; the steam train is a thin strip floating on the haze |
| 3 Desert Road | 5 | The freight train reads as a stripe; large empty sand areas; washed out |
| 4 Amber Valley | 6 | Windmills read as crosses; the giant wheel fades in early over the hills |
| 5 Sunset Coast | 6 | Ship sits on sand; the wheel is a fixed-size sticker; forks; the wheel ghosts over the city |
| 6 Dusk City | 7 | Works; the skyline and airship read well |
| 7 Neon Quarter | 8 | Best mood |
| 8 Storm Pass | 6 | Grey and murky; little happens |
| 9 Northern Lights | 6 | Snow wedge splits the road; dark |
| 10 Sunrise Coast | 7 | Nice coast; fireworks hard to see in daylight |

## Root causes

1. **Stickers, not objects.** The wheel, ship and trains are painted at a fixed screen size and place, so they never come closer. Something far away should start small, grow as you drive and pass by.
2. **Nothing is grounded.** The sea only exists beside the road, so the ship sits on sand at the horizon. Trains have no track or shadow. The wheel's pier stands on nothing.
3. **Cross-fades between chapters.** The next chapter fades in over the current one, so skylines and the wheel show through the hills as ghosts.
4. **Curves swing the road off-screen.** On sharp S-bends the middle of the road leaves the screen and the far part comes back from the other side, so it looks like two roads.
5. **Heroes collide.** The ship crossed the wheel, the balloon crossed the wheel, the title crossed the drones.
6. **Hairlines.** Wheel spokes and the distant freight train are too thin for a phone screen.
7. **An empty middle ground.** The ground is one colour fade. Scenery only stands in a thin strip beside the road; between it and the horizon there is nothing, so the inside of every bend is bare.

## The rules we build by (how game developers and animators do it)

1. **Three depth layers, and every object belongs to one:**
   - far, which never grows: sun, moon, aurora, distant mountains;
   - middle, which slides with the bends but does not grow: hills, skylines, the painted village or forest;
   - world, which grows and passes you: anything you could drive past.
2. **Grounding:** each object stands on the right surface with a small contact shadow, and far objects fade toward the fog colour.
3. **True scale:** compare against a car. A giant wheel is about 13 car-heights tall.
4. **Motion in perspective:** a train beside the road moves slowly on screen when far and fast when near, along its track.
5. **Change places through geography:** new things rise over the horizon or appear behind a crest, a bend or a fog bank. No fades of whole scenes.
6. **Road rules:** curvature capped so the road centre always stays on screen; bends ease in and out; one bend finishes before the next starts.
7. **Staging:** one hero at a time, in open sky or open sea, never under the score or the title.
8. **Phone readability:** minimum line thickness. Far objects are simple solid shapes; detail comes up close.

## The anime-inspired look (the style, not copied art)

- **A full middle ground:** patchwork fields, hedgerows, stone walls, footpaths, small farms, a river, a distant village.
- **Painterly skies:** tall cumulus clouds with lit tops and shaded bases, drifting slowly.
- **Light:** warm sun, long soft shadows, cloud shadows sliding over the fields, a golden rim at sunset.
- **Signature details:** telegraph poles with sagging wires along the road, small shrines, bus stops, fences, chimney smoke, grass rippling in the wind.
- **Soft and hand-painted:** gentle texture, few outlines, trees as clusters of round clumps with a lit side.

It will be anime-inspired, flat and painterly, not hand-painted film quality.

## Per chapter

| Chapter | Middle ground (fills the empty space) | Sky | Moment (as a world object) |
|---|---|---|---|
| Dawn Meadow | patchwork fields, hedgerows, a farmhouse with smoke, telegraph poles | tall morning cumulus | balloons lifting off from a field |
| Cherry Hills | terraced fields, a shrine gate, a stone path, a hill village | soft pink haze | steam train on a track beside the road |
| Desert Road | mesas and rock towers, dune ridges, scrub, a dry riverbed, an old gas station | huge sun, heat shimmer | freight train on a track, passing you |
| Amber Valley | golden wheat, hay bales, an orchard, a winding river | low warm sun, long shadows | geese flying over |
| Sunset Coast | sea to the horizon, a pier, a fishing village, rocks in the surf | glowing cloud bank | giant wheel on the pier that grows and passes; a liner on real water |
| Dusk City | streets fading into the distance, an elevated rail, layered lit windows | city glow under clouds | airship and searchlights |
| Neon Quarter | layered towers, signs fixed to buildings | glow and drones | drone light show |
| Storm Pass | pine forests in layers, a dam or a waterfall | dark rolling clouds | the storm breaks |
| Northern Lights | a frozen lake, cabins with lit windows, pine forest | big aurora | the aurora flares |
| Sunrise Coast | sea to the horizon, a harbour, a lighthouse | sunrise cloud bank | fireworks, brighter by day |

## Order of work (each step: build, one link, you test)

1. **Road rules:** cap the curves, which removes the forks in Dawn, Cherry, Sunset and Northern Lights.
2. **Mock first:** Dawn Meadow and Desert Road in the new style, before and after, from the real game. Nothing spreads to other chapters until you approve it.
3. **Middle ground and skies** for all 10 chapters: fields and land patches drawn on the ground, one painted middle layer per chapter, new clouds and cloud shadows, telegraph poles.
4. **Moments as world objects:** the wheel on a pier, the ship on a sea that reaches the horizon, trains on tracks.
5. **Transitions through geography** instead of cross-fades.
6. **One hero at a time:** a timing rule so set pieces never overlap.
7. **Sound to match:** wind through fields, surf at the pier, a faint fairground tune at the wheel, the train on its track passing in 3D.
8. **Final pass:** all tests once, docs, one link for a full playtest.
