#!/usr/bin/env python3
"""
Seed the Meta (Facebook) dataset with every event + parameter Viketa will ever
send, so Ads Manager immediately offers them as options when building ads
(conversion events, custom conversions, value optimisation, breakdowns).

It fires the pixel's public tracking endpoint (https://www.facebook.com/tr)
directly - the exact same request the browser pixel makes - once per
event/parameter combination.

Run:
    python3 scripts/seed-meta-pixel-params.py            # real send
    python3 scripts/seed-meta-pixel-params.py --dry-run  # just print
"""

import argparse
import random
import time
import urllib.parse
import urllib.request

PIXEL_ID = "1580276863536035"
SITE = "https://viketa.xyz"
UA = (
    "Mozilla/5.0 (Linux; Android 13; SM-A155F) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/126.0.0.0 Mobile Safari/537.36"
)

CURRENCY = "NGN"
SHARE_PRICE = 5000
SHARE_PAYOUT = 10000

# Every standard event Meta lets you optimise for, with the full custom-data
# parameter set Viketa can supply. Grandma-plain names on purpose.
STANDARD_EVENTS = [
    ("PageView", "/", {}),
    ("ViewContent", "/", {
        "content_name": "Home page - pick a picture get paid",
        "content_category": "Landing",
        "content_type": "product",
        "content_ids": '["ad_share"]',
        "value": SHARE_PRICE, "currency": CURRENCY,
    }),
    ("ViewContent", "/how-it-works", {
        "content_name": "How it works page",
        "content_category": "Explainer",
        "content_type": "product",
        "content_ids": '["ad_share"]',
        "value": SHARE_PRICE, "currency": CURRENCY,
    }),
    ("ViewContent", "/watch-first", {
        "content_name": "Watch first video",
        "content_category": "Video",
        "content_type": "product",
        "content_ids": '["explainer_video"]',
        "value": 0, "currency": CURRENCY,
    }),
    ("Search", "/blog", {
        "search_string": "how to make money in nigeria",
        "content_category": "Blog",
    }),
    ("Lead", "/signup", {
        "content_name": "Signup started",
        "content_category": "Signup",
        "value": 500, "currency": CURRENCY,
    }),
    ("CompleteRegistration", "/signup", {
        "content_name": "Account created",
        "status": "true",
        "value": 1000, "currency": CURRENCY,
    }),
    ("AddToCart", "/dashboard", {
        "content_name": "1 ad share picked",
        "content_category": "Ad share",
        "content_type": "product",
        "content_ids": '["ad_share"]',
        "num_items": 1,
        "value": SHARE_PRICE, "currency": CURRENCY,
    }),
    ("AddToWishlist", "/dashboard", {
        "content_name": "Saved ad share for later",
        "content_ids": '["ad_share"]',
        "value": SHARE_PRICE, "currency": CURRENCY,
    }),
    ("InitiateCheckout", "/dashboard", {
        "content_name": "Payment drawer opened",
        "content_category": "Ad share",
        "content_type": "product",
        "content_ids": '["ad_share"]',
        "num_items": 1,
        "value": SHARE_PRICE, "currency": CURRENCY,
    }),
    ("AddPaymentInfo", "/dashboard", {
        "content_category": "Bank transfer",
        "value": SHARE_PRICE, "currency": CURRENCY,
    }),
    ("Purchase", "/activation-success", {
        "content_name": "Ad share activated",
        "content_category": "Ad share",
        "content_type": "product",
        "content_ids": '["ad_share"]',
        "num_items": 1,
        "order_id": "seed-purchase-1",
        "value": SHARE_PRICE, "currency": CURRENCY,
        "predicted_ltv": SHARE_PAYOUT,
    }),
    ("Purchase", "/activation-success", {
        "content_name": "3 ad shares activated",
        "content_category": "Ad share",
        "content_type": "product",
        "content_ids": '["ad_share"]',
        "num_items": 3,
        "order_id": "seed-purchase-3",
        "value": SHARE_PRICE * 3, "currency": CURRENCY,
        "predicted_ltv": SHARE_PAYOUT * 3,
    }),
    ("Subscribe", "/dashboard", {
        "value": SHARE_PRICE, "currency": CURRENCY,
        "predicted_ltv": SHARE_PAYOUT,
    }),
    ("StartTrial", "/dashboard", {
        "value": 0, "currency": CURRENCY,
        "predicted_ltv": SHARE_PAYOUT,
    }),
    ("Contact", "/support", {
        "content_category": "Help",
    }),
    ("SubmitApplication", "/withdraw", {
        "content_name": "Payout asked for",
        "value": SHARE_PAYOUT, "currency": CURRENCY,
    }),
    ("Schedule", "/task", {
        "content_name": "Daily picking booked",
    }),
    ("Donate", "/", {"value": 1000, "currency": CURRENCY}),
    ("FindLocation", "/", {"content_category": "Nigeria"}),
    ("CustomizeProduct", "/dashboard", {
        "content_name": "Chose how many shares",
        "num_items": 5,
        "value": SHARE_PRICE * 5, "currency": CURRENCY,
    }),
]

# Custom events - these become custom conversions / breakdown options.
CUSTOM_EVENTS = [
    ("WatchedVideo", "/watch-first", {
        "content_name": "Explainer video watched",
        "video_percent": 90,
        "value": 0, "currency": CURRENCY,
    }),
    ("ActivationStarted", "/dashboard", {
        "how_many_shares": 1,
        "money_way": "bank transfer",
        "value": SHARE_PRICE, "currency": CURRENCY,
    }),
    ("ShareActivated", "/activation-success", {
        "how_many_shares": 1,
        "money_way": "bank transfer",
        "where_they_live": "Lagos",
        "value": SHARE_PRICE, "currency": CURRENCY,
    }),
    ("ExtraShareAdded", "/dashboard", {
        "how_many_shares": 2,
        "value": SHARE_PRICE * 2, "currency": CURRENCY,
    }),
    ("PickedPictures", "/task", {
        "batches_done": 1,
        "money_earned": 50, "currency": CURRENCY,
    }),
    ("FriendInvited", "/invite", {
        "how_they_shared": "whatsapp",
        "value": 1000, "currency": CURRENCY,
    }),
    ("FriendPaid", "/invite", {
        "value": 1000, "currency": CURRENCY,
    }),
    ("PayoutAsked", "/withdraw", {
        "value": SHARE_PAYOUT, "currency": CURRENCY,
    }),
    ("PayoutPaid", "/transactions", {
        "value": SHARE_PAYOUT, "currency": CURRENCY,
    }),
    ("AppInstalled", "/dashboard", {"how_they_installed": "add to home screen"}),
]

# Extra breakdown-friendly properties Meta will remember as parameter options.
def extra_props(i: int) -> dict:
    states = ["Lagos", "Abuja FCT", "Rivers", "Kano", "Oyo", "Enugu"]
    return {
        "where_they_live": states[i % len(states)],
        "phone_or_computer": "phone" if i % 3 else "computer",
        "how_they_found_us": ["facebook ad", "friend link", "google", "whatsapp"][i % 4],
        "is_member_yet": "yes" if i % 2 else "not yet",
        "money_way": ["bank transfer", "moniepoint", "flutterwave"][i % 3],
    }


def build_url(event: str, path: str, custom: dict, i: int) -> str:
    page = SITE + path
    params = {
        "id": PIXEL_ID,
        "ev": event,
        "dl": page,
        "rl": SITE + "/",
        "if": "false",
        "ts": str(int(time.time() * 1000)),
        "sw": "412",
        "sh": "915",
        "v": "2.9.180",
        "r": "stable",
        "ec": "0",
        "o": "30",
        "fbp": f"fb.1.{int(time.time())}.{random.randint(10**9, 10**10)}",
        "it": str(int(time.time() * 1000)),
        "coo": "false",
        "es": "automatic",
        "tm": "3",
        "eid": f"seed-{event}-{i}-{int(time.time())}",
    }
    for k, v in {**custom, **extra_props(i)}.items():
        params[f"cd[{k}]"] = str(v)
    return "https://www.facebook.com/tr/?" + urllib.parse.urlencode(params)


def fire(url: str, dry: bool) -> int:
    if dry:
        return 0
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": UA,
            "Referer": SITE + "/",
            "Accept": "image/avif,image/webp,*/*",
            "Accept-Language": "en-NG,en;q=0.9",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status
    except Exception as e:  # noqa: BLE001
        return getattr(e, "code", -1)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    jobs = [(e, p, c) for e, p, c in STANDARD_EVENTS] + [(e, p, c) for e, p, c in CUSTOM_EVENTS]
    ok = 0
    print(f"Seeding dataset {PIXEL_ID} with {len(jobs)} event sends...\n")
    for i, (event, path, custom) in enumerate(jobs):
        url = build_url(event, path, custom, i)
        status = fire(url, args.dry_run)
        good = args.dry_run or status in (200, 204)
        ok += 1 if good else 0
        print(f"  {'OK ' if good else f'{status} '} {event:<22} {path:<22} params={len(custom)+5}")
        if not args.dry_run:
            time.sleep(0.35)

    print(f"\nDone: {ok}/{len(jobs)} accepted by Meta.")
    print("Open Events Manager > Data sources > your pixel > Test/Overview to see them.")


if __name__ == "__main__":
    main()
