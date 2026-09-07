"""
Viketa Video Studio — THE RECIPE (edit this file, nothing else, for new videos).

Two things live here:

  PERSON   the real-looking Nigerian person we sign up on camera
  SCENES   every piece of screen we know how to record, with a short id

Timing does NOT live here. The voice recording is the master clock
(see timeline.py). capture.py records each scene; compose.py stretches or
trims each recorded scene so it lands exactly on the words being spoken.
"""

# The person who signs up on camera. Nothing about them says "demo".
PERSON = {
    "full_name": "CHINEDU EMEKA OKAFOR",
    "email": "chinedu.okafor1994@gmail.com",   # a unique real-looking one is
    "password": "Viketa2026walk",              # generated at run time
    "phone": "08067451209",
    "birth_year": "1994",
    "birth_month": "Mar",
    "state": "Lagos",
    "shares_to_buy": 5,          # how many shares the calculator climbs to
}

# Picture + PIN we drop on the account (by SQL) so the tour never gets
# stopped by the "set your picture / create your PIN" screens.
AVATAR_URL = "/src/assets/queue-mocks/person-03.jpg"

# The URL the viewer is told to open. ?xse=1 skips the in-app explainer
# video, because this YouTube video IS the explainer.
SIGNUP_URL = "/signup?xse=1"

# Every recordable scene. `title` is the big text burned on the left of the
# finished 1920x1080 frame while that scene is on screen.
SCENES = {
    # ---------- PART A : public pages + signup + calculator + payment ----------
    "landing_hero":  dict(title="Viketa\nAd Rating Shares"),
    "landing_proof": dict(title="Real people.\nReal bank\nalerts."),
    "how_it_works":  dict(title="Brands pay\nfor your\nopinion"),
    "pricing":       dict(title="₦5,000 a share\n₦10,000 back"),
    "signup_open":   dict(title="Step 1\nOpen the link"),
    "birth_year":    dict(title="Your birth year"),
    "birth_month":   dict(title="Your birth month"),
    "state":         dict(title="Where you live"),
    "name":          dict(title="Your name must\nmatch your\nbank account"),
    "details":       dict(title="Phone, email,\npassword"),
    "locked_dash":   dict(title="Account ready\n(not active yet)"),
    "cta":           dict(title="Tap\nI Want A Share"),
    "calc_open":     dict(title="The share\ncalculator"),
    "calc_one":      dict(title="1 share\n₦5,000 → ₦10,000"),
    "calc_five":     dict(title="5 shares\n₦25,000 → ₦50,000"),
    "pay_click":     dict(title="Tap Pay"),
    "pay_page":      dict(title="One bank\ntransfer.\nThat's all."),
    "outro":         dict(title="Your share\nis waiting."),

    # ---------- PART B : the live, activated account ----------
    "dash_active":   dict(title="Payment confirmed\nautomatically"),
    "wallet":        dict(title="Your earnings\nat a glance"),
    "progress":      dict(title="Campaign\nprogress\nto 100%"),
    "task":          dict(title="Pick the better\npicture.\n15 minutes."),
    "withdraw":      dict(title="Withdraw to\nyour bank"),
    "rules":         dict(title="₦10,000 max\nper share.\nNo fake promises."),
}

PART_A = [
    "landing_hero", "landing_proof", "how_it_works", "pricing",
    "signup_open", "birth_year", "birth_month", "state", "name", "details",
    "locked_dash", "cta", "calc_open", "calc_one", "calc_five",
    "pay_click", "pay_page", "outro",
]
PART_B = ["dash_active", "wallet", "progress", "task", "withdraw", "rules"]
