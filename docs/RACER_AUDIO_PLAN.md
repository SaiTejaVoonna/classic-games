# Racer audio plan (design, not built yet)

Everything is synthesised in the browser with the Web Audio API, so the game ships **no audio files**. "How many sounds" therefore means how many recipes, not files. These are Classic Games prototype choices.

## What exists today and what the lab showed

`racer/audio.js` is the first version (simple pad, bass and plucks, a few effects). A scratch lab (not in the repo) rendered four preview files to test a richer engine. Measured with a spectrum check:

| Preview | Before the lab fixes | After |
|---|---|---|
| Stereo width (side/mid, 0 is mono) | 0.05 to 0.06 (almost mono) | 0.19 to 0.35 |
| Brightness, energy at 4 to 8 kHz vs the loudest band | about -36 dB (dark) | -14 to -23 dB |
| Shape | not V shaped, but bass heavy and dark | mids and presence lifted, bass trimmed |
| Peak level | up to 1.08 before normalising | 0.72 to 0.88, no clipped samples |

The measurements were made by code, not by ear.

## Recipe count

| Group | Recipes | Notes |
|---|---|---|
| Chapter music | 10 themes | Each has 4 layers: base (sub and pad), pulse, lead, climax |
| Style kits | 3 | Cinematic (default), Piano, Acoustic (handpan and plucks). Same chords, different instruments, so 30 arrangements from 10 pieces of music data |
| Menus | 3 | Launcher, trip select, journey end |
| Stingers | 12 | One per chapter change (in the next key), rest stop, crash, journey complete |
| Ambience beds | 10 | Waves and gulls, meadow wind, city hum, rain, storm and thunder, snow wind, crickets, desert wind, tunnel echo, forest birds |
| Car | 5 | Engine (one layered loop driven by speed), tyres, wind, pass-by whoosh (3 variants), occasional horn |
| Events | about 16 | Lane, near miss (3 variants), coin (chord notes), gem, heart, shield on and off, boost on and off, bump, crash, tap, back, award, unlock |
| Signature | 1 | A four note Classic Games motif for launcher open and journey end |

About 60 recipes, 0 files. Music data is small (chords and melody per chapter).

## How audio follows the game

- **Music clock:** events (coin, near miss, heart) are scheduled on the next eighth note and in the current key, so they join the music instead of fighting it.
- **Intensity layers:** speed and combo add or remove layers (pulse at speed, climax on combos, only base when calm or paused).
- **Chapter change:** a riser, then the next theme starts on a bar line, in the next key. Ambience cross-fades by the same blend value that mixes the scenery (water, rain, night, snow).
- **Crash:** a low boom and glass, music ducks and low-passes, then returns when a new run starts.
- **Wind and trees:** gusts in the ambience line up with tree sway.
- **Engine:** pitch and brightness follow speed. Tyres get louder in curves. Easing off drops the engine and lifts the wind.

## 3D and wide sound

- Traffic is placed by lane (left, centre, right) and distance (quieter and duller farther away), and gets a pitch drop as it passes (Doppler).
- Waves sit on the shore side. Strings spread across the stereo field, piano pans by pitch, plucks pan randomly, taiko stays centred, shaker alternates sides.
- A ping-pong echo and one shared soft reverb give width. Target side/mid 0.25 to 0.45 and left/right correlation of 0.6 or more so it still works on one speaker.

## Mix targets

- Master peak at or below -2 dBFS. Music about -18 dBFS RMS, ambience about -26, effects peaking 6 to 8 dB under the music peak.
- Events duck music and ambience by about 3 dB for a moment. A compressor keeps loud parts from jumping out.
- Tonal balance: roughly -3 to -4 dB per octave from 120 Hz to 8 kHz. Do not scoop the mids (500 Hz to 2 kHz) and do not boost bass and treble together (the V shape). High-pass at 32 Hz.
- Calm mode: about -4 dB overall, a softer top end, no hard transients, no sub below 40 Hz.

## Limits

I cannot hear any of this, so loudness and taste need your ears. Proper film-level music needs a composer or licensed tracks; this plan builds an adaptive player that could carry them.
