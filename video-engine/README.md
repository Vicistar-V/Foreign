# Viketa Explainer Video Engine

Phrase-synced kinetic typography renderer that produces the 9:16 (1080x1920)
Viketa explainer video. All source, fonts, and the voiceover live here so the
video can be rebuilt from scratch at any time.

## Files
- `moments.py` — phrase-level timeline (timestamps mapped to scenes)
- `scene.py`   — drawing primitives + every scene's animation logic
- `render.py`  — parallel frame renderer (uses all CPU cores)
- `build.sh`   — one-shot: render frames + mux voiceover with ffmpeg
- `assets/fonts/` — Inter family + NotoColorEmoji (bundled, no download)
- `assets/voiceover.mp3` — final voiceover track

## Rebuild the video
```bash
bash video-engine/build.sh /mnt/documents/viketa-promo.mp4
```

Output: 1080x1920 @ 30fps, ~137s, H.264 + AAC. Takes ~2-3 min on 16 cores.

## Tweak a scene
Edit `scene.py` (look for the named `scene_*` functions) or adjust phrase
timing in `moments.py`, then re-run `build.sh`.
