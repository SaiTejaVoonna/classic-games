# Classic Games Reel

A 30-second vertical promo (1080x1920, 30 fps) made from the real game. Everything is our own: the game recorded frame by frame, its own synthesised soundtrack and effects, no stock music or recordings.

## How it is made

1. **Capture** (`capture.js`): Playwright and Chromium open Cruise, jump to each place, and drive it with a small autopilot (it steers for coins and around traffic). The game is stepped exactly 1/30 s per frame and screenshotted at 1080x1920. Titles, captions, the punch-in zoom on each cut and the end card are drawn in the same page. Snake is recorded in real time. Every sound the game asks for is logged with its frame.
2. **Soundtrack** (`soundtrack.js`): the game's own audio engine renders offline in Cruise's Drive style (139 BPM, cuts on the bar). Each logged sound (coins, close passes, passing cars, thunder, world sounds) is played on its exact frame, with a whoosh on every cut and the finish sting on the end card.
3. **Voice-over** (`voice.py`): the Kokoro voice (speaker 3) through sherpa-onnx 1.10.46, offline. Each line starts on the cut it describes. Every line was checked with Whisper (tiny.en) speech recognition, alone and in the final mix.
4. **Mix and assemble** (`mix.py`, ffmpeg): the music dips about 6 dB under the voice, the voice gets a light high-pass and presence lift, loudness is normalised to -14 LUFS for Reels and TikTok, and the video is H.264 with AAC audio.

Script: "Got fifteen minutes? Ten places. One road. Grab the coins, slip through the traffic, and watch the world come alive. Rain. Storms. Northern lights. All the way to the coast, with music made for every mile. Plus classic Snake. Classic Games. Play free in your browser."

## Rebuild

```
OUT=/tmp/reel
NODE_PATH=/opt/node-tools/node_modules node reel/capture.js $OUT
NODE_PATH=/opt/node-tools/node_modules node reel/soundtrack.js $OUT
pip install sherpa-onnx==1.10.46   # newer releases need a lexicon file for this voice model
# voice model: https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/kokoro-en-v0_19.tar.bz2
python3 reel/voice.py kokoro-en-v0_19 $OUT/voice 3
python3 reel/mix.py $OUT $OUT/voice ClassicGames-Reel.mp4
```

Scenes, captions and timing are the `SCENES` list at the top of `capture.js` (lengths in bars of the music).
