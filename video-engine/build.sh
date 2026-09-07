#!/usr/bin/env bash
# Build the Viketa explainer video end-to-end.
# Usage: bash video-engine/build.sh [output.mp4]
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
OUT="${1:-/mnt/documents/viketa-promo.mp4}"
FRAMES_DIR="/tmp/viketa_frames_build"

rm -rf "$FRAMES_DIR"
mkdir -p "$FRAMES_DIR"

echo "[1/2] Rendering frames..."
cd "$DIR"
OUT_DIR_OVERRIDE="$FRAMES_DIR" python3 - <<PY
import os, sys
os.environ.setdefault("VIKETA_OUT_DIR", "$FRAMES_DIR")
sys.path.insert(0, ".")
import render
render.OUT_DIR = os.environ["VIKETA_OUT_DIR"]
render.main()
PY

echo "[2/2] Encoding MP4 -> $OUT"
ffmpeg -y -framerate 30 -i "$FRAMES_DIR/f_%05d.jpg" \
  -i "$DIR/assets/voiceover.mp3" \
  -c:v libx264 -crf 20 -pix_fmt yuv420p -preset medium \
  -c:a aac -b:a 192k -shortest "$OUT"

echo "Done: $OUT"
