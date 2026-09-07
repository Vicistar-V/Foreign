"""
Viketa Video Studio — COMPOSER (voice-locked, chunked, resumable).

Takes the two phone recordings + the recorded voice and builds the finished
landscape video:

    [ big headline text ]        [ phone screen, playing ]

The voice is the master clock. For every slot in timeline.py the matching
recorded scene is stretched (slowed) or trimmed so it lands exactly on the
words being spoken.

Why chunked: every slot is rendered to its own small mp4 first, then all the
pieces are joined with a stream copy and the voice is muxed in with another
stream copy. Nothing ever has to encode 8 minutes in one shot, and a re-run
skips the pieces that already exist, so this can never die halfway again.

    python3 video-studio/compose.py            build (resumes)
    python3 video-studio/compose.py --fresh    rebuild every piece
"""
import json, os, subprocess, sys, textwrap
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from timeline import SLOTS
from recipe import SCENES  # legacy titles, unused by the clip library

WORK = Path(os.environ.get("VIKETA_WORK_DIR", "/mnt/documents/viketa_studio"))
SEGS = WORK / "segments"
OUT = Path(os.environ.get("VIKETA_OUT", "/mnt/documents/viketa-walkthrough.mp4"))
VOICE = Path(os.environ.get("VIKETA_VOICE", str(WORK / "voice" / "voice.mp3")))
SRT = Path(os.environ.get("VIKETA_SRT", str(WORK / "voice" / "voice.srt")))

W, H = int(os.environ.get("VIKETA_W", 1920)), int(os.environ.get("VIKETA_H", 1080))
PHONE_H = int(H * 0.889)
FPS = 30

BG = (8, 11, 10)
GREEN = (16, 185, 129)
S = H / 1080.0


def sc(v):
    return int(round(v * S))


def font_file():
    for p in ("/dev-server/video-engine/assets/fonts/Inter-Bold.ttf",
              "/dev-server/video-engine/assets/fonts/Inter-Regular.ttf"):
        if Path(p).exists():
            return p
    cands = list(Path("/dev-server/video-engine/assets/fonts").glob("*.ttf"))
    if cands:
        return str(cands[0])
    out = subprocess.run(["fc-match", "-f", "%{file}", "sans-serif:bold"],
                         capture_output=True, text=True).stdout.strip()
    return out or "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"


def probe(path, stream="v"):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", str(path)],
        capture_output=True, text=True, check=True).stdout.strip()
    return float(out)


def build_background(path):
    """Dark brand canvas with a soft green glow behind the phone slab."""
    from PIL import Image, ImageDraw, ImageFilter, ImageFont

    img = Image.new("RGB", (W, H), BG)
    glow = Image.new("RGB", (W, H), BG)
    gd = ImageDraw.Draw(glow)
    px = W - sc(520)
    gd.ellipse([px - sc(430), H // 2 - sc(560), px + sc(430), H // 2 + sc(560)], fill=(6, 60, 44))
    gd.ellipse([sc(120), H - sc(260), sc(900), H + sc(260)], fill=(14, 40, 33))
    glow = glow.filter(ImageFilter.GaussianBlur(sc(150)))
    img = Image.blend(img, glow, 0.9)

    d = ImageDraw.Draw(img)
    pw, ph = int(PHONE_H * 450 / 975), PHONE_H
    x0, y0 = px - pw // 2, (H - ph) // 2
    d.rounded_rectangle([x0 - sc(14), y0 - sc(14), x0 + pw + sc(14), y0 + ph + sc(14)],
                        radius=sc(54), fill=(20, 24, 22), outline=(45, 52, 48), width=2)

    f = font_file()
    try:
        d.text((sc(120), sc(80)), "VIKETA", font=ImageFont.truetype(f, sc(40)), fill=GREEN)
        d.text((sc(120), sc(132)), "viketa.xyz",
               font=ImageFont.truetype(f, sc(24)), fill=(120, 130, 125))
    except Exception:
        pass

    img.save(path)
    return x0, y0, pw, ph


def esc(t):
    return (t.replace("\\", "\\\\").replace(":", "\\:")
             .replace("'", "\u2019").replace("%", "\\%"))


def load_scene_index():
    """clip id -> (file, start, end), straight from the clip library.

    Every clip is its own already-trimmed file, so the window is simply the
    whole file. Clips live in the repo at video-studio/clips/.
    """
    lib = Path(os.environ.get("VIKETA_CLIP_DIR",
                              str(Path(__file__).resolve().parent / "clips")))
    man = lib / "clips.json"
    if not man.exists():
        return {}
    idx = {}
    for cid, c in json.loads(man.read_text()).items():
        f = lib / c["file"]
        if f.exists():
            idx[cid] = (f, 0.0, float(c["duration"]))
    return idx


def frame_window(start, end):
    """Quantize boundaries once so segment rounding cannot accumulate drift."""
    first = round(start * FPS)
    last = round(end * FPS)
    return first, last, max(1, last - first)


def render_fx(i, slot):
    """Fully drawn motion-graphics scene — no phone recording involved."""
    import explainer

    start, end, scene_id, headline = slot
    _, _, frames = frame_window(start, end)
    dur = frames / FPS
    dst = SEGS / f"seg_{i:03d}.mp4"
    if dst.exists() and probe(dst) > dur - 0.35:
        print(f"  [{i:02d}] {scene_id}: already built", flush=True)
        return dst
    print(f"  [{i:02d}] {scene_id}: drawing {dur:.1f}s of animation", flush=True)
    explainer.render(scene_id, dur, dst, fps=FPS, global_start=start)
    return dst


def render_slot(i, slot, index, bgp, geom, font):
    start, end, scene_id, headline = slot
    if scene_id.startswith("fx_"):
        return render_fx(i, slot)

    _, _, frames = frame_window(start, end)
    dur = frames / FPS
    dst = SEGS / f"seg_{i:03d}.mp4"
    if dst.exists() and probe(dst) > dur - 0.35:
        print(f"  [{i:02d}] {scene_id}: already built", flush=True)
        return dst

    if scene_id not in index:
        raise SystemExit(f"scene '{scene_id}' was never recorded — run capture.py first")
    src, s0, s1 = index[scene_id]
    clip = max(0.4, s1 - s0)

    # The narration owns the duration. Play each recorded action once and
    # reach its completed state exactly at the phrase boundary.
    k = max(dur / clip, 1.0)

    x0, y0, pw, ph = geom
    lines = (headline or SCENES.get(scene_id, {}).get("title", "")).split("\n")
    line_h, fsize = sc(92), sc(72)
    top = (H - len(lines) * line_h) // 2
    draws = []
    for j, line in enumerate(lines):
        if not line.strip():
            continue
        draws.append(
            f"drawtext=fontfile='{font}':text='{esc(line)}':x={sc(120)}:"
            f"y={top + j * line_h}:fontsize={fsize}:fontcolor=white:"
            f"alpha='min(1,max(0,t*2.5))'")

    chain = (
        f"[1:v]fps={FPS},scale={pw}:{ph}:flags=lanczos,setsar=1,"
        f"setpts={k:.6f}*(PTS-STARTPTS),tpad=stop_mode=clone:stop_duration=30[ph];"
        f"[0:v][ph]overlay={x0}:{y0}[base];"
        "[base]" + (",".join(draws) if draws else "null") + "[v]"
    )

    cmd = ["ffmpeg", "-y", "-loglevel", "error",
           "-loop", "1", "-i", str(bgp),
           "-ss", f"{s0:.3f}", "-t", f"{clip:.3f}", "-i", str(src),
           "-filter_complex", chain, "-map", "[v]",
           "-t", f"{dur:.3f}", "-r", str(FPS),
           "-c:v", "libx264", "-preset", "veryfast", "-crf", "22",
           "-pix_fmt", "yuv420p", "-an", str(dst)]
    print(f"  [{i:02d}] {scene_id}: {dur:.1f}s (clip {clip:.1f}s, x{k:.2f})", flush=True)
    subprocess.run(cmd, check=True)
    return dst



def main():
    fresh = "--fresh" in sys.argv
    SEGS.mkdir(parents=True, exist_ok=True)
    if fresh:
        for f in SEGS.glob("seg_*.mp4"):
            f.unlink()

    index = load_scene_index()
    needed = {s[2] for s in SLOTS if not s[2].startswith("fx_")}
    missing = sorted(needed - set(index))
    if missing:
        raise SystemExit("missing recordings for: " + ", ".join(missing))


    bgp = WORK / "bg.png"
    geom = build_background(bgp)
    font = font_file()

    parts = [render_slot(i, slot, index, bgp, geom, font)
             for i, slot in enumerate(SLOTS)]

    # join (stream copy — instant, cannot time out)
    listf = WORK / "concat.txt"
    listf.write_text("\n".join(f"file '{p}'" for p in parts))
    silent = WORK / "master_silent.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0",
                    "-i", str(listf), "-c", "copy", str(silent)], check=True)

    # voice (stream copy on video)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    if VOICE.exists():
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error",
                        "-i", str(silent), "-i", str(VOICE),
                        "-map", "0:v", "-map", "1:a",
                        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                        "-shortest", "-movflags", "+faststart", str(OUT)], check=True)
    else:
        print("  ! no voice file, shipping silent master", flush=True)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(silent),
                        "-c", "copy", "-movflags", "+faststart", str(OUT)], check=True)

    write_docs()
    print(f"done: {OUT} ({OUT.stat().st_size/1e6:.1f} MB, {probe(OUT):.1f}s)", flush=True)


def ts(sec):
    m, s = divmod(sec, 60)
    return f"{int(m):02d}:{s:05.2f}"


def write_docs():
    """A human-readable shot list, so a new voice can be recorded to match."""
    md = ["# Viketa walkthrough — shot list (voice-locked)", "",
          "The voice recording is the master clock. Each block below is the exact",
          "window that piece of screen is on camera. Re-record the voice with the",
          "same section lengths and everything still lands perfectly.", ""]
    for i, (start, end, scene, headline) in enumerate(SLOTS, 1):
        title = (headline or SCENES.get(scene, {}).get("title", "")).replace("\n", " / ")
        md.append(f"### {ts(start)} → {ts(end)}  ·  {scene}")
        md.append(f"*on screen:* {title}")
        md.append("")
    docs = Path("/mnt/documents")
    docs.mkdir(parents=True, exist_ok=True)
    (docs / "viketa-walkthrough-shotlist.md").write_text("\n".join(md))
    if SRT.exists():
        (docs / "viketa-walkthrough-narration.srt").write_text(SRT.read_text())


if __name__ == "__main__":
    main()
