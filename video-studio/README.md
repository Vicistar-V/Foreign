# Viketa Video Studio — everything an agent needs to know

This folder builds the faceless YouTube walkthrough of the Viketa app:
a 1920x1080 landscape video with a big headline on the left and a real
phone screen recording playing on the right, locked to a recorded voice-over.

Current finished output: **7:41 (461.76 s), ~22.5 MB**, at
`/mnt/documents/viketa-walkthrough.mp4`.

Read `CLIPS.md` next — it documents every single recorded clip one by one.

---

## 1. The three-layer idea (why it is built this way)

1. **Clip library** — the app is recorded once into 30 small, labelled,
   already-trimmed clips (`clips/`). Recording the browser is slow and
   fragile, so it is done **once** and the result is committed to the repo.
2. **Timeline** — a new voice-over never needs the browser. `timeline.py`
   maps each spoken sentence (from the SRT) to a clip id.
3. **Composer** — `compose.py` renders each timeline slot to its own small
   mp4, joins them with a stream copy, and muxes the voice. Nothing ever
   encodes 8 minutes in one shot, so it cannot time out, and a re-run
   skips work already done.

**The voice recording is the master clock.** Not the clips, not the
animations. Every boundary in `timeline.py` is copied out of the SRT, so
the picture always changes on the same breath as the words.

---

## 2. Files

| file | what it is |
|---|---|
| `clips.py` | The recorder. Defines every clip (`CLIPS`), drives Playwright, cuts on sync markers, writes `clips/clips.json`. |
| `clips/` | 30 finished mp4 clips + `clips.json` manifest. **In the repo on purpose** (small, browsable, travels with the code). |
| `timeline.py` | `SLOTS = [(start_sec, end_sec, clip_id_or_fx_scene, headline_text), ...]` — the edit decision list. |
| `compose.py` | Renders slots → segments → joins → muxes voice → writes the shot list. |
| `explainer.py` | The drawn motion-graphics scenes (`fx_*`), frame-by-frame with Pillow. |
| `recipe.py` | The on-camera person (`PERSON`), the signup URL, and legacy scene titles. |
| `capture.py` | **Legacy.** The old two-long-recordings approach. Superseded by `clips.py`. Kept for reference only; do not use it. |

Persistent scratch (never `/tmp`, so nothing is lost between runs):
`/mnt/documents/viketa_studio/`

| path | what it holds |
|---|---|
| `voice/voice.mp3` | The narration. **The master clock.** |
| `voice/voice.srt` | 88 cues, 461.9 s. Drives both the slot boundaries and the on-screen captions. |
| `segments/seg_NNN.mp4` | One rendered file per timeline slot. Delete a single one to re-render just that slot. |
| `bg.png` | The generated dark brand canvas with the phone slab. |
| `master_silent.mp4`, `concat.txt` | Join artefacts. |
| `state.json` | Playwright session of the **paid** demo member. Holds access tokens — never commit. |
| `_fresh_state.json`, `_fresh_run.json` | Session + details of the **unpaid** demo account. |
| `_raw/` | Raw Playwright `.webm` recordings, deleted after each cut. |

---

## 3. How a clip gets recorded frame-accurately (the sync-marker trick)

Playwright starts recording the moment the browser context opens, so all the
boring setup (navigating, logging in, replaying form steps) is on the tape.
To find the real action:

- Right before the action the recorder injects a **full-screen white div**
  for 0.5 s, removes it for 0.3 s, and flashes it **again** — a *twin*
  white flash. The app is dark, so it can never produce this by itself.
- At the end it flashes white **once**.
- `white_marks()` runs `ffmpeg -vf negate,blackdetect` (a white card is a
  black card after `negate`) and lists every flash.
- `find_window()` takes the **second card of the twin pair** as the start
  and the **next single card** as the end.
- `cut()` trims `start + 0.12 s` → `end - 0.08 s` and re-encodes to
  450x976 @ 30 fps, CRF 20, no audio.

No clocks, no guessing, no drift. If a clip ever fails with
`no twin start marker found`, the page was navigating during the flash —
move the navigation into `setup`.

---

## 4. Recording

The dev server must be running at `http://localhost:8080`
(override with `VIKETA_BASE_URL`).

```bash
python3 video-studio/clips.py --list                 # catalogue + durations
python3 video-studio/clips.py --group pub            # one group
python3 video-studio/clips.py --only 24_calculator_tap_plus_to_five_shares_25000_gets_50000
python3 video-studio/clips.py --all --fresh          # re-record everything
```

- Resumable: an existing clip is skipped unless `--fresh` is passed.
- Each clip gets its **own** browser context, so one failure never poisons
  the rest.
- Outbound document requests to anything other than localhost / supabase.co
  are aborted, so no third-party page can ever appear in a recording.
- Recording viewport is **450x975, `is_mobile=True`, `has_touch=True`,
  `device_scale_factor=1`, scrollbars hidden.** This project is
  mobile-first; never record desktop.

### Scrolling gotcha (important)

The app keeps its own scrolling box (a `<main>` with `overflow-y`), so
`window.scrollTo` and `mouse.wheel` do nothing in a touch context. All
scrolling goes through `SCROLLER_JS`, which finds the **tallest element
whose `scrollHeight > clientHeight + 40` and whose `overflow-y` is
auto/scroll** and scrolls that. If a future layout change breaks scrolling
in clips, this is the function to fix.

### Never do these in a clip

- Never leave a truly frozen frame — use `_act_hold()`, which adds a ±18 px
  drift so the encoder and YouTube both see motion.
- Never use an email/name containing "demo", "test", "example" or
  "playwright". The person in `recipe.py` looks like a real Nigerian user
  on purpose (`CHINEDU EMEKA OKAFOR`, a plain Gmail address, a real Lagos
  phone shape). A single "demo@" on screen destroys the video's credibility.
- Never let the activation-celebration route cover a shot — see the
  `dismiss_activation_screen` localStorage priming in `clips.py`.
- Never record while a skeleton loader is on screen — wait on real text
  (`"UPCOMING PAYOUT"`) or on real images (`naturalWidth > 150`).

---

## 5. Making a new demo account (for `fresh` and `member` clips)

1. Run the signup clips; `16_signup_tap_create_account_lands_on_dashboard`
   creates a real account and (with `saves_state`) writes
   `_fresh_state.json` + `_fresh_run.json` (email, password, user_id).
2. That account is the `fresh` group's session — signed up, nothing paid.
3. To get the `member` session, flip that same account to paid **in the
   database** (no real money moves): mark the membership active and give it
   5 active shares/spots with a payout target, then log that account in
   once and save the storage state to `state.json`.
4. Do this with the Supabase tools, using the `user_id` from
   `_fresh_run.json`. Keep the account looking ordinary: real-looking name,
   an avatar (`AVATAR_URL` in `recipe.py`), a PIN set — the PIN and avatar
   are pre-set so the "set your PIN / picture" screens never interrupt.

After any full user-data wipe, **all `fresh` and `member` clips are stale**
and must be re-recorded, because their sessions no longer exist.

---

## 6. The drawn scenes (`fx_*`)

The first ~2:41 of the video is not a screen recording — it is drawn frame
by frame in `explainer.py` (Pillow → PNG frames → x264). Scene ids start
with `fx_` and `compose.py` routes them to `explainer.render()`.

| scene | window in the current cut | what it explains |
|---|---|---|
| `fx_hook` | 0:00–0:11.9 | ₦5,000 → ₦10,000 in one moving line |
| `fx_agenda` | 0:11.9–0:42 | the five things this video will show |
| `fx_how` | 0:42–1:21 | companies pay for opinions |
| `fx_price` | 1:21–1:42.8 | 1 share: ₦5,000 → ₦10,000 |
| `fx_three` | 1:42.8–1:51.9 | 3 shares: ₦15,000 → ₦30,000 |
| `fx_five` | 1:51.9–2:00.8 | 5 shares: ₦25,000 → ₦50,000 |
| `fx_time` | 2:00.8–2:13.9 | same ~15 minutes either way |
| `fx_progress` | 2:13.9–2:28.7 | the campaign bar moving to 100% |
| `fx_bank` | 2:28.7–2:41.8 | the credit alert landing in your bank |

Rules that keep them looking professional:

- **Brand palette only** — dark `#070C0A`/`#040807` background, green
  `#10B981` / `#34D399`, white `#F5FAF8`, grey `#8C9894`, orange `#F9922E`.
- **Inter** from `/dev-server/video-engine/assets/fonts` (Black, Bold,
  SemiBold, Regular). If those files move, the drawn text silently falls
  back to a bitmap default and looks broken — check this first if fx text
  goes ugly.
- Nothing is ever static: `breathe()` gives a slow float, easing functions
  (`ease`, `out_back`, `seg`) stagger every element in.
- **Captions**: `caption_overlay()` reads the SRT and reveals the current
  phrase **word by word** in a box at `1010,842 → 1840,1018`. It receives
  the *absolute* video time (`global_start + t`), which is why
  `compose.py` passes `global_start=start`. Text wraps at **44 characters
  and shows the last 2 lines** — going wider than 44 makes text bleed
  outside the box (this was a real bug; do not raise it).
- Anything drawn below y≈820 on the right half will collide with the
  caption box. Keep secondary lines above it.

---

## 7. Composing the final video

```bash
python3 video-studio/compose.py           # resumes: only builds missing segments
python3 video-studio/compose.py --fresh   # rebuilds every segment
```

Environment overrides: `VIKETA_WORK_DIR`, `VIKETA_CLIP_DIR`, `VIKETA_OUT`,
`VIKETA_VOICE`, `VIKETA_SRT`, `VIKETA_W`, `VIKETA_H`.

What it does, in order:

1. `build_background()` draws `bg.png`: dark canvas, two blurred green
   glows, a rounded phone slab on the right, "VIKETA / viketa.xyz" top-left.
   Returns the phone geometry `(x0, y0, pw, ph)`.
2. For each slot: `fx_` → drawn animation; otherwise take the clip file,
   `fps=30`, scale to the phone slab, overlay it on `bg.png`, and burn the
   slot's headline on the left at `x=120`, vertically centred, fading in
   with `alpha='min(1,max(0,t*2.5))'`.
3. Duration fitting: `frame_window()` quantises both boundaries to whole
   frames **before** computing length, so per-segment rounding can never
   accumulate drift across 88 cuts. The clip is slowed by
   `k = max(window / clip, 1.0)` — never sped up, never looped.
4. Join all segments with `-f concat -c copy` (instant, cannot time out).
5. Mux `voice.mp3` with `-c:v copy -c:a aac -b:a 192k -shortest
   -movflags +faststart`.
6. `write_docs()` writes `/mnt/documents/viketa-walkthrough-shotlist.md`
   and a copy of the narration SRT.

### Never let the render "time out"

The whole reason for segments is that no single ffmpeg call is long. The
join and the mux are stream copies (seconds). **Run `compose.py` in the
background and poll for the output file** — do not sit in a blocking wait
loop, and do not use a `wait`-style command that gives no feedback (that
has silently hidden a finished render before).

---

## 8. Building a video from a NEW voice-over

1. Drop the new `voice.mp3` and `voice.srt` into
   `/mnt/documents/viketa_studio/voice/`.
2. Read the **whole** SRT. Do not guess timings.
3. Rewrite `SLOTS` in `timeline.py`: one slot per narrated idea, with
   `start`/`end` **copied literally from the SRT cue times** so slots are
   contiguous and the last `end` equals the audio length.
4. Point each slot at a clip id (see `CLIPS.md`) or an `fx_` scene, and
   write the left-hand headline as 1–3 short lines separated by `\n`.
   Headlines must be grandma-plain: no jargon, and never the forbidden
   words (spot, line, queue, position, drop, cycle, mining, invest…) —
   say **share, campaign, picking pictures, pending balance, payout**.
5. Check the stretch table in `CLIPS.md`: if a window is much longer than
   any suitable clip, split it across two clips rather than over-stretching.
6. `rm /mnt/documents/viketa_studio/segments/seg_*.mp4` if slot count or
   boundaries changed (segment numbering is positional), then run
   `compose.py` in the background.
7. **QA every time:** grab frames across the whole timeline
   (`ffmpeg -ss <t> -i out.mp4 -frames:v 1 f.png`) at ~10 points and look
   at each one. Check: headline not clipped, caption box not overflowing,
   phone screen not letterboxed, no white sync flash left in a clip, no
   activation modal covering the app, no skeleton loaders, duration equals
   the audio length.

---

## 9. Known traps, all of them

- **Height 976, not 975.** Clips are 450x976 (even height for H.264). Any
  new compositing must match or the phone gets letterboxed.
- **Segment files are positional.** `seg_007.mp4` is "slot index 7". Change
  the slot order and you must delete the segments.
- **A segment is reused if it already exists and is long enough**
  (`probe(dst) > dur - 0.35`). If you change a headline but not the
  duration, delete that segment or the old text stays.
- **`recipe.py` `SCENES` is legacy.** `compose.py` still imports it as a
  fallback title source. Prefer putting the headline in the timeline slot.
- **`capture.py` is legacy** and records the old two long parts. Ignore it.
- **Sessions expire.** `state.json` / `_fresh_state.json` hold Supabase
  tokens. If `member`/`fresh` clips suddenly record a login page, the
  session is dead — re-mint it.
- **App copy drift.** Clips 04, 07, 23, 24, 37 show real prices, real
  payout boards and the real referral bonus. Change those numbers in the
  product and these clips must be re-recorded or the video lies.
- **Fonts.** Missing Inter files degrade silently to a bitmap font.
- **Never store studio assets in `/tmp`** — it resets, and re-recording the
  browser is the expensive part of this whole pipeline.

---

## 10. One-glance commands

```bash
# what clips exist, with durations and descriptions
python3 video-studio/clips.py --list

# re-record one clip
python3 video-studio/clips.py --only 33_task_page_todays_two_pictures_to_compare --fresh

# preview a single drawn scene
python3 video-studio/explainer.py fx_price 12

# build the video (run in background, then poll for the file)
python3 video-studio/compose.py

# inspect the result
ffprobe -v error -show_entries format=duration,size -of default=nw=1 \
  /mnt/documents/viketa-walkthrough.mp4
```
