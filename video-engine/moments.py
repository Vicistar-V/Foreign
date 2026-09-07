"""
Phrase-by-phrase moments for the Viketa explainer video.
Each moment binds an audio time window to a contextual visual scene.

Times in SECONDS. start/end map directly to the voiceover SRT phrasing.
"""

MOMENTS = [
    # ---------- HOOK: Poverty problem (0 - 10.5s) ----------
    {"start": 0.00, "end": 2.10, "scene": "poverty_hit",
     "keyword": "POVERTY", "sub": "is now looking like a normal thing"},
    {"start": 2.10, "end": 3.55, "scene": "country",
     "keyword": "...in this country", "sub": ""},
    {"start": 3.55, "end": 4.40, "scene": "breath", "keyword": "", "sub": ""},
    {"start": 4.40, "end": 6.30, "scene": "money_amount",
     "keyword": "₦3,000", "sub": "the same money you spend daily"},
    {"start": 6.30, "end": 7.95, "scene": "buy_data",
     "keyword": "Buy data", "sub": "phone keeps eating it"},
    {"start": 7.95, "end": 10.55, "scene": "money_gone",
     "keyword": "Money gone.", "sub": "nothing to show for it"},

    # ---------- HOPE: There is a way (10.5 - 17s) ----------
    {"start": 10.55, "end": 12.20, "scene": "but_listen",
     "keyword": "But listen…", "sub": ""},
    {"start": 12.20, "end": 16.85, "scene": "earn_daily",
     "keyword": "₦5,000 – ₦10,000", "sub": "every single day"},

    # ---------- MATH: calculate it (17 - 30s) ----------
    {"start": 16.85, "end": 18.55, "scene": "calc_it",
     "keyword": "Let's do the math.", "sub": ""},
    {"start": 18.55, "end": 24.40, "scene": "math_5k",
     "keyword": "₦5,000 × 7 days", "result": "₦35,000", "sub": "in just one week"},
    {"start": 24.40, "end": 29.85, "scene": "math_10k",
     "keyword": "₦10,000 × 7 days", "result": "₦70,000", "sub": "every single week"},

    # ---------- ORIGIN: I built Viketa (30 - 46s) ----------
    {"start": 29.85, "end": 32.10, "scene": "thinking",
     "keyword": "So I thought…", "sub": ""},
    {"start": 32.10, "end": 33.50, "scene": "sat_down",
     "keyword": "Sat down.", "sub": "planned everything"},
    {"start": 33.50, "end": 35.65, "scene": "with_ai",
     "keyword": "Planned with AI", "sub": ""},
    {"start": 35.65, "end": 43.50, "scene": "for_us_all",
     "keyword": "₦3,000 – ₦5,000 daily", "sub": "for everyday Nigerians"},

    # ---------- THE NAME: Viketa (44 - 46.5s) ----------
    {"start": 43.50, "end": 46.55, "scene": "viketa_reveal",
     "keyword": "VIKETA", "sub": "this is what I built"},

    # ---------- HOW IT WORKS (46.5 - 73s) ----------
    {"start": 46.55, "end": 49.55, "scene": "enter_3k",
     "keyword": "Enter with ₦3,000", "sub": "one time only"},
    {"start": 49.55, "end": 54.70, "scene": "hold_spot",
     "keyword": "Holds your spot", "sub": "on the platform"},
    {"start": 54.70, "end": 60.30, "scene": "world_joins",
     "keyword": "People keep joining", "sub": "with their own ₦3,000"},
    {"start": 60.30, "end": 62.60, "scene": "line_by_line",
     "keyword": "Line by line", "sub": ""},
    {"start": 62.60, "end": 66.65, "scene": "distribute_line",
     "keyword": "Money flows down the line", "sub": "to every spot"},
    {"start": 66.65, "end": 71.60, "scene": "from_3k_split",
     "keyword": "Their ₦3,000 → your spot", "sub": ""},
    {"start": 71.60, "end": 73.95, "scene": "no_refer",
     "keyword": "No referrals needed", "sub": "the line does the work"},

    # ---------- TASKS (74 - 93s) ----------
    {"start": 73.95, "end": 79.40, "scene": "task_simple",
     "keyword": "Plain & simple task", "sub": ""},
    {"start": 79.40, "end": 82.50, "scene": "choose_image",
     "keyword": "Choose one image", "sub": "over another"},
    {"start": 82.50, "end": 85.85, "scene": "pending_balance",
     "keyword": "Pending balance grows", "sub": "every tap"},
    {"start": 85.85, "end": 93.00, "scene": "line_reaches_you",
     "keyword": "Line reaches you → you withdraw", "sub": "everything you built"},

    # ---------- CYCLE (93 - 99s) ----------
    {"start": 93.00, "end": 99.55, "scene": "back_of_line",
     "keyword": "Back of the line", "sub": "hold another spot, repeat"},

    # ---------- WARNING: keep doing tasks (99 - 111s) ----------
    {"start": 99.55, "end": 111.10, "scene": "do_tasks",
     "keyword": "Keep doing your tasks", "sub": "so you don't miss any money"},

    # ---------- WHY IMAGES MATTER (111 - 127s) ----------
    {"start": 111.10, "end": 115.70, "scene": "images_important",
     "keyword": "Those images are valuable", "sub": ""},
    {"start": 115.70, "end": 123.00, "scene": "sell_to_ai",
     "keyword": "Sold to AI companies", "sub": "they need this data"},
    {"start": 123.00, "end": 127.20, "scene": "researched",
     "keyword": "Already researched", "sub": "the buyers are ready"},

    # ---------- CTA (127 - 137s) ----------
    {"start": 127.20, "end": 131.20, "scene": "simple_close",
     "keyword": "That's it. Very simple.", "sub": ""},
    {"start": 131.20, "end": 137.00, "scene": "cta",
     "keyword": "Tap the link. Bring your ₦3k.", "sub": "Hold your spot. Let's start."},
]
