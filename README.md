# Classic Games

Small classic-inspired games with a modern, calm look. No backend, no dependencies, no ads; scores stay on your device. Open `index.html` in a browser (works from `file://`).

- `index.html` is the launcher: the Games screen (a Continue card for the game you played last, game tiles, awards), with bottom tabs for Awards, Scores and Settings. See `docs/NAVIGATION.md`.
- `snake/` is Snake. Its source lives in `src/` and `styles.css`.
- `racer/` is Cruise (the folder keeps its old name so saved progress and links still work): a pseudo-3D road game. One tuned Journey of about 15 minutes (10 chapters, rest stops, checkpoints, finish, then Keep driving), lives and shields, coins, three playable cars, and a fully synthesised soundtrack, effects and engine (no audio files). See `docs/RACER.md` and `docs/RACER_AUDIO.md`.

All rules are Classic Games prototype choices; the original Nokia-era mechanics are not verified. Audio is not yet tuned by ear and nothing here has been tested on a real phone.

## Tests

```
node --test tests/*.test.js
NODE_PATH=<dir with playwright> node tests/browser/<ui|play|m1|rules|rendering|sweep|app|audio>.js
```

See `docs/` for the Racer prototype notes, audio plan and mockups.

## Credits

Engine sound follows Baldan et al. (2015); see `docs/RACER.md` for the full note on references and licences.
