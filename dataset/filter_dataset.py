"""
Civitai → clean RLHF preference dataset filter.

Usage:
    python filter_dataset.py civitai.csv filtered_dataset.csv

Why this exists:
    Civitai is mostly anime/NSFW. RLHF buyers want clean photoreal product images.
    This script aggressively drops anime, NSFW, low-res, and short-prompt rows,
    then balances per-category with reservoir sampling so no niche dominates.
"""

import csv, json, re, random, sys, os
from collections import defaultdict

random.seed(42)
csv.field_size_limit(sys.maxsize)

# ---------- config ----------
PER_CATEGORY_CAP = 800       # max rows kept per category (tune later)
MIN_PROMPT_LEN   = 25        # chars
MIN_WIDTH        = 768       # parsed from civitai URL /width=NNN/
INPUT  = sys.argv[1] if len(sys.argv) > 1 else "civitai.csv"
OUTPUT = sys.argv[2] if len(sys.argv) > 2 else "filtered_dataset.csv"

# Drop the row entirely if any of these tokens appear in the prompt.
BLOCKLIST = [
    r"\b1girl\b", r"\b1boy\b", r"\b2girls\b", r"\bmultiple girls\b",
    r"\banime\b", r"\bwaifu\b", r"\bcartoon\b", r"\bchibi\b", r"\bmanga\b",
    r"\bhentai\b", r"\bnsfw\b", r"\bnude\b", r"\bnaked\b", r"\bloli\b",
    r"\bsex\b", r"\bporn\b", r"\bpussy\b", r"\bbreast", r"\bnipple",
    r"lora:[a-z0-9_]*doll", r"lora:[a-z0-9_]*anime",
    r"\bkoreandolllikeness\b", r"\btaiwandolllikeness\b",
    r"\bschoolgirl\b", r"\bpleated skirt\b", r"\bcollared shirt\b",
]
BLOCK_RE = re.compile("|".join(BLOCKLIST), re.IGNORECASE)

# Strict per-category keywords (word-boundary). Order matters: first hit wins,
# but blocklist runs first so anime-cafe rows never reach here.
CATEGORIES = {
    "coffee":      [r"\bespresso\b", r"\blatte\b", r"\bcappuccino\b",
                    r"\bbarista\b", r"\bcoffee (cup|bean|shop|mug)\b",
                    r"\bpour[- ]over\b", r"\bfrench press\b"],
    "sneakers":    [r"\bsneakers?\b", r"\brunning shoes?\b", r"\bnike\b",
                    r"\badidas\b", r"\bjordan\b", r"\byeezy\b",
                    r"\btrainers?\b", r"\bfootwear\b"],
    "perfume":     [r"\bperfume\b", r"\bfragrance\b", r"\beau de (parfum|toilette)\b",
                    r"\bcologne\b", r"\bperfume bottle\b"],
    "tech_gadgets":[r"\bsmartphone\b", r"\biphone\b", r"\bmacbook\b",
                    r"\blaptop\b", r"\bheadphones?\b", r"\bearbuds?\b",
                    r"\bdrone\b", r"\bvr headset\b", r"\bgaming console\b"],
    "watches":     [r"\bwristwatch\b", r"\brolex\b", r"\bomega watch\b",
                    r"\bchronograph\b", r"\btimepiece\b",
                    r"\bluxury watch\b", r"\bsmartwatch\b"],
    "cars":        [r"\bsports car\b", r"\bsupercar\b", r"\bferrari\b",
                    r"\blamborghini\b", r"\bporsche\b", r"\btesla\b",
                    r"\bbmw\b", r"\bmercedes\b", r"\bmuscle car\b",
                    r"\bvintage car\b"],
}
CAT_RE = {c: re.compile("|".join(pats), re.IGNORECASE) for c, pats in CATEGORIES.items()}

WIDTH_RE = re.compile(r"/width=(\d+)/")

def categorize(prompt: str) -> str | None:
    for cat, rgx in CAT_RE.items():
        if rgx.search(prompt):
            return cat
    return None

def url_width(url: str) -> int:
    m = WIDTH_RE.search(url or "")
    return int(m.group(1)) if m else 0

# ---------- reservoir sampling per category ----------
buckets: dict[str, list[dict]] = defaultdict(list)
seen_urls: set[str] = set()
counters = defaultdict(int)  # how many we've considered per cat (for reservoir)
stats = {"total": 0, "blocked_nsfw": 0, "blocked_anime": 0,
         "too_short": 0, "too_small": 0, "duplicate": 0,
         "no_category": 0, "kept_pre_sample": defaultdict(int)}

print(f"Reading {INPUT} ...")
with open(INPUT, "r", encoding="utf-8", errors="replace", newline="") as f:
    reader = csv.DictReader(f)
    for row in reader:
        stats["total"] += 1
        if stats["total"] % 100_000 == 0:
            print(f"  processed {stats['total']:,} rows")

        # NSFW: handle multiple schemas
        if str(row.get("nsfw", "")).lower() in ("true", "1", "yes") \
           or str(row.get("nsfwLevel", "0")) not in ("0", "1", "None", ""):
            stats["blocked_nsfw"] += 1
            continue

        prompt = (row.get("prompt") or "").strip()
        if len(prompt) < MIN_PROMPT_LEN:
            stats["too_short"] += 1
            continue

        if BLOCK_RE.search(prompt):
            stats["blocked_anime"] += 1
            continue

        url = (row.get("url") or "").strip()
        if not url or url in seen_urls:
            stats["duplicate"] += 1
            continue

        if url_width(url) < MIN_WIDTH:
            stats["too_small"] += 1
            continue

        cat = categorize(prompt)
        if not cat:
            stats["no_category"] += 1
            continue

        seen_urls.add(url)
        stats["kept_pre_sample"][cat] += 1
        counters[cat] += 1

        item = {"url": url, "prompt": prompt, "category": cat}
        # Reservoir sampling: keep up to CAP, then randomly replace.
        if len(buckets[cat]) < PER_CATEGORY_CAP:
            buckets[cat].append(item)
        else:
            j = random.randint(0, counters[cat] - 1)
            if j < PER_CATEGORY_CAP:
                buckets[cat][j] = item

# ---------- write output ----------
with open(OUTPUT, "w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=["url", "prompt", "category"])
    w.writeheader()
    for cat, rows in buckets.items():
        random.shuffle(rows)
        for r in rows:
            w.writerow(r)

# ---------- stats ----------
final_counts = {c: len(rows) for c, rows in buckets.items()}
stats["final_kept"] = sum(final_counts.values())
stats["final_per_category"] = final_counts
stats["kept_pre_sample"] = dict(stats["kept_pre_sample"])

with open("stats.json", "w") as f:
    json.dump(stats, f, indent=2)

print("\n=== DONE ===")
print(f"Total rows read         : {stats['total']:,}")
print(f"Blocked NSFW            : {stats['blocked_nsfw']:,}")
print(f"Blocked anime/illegal   : {stats['blocked_anime']:,}")
print(f"Prompt too short        : {stats['too_short']:,}")
print(f"Image too small         : {stats['too_small']:,}")
print(f"Duplicate URL           : {stats['duplicate']:,}")
print(f"No category match       : {stats['no_category']:,}")
print(f"Final kept (balanced)   : {stats['final_kept']:,}")
for c, n in final_counts.items():
    print(f"  {c:<14}: {n}")
print(f"\nWrote {OUTPUT} + stats.json")
