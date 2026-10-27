"""Classic Games Reel: the voice-over, made offline with the Kokoro voice through sherpa-onnx.
Usage: python3 reel/voice.py <kokoro-model-dir> <out-dir> [speaker-id]
Writes one WAV per line (line00.wav ...) and lines.json with each line's start time and length."""
import json, sys, os
import wave
import numpy as np
import sherpa_onnx

BAR = 4 * 60 / 139  # one bar of the music, in seconds
# (bar the line starts on, words). Lines land on the cut they describe.
LINES = [
    (0.35, "Got fifteen minutes?"),
    (2.05, "Ten places."),
    (3.05, "One road."),
    (4.1, "Grab the coins,"),
    (6.05, "slip through the traffic,"),
    (7.05, "and watch the world come alive."),
    (9.05, "Rain. Storms. Northern lights."),
    (12.05, "All the way to the coast,"),
    (13.05, "with music made for every mile."),
    (14.3, "Plus classic Snake."),
    (15.15, "Classic Games. Play free in your browser."),
]
model, out = sys.argv[1], sys.argv[2]
sid = int(sys.argv[3]) if len(sys.argv) > 3 else 1
cfg = sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(kokoro=sherpa_onnx.OfflineTtsKokoroModelConfig(
    model=os.path.join(model, "model.onnx"), voices=os.path.join(model, "voices.bin"), tokens=os.path.join(model, "tokens.txt"),
    data_dir=os.path.join(model, "espeak-ng-data")), num_threads=4))
tts = sherpa_onnx.OfflineTts(cfg)
meta = []
for i, (bar, text) in enumerate(LINES):
    a = tts.generate(text, sid=sid, speed=1.0)
    p = os.path.join(out, "line%02d.wav" % i); pcm = (np.clip(np.asarray(a.samples, dtype=np.float32), -1, 1) * 32767).astype('<i2')
    with wave.open(p, 'wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(a.sample_rate); w.writeframes(pcm.tobytes())
    meta.append({"i": i, "text": text, "start": round(bar * BAR, 3), "len": round(len(a.samples) / a.sample_rate, 3), "file": p})
    print("%5.2fs +%.2fs  %s" % (bar * BAR, len(a.samples) / a.sample_rate, text))
json.dump(meta, open(os.path.join(out, "lines.json"), "w"), indent=1)
