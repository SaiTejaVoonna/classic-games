# Cruise sound plan: what is missing

Status: built, except the menu music in M5 (browsers block sound until the first tap, and on the start screen that tap is Play). All tests pass.

Sound only: music, effects and the mix. Everything stays synthesised in code, with no recordings and no copied music. Every rule is a Classic Games prototype choice.

## What is already there

- 10 chapter themes, each with its own key, tempo and lead instrument; a 32-bar song form (A, B, break, drop); a "Drive" version of every theme.
- Instruments: piano, pluck, guitar, slide guitar, koto, flute, marimba, cello, handpan, electric piano, synth, glide lead, bell, strings, brass, three drum kits.
- Music layers that follow intensity, a rest-stop calm, and ducking under big effects.
- Effects: lane change, coin, heart, near pass, passing cars, bump, crash, chapter, rest stop, finish, thunder (close and far), rain gusts, wet-tyre hiss, bridge joints, engine with gears and turbo, and 25+ world sounds (birds, gulls, horns, wind chimes, music box and more).
- Small random pitch and level variation on frequent effects.

## Missing: music

| # | Missing | Why it matters | Plan |
|---|---|---|---|
| M1 | **A main theme** | 10 separate tunes do not feel like one journey | One short, hummable melody. Each chapter quotes it in its own instrument; the finale plays it in full |
| M2 | **Smooth chapter transitions** | The theme switches abruptly at the chapter line | Finish the current phrase, then crossfade over 2 bars into the next key |
| M3 | **Chapter fanfares** | The chapter card appears in silence | A 2-second fanfare in the new chapter's key and instrument |
| M4 | **Music that answers good play** | Combos barely change the music | Combo 3+ opens the drums; combo 6+ the full band; a bump strips back to pads for 2 bars |
| M5 | **Start, finish and game-over music** | There is none on the menu; the finish and the crash are effects only | A soft menu loop; a short finish anthem (the main theme); a gentle game-over phrase |
| M6 | **Retune per chapter** | Some chapters miss their mood | Storm Pass 120 to 108 BPM; Northern Lights starts with no drums; Sunset Coast gets a funky bass and claps (city pop) |
| M7 | **Big-moment cues** | The music does not notice the moments | The music drops to pads while a moment plays, then returns |

## Missing: effects

| # | Missing | Plan |
|---|---|---|
| S1 | **3-2-1 countdown on Resume** | Three soft ticks and a rising tone on go |
| S2 | **Menu and button sounds** | Soft taps for buttons; a whoosh for pause and resume |
| S3 | **Effects on the beat** | Coin chimes and near-pass stings land on the next musical sixteenth, in the chapter's key |
| S4 | **Proper sounds for new moments** | Kites: wind and fluttering cloth. Dust devil: a rising sandy swirl. Drone show: a soft electric hum under the shimmer. These now borrow other sounds |
| S5 | **Rest-stop arch and finish arch** | A whoosh as you pass under, and a crowd-like cheer at the finish |
| S6 | **Tyres and road surface** | A light tyre squeal on quick lane changes; the road tone changing on bridges, wet roads and snow |
| S7 | **Rain on the car** | Soft drops on the roof and glass at night and in storms |

## Missing: mix

| # | Missing | Plan |
|---|---|---|
| X1 | **A loudness target** | Measure every chapter and effect; set music, engine and effects to fixed levels in decibels so nothing jumps |
| X2 | **Phone speaker check** | Phone speakers lose the bass: add a little upper harmonic to bass and kick so they still read |
| X3 | **Gentler ducking** | Duck by 3–6 dB with slow release, never a sudden dip |
| X4 | **Headphone space** | Passing cars and world sounds panned and slightly reverbed by distance |

## Order of work

1. **M1 main theme and M2 transitions**: the biggest change in feel.
2. **M6 chapter retune and M7 big-moment cues.**
3. **M3 fanfares, M5 start, finish and game-over music.**
4. **M4 music that answers play, S3 effects on the beat** (the audio-design skill).
5. **S1, S2, S4–S7 new effects.**
6. **X1–X4 mix pass**, measured, last.

Each step ends with a short listening file (about 30 seconds) and one link to play it in the game.
