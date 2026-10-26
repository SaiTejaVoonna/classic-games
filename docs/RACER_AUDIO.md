# Racer audio

Everything is synthesised with the Web Audio API. No audio files.

## Layers

| Layer | Where | What |
|---|---|---|
| Score | `racer/score.js` data, `racer/audio.js` player | 10 themes, each with a key, mode, tempo, a two-bar motif, an eight-bar loop, and caps for 8 layers |
| Engine | `racer/enginesynth.js` + `audio.js` | physical-model loops (waveguide body plus a firing-pulse exhaust voice that carries the note above 800 Hz for phone speakers) crossfaded by revs; V8 (sedan), turbo four (rally), electric (EV); V10, V12 and formula profiles exist for later |
| Effects | `audio.js` | lane, coin, heart, near miss, pass, bump, crash, chapter, rest, thunder, finish, each built from layers |
| Life sounds | `audio.js` | 23 small sounds, one list per chapter, every 6 to 14 s |
| Ambience | `audio.js` | 7 beds: meadow, desert, waves, city, rain, storm, snow |
| Mixer | `audio.js` | per-layer reverb buses, ducking, bus compressor, output limiter, calm mode |

## Score layers

air, lead (the motif), pulse (arpeggio), strings, brass, percussion, choir, bass.
A layer enters when the music intensity passes its threshold and never exceeds the cap the chapter gives it. Intensity is the plan for the chapter blended with speed and combo. Each chapter opens with the lead and the air alone for 10 seconds. A rest stop strips everything but lead and air. One life left adds a heartbeat. The final chapter plays the opening motif of the first chapter again, trimmed to sit with the rest.

## Levels

Each voice and layer was measured alone and trimmed so every chapter sits at about the same loudness. `tests/browser/audio.js` renders every effect, life sound and chapter score offline and checks that it is clean, audible and balanced.

## Not verified

The balance and taste of the music have only been checked by measurement and by the owner listening to previews. Nothing has been listened to on a real phone speaker by the tester.
