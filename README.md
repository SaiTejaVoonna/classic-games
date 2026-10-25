# Classic Games

Small classic-inspired games with a modern, calm look. No backend, no dependencies, no ads; scores stay on your device. Open `index.html` in a browser (works from `file://`).

- `index.html` is the launcher (Racer, Snake, menu drawer, awards, best scores).
- `snake/` is Snake. Its source lives in `src/` and `styles.css`.
- `racer/` is Racer: a pseudo-3D road game with a Journey (10 chapters, rest stops, checkpoints, finish) or Endless, lives, shields, coins, and a synthesised live soundtrack (no audio files).

All rules are Classic Games prototype choices; the original Nokia-era mechanics are not verified. Audio is not yet tuned by ear and nothing here has been tested on a real phone.

## Tests

```
node --test tests/*.test.js
NODE_PATH=<dir with playwright> node tests/browser/<ui|play|m1|rules|rendering|sweep|app>.js
```

See `docs/` for the Racer prototype notes, audio plan and mockups.
