"""Parallel frame renderer."""
import os, sys, time, multiprocessing as mp
sys.path.insert(0, os.path.dirname(__file__))
from scene import render_frame, TOTAL_FRAMES, FPS

OUT_DIR = "/tmp/viketa_frames_v4"

def render_one(i):
    path = os.path.join(OUT_DIR, f"f_{i:05d}.jpg")
    if os.path.exists(path):
        return i
    img = render_frame(i)
    img.save(path, "JPEG", quality=88)
    return i

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    start, end = 0, TOTAL_FRAMES
    if len(sys.argv) >= 3:
        start = int(sys.argv[1]); end = int(sys.argv[2])
    frames = list(range(start, end))
    workers = min(16, mp.cpu_count())
    print(f"Rendering {len(frames)} frames with {workers} workers...")
    t0 = time.time()
    done = 0
    with mp.Pool(workers) as p:
        for _ in p.imap_unordered(render_one, frames, chunksize=8):
            done += 1
            if done % 200 == 0:
                el = time.time()-t0
                print(f"  {done}/{len(frames)}  {done/el:.1f} fps  ({el:.0f}s)")
    print(f"Done in {time.time()-t0:.0f}s")

if __name__ == "__main__":
    main()
