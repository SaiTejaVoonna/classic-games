"""Classic Games Reel: mix the voice-over over the soundtrack and build the final MP4.
Usage: python3 reel/mix.py <capture-dir> <voice-dir> <out.mp4>
The music dips about 6 dB under each line (sidechain), the voice gets a gentle high-pass and presence lift,
and the whole mix is normalised to -14 LUFS for Reels and TikTok."""
import json, subprocess, sys, os
cap, vdir, out = sys.argv[1], sys.argv[2], sys.argv[3]
lines = json.load(open(os.path.join(vdir, 'lines.json')))
args = ['ffmpeg', '-y', '-loglevel', 'error', '-framerate', '30', '-i', os.path.join(cap, 'f%05d.jpg'), '-i', os.path.join(cap, 'music.wav')]
for l in lines: args += ['-i', l['file']]
f = []
for i, l in enumerate(lines):
    ms = int(l['start'] * 1000)
    f.append('[%d:a]aresample=48000,aformat=channel_layouts=stereo,adelay=%d|%d[v%d]' % (i + 2, ms, ms, i))
f.append(''.join('[v%d]' % i for i in range(len(lines))) + 'amix=inputs=%d:normalize=0,highpass=f=90,equalizer=f=3500:t=q:w=1.2:g=3,volume=1.35,apad=whole_dur=30,asplit=2[voice][key]' % len(lines))
f.append('[1:a]volume=0.85[mus]')
f.append('[mus][key]sidechaincompress=threshold=0.03:ratio=4:attack=15:release=260:makeup=1[ducked]')
f.append('[ducked][voice]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=9[a]')
args += ['-filter_complex', ';'.join(f), '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
         '-profile:v', 'high', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', out]
subprocess.run(args, check=True)
print('wrote', out)
