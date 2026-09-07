"""
Viketa Video Studio — THE ANIMATED EXPLAINER.

The first part of the video is not a screen recording. It is a proper motion
piece drawn frame by frame (Pillow) and encoded to mp4, so the money story is
told with moving numbers, cards and bars instead of "here is a website".

Real screenshots taken from the phone recordings are reused inside a drawn
phone body, so the animation still shows the true app.

Every scene id used here starts with "fx_" so compose.py knows to draw it
instead of cutting a piece of screen recording.

    render(scene_id, seconds, out_mp4, headline)
"""
import math
import os
import re
import shutil
import subprocess
import tempfile
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

WORK = Path(os.environ.get("VIKETA_WORK_DIR", "/mnt/documents/viketa_studio"))
FRAMES = WORK / "frames"
FPS = 30
W, H = 1920, 1080

# ---- brand ---------------------------------------------------------------
BG_TOP = (7, 12, 10)
BG_BOT = (4, 8, 7)
GREEN = (16, 185, 129)
GREEN_SOFT = (52, 211, 153)
WHITE = (245, 250, 248)
GREY = (140, 152, 148)
CARD = (17, 24, 21)
CARD_LINE = (36, 48, 43)
ORANGE = (249, 146, 46)

FONT_DIR = Path("/dev-server/video-engine/assets/fonts")


def _font(name, size):
    p = FONT_DIR / name
    if p.exists():
        return ImageFont.truetype(str(p), size)
    return ImageFont.load_default()


def black(s):
    return _font("Inter-Black.ttf", s)


def bold(s):
    return _font("Inter-Bold.ttf", s)


def semi(s):
    return _font("Inter-SemiBold.ttf", s)


def reg(s):
    return _font("Inter-Regular.ttf", s)


# ---- tiny animation toolkit ---------------------------------------------
def clamp01(v):
    return 0.0 if v < 0 else (1.0 if v > 1 else v)


def ease(t):
    """smooth in-out"""
    t = clamp01(t)
    return t * t * (3 - 2 * t)


def out_back(t):
    """overshoot, for things that pop in"""
    t = clamp01(t)
    c = 1.70158
    t -= 1
    return 1 + (c + 1) * t ** 3 + c * t ** 2


def seg(t, start, dur):
    """0..1 progress of a piece that begins at `start` and lasts `dur`"""
    if dur <= 0:
        return 1.0
    return clamp01((t - start) / dur)


def naira(v):
    return "\u20a6" + f"{int(round(v)):,}"


def breathe(t, amp=6.0, speed=0.55):
    """slow float so nothing is ever frozen"""
    return math.sin(t * speed * 2 * math.pi) * amp


def _srt_time(value):
    h, m, tail = value.replace(",", ".").split(":")
    return int(h) * 3600 + int(m) * 60 + float(tail)


def load_captions():
    """Read the real voice timestamps so explainer copy is never guessed."""
    path = WORK / "voice" / "voice.srt"
    if not path.exists():
        path = WORK / "narration.srt"
    if not path.exists():
        return []
    cues = []
    for block in re.split(r"\n\s*\n", path.read_text(errors="replace").strip()):
        lines = [line.strip() for line in block.splitlines() if line.strip()]
        timing = next((line for line in lines if "-->" in line), None)
        if timing is None:
            continue
        pos = lines.index(timing)
        start, end = [part.strip() for part in timing.split("-->")]
        spoken = " ".join(lines[pos + 1:])
        spoken = re.sub(r"\b(vacator|catawox)\b", "Viketa", spoken, flags=re.I)
        for amount in ("5,000", "10,000", "15,000", "25,000", "30,000", "50,000"):
            spoken = spoken.replace(f"${amount}", f"₦{amount}")
        cues.append((_srt_time(start), _srt_time(end), spoken))
    return cues


CAPTIONS = load_captions()


def caption_overlay(img, absolute_t):
    """Reveal the current SRT phrase word by word at its exact timestamp."""
    cue = next((item for item in CAPTIONS if item[0] <= absolute_t < item[1]), None)
    if cue is None:
        return
    start, end, spoken = cue
    words = spoken.split()
    progress = (absolute_t - start) / max(0.1, end - start)
    shown = max(1, min(len(words), int(progress * len(words)) + 1))
    wrapped = textwrap.wrap(" ".join(words[:shown]), width=44)[-2:]
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer, "RGBA")
    d.rounded_rectangle([1010, 842, 1840, 1018], radius=26,
                        fill=(5, 12, 9, 238), outline=GREEN + (150,), width=2)
    d.text((1050, 870), "WHAT IS BEING EXPLAINED", font=semi(21), fill=GREEN + (255,))
    y = 912
    for line in wrapped:
        d.text((1050, y), line, font=semi(28), fill=WHITE + (255,))
        y += 40
    img.paste(layer, (0, 0), layer)


# ---- drawing helpers -----------------------------------------------------
_BG_CACHE = {}


def canvas():
    if "bg" not in _BG_CACHE:
        img = Image.new("RGB", (W, H), BG_TOP)
        d = ImageDraw.Draw(img)
        for y in range(H):
            k = y / H
            d.line([(0, y), (W, y)],
                   fill=(int(BG_TOP[0] + (BG_BOT[0] - BG_TOP[0]) * k),
                         int(BG_TOP[1] + (BG_BOT[1] - BG_TOP[1]) * k),
                         int(BG_TOP[2] + (BG_BOT[2] - BG_TOP[2]) * k)))
        glow = Image.new("RGB", (W, H), (0, 0, 0))
        gd = ImageDraw.Draw(glow)
        gd.ellipse([W - 900, -300, W + 300, 900], fill=(6, 58, 43))
        gd.ellipse([-300, H - 500, 700, H + 400], fill=(8, 34, 27))
        glow = glow.filter(ImageFilter.GaussianBlur(220))
        img = Image.blend(img, Image.blend(img, glow, 0.55), 1.0)
        d = ImageDraw.Draw(img)
        d.text((110, 74), "VIKETA", font=black(38), fill=GREEN)
        d.text((110, 124), "viketa.xyz", font=reg(24), fill=(110, 122, 118))
        _BG_CACHE["bg"] = img
    return _BG_CACHE["bg"].copy()


def alpha_layer():
    return Image.new("RGBA", (W, H), (0, 0, 0, 0))


def paste(img, layer):
    img.paste(layer, (0, 0), layer)


def card(d, box, radius=28, fill=CARD, line=CARD_LINE, alpha=255, width=2):
    x0, y0, x1, y1 = box
    d.rounded_rectangle([x0, y0, x1, y1], radius=radius,
                        fill=fill + (alpha,) if len(fill) == 3 else fill,
                        outline=line + (alpha,) if len(line) == 3 else line,
                        width=width)


def text(d, xy, s, font, fill=WHITE, a=255, anchor=None):
    col = fill + (int(a),) if len(fill) == 3 else fill
    d.text(xy, s, font=font, fill=col, anchor=anchor)


def wide(d, xy, s, font, fill=WHITE, a=255, track=6):
    """letter-spaced label"""
    x, y = xy
    for ch in s:
        text(d, (x, y), ch, font, fill, a)
        x += d.textlength(ch, font=font) + track
    return x


def headline_block(d, lines, t, y_center=None, size=86, lead=112, x=110):
    """The left-hand headline every animated scene shares."""
    lines = [l for l in lines if l is not None]
    f = black(size)
    top = (y_center if y_center is not None else H // 2) - len(lines) * lead // 2
    for i, line in enumerate(lines):
        p = ease(seg(t, 0.12 + i * 0.14, 0.55))
        dy = int((1 - p) * 34)
        text(d, (x, top + i * lead + dy), line, f, WHITE, 255 * p)
    return top + len(lines) * lead


def phone(img, screenshot, cx, cy, height=880, t=0.0, appear=1.0):
    """Draw a phone body with a real app screenshot inside it."""
    ph = int(height * appear + 1)
    pw = int(ph * 450 / 975)
    body = Image.new("RGBA", (pw + 34, ph + 34), (0, 0, 0, 0))
    bd = ImageDraw.Draw(body)
    bd.rounded_rectangle([0, 0, pw + 33, ph + 33], radius=52,
                         fill=(18, 23, 21, 255), outline=(48, 58, 53, 255), width=3)
    shot = screenshot.resize((pw, ph), Image.LANCZOS).convert("RGBA")
    mask = Image.new("L", (pw, ph), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, pw - 1, ph - 1], radius=38, fill=255)
    body.paste(shot, (17, 17), mask)
    y = int(cy - (ph + 34) / 2 + breathe(t, 8))
    img.paste(body, (int(cx - (pw + 34) / 2), y), body)
    return int(cx - (pw + 34) / 2), y, pw + 34, ph + 34


def shot(name):
    p = FRAMES / f"{name}.png"
    if p.exists():
        return Image.open(p).convert("RGB")
    return Image.new("RGB", (450, 975), CARD)


def money_card(d, box, label, value, t, appear, accent=GREEN, sub=None):
    p = out_back(appear)
    x0, y0, x1, y1 = box
    cy = (y0 + y1) / 2
    h = (y1 - y0) * min(1.0, p)
    y0, y1 = cy - h / 2, cy + h / 2
    if h < 8:
        return
    a = int(255 * clamp01(appear * 1.4))
    d.rounded_rectangle([x0, y0, x1, y1], radius=26,
                        fill=CARD + (a,), outline=accent + (int(a * 0.55),), width=2)
    if appear > 0.35:
        aa = int(255 * clamp01((appear - 0.35) / 0.4))
        text(d, ((x0 + x1) / 2, y0 + 34), label, semi(26), GREY, aa, anchor="mm")
        text(d, ((x0 + x1) / 2, (y0 + y1) / 2 + 12), value, black(58), accent, aa, anchor="mm")
        if sub:
            text(d, ((x0 + x1) / 2, y1 - 34), sub, reg(24), GREY, aa, anchor="mm")


def arrow(d, x0, x1, y, p, color=GREEN):
    if p <= 0:
        return
    x = x0 + (x1 - x0) * ease(p)
    d.line([(x0, y), (x, y)], fill=color + (220,), width=6)
    if p > 0.75:
        d.polygon([(x1, y), (x1 - 26, y - 16), (x1 - 26, y + 16)], fill=color + (255,))


def progress_bar(d, box, p, label=None, color=GREEN):
    x0, y0, x1, y1 = box
    r = (y1 - y0) / 2
    d.rounded_rectangle([x0, y0, x1, y1], radius=r, fill=(24, 32, 29, 255))
    w = (x1 - x0) * clamp01(p)
    if w > 4:
        d.rounded_rectangle([x0, y0, x0 + max(w, 2 * r), y1], radius=r, fill=color + (255,))
    if label:
        text(d, (x1, y0 - 44), label, bold(34), WHITE, 255, anchor="rs")


# ---- the scenes ----------------------------------------------------------
def fx_hook(img, d, t, dur):
    """0:00 — the whole promise in one moving line."""
    text(d, (110, 240), "THE WHOLE THING, IN PLAIN WORDS", semi(30), GREEN,
         255 * ease(seg(t, 0.2, 0.8)))
    headline_block(d, ["How \u20a65,000", "becomes", "\u20a610,000"], t, y_center=470, size=104, lead=126)

    # right side: pay card -> arrow -> get card, then the profit stamp
    p1 = seg(t, 1.6, 0.9)
    p2 = seg(t, 3.4, 0.9)
    ar = seg(t, 2.9, 0.7)
    money_card(d, (1090, 330, 1380, 620), "YOU PAY", naira(5000), t, p1, GREEN_SOFT, "one ad share")
    arrow(d, 1405, 1495, 475, ar)
    grow = ease(seg(t, 4.0, 1.6))
    money_card(d, (1520, 330, 1830, 620), "YOU GET", naira(5000 + 5000 * grow), t, p2,
               GREEN, "when the campaign ends")

    p3 = seg(t, 6.0, 0.8)
    if p3 > 0:
        a = int(255 * ease(p3))
        pulse = 1 + 0.02 * math.sin(t * 3.2)
        w = int(520 * pulse)
        x0 = 1460 - w // 2

        d.rounded_rectangle([x0, 700, x0 + w, 800], radius=50,
                            fill=(6, 40, 30, a), outline=GREEN + (a,), width=2)
        text(d, (x0 + w / 2, 750), "\u20a65,000 pure profit", bold(40), GREEN, a, anchor="mm")

    p4 = seg(t, 8.5, 1.0)
    if p4 > 0:
        a = int(255 * ease(p4))
        text(d, (1090, 860), "No selling.  No referrals needed.", reg(32), GREY, a)
        text(d, (1090, 910), "About 15 minutes a day on your phone.", reg(32), GREY, a)

    # the long tail of this scene keeps moving: three facts take turns
    facts = ["Your name, your own bank account.",
             "Every share is the same \u20a65,000.",
             "You are paid when the campaign finishes."]
    if t > 11.0:
        k = (t - 11.0) / 4.2
        i = int(k) % len(facts)
        f = k - int(k)
        a = int(255 * min(ease(f / 0.25), ease((1 - f) / 0.25), 1.0))
        text(d, (1090, 990), facts[i], semi(30), GREEN_SOFT, max(a, 0))



def fx_agenda(img, d, t, dur):
    """0:25 — what the viewer is about to see, start to finish."""
    headline_block(d, ["Everything,", "from start", "to finish"], t, y_center=470, size=92)
    rows = [
        ("1", "How the money works"),
        ("2", "Opening your account"),
        ("3", "Paying for your share"),
        ("4", "Rating pictures each day"),
        ("5", "Money in your bank"),
    ]
    for i, (n, label) in enumerate(rows):
        p = ease(seg(t, 1.2 + i * 0.7, 0.7))
        if p <= 0:
            continue
        y = 250 + i * 128 + int(breathe(t, 5, 0.28 + 0.04 * i))
        x = 1080 + int((1 - p) * 90)
        a = int(255 * p)
        d.rounded_rectangle([x, y, x + 760, y + 96], radius=24,
                            fill=CARD + (a,), outline=CARD_LINE + (a,), width=2)
        d.ellipse([x + 22, y + 22, x + 74, y + 74], fill=(6, 46, 34, a), outline=GREEN + (a,), width=2)
        text(d, (x + 48, y + 48), n, bold(30), GREEN, a, anchor="mm")
        text(d, (x + 100, y + 48), label, semi(34), WHITE, a, anchor="lm")



def fx_how(img, d, t, dur):
    """0:42 — brands pay -> you rate -> you get paid."""
    text(d, (110, 230), "WHERE THE MONEY COMES FROM", semi(30), GREEN,
         255 * ease(seg(t, 0.2, 0.8)))
    headline_block(d, ["Brands pay", "for real", "opinions"], t, y_center=520, size=92)

    steps = [
        ("A company", "pays Viketa to learn", "which advert people like"),
        ("You", "pick the better picture", "about 15 minutes a day"),
        ("Your share", "fills up to \u20a610,000", "then it goes to your bank"),
    ]
    bx = 1040
    # once all three are up, a soft ring walks down the list so the long
    # stretch of narration always has something moving.
    walk = int((t - 10.0) / 3.4) % 3 if t > 10.0 else -1
    for i, (title, l1, l2) in enumerate(steps):
        p = out_back(seg(t, 1.6 + i * 2.6, 1.0))
        if p <= 0:
            continue
        a = int(255 * clamp01(seg(t, 1.6 + i * 2.6, 0.6) * 1.3))
        y = 250 + i * 220 + int(breathe(t, 5, 0.3 + 0.05 * i))
        sy = int((1 - min(p, 1)) * 40)
        live = (i == walk)
        outline = GREEN if live else CARD_LINE
        d.rounded_rectangle([bx, y - sy, bx + 800, y + 180 - sy], radius=28,
                            fill=(12, 30, 24, a) if live else CARD + (a,),
                            outline=outline + (a,), width=3 if live else 2)
        d.ellipse([bx + 30, y + 52 - sy, bx + 106, y + 128 - sy],
                  fill=(6, 46, 34, a), outline=GREEN + (a,), width=3)
        text(d, (bx + 68, y + 90 - sy), str(i + 1), black(38), GREEN, a, anchor="mm")
        text(d, (bx + 136, y + 52 - sy), title, black(38), WHITE, a)
        text(d, (bx + 136, y + 104 - sy), l1, reg(30), GREY, a)
        text(d, (bx + 136, y + 142 - sy), l2, reg(30), GREY, a)

        if i < 2:
            pl = ease(seg(t, 2.9 + i * 2.6, 0.6))
            if pl > 0:
                yy = y + 180 - sy
                d.line([(bx + 68, yy + 6), (bx + 68, yy + 6 + int(34 * pl))],
                       fill=GREEN + (200,), width=5)



def _share_math(img, d, t, dur, shares, headline_lines):
    """Shared layout for the 1 / 3 / 5 share money scenes."""
    headline_block(d, headline_lines, t, y_center=430, size=92)

    pay, get = 5000 * shares, 10000 * shares
    cols = min(shares, 5)
    gap, cw = 26, 150
    total_w = cols * cw + (cols - 1) * gap
    x0 = 1480 - total_w // 2
    for i in range(shares):
        p = out_back(seg(t, 1.1 + i * 0.45, 0.6))
        if p <= 0:
            continue
        a = int(255 * clamp01(seg(t, 1.1 + i * 0.45, 0.4) * 1.5))
        h = int(200 * min(p, 1.08))
        x = x0 + i * (cw + gap)
        y = 300 + (200 - h) // 2 + int(breathe(t, 4.5, 0.3 + 0.12 * i))
        d.rounded_rectangle([x, y, x + cw, y + h], radius=22,
                            fill=(10, 34, 27, a), outline=GREEN + (a,), width=2)
        if p > 0.5:
            text(d, (x + cw / 2, y + h / 2 - 22), "SHARE", semi(20), GREY, a, anchor="mm")
            text(d, (x + cw / 2, y + h / 2 + 20), f"{i + 1}", black(52), GREEN, a, anchor="mm")

    run = ease(seg(t, 1.1 + shares * 0.45, 1.4))
    a = int(255 * clamp01(run * 2))
    if run > 0:
        gy = int(breathe(t, 6, 0.5))
        d.rounded_rectangle([1130, 552 + gy, 1830, 742 + gy], radius=28,
                            fill=CARD + (a,), outline=CARD_LINE + (a,), width=2)
        text(d, (1300, 608 + gy), "YOU PAY", semi(26), GREY, a, anchor="mm")
        text(d, (1300, 672 + gy), naira(pay * run), black(56), WHITE, a, anchor="mm")
        d.line([(1480, 594 + gy), (1480, 700 + gy)], fill=CARD_LINE + (a,), width=2)
        text(d, (1660, 608 + gy), "YOU GET", semi(26), GREY, a, anchor="mm")
        text(d, (1660, 672 + gy), naira(get * run), black(56), GREEN, a, anchor="mm")


    p = ease(seg(t, 2.4 + shares * 0.45, 0.9))
    if p > 0:
        aa = int(255 * p)
        text(d, (1480, 780), f"{naira(get - pay)} profit \u00b7 same 15 minutes a day",
             semi(32), GREEN_SOFT, aa, anchor="mm")
        text(d, (1480, 820), "Every share costs the same \u20a65,000",
             reg(26), GREY, aa, anchor="mm")



def fx_price(img, d, t, dur):
    _share_math(img, d, t, dur, 1, ["1 share", "\u20a65,000", "pays \u20a610,000"])


def fx_three(img, d, t, dur):
    _share_math(img, d, t, dur, 3, ["3 shares", "\u20a615,000", "pays \u20a630,000"])


def fx_five(img, d, t, dur):
    _share_math(img, d, t, dur, 5, ["5 shares", "\u20a625,000", "pays \u20a650,000"])


def fx_time(img, d, t, dur):
    """1:53 — one share or five, the daily work is the same."""
    headline_block(d, ["Same 15", "minutes", "either way"], t, y_center=470, size=92)
    app = ease(seg(t, 0.3, 0.9))
    if app > 0.02:
        px, py, pw, ph = phone(img, shot("task"), 1420, H // 2, 860, t, max(app, 0.02))
        d2 = ImageDraw.Draw(img, "RGBA")
        # tap ripples on the picture the person is choosing
        for k in range(3):
            rp = seg(t, 2.0 + k * 2.2, 1.3)
            if 0 < rp < 1:
                r = int(30 + 130 * rp)
                a = int(180 * (1 - rp))
                cx = px + pw // 2
                cy = py + int(ph * (0.34 if k % 2 == 0 else 0.66))
                d2.ellipse([cx - r, cy - r, cx + r, cy + r], outline=GREEN + (a,), width=5)

    p = ease(seg(t, 5.0, 1.0))
    if p > 0:
        a = int(255 * p)
        d.rounded_rectangle([110, 760, 900, 900], radius=26,
                            fill=CARD + (a,), outline=CARD_LINE + (a,), width=2)
        text(d, (150, 796), "Tap the picture you like more.", semi(32), WHITE, a)
        text(d, (150, 844), "That is the whole job.", reg(30), GREY, a)


def fx_progress(img, d, t, dur):
    """2:28 — the share filling to 100%."""
    headline_block(d, ["3 to 5 days", "to 100%"], t, y_center=430, size=92)
    p = ease(seg(t, 0.6, dur - 1.6))
    d.rounded_rectangle([1080, 380, 1850, 700], radius=32,
                        fill=CARD + (255,), outline=CARD_LINE + (255,), width=2)
    text(d, (1120, 424), "YOUR CAMPAIGN", semi(26), GREY)
    text(d, (1810, 424), f"{int(p * 100)}%", black(40), GREEN, anchor="rt")
    progress_bar(d, (1120, 520, 1810, 566), p)
    text(d, (1120, 604), naira(10000 * p), black(48), WHITE)
    text(d, (1810, 620), "of \u20a610,000", reg(28), GREY, anchor="rt")
    if p > 0.985:
        a = int(255 * ease(seg(t, dur - 1.4, 0.6)))
        text(d, (1120, 760), "Full. Money released.", bold(38), GREEN, a)


def fx_bank(img, d, t, dur):
    """2:35 — the bank alert."""
    headline_block(d, ["Then it goes", "to your bank"], t, y_center=430, size=92)
    p = out_back(seg(t, 0.5, 0.8))
    if p > 0:
        a = int(255 * clamp01(seg(t, 0.5, 0.5) * 2))
        x = 1080 + int((1 - min(p, 1)) * 120)
        y = 400 + int(breathe(t, 6))
        d.rounded_rectangle([x, y, x + 760, y + 260], radius=30,
                            fill=(9, 30, 24, a), outline=GREEN + (a,), width=2)
        text(d, (x + 40, y + 40), "CREDIT ALERT", semi(26), GREEN, a)
        text(d, (x + 40, y + 96), naira(10000), black(76), WHITE, a)
        text(d, (x + 40, y + 190), "Paid into your own bank account", reg(28), GREY, a)


SCENES = {
    "fx_hook": fx_hook,
    "fx_agenda": fx_agenda,
    "fx_how": fx_how,
    "fx_price": fx_price,
    "fx_three": fx_three,
    "fx_five": fx_five,
    "fx_time": fx_time,
    "fx_progress": fx_progress,
    "fx_bank": fx_bank,
}


def render(scene_id, seconds, out_path, fps=FPS, global_start=0.0):
    """Draw every frame of an animated scene and encode it to mp4."""
    fn = SCENES[scene_id]
    n = max(1, int(round(seconds * fps)))
    tmp = Path(tempfile.mkdtemp(prefix=f"fx_{scene_id}_"))
    try:
        for i in range(n):
            t = i / fps
            img = canvas()
            layer = alpha_layer()
            d = ImageDraw.Draw(layer, "RGBA")
            fn(img, d, t, seconds)
            paste(img, layer)
            caption_overlay(img, global_start + t)
            img.save(tmp / f"f{i:05d}.png")
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(fps),
             "-i", str(tmp / "f%05d.png"), "-r", str(fps),
             "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
             "-pix_fmt", "yuv420p", "-an", str(out_path)], check=True)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return out_path


if __name__ == "__main__":
    import sys
    sid = sys.argv[1] if len(sys.argv) > 1 else "fx_hook"
    secs = float(sys.argv[2]) if len(sys.argv) > 2 else 6.0
    render(sid, secs, f"/tmp/{sid}.mp4")
    print("ok")
