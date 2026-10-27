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

## Mix notes (latest round)

- The engine has its own bus and its own slider; Effects volume no longer scales it. It still follows the Effects on/off switch.
- Effect bells take their notes from the chapter's own theme in `score.js` (one scale for music and effects). The near-miss bell climbs the scale with the combo.
- Effect and life-sound buses are made once per level and reused.
- The engine is updated about 30 times a second, and only the loops next to the one playing follow the pitch.
- Pausing and resuming keeps the music schedule (the audio clock stops while paused), so nothing doubles up.

## Score v3 (latest round)

- **A groove from the first chapter.** The chapter sets the music's energy (driving adds to it), and bass, a rolling pulse and a soft beat play in every chapter after a short intro of a few seconds. Before, the first chapters were a lead melody alone for about five minutes.
- **Songs with sections.** Each chapter loops a 32-bar form: A (the theme, light band), B (fuller, with a second melody and the motif answering itself), a 4-bar break (no drums, strings and lead carry), and a 12-bar drop (everything, busier hats). Each section ends with a fill.
- **Each chapter rolls its chords its own way** (six arpeggio shapes), and the bass and drums have a figure per kit.
- **Styles change the whole band** (lead, pulse instrument and drums), not just the lead.
- **Drive** is a new style, phonk-inspired with our own patterns and synthesised sounds: a half-time beat, a sliding, driven 808, a pitched cowbell riff, hi-hat rolls and a mix that pumps with the kick. It keeps each chapter's key, goes dark (minor), and runs at 126-150 BPM.
- **Mix:** music raised about 2 dB, measured in game so it sits just over the engine at the default sliders.

## Effects fixes

- **Thunder follows the light.** A strike is heard 0.15-1.25 s after its flash, as a crack with a short attack and then the roll; between strikes the sky flickers faintly far away and a distant rumble follows. Storm Pass no longer plays cracks with no flash, and the music only dips gently.
- **Ambience crossfades** with the scenery: the next chapter's bed fades in as the picture blends, and takes over at the chapter change instead of cutting.
- **No clicks:** every noise burst has a 2-4 ms attack.
