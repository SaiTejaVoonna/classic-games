# Classic Games Reel

A 30-second vertical promo (1080x1920, 30 fps) made from the real game. Everything is our own: the game recorded frame by frame, its own synthesised soundtrack and effects, no stock music or recordings.

## How it is made

1. **Capture** (`capture.js`): Playwright and Chromium open Cruise, jump to each place, and drive it with a small autopilot (it steers for coins and around traffic). The game is stepped exactly 1/30 s per frame and screenshotted at 1080x1920. Titles, captions, the punch-in zoom on each cut and the end card are drawn in the same page. Snake is recorded in real time. Every sound the game asks for is logged with its frame.
2. **Soundtrack** (`soundtrack.js`): the game's own audio engine renders offline in Cruise's Drive style (139 BPM, cuts on the bar). Each logged sound (coins, close passes, passing cars, thunder, world sounds) is played on its exact frame, with a whoosh on every cut and the finish sting on the end card.
3. **Assemble** (ffmpeg): H.264 video, AAC audio, loudness normalised to -14 LUFS for Reels and TikTok.

## Rebuild

```
OUT=/tmp/reel
NODE_PATH=/opt/node-tools/node_modules node reel/capture.js $OUT
NODE_PATH=/opt/node-tools/node_modules node reel/soundtrack.js $OUT
ffmpeg -y -framerate 30 -i $OUT/f%05d.jpg -i $OUT/music.wav \
  -filter_complex "[1:a]loudnorm=I=-14:TP=-1.5:LRA=9[a]" -map 0:v -map "[a]" \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -movflags +faststart \
  -c:a aac -b:a 192k -shortest ClassicGames-Reel.mp4
```

Scenes, captions and timing are the `SCENES` list at the top of `capture.js` (lengths in bars of the music).
