"""
Viketa explainer — phrase-synced renderer (v4).

Design:
- 1080x1920 vertical, 30 fps
- Dark cinematic base, Viketa green / gold / red accents
- Each MOMENT renders a self-contained visual that hits with the spoken phrase
- Active-word kinetic micro-subtitle floats above scene (only where useful)

Run via /tmp/viketa_video/render.py which spawns workers.
"""
import os, math, random, re, sys, json
from PIL import Image, ImageDraw, ImageFont, ImageFilter

sys.path.insert(0, os.path.dirname(__file__))
from moments import MOMENTS

# ---------- constants ----------
# Scenes are designed on a 1080x1920 canvas. Final output is cropped to a
# 4:5 (1080x1350) frame centered around the action band (y = 285..1635).
W, H = 1080, 1920
OUT_W, OUT_H = 1080, 1350
CROP_Y = (H - OUT_H) // 2  # 285
FPS = 30
DURATION = 137.0
TOTAL_FRAMES = int(DURATION * FPS)

# Colors
BG       = (8, 10, 14)
BG2      = (16, 20, 28)
CARD     = (22, 26, 34)
LINE_C   = (40, 46, 58)
FG       = (245, 247, 250)
MUTED    = (140, 148, 162)
GREEN    = (16, 185, 129)
GREEN_D  = (5, 120, 87)
GOLD     = (245, 158, 11)
RED      = (239, 68, 68)
BLUE     = (59, 130, 246)
NAIJA_G  = (0, 135, 81)
NAIJA_W  = (255, 255, 255)

_FONT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "fonts")
FONT_BLACK = os.path.join(_FONT_DIR, "Inter-Black.ttf")
FONT_BOLD  = os.path.join(_FONT_DIR, "Inter-Bold.ttf")
FONT_SEMI  = os.path.join(_FONT_DIR, "Inter-SemiBold.ttf")
FONT_REG   = os.path.join(_FONT_DIR, "Inter-Regular.ttf")
FONT_EMOJI = os.path.join(_FONT_DIR, "NotoColorEmoji.ttf")

_font_cache = {}
def F(path, size):
    k = (path, size)
    if k not in _font_cache:
        _font_cache[k] = ImageFont.truetype(path, size)
    return _font_cache[k]

# Emoji is a fixed 109px CBDT bitmap font; we render at 109 then scale.
_emoji_font = None
def emoji_font():
    global _emoji_font
    if _emoji_font is None:
        _emoji_font = ImageFont.truetype(FONT_EMOJI, 109)
    return _emoji_font

_emoji_cache = {}
def render_emoji(char, size):
    """Return RGBA Image of the emoji glyph at the given pixel height."""
    k = (char, size)
    if k in _emoji_cache:
        return _emoji_cache[k]
    src = Image.new("RGBA", (140, 140), (0, 0, 0, 0))
    d = ImageDraw.Draw(src)
    try:
        d.text((0, 0), char, font=emoji_font(), embedded_color=True)
    except Exception:
        pass
    # tight crop
    bbox = src.getbbox()
    if bbox:
        src = src.crop(bbox)
    if src.width == 0 or src.height == 0:
        src = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    # scale to target height
    scale = size / src.height
    new_w = max(1, int(src.width * scale))
    new_h = max(1, int(src.height * scale))
    out = src.resize((new_w, new_h), Image.LANCZOS)
    _emoji_cache[k] = out
    return out

def paste_emoji(img, char, cx, cy, size, opacity=1.0, rot=0):
    glyph = render_emoji(char, size)
    if rot:
        glyph = glyph.rotate(rot, resample=Image.BICUBIC, expand=True)
    if opacity < 1.0:
        a = glyph.split()[-1].point(lambda p: int(p * opacity))
        glyph = glyph.copy()
        glyph.putalpha(a)
    img.alpha_composite(glyph, (int(cx - glyph.width/2), int(cy - glyph.height/2)))

# ---------- easing ----------
def clamp(v, lo=0.0, hi=1.0): return max(lo, min(hi, v))
def ease_out_cubic(t): t = clamp(t); return 1 - (1 - t)**3
def ease_in_out(t): t = clamp(t); return 3*t*t - 2*t*t*t
def ease_out_back(t):
    t = clamp(t); c1=1.70158; c3=c1+1
    return 1 + c3*((t-1)**3) + c1*((t-1)**2)
def ease_in(t): t = clamp(t); return t*t

# ---------- text helpers ----------
def text_size(text, font):
    bb = font.getbbox(text)
    return bb[2] - bb[0], bb[3] - bb[1]

def draw_text(img, text, x, y, font, color=FG, opacity=1.0, anchor="lt", shadow=False):
    if not text: return
    r, g, b = color
    a = int(255 * clamp(opacity))
    tw, th = text_size(text, font)
    bb = font.getbbox(text)
    # anchor
    if "m" in anchor[0:1] or anchor == "mm":
        x -= tw / 2
    if anchor.endswith("m"):
        y -= th / 2 + bb[1]
    elif anchor.endswith("t"):
        y -= bb[1]
    # shadow
    if shadow and a > 0:
        sd = Image.new("RGBA", (tw + 40, th + 40), (0, 0, 0, 0))
        ImageDraw.Draw(sd).text((20, 20 - bb[1]), text, font=font, fill=(0, 0, 0, int(a*0.55)))
        sd = sd.filter(ImageFilter.GaussianBlur(8))
        img.alpha_composite(sd, (int(x - 20), int(y - 20)))
    d = ImageDraw.Draw(img)
    d.text((int(x), int(y)), text, font=font, fill=(r, g, b, a))

def wrap_text(text, font, max_w):
    words = text.split()
    lines, cur = [], ""
    for w in words:
        test = (cur + " " + w).strip()
        if text_size(test, font)[0] <= max_w:
            cur = test
        else:
            if cur: lines.append(cur)
            cur = w
    if cur: lines.append(cur)
    return lines

def draw_text_centered_block(img, text, cx, cy, font, color=FG, opacity=1.0,
                              max_w=900, line_gap=10, shadow=False):
    lines = wrap_text(text, font, max_w)
    sizes = [text_size(l, font) for l in lines]
    total_h = sum(s[1] for s in sizes) + line_gap * (len(lines)-1) if lines else 0
    y = cy - total_h/2
    for l, (tw, th) in zip(lines, sizes):
        draw_text(img, l, cx - tw/2, y, font, color, opacity, "lt", shadow=shadow)
        y += th + line_gap

# ---------- shapes ----------
def rounded_rect(img, x1, y1, x2, y2, r, fill=None, outline=None, width=2, opacity=1.0):
    layer = Image.new("RGBA", (img.width, img.height), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    f = None
    if fill is not None:
        f = (fill[0], fill[1], fill[2], int(255*opacity))
    o = None
    if outline is not None:
        o = (outline[0], outline[1], outline[2], int(255*opacity))
    d.rounded_rectangle([x1, y1, x2, y2], r, fill=f, outline=o, width=width)
    img.alpha_composite(layer)

def circle(img, cx, cy, r, fill=None, outline=None, width=2, opacity=1.0):
    rounded_rect(img, cx-r, cy-r, cx+r, cy+r, r, fill, outline, width, opacity)

def glow(img, cx, cy, r, color, intensity=0.5):
    g = Image.new("RGBA", (r*4, r*4), (0, 0, 0, 0))
    d = ImageDraw.Draw(g)
    d.ellipse([r, r, 3*r, 3*r], fill=(color[0], color[1], color[2], int(255*intensity)))
    g = g.filter(ImageFilter.GaussianBlur(r*0.6))
    img.alpha_composite(g, (int(cx - g.width/2), int(cy - g.height/2)))

# ---------- background ----------
def base_bg(scene_type, t_global):
    img = Image.new("RGBA", (W, H), BG + (255,))
    # subtle radial vignette and accent glow shifting per scene
    accent_map = {
        "warm": (245, 158, 11),
        "danger": (239, 68, 68),
        "green": (16, 185, 129),
        "blue": (59, 130, 246),
        "neutral": (60, 70, 90),
    }
    accent = accent_map.get(scene_type, accent_map["neutral"])
    drift_x = W/2 + math.sin(t_global*0.4)*120
    drift_y = H/2 + math.cos(t_global*0.3)*180
    glow(img, drift_x, drift_y, 520, accent, intensity=0.18)
    # bottom dark gradient
    grad = Image.new("RGBA", (1, H), (0,0,0,0))
    for y in range(H):
        a = int(180 * (y/H)**2)
        grad.putpixel((0, y), (0, 0, 0, a))
    grad = grad.resize((W, H))
    img.alpha_composite(grad)
    # film grain (subtle, deterministic per frame)
    return img

def progress_bar(img, t):
    p = clamp(t / DURATION)
    rounded_rect(img, 0, 0, W, 6, 0, fill=(40, 46, 58), opacity=1.0)
    rounded_rect(img, 0, 0, int(W*p), 6, 0, fill=GREEN, opacity=1.0)

def brand_chip(img, t):
    # tiny VIKETA chip top-left, after first 2s
    if t < 1.2: return
    op = ease_out_cubic((t-1.2)/0.6)
    rounded_rect(img, 36, 36, 230, 86, 25, fill=(0,0,0), opacity=0.55*op, outline=GREEN, width=2)
    # small green dot
    circle(img, 64, 61, 7, fill=GREEN, opacity=op)
    draw_text(img, "VIKETA", 86, 49, F(FONT_BOLD, 26), color=FG, opacity=op)

# ---------- per-scene drawings ----------
def scene_bg_type(name):
    return {
        "poverty_hit": "danger", "country": "danger", "breath": "neutral",
        "money_amount": "warm", "buy_data": "danger", "money_gone": "danger",
        "but_listen": "neutral", "earn_daily": "green", "calc_it": "warm",
        "math_5k": "green", "math_10k": "green",
        "thinking": "neutral", "sat_down": "neutral", "with_ai": "blue",
        "for_us_all": "green", "viketa_reveal": "green",
        "enter_3k": "green", "hold_spot": "warm", "world_joins": "blue",
        "line_by_line": "green", "distribute_line": "green",
        "from_3k_split": "green", "no_refer": "warm",
        "task_simple": "blue", "choose_image": "blue", "pending_balance": "warm",
        "line_reaches_you": "green", "back_of_line": "green",
        "do_tasks": "warm", "images_important": "warm",
        "sell_to_ai": "blue", "researched": "green",
        "simple_close": "green", "cta": "green",
    }.get(name, "neutral")

def title_keyword(img, text, cy, t_local, dur, big=130, color=FG, color_accent=GREEN):
    """Big slamming keyword. Auto-shrinks to fit width."""
    if not text: return
    font_size = big
    font = F(FONT_BLACK, font_size)
    while text_size(text, font)[0] > W - 120 and font_size > 60:
        font_size -= 6
        font = F(FONT_BLACK, font_size)
    # entrance: slam-in with overshoot, then settle
    in_t = clamp(t_local / 0.35)
    scale = 0.7 + 0.3 * ease_out_back(in_t)
    op = ease_out_cubic(t_local / 0.18)
    # slight breathing during display
    rest_t = max(0, t_local - 0.35)
    breath = 1.0 + 0.012 * math.sin(rest_t * 4.5)
    scale *= breath
    # render to its own layer for scaling
    tw, th = text_size(text, font)
    layer = Image.new("RGBA", (tw + 80, th + 80), (0, 0, 0, 0))
    bb = font.getbbox(text)
    # split colored words: numbers/₦ in accent
    parts = re.split(r"(₦[\d,kK]+(?:\.\d+)?|[\d,]+(?:\.\d+)?[kK]?|–|×)", text)
    x_cursor = 40
    for part in parts:
        if not part: continue
        c = color_accent if (part.startswith("₦") or re.match(r"^[\d,]+[kK]?$", part) or part in {"–","×"}) else color
        ImageDraw.Draw(layer).text((x_cursor, 40 - bb[1]), part, font=font, fill=c + (int(255*op),))
        x_cursor += text_size(part, font)[0]
    # scale
    nw = max(1, int(layer.width * scale))
    nh = max(1, int(layer.height * scale))
    layer = layer.resize((nw, nh), Image.LANCZOS)
    img.alpha_composite(layer, (int(W/2 - nw/2), int(cy - nh/2)))

def sub_line(img, text, cy, t_local, color=MUTED, size=44, dur=0.4):
    if not text: return
    op = ease_out_cubic(clamp((t_local - 0.2) / dur))
    if op <= 0: return
    yshift = (1 - op) * 14
    font = F(FONT_SEMI, size)
    draw_text_centered_block(img, text, W/2, cy + yshift, font, color=color, opacity=op, max_w=920)

# ---- individual scenes ----
def s_poverty_hit(img, t, m):
    # red pulsing vignette + slamming POVERTY + weary face
    pulse = 0.4 + 0.25 * abs(math.sin(t*4))
    glow(img, W/2, H/2, 600, RED, intensity=0.20 * pulse)
    paste_emoji(img, "😩", W/2, 520, 380, opacity=ease_out_cubic(t/0.4))
    title_keyword(img, m["keyword"], 1020, t, m["end"]-m["start"], big=200, color=RED, color_accent=RED)
    sub_line(img, m["sub"], 1200, t, color=FG)
    # falling money emoji (loss)
    if t > 0.6:
        for i, em in enumerate(["💸","💸","💸"]):
            tt = t - 0.6 - i*0.15
            if tt <= 0: continue
            y = 200 + tt*900
            x = 200 + i*340 + math.sin(tt*3)*30
            if y < H + 80:
                paste_emoji(img, em, x, y, 120, opacity=clamp(1.2 - tt*0.7))

def s_country(img, t, m):
    # Nigeria flag swoop in
    paste_emoji(img, "🇳🇬", W/2, 600, int(380 * ease_out_back(clamp(t/0.45))),
                opacity=ease_out_cubic(t/0.3))
    draw_text(img, "NIGERIA", W/2, 880, F(FONT_BLACK, 110),
              color=FG, opacity=ease_out_cubic((t-0.25)/0.4), anchor="mt")
    sub_line(img, "...this can't be normal.", 1100, t, color=MUTED, size=46)

def s_breath(img, t, m):
    # quiet transitional beat — slow drifting accent
    pass

def s_money_amount(img, t, m):
    paste_emoji(img, "💵", W/2, 560, 360, opacity=ease_out_cubic(t/0.3))
    title_keyword(img, "₦3,000", 920, t, m["end"]-m["start"], big=300, color=FG, color_accent=GOLD)
    sub_line(img, m["sub"], 1140, t, color=MUTED, size=44)
    # tag chip
    if t > 0.4:
        op = ease_out_cubic((t-0.4)/0.3)
        rounded_rect(img, W/2-200, 1240, W/2+200, 1310, 35, fill=GOLD, opacity=op)
        draw_text(img, "DAILY DATA", W/2, 1275, F(FONT_BOLD, 32), color=BG, opacity=op, anchor="mm")

def s_buy_data(img, t, m):
    paste_emoji(img, "📱", W/2 - 180, 580, 320, opacity=ease_out_cubic(t/0.25))
    paste_emoji(img, "📶", W/2 + 220, 540, 200,
                opacity=ease_out_cubic((t-0.2)/0.3))
    title_keyword(img, "Buying data…", 1000, t, m["end"]-m["start"], big=140, color=FG)
    sub_line(img, m["sub"], 1140, t, color=MUTED, size=42)
    # small money flying into phone
    for i in range(4):
        tt = (t + i*0.18) % 0.9
        op = 1 - tt/0.9
        x = W/2 + 320 - tt*450
        paste_emoji(img, "💵", x, 580 + math.sin(tt*6)*20, 70, opacity=op*0.9)

def s_money_gone(img, t, m):
    paste_emoji(img, "💨", W/2, 540, 300, opacity=ease_out_cubic(t/0.2))
    title_keyword(img, "Money gone.", 940, t, m["end"]-m["start"], big=170, color=RED, color_accent=RED)
    sub_line(img, m["sub"], 1080, t, color=MUTED, size=44)
    # red strike on ₦3,000
    op = ease_out_cubic((t-0.4)/0.4)
    if op > 0:
        font = F(FONT_BLACK, 110)
        txt = "₦3,000"
        tw, th = text_size(txt, font)
        x = W/2 - tw/2
        y = 1240
        draw_text(img, txt, x, y, font, color=MUTED, opacity=op*0.7)
        # strike
        sw = int(tw * clamp((t-0.55)/0.25))
        rounded_rect(img, x-10, y+th/2-4, x-10+sw+20, y+th/2+8, 4, fill=RED, opacity=op)

def s_but_listen(img, t, m):
    paste_emoji(img, "👂", W/2, 760, 420, opacity=ease_out_cubic(t/0.25))
    title_keyword(img, "But listen…", 1180, t, m["end"]-m["start"], big=150, color=FG, color_accent=GREEN)

def s_earn_daily(img, t, m):
    # ticking counter 5,000 -> 10,000
    paste_emoji(img, "🤑", W/2, 460, 320, opacity=ease_out_cubic(t/0.25))
    # animated number
    p = clamp((t-0.2)/2.2)
    val = int(5000 + (10000-5000) * ease_in_out(p))
    rounded_rect(img, W/2-440, 820, W/2+440, 1060, 50, fill=CARD, outline=GREEN, width=3, opacity=0.95)
    draw_text(img, f"₦{val:,}", W/2, 920, F(FONT_BLACK, 150), color=GREEN, opacity=1.0, anchor="mm")
    draw_text(img, "every single day", W/2, 1020, F(FONT_SEMI, 40), color=MUTED, opacity=1.0, anchor="mm")
    sub_line(img, "this is possible right now", 1180, t, color=FG, size=44)

def s_calc_it(img, t, m):
    paste_emoji(img, "🧮", W/2, 600, 380, opacity=ease_out_cubic(t/0.25))
    title_keyword(img, "Let's do the math.", 980, t, m["end"]-m["start"], big=110, color=FG)

def _math_scene(img, t, m, per_day, days, total):
    # row of 7 day cards lighting up, then big total
    paste_emoji(img, "📅", W/2 - 380, 400, 170, opacity=ease_out_cubic(t/0.2))
    draw_text(img, f"₦{per_day:,} / day", W/2 + 60, 400, F(FONT_BLACK, 68),
              color=GOLD, opacity=ease_out_cubic(t/0.25), anchor="lm")
    # 7 day pills
    card_w = 130; gap = 10
    total_w = 7 * card_w + 6 * gap
    x0 = W/2 - total_w/2
    for i in range(7):
        ti = (t - 0.4 - i*0.25)
        op = ease_out_cubic(clamp(ti/0.25))
        scale = 0.8 + 0.2 * ease_out_back(clamp(ti/0.3))
        cw = int(card_w * scale)
        ch = int(170 * scale)
        cx = int(x0 + i*(card_w+gap) + card_w/2)
        cy = 720
        rounded_rect(img, cx-cw/2, cy-ch/2, cx+cw/2, cy+ch/2, 24,
                     fill=GREEN if op>0.6 else CARD,
                     outline=GREEN, width=3, opacity=clamp(op+0.2))
        if op > 0.4:
            draw_text(img, str(i+1), cx, cy-22, F(FONT_BLACK, 44),
                      color=BG if op>0.6 else FG, opacity=op, anchor="mm")
            draw_text(img, f"+{per_day//1000}k", cx, cy+30, F(FONT_BOLD, 26),
                      color=BG if op>0.6 else GREEN, opacity=op, anchor="mm")
    # equals & total
    eq_t = t - (0.4 + 7*0.25)
    op = ease_out_cubic(clamp(eq_t/0.35))
    if op > 0:
        draw_text(img, "=", W/2, 920, F(FONT_BLACK, 100), color=MUTED, opacity=op, anchor="mm")
        # total card
        op2 = ease_out_back(clamp((eq_t-0.15)/0.5))
        rounded_rect(img, W/2-460, 1000, W/2+460, 1280, 60,
                     fill=GREEN, opacity=clamp(op2)*0.96)
        draw_text(img, f"₦{total:,}", W/2, 1100, F(FONT_BLACK, 170),
                  color=BG, opacity=clamp(op2), anchor="mm")
        draw_text(img, "in just 7 days", W/2, 1220, F(FONT_BOLD, 44),
                  color=(0,0,0), opacity=clamp(op2)*0.7, anchor="mm")
    sub_line(img, m["sub"], 1380, t, color=FG, size=42, dur=0.6)

def s_math_5k(img, t, m): _math_scene(img, t, m, 5000, 7, 35000)
def s_math_10k(img, t, m): _math_scene(img, t, m, 10000, 7, 70000)

def s_thinking(img, t, m):
    paste_emoji(img, "🤔", W/2, 760, 460, opacity=ease_out_cubic(t/0.25))
    title_keyword(img, "So I thought…", 1180, t, m["end"]-m["start"], big=120, color=FG)

def s_sat_down(img, t, m):
    paste_emoji(img, "🪑", W/2 - 200, 760, 320, opacity=ease_out_cubic(t/0.25))
    paste_emoji(img, "💭", W/2 + 220, 620, 240, opacity=ease_out_cubic((t-0.15)/0.25))
    title_keyword(img, "Sat down.", 1100, t, m["end"]-m["start"], big=150, color=FG)
    sub_line(img, m["sub"], 1240, t, color=MUTED, size=42)

def s_with_ai(img, t, m):
    paste_emoji(img, "🤖", W/2 - 200, 700, 360, opacity=ease_out_cubic(t/0.25))
    paste_emoji(img, "🧑🏾\u200d💻", W/2 + 200, 700, 320, opacity=ease_out_cubic((t-0.15)/0.25))
    title_keyword(img, "Planned with AI", 1080, t, m["end"]-m["start"], big=130, color=FG, color_accent=BLUE)
    # connecting line / spark
    op = ease_out_cubic((t-0.3)/0.4)
    if op > 0:
        for i in range(8):
            cx = int(W/2 - 100 + i*30)
            circle(img, cx, 700, 4, fill=BLUE, opacity=op*(0.4+0.6*math.sin(t*6+i)))

def s_for_us_all(img, t, m):
    paste_emoji(img, "👨🏾\u200d👩🏾\u200d👧🏾\u200d👦🏾", W/2, 540, 380, opacity=ease_out_cubic(t/0.25))
    title_keyword(img, "₦3,000 – ₦5,000", 920, t, m["end"]-m["start"], big=140, color=FG, color_accent=GREEN)
    draw_text(img, "every single day", W/2, 1050, F(FONT_BOLD, 56),
              color=GREEN, opacity=ease_out_cubic((t-0.2)/0.3), anchor="mm")
    sub_line(img, m["sub"], 1200, t, color=MUTED, size=42)
    # tag pills
    if t > 0.5:
        pills = ["for the student", "for the trader", "for the mama", "for the hustler"]
        idx = int((t-0.5) / 1.0) % len(pills)
        op = ease_out_cubic(((t-0.5) % 1.0) / 0.3) * (1 - clamp(((t-0.5) % 1.0 - 0.7)/0.3))
        rounded_rect(img, W/2-280, 1310, W/2+280, 1400, 45, fill=CARD, outline=GREEN, width=2, opacity=op)
        draw_text(img, pills[idx], W/2, 1355, F(FONT_BOLD, 40), color=GREEN, opacity=op, anchor="mm")

def s_viketa_reveal(img, t, m):
    # massive logo reveal
    op = ease_out_cubic(t/0.35)
    scale = 0.4 + 0.6 * ease_out_back(clamp(t/0.55))
    # glow halo
    glow(img, W/2, H/2 - 60, 700, GREEN, intensity=0.35 * op)
    font = F(FONT_BLACK, int(280*scale))
    tw, th = text_size("VIKETA", font)
    draw_text(img, "VIKETA", W/2 - tw/2, H/2 - 60 - th/2, font,
              color=GREEN, opacity=op, shadow=True)
    # underline sweep
    uw_t = clamp((t-0.4)/0.6)
    rounded_rect(img, W/2-260, H/2 + 110, W/2-260 + int(520*uw_t), H/2 + 130, 10,
                 fill=GOLD, opacity=op)
    sub_line(img, m["sub"], H/2 + 200, t, color=FG, size=48, dur=0.6)

def s_enter_3k(img, t, m):
    paste_emoji(img, "🚪", W/2 - 240, 660, 380, opacity=ease_out_cubic(t/0.25))
    # door opening: ₦3,000 walking through
    tt = clamp((t-0.3)/0.8)
    x = W/2 - 240 + 200 + tt*400
    paste_emoji(img, "💵", x, 720, 220, opacity=clamp((t-0.3)/0.2))
    title_keyword(img, "Enter with ₦3,000", 1000, t, m["end"]-m["start"], big=110, color=FG, color_accent=GOLD)
    sub_line(img, m["sub"], 1140, t, color=MUTED, size=42)

def s_hold_spot(img, t, m):
    # platform with a single highlighted spot
    paste_emoji(img, "📍", W/2, 580, 320, opacity=ease_out_cubic(t/0.25))
    # row of spots, yours highlighted
    spot_r = 50; gap = 30
    n = 7
    total_w = n*spot_r*2 + (n-1)*gap
    x0 = W/2 - total_w/2 + spot_r
    your_idx = 3
    for i in range(n):
        cx = int(x0 + i*(spot_r*2+gap)); cy = 920
        is_you = (i == your_idx)
        op = ease_out_cubic((t - 0.2 - i*0.06)/0.25)
        if op <= 0: continue
        if is_you:
            pulse = 0.5 + 0.5*math.sin(t*5)
            glow(img, cx, cy, 110, GOLD, intensity=0.5*pulse*op)
            circle(img, cx, cy, spot_r, fill=GOLD, opacity=op)
            draw_text(img, "YOU", cx, cy, F(FONT_BLACK, 28), color=BG, opacity=op, anchor="mm")
        else:
            circle(img, cx, cy, spot_r, fill=CARD, outline=LINE_C, width=3, opacity=op)
    title_keyword(img, "Your spot is held", 1100, t, m["end"]-m["start"], big=110, color=FG, color_accent=GOLD)
    sub_line(img, m["sub"], 1250, t, color=MUTED, size=42)

def s_world_joins(img, t, m):
    paste_emoji(img, "🌍", W/2, 540, 380, opacity=ease_out_cubic(t/0.25))
    # avatar rings appearing
    rng = random.Random(1)
    avatars = ["🧑🏾","👨🏿","👩🏽","🧔🏾","👩🏾","🧒🏾","👨🏽","👩🏿","🧑🏽","👨🏾"]
    for i, em in enumerate(avatars):
        ti = t - 0.2 - i*0.18
        op = ease_out_cubic(clamp(ti/0.3))
        if op <= 0: continue
        angle = i * (2*math.pi/len(avatars)) + math.pi/2
        cx = W/2 + math.cos(angle)*330
        cy = 540 + math.sin(angle)*330
        paste_emoji(img, em, cx, cy, 120, opacity=op)
    title_keyword(img, "People keep joining", 1080, t, m["end"]-m["start"], big=100, color=FG, color_accent=BLUE)
    sub_line(img, m["sub"], 1220, t, color=MUTED, size=40)
    # ticker of registrations
    if t > 0.6:
        op = ease_out_cubic((t-0.6)/0.3)
        draw_text(img, f"+{int((t-0.6)*7)} just joined", W/2, 1320,
                  F(FONT_BOLD, 44), color=GREEN, opacity=op, anchor="mm")

def s_line_by_line(img, t, m):
    # horizontal queue
    title_keyword(img, "Line by line", 460, t, m["end"]-m["start"], big=140, color=FG, color_accent=GREEN)
    # the queue
    n = 8
    spot_r = 48; gap = 26
    total_w = n*spot_r*2 + (n-1)*gap
    x0 = W/2 - total_w/2 + spot_r
    head_idx = int(t*3) % n
    for i in range(n):
        cx = int(x0 + i*(spot_r*2+gap)); cy = 900
        is_active = (i == head_idx)
        circle(img, cx, cy, spot_r, fill=GREEN if is_active else CARD,
               outline=GREEN, width=3, opacity=1.0)
        if is_active:
            glow(img, cx, cy, 120, GREEN, intensity=0.55)
            draw_text(img, "₦", cx, cy, F(FONT_BLACK, 50), color=BG, opacity=1.0, anchor="mm")
    # arrow
    draw_text(img, "→  →  →", W/2, 1040, F(FONT_BLACK, 70), color=GREEN, opacity=0.6, anchor="mm")
    sub_line(img, "the queue moves forward", 1200, t, color=MUTED, size=42)

def s_distribute_line(img, t, m):
    # money cascading down a vertical line of spots
    title_keyword(img, "Money flows down", 360, t, m["end"]-m["start"], big=120, color=FG, color_accent=GREEN)
    n = 5
    cy0 = 600
    gap = 140
    for i in range(n):
        cy = cy0 + i*gap
        op = ease_out_cubic((t - i*0.15)/0.25)
        if op <= 0: continue
        rounded_rect(img, W/2-280, cy-50, W/2+280, cy+50, 30, fill=CARD,
                     outline=GREEN, width=3, opacity=op)
        draw_text(img, f"Spot #{i+1}", W/2 - 220, cy, F(FONT_BOLD, 38),
                  color=FG, opacity=op, anchor="lm")
        # ₦ amount
        paid_t = clamp((t - 0.4 - i*0.2)/0.3)
        if paid_t > 0:
            draw_text(img, "+₦900", W/2 + 220, cy, F(FONT_BLACK, 44),
                      color=GREEN, opacity=op, anchor="rm")
            circle(img, W/2+250, cy, 14, fill=GREEN, opacity=paid_t)
    # falling money
    for i in range(6):
        tt = (t + i*0.13) % 1.3
        y = 540 + tt*900
        paste_emoji(img, "💸", W/2 + 340, y, 70, opacity=clamp(1.2-tt))

def s_from_3k_split(img, t, m):
    paste_emoji(img, "💵", W/2, 460, 240, opacity=ease_out_cubic(t/0.2))
    draw_text(img, "Their ₦3,000", W/2, 640, F(FONT_BLACK, 72),
              color=GOLD, opacity=ease_out_cubic(t/0.25), anchor="mm")
    # arrows down to 3 small spots
    op = ease_out_cubic((t-0.3)/0.3)
    if op > 0:
        draw_text(img, "↓", W/2, 770, F(FONT_BLACK, 80), color=MUTED, opacity=op, anchor="mm")
        labels = ["Spot A","Spot B","YOUR SPOT"]
        for i, lbl in enumerate(labels):
            cx = W/2 - 320 + i*320; cy = 1000
            is_you = (i == 2)
            op2 = ease_out_cubic((t-0.4-i*0.15)/0.3)
            if op2 <= 0: continue
            rounded_rect(img, cx-130, cy-90, cx+130, cy+90, 30,
                         fill=GREEN if is_you else CARD,
                         outline=GOLD if is_you else LINE_C,
                         width=3, opacity=op2)
            draw_text(img, lbl, cx, cy-20, F(FONT_BOLD, 28),
                      color=BG if is_you else FG, opacity=op2, anchor="mm")
            draw_text(img, "+₦900", cx, cy+30, F(FONT_BLACK, 44),
                      color=BG if is_you else GREEN, opacity=op2, anchor="mm")
    sub_line(img, m["sub"], 1280, t, color=MUTED, size=40)
    title_keyword(img, "Distributed automatically", 1420, t, m["end"]-m["start"], big=70, color=FG)

def s_no_refer(img, t, m):
    paste_emoji(img, "📣", W/2, 620, 360, opacity=ease_out_cubic(t/0.25))
    # red X over megaphone
    op = ease_out_cubic((t-0.2)/0.3)
    if op > 0:
        d = ImageDraw.Draw(img)
        d.line([(W/2-180, 480),(W/2+180, 780)], fill=RED+(int(255*op),), width=22)
        d.line([(W/2+180, 480),(W/2-180, 780)], fill=RED+(int(255*op),), width=22)
    title_keyword(img, "NO referrals needed", 980, t, m["end"]-m["start"], big=110, color=FG, color_accent=RED)
    sub_line(img, m["sub"], 1120, t, color=MUTED, size=42)

def s_task_simple(img, t, m):
    paste_emoji(img, "✅", W/2, 560, 360, opacity=ease_out_cubic(t/0.25))
    title_keyword(img, "The task is simple", 920, t, m["end"]-m["start"], big=110, color=FG, color_accent=GREEN)
    # 3 dots steps
    for i in range(3):
        cx = W/2 - 200 + i*200; cy = 1100
        op = ease_out_cubic((t-0.3-i*0.15)/0.25)
        if op <= 0: continue
        circle(img, cx, cy, 38, fill=GREEN, opacity=op)
        draw_text(img, str(i+1), cx, cy, F(FONT_BLACK, 42), color=BG, opacity=op, anchor="mm")
    draw_text(img, "open → tap → done", W/2, 1220, F(FONT_BOLD, 40),
              color=MUTED, opacity=ease_out_cubic((t-0.7)/0.3), anchor="mm")

def s_choose_image(img, t, m):
    # two image cards, finger taps one
    title_keyword(img, "Pick an image", 400, t, m["end"]-m["start"], big=110, color=FG, color_accent=BLUE)
    pick = 0 if (int(t*1.3) % 2 == 0) else 1
    for i in range(2):
        x = W/2 - 280 + i*560
        y = 900
        sel = (i == pick)
        op = ease_out_cubic((t - 0.2 - i*0.1)/0.25)
        if op <= 0: continue
        rounded_rect(img, x-200, y-280, x+200, y+280, 40,
                     fill=CARD, outline=GREEN if sel else LINE_C, width=8 if sel else 3, opacity=op)
        # placeholder picture: emoji
        em = ["🌅","🌄"][i]
        paste_emoji(img, em, x, y-60, 280, opacity=op)
        draw_text(img, ["Image A","Image B"][i], x, y+170, F(FONT_BOLD, 42),
                  color=FG, opacity=op, anchor="mm")
        if sel:
            glow(img, x, y, 280, GREEN, intensity=0.45)
            paste_emoji(img, "👆", x+70, y+200, 160, opacity=op)
    sub_line(img, "that's the whole task", 1350, t, color=MUTED, size=40)

def s_pending_balance(img, t, m):
    paste_emoji(img, "🪙", W/2, 480, 320, opacity=ease_out_cubic(t/0.25))
    rounded_rect(img, W/2-440, 740, W/2+440, 1080, 50,
                 fill=CARD, outline=GOLD, width=4, opacity=0.96)
    draw_text(img, "Pending Balance", W/2, 800, F(FONT_BOLD, 40), color=MUTED, opacity=1, anchor="mm")
    val = int(0 + ease_in_out(clamp(t/2.5)) * 2400)
    draw_text(img, f"₦{val:,}", W/2, 920, F(FONT_BLACK, 140), color=GOLD, opacity=1, anchor="mm")
    # plus arrow
    op = ease_out_cubic((t-0.3)/0.4)
    if op > 0:
        draw_text(img, "↑ growing every tap", W/2, 1020, F(FONT_BOLD, 36),
                  color=GREEN, opacity=op, anchor="mm")
    sub_line(img, m["sub"], 1200, t, color=FG, size=42)

def s_line_reaches_you(img, t, m):
    # queue with arrow moving to YOU and big withdrawal popup
    title_keyword(img, "Line reaches you", 360, t, m["end"]-m["start"], big=110, color=FG, color_accent=GREEN)
    n = 6
    spot_r = 50; gap = 30
    total_w = n*spot_r*2 + (n-1)*gap
    x0 = W/2 - total_w/2 + spot_r
    progress = clamp(t/2.0)
    head_idx = int(progress * (n-1))
    your_idx = n-1
    for i in range(n):
        cx = int(x0 + i*(spot_r*2+gap)); cy = 600
        is_you = (i == your_idx)
        reached = (i <= head_idx)
        fill = GREEN if reached else CARD
        outline = GOLD if is_you else GREEN
        circle(img, cx, cy, spot_r, fill=fill, outline=outline, width=4)
        if is_you:
            draw_text(img, "YOU", cx, cy-130, F(FONT_BLACK, 32), color=GOLD, opacity=1, anchor="mm")
            draw_text(img, "↓", cx, cy-80, F(FONT_BLACK, 50), color=GOLD, opacity=1, anchor="mm")
    # withdrawal card
    wt = clamp((t-2.0)/0.5)
    if wt > 0:
        op = ease_out_back(wt)
        rounded_rect(img, W/2-440, 820, W/2+440, 1180, 60, fill=GREEN, opacity=clamp(op)*0.96)
        draw_text(img, "WITHDRAW", W/2, 900, F(FONT_BOLD, 48), color=BG, opacity=clamp(op), anchor="mm")
        draw_text(img, "₦2,400", W/2, 1020, F(FONT_BLACK, 160), color=BG, opacity=clamp(op), anchor="mm")
        draw_text(img, "lands in your bank", W/2, 1130, F(FONT_BOLD, 40),
                  color=(0,0,0), opacity=clamp(op)*0.7, anchor="mm")
        paste_emoji(img, "🏦", W/2, 1320, 220, opacity=clamp(op))
    sub_line(img, m["sub"], 1500, t, color=FG, size=40, dur=0.5)

def s_back_of_line(img, t, m):
    paste_emoji(img, "🔄", W/2, 560, 360, opacity=ease_out_cubic(t/0.25))
    title_keyword(img, "Back of the line", 880, t, m["end"]-m["start"], big=110, color=FG, color_accent=GREEN)
    sub_line(img, m["sub"], 1020, t, color=MUTED, size=42)
    # circular flow visualization
    op = ease_out_cubic((t-0.3)/0.4)
    if op > 0:
        cy = 1280
        cx = W/2
        r = 200
        # circle
        circle(img, cx, cy, r, fill=None, outline=GREEN, width=6, opacity=op*0.6)
        # rotating dot
        ang = t * 1.8
        dx = cx + math.cos(ang)*r
        dy = cy + math.sin(ang)*r
        circle(img, dx, dy, 22, fill=GOLD, opacity=op)
        # labels
        draw_text(img, "withdraw", cx, cy-r-40, F(FONT_BOLD, 32), color=MUTED, opacity=op, anchor="mm")
        draw_text(img, "repeat", cx+r+90, cy, F(FONT_BOLD, 32), color=MUTED, opacity=op, anchor="lm")
        draw_text(img, "hold spot", cx, cy+r+40, F(FONT_BOLD, 32), color=MUTED, opacity=op, anchor="mm")
        draw_text(img, "do tasks", cx-r-90, cy, F(FONT_BOLD, 32), color=MUTED, opacity=op, anchor="rm")

def s_do_tasks(img, t, m):
    paste_emoji(img, "⚠️", W/2 - 320, 460, 220, opacity=ease_out_cubic(t/0.2))
    paste_emoji(img, "📲", W/2 + 200, 460, 280, opacity=ease_out_cubic((t-0.1)/0.2))
    title_keyword(img, "Keep tapping tasks", 760, t, m["end"]-m["start"], big=110, color=FG, color_accent=GOLD)
    # tapping counter
    val = int(ease_in_out(clamp(t/4)) * 47)
    rounded_rect(img, W/2-380, 920, W/2+380, 1180, 50, fill=CARD, outline=GOLD, width=4, opacity=0.96)
    draw_text(img, "Tasks today", W/2, 980, F(FONT_BOLD, 38), color=MUTED, opacity=1, anchor="mm")
    draw_text(img, f"{val}", W/2, 1080, F(FONT_BLACK, 130), color=GOLD, opacity=1, anchor="mm")
    sub_line(img, m["sub"], 1290, t, color=FG, size=42)
    # warning text
    op = ease_out_cubic((t - 4.5)/0.5)
    if op > 0:
        draw_text(img, "no taps = no money when your turn comes", W/2, 1400,
                  F(FONT_BOLD, 36), color=RED, opacity=op, anchor="mm")

def s_images_important(img, t, m):
    # gallery of images shining
    title_keyword(img, "These images = GOLD", 380, t, m["end"]-m["start"], big=110, color=FG, color_accent=GOLD)
    emojis = ["🏞️","🏙️","🌄","🌅","🗻","🌃"]
    for i, em in enumerate(emojis):
        row = i // 3; col = i % 3
        x = W/2 - 320 + col*320
        y = 740 + row*340
        op = ease_out_cubic((t - 0.2 - i*0.1)/0.25)
        if op <= 0: continue
        rounded_rect(img, x-130, y-140, x+130, y+140, 30, fill=CARD,
                     outline=GOLD, width=3, opacity=op)
        paste_emoji(img, em, x, y, 220, opacity=op)
        # gold star
        pulse = 0.5 + 0.5*math.sin(t*4 + i)
        paste_emoji(img, "⭐", x+100, y-110, 80, opacity=op*pulse)
    sub_line(img, "every tap = real value", 1500, t, color=FG, size=40)

def s_sell_to_ai(img, t, m):
    # left: images stack ; arrow ; right: AI company ; arrow ; ₦
    paste_emoji(img, "🖼️", W/2 - 380, 740, 240, opacity=ease_out_cubic(t/0.2))
    op1 = ease_out_cubic((t-0.3)/0.25)
    draw_text(img, "→", W/2 - 180, 740, F(FONT_BLACK, 100), color=GREEN, opacity=op1, anchor="mm")
    paste_emoji(img, "🤖", W/2, 740, 280, opacity=ease_out_cubic((t-0.4)/0.25))
    op2 = ease_out_cubic((t-0.7)/0.25)
    draw_text(img, "→", W/2 + 200, 740, F(FONT_BLACK, 100), color=GREEN, opacity=op2, anchor="mm")
    paste_emoji(img, "💰", W/2 + 380, 740, 260, opacity=ease_out_cubic((t-0.8)/0.25))
    title_keyword(img, "Sold to AI companies", 1040, t, m["end"]-m["start"], big=100, color=FG, color_accent=BLUE)
    sub_line(img, m["sub"], 1180, t, color=MUTED, size=40)
    # logos placeholder
    logos = ["OpenAI","Google","Meta","Anthropic"]
    op3 = ease_out_cubic((t-1.0)/0.4)
    for i, name in enumerate(logos):
        x = W/2 - 360 + i*240; y = 1340
        rounded_rect(img, x-100, y-40, x+100, y+40, 20, fill=CARD,
                     outline=LINE_C, width=2, opacity=op3)
        draw_text(img, name, x, y, F(FONT_BOLD, 28), color=FG, opacity=op3, anchor="mm")

def s_researched(img, t, m):
    paste_emoji(img, "🔍", W/2 - 220, 600, 280, opacity=ease_out_cubic(t/0.2))
    paste_emoji(img, "📋", W/2 + 200, 600, 280, opacity=ease_out_cubic((t-0.15)/0.2))
    paste_emoji(img, "✅", W/2 + 360, 760, 160, opacity=ease_out_cubic((t-0.4)/0.25))
    title_keyword(img, "Already researched", 980, t, m["end"]-m["start"], big=120, color=FG, color_accent=GREEN)
    sub_line(img, m["sub"], 1140, t, color=MUTED, size=42)

def s_simple_close(img, t, m):
    paste_emoji(img, "✨", W/2, 680, 380, opacity=ease_out_cubic(t/0.25))
    title_keyword(img, "Very. Simple.", 1080, t, m["end"]-m["start"], big=160, color=GREEN, color_accent=GREEN)

def s_cta(img, t, m):
    # big CTA: tap the link, ₦3k, hold your spot
    paste_emoji(img, "👇", W/2, 360, 280,
                opacity=ease_out_cubic(t/0.2) * (0.6 + 0.4*math.sin(t*5)))
    # the button
    op = ease_out_cubic((t-0.2)/0.3)
    scale = ease_out_back(clamp((t-0.2)/0.5))
    btn_w, btn_h = int(900*scale), int(220*scale)
    pulse = 1 + 0.04*math.sin(t*4)
    btn_w = int(btn_w * pulse); btn_h = int(btn_h * pulse)
    bx, by = W/2 - btn_w/2, 700
    glow(img, W/2, by + btn_h/2, 500, GREEN, intensity=0.4*op)
    rounded_rect(img, bx, by, bx+btn_w, by+btn_h, 60, fill=GREEN, opacity=op)
    draw_text(img, "TAP TO JOIN", W/2, by+btn_h/2 - 30, F(FONT_BLACK, 80),
              color=BG, opacity=op, anchor="mm")
    draw_text(img, "viketa.xyz", W/2, by+btn_h/2 + 50, F(FONT_BOLD, 44),
              color=(0,0,0), opacity=op*0.7, anchor="mm")
    # 3 mini steps
    steps = [("💵","Bring ₦3,000"), ("📍","Hold your spot"), ("💰","Start earning")]
    for i, (em, lbl) in enumerate(steps):
        cy = 1100 + i*200
        op2 = ease_out_cubic((t-0.5-i*0.2)/0.3)
        if op2 <= 0: continue
        rounded_rect(img, W/2-440, cy-80, W/2+440, cy+80, 40,
                     fill=CARD, outline=GREEN, width=3, opacity=op2)
        paste_emoji(img, em, W/2-340, cy, 120, opacity=op2)
        draw_text(img, lbl, W/2-220, cy, F(FONT_BOLD, 52),
                  color=FG, opacity=op2, anchor="lm")
        circle(img, W/2+360, cy, 30, fill=GREEN, opacity=op2)
        draw_text(img, str(i+1), W/2+360, cy, F(FONT_BLACK, 38),
                  color=BG, opacity=op2, anchor="mm")

SCENES = {
    "poverty_hit": s_poverty_hit, "country": s_country, "breath": s_breath,
    "money_amount": s_money_amount, "buy_data": s_buy_data, "money_gone": s_money_gone,
    "but_listen": s_but_listen, "earn_daily": s_earn_daily,
    "calc_it": s_calc_it, "math_5k": s_math_5k, "math_10k": s_math_10k,
    "thinking": s_thinking, "sat_down": s_sat_down, "with_ai": s_with_ai,
    "for_us_all": s_for_us_all, "viketa_reveal": s_viketa_reveal,
    "enter_3k": s_enter_3k, "hold_spot": s_hold_spot, "world_joins": s_world_joins,
    "line_by_line": s_line_by_line, "distribute_line": s_distribute_line,
    "from_3k_split": s_from_3k_split, "no_refer": s_no_refer,
    "task_simple": s_task_simple, "choose_image": s_choose_image,
    "pending_balance": s_pending_balance, "line_reaches_you": s_line_reaches_you,
    "back_of_line": s_back_of_line, "do_tasks": s_do_tasks,
    "images_important": s_images_important, "sell_to_ai": s_sell_to_ai,
    "researched": s_researched, "simple_close": s_simple_close, "cta": s_cta,
}

def render_frame(frame_idx):
    t = frame_idx / FPS
    # locate active moment
    active = None
    for m in MOMENTS:
        if m["start"] <= t < m["end"]:
            active = m; break
    if active is None:
        active = MOMENTS[-1] if t >= MOMENTS[-1]["end"] else MOMENTS[0]

    bg_type = scene_bg_type(active["scene"])
    img = base_bg(bg_type, t)

    t_local = t - active["start"]
    fn = SCENES.get(active["scene"])
    if fn:
        fn(img, t_local, active)

    # Crop tall design canvas to 4:5 output frame around the action band.
    img = img.crop((0, CROP_Y, OUT_W, CROP_Y + OUT_H))

    # Overlays drawn AFTER crop so they sit at the visible edges.
    progress_bar(img, t)
    brand_chip(img, t)

    return img.convert("RGB")

if __name__ == "__main__":
    # CLI: python scene.py FRAME_IDX OUT.png  (single-frame preview)
    if len(sys.argv) >= 3:
        idx = int(sys.argv[1])
        out = sys.argv[2]
        render_frame(idx).save(out, "PNG")
        print(f"wrote {out}")
