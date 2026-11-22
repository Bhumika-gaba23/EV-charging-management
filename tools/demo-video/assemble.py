"""Turns out/frames + out/frames.json (from record.mjs) into a 1080p30 MP4 with a silent audio track."""
import json
from pathlib import Path
import subprocess
import sys

out = Path(__file__).resolve().parent / 'out'
data = json.loads((out / 'frames.json').read_text())
frames, end = data['frames'], data['started'] + data['marks'][-1]['at']
lines = ['ffconcat version 1.0']
for i, frame in enumerate(frames):
    nxt = frames[i + 1]['ts'] if i + 1 < len(frames) else end
    lines += [f"file '{frame['file']}'", f"duration {max(0.001, nxt - frame['ts']):.4f}"]
lines.append(f"file '{frames[-1]['file']}'")
(out / 'frames.ffconcat').write_text('\n'.join(lines) + '\n')
target = sys.argv[1] if len(sys.argv) > 1 else str(out / 'pluggo-demo.mp4')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', str(out / 'frames.ffconcat'),
                '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-t', f"{end - frames[0]['ts']:.2f}",
                '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
                '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', target], check=True)
print(target)
