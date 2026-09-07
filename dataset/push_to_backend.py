#!/usr/bin/env python3
"""
push_to_backend.py
------------------
Push a scraped Unsplash JSON file (one campaign / category) into the
Supabase `comparison_images` table.

USAGE
-----
  export SUPABASE_URL="https://sbprvewcfrtazdlcfvxt.supabase.co"
  export SUPABASE_SERVICE_ROLE_KEY="eyJhbGci...your service role key..."

  python3 push_to_backend.py path/to/campaign.json

  # override the category slug if the JSON's task_tag is wrong:
  python3 push_to_backend.py path/to/campaign.json --slug skincare_ritual

  # dry run (don't actually upload):
  python3 push_to_backend.py path/to/campaign.json --dry-run

INPUT FILE FORMAT
-----------------
The JSON must have this shape (this is what your Unsplash scraper outputs):

  {
    "_meta": {"slug": "...", "task_tag": "skincare_ritual", "count": 367},
    "results": [
      {
        "image_url": "https://images.unsplash.com/...",
        "source_prompt": "woman with white face paint",
        "task_tag": "skincare_ritual",
        ...
      },
      ...
    ]
  }

VALID CATEGORY SLUGS (must already exist in comparison_categories):
  skincare_ritual, tech_lifestyle, fitness_action, street_fashion, food_crave

The script:
  - de-duplicates by image_url (skips URLs already in DB)
  - inserts in batches of 200
  - reports per-batch progress + final summary
"""

import argparse
import json
import os
import sys
import time
from urllib import request, error, parse

VALID_SLUGS = {
    "skincare_ritual",
    "tech_lifestyle",
    "fitness_action",
    "street_fashion",
    "food_crave",
}

BATCH_SIZE = 200


def env(name: str) -> str:
    v = os.environ.get(name)
    if not v:
        sys.exit(f"ERROR: env var {name} is not set. See top of file for usage.")
    return v


def http(method: str, url: str, headers: dict, body: bytes | None = None) -> tuple[int, bytes]:
    req = request.Request(url, method=method, headers=headers, data=body)
    try:
        with request.urlopen(req, timeout=60) as r:
            return r.status, r.read()
    except error.HTTPError as e:
        return e.code, e.read()


def fetch_existing_urls(base_url: str, headers: dict, slug: str) -> set[str]:
    """Pull every image_url already stored for this category so we can skip dupes."""
    existing: set[str] = set()
    page_size = 1000
    offset = 0
    while True:
        q = parse.urlencode({
            "select": "image_url",
            "category_slug": f"eq.{slug}",
            "limit": str(page_size),
            "offset": str(offset),
        })
        url = f"{base_url}/rest/v1/comparison_images?{q}"
        status, raw = http("GET", url, headers)
        if status != 200:
            sys.exit(f"ERROR fetching existing rows ({status}): {raw[:300]!r}")
        rows = json.loads(raw)
        if not rows:
            break
        for r in rows:
            existing.add(r["image_url"])
        if len(rows) < page_size:
            break
        offset += page_size
    return existing


def insert_batch(base_url: str, headers: dict, rows: list[dict]) -> int:
    """Insert a batch of rows. Returns number inserted."""
    url = f"{base_url}/rest/v1/comparison_images"
    body = json.dumps(rows).encode("utf-8")
    h = {**headers, "Content-Type": "application/json", "Prefer": "return=minimal"}
    status, raw = http("POST", url, h, body)
    if status not in (200, 201, 204):
        sys.exit(f"ERROR inserting batch ({status}): {raw[:500]!r}")
    return len(rows)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("json_file", help="Path to the campaign JSON file from your scraper")
    ap.add_argument("--slug", help="Override category slug (otherwise read from _meta.task_tag)")
    ap.add_argument("--dry-run", action="store_true", help="Don't upload, just report")
    args = ap.parse_args()

    SUPABASE_URL = env("SUPABASE_URL").rstrip("/")
    SERVICE_KEY = env("SUPABASE_SERVICE_ROLE_KEY")

    headers = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
    }

    print(f"Reading {args.json_file} ...")
    with open(args.json_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    meta = data.get("_meta", {})
    results = data.get("results", [])
    slug = args.slug or meta.get("task_tag")

    if not slug:
        sys.exit("ERROR: no category slug. Pass --slug or include _meta.task_tag in JSON.")
    if slug not in VALID_SLUGS:
        sys.exit(f"ERROR: slug '{slug}' not in valid set {VALID_SLUGS}")
    if not results:
        sys.exit("ERROR: no 'results' array in JSON.")

    print(f"  category slug : {slug}")
    print(f"  rows in file  : {len(results)}")

    # Build candidate rows + de-dupe within the file itself
    seen_in_file: set[str] = set()
    candidates: list[dict] = []
    skipped_no_url = 0
    skipped_dupes_in_file = 0
    for r in results:
        url = (r.get("image_url") or "").strip()
        if not url:
            skipped_no_url += 1
            continue
        if url in seen_in_file:
            skipped_dupes_in_file += 1
            continue
        seen_in_file.add(url)
        candidates.append({
            "image_url": url,
            "category_slug": slug,
            "provider": "unsplash",
            "source_prompt": (r.get("source_prompt") or "")[:1000],
            "is_dead": False,
        })

    print(f"  unique URLs   : {len(candidates)}  (skipped {skipped_no_url} blank, {skipped_dupes_in_file} dupes-in-file)")

    # Skip URLs already in DB for this category
    print("Fetching existing URLs from backend (so we don't re-insert)...")
    existing = fetch_existing_urls(SUPABASE_URL, headers, slug)
    print(f"  already in DB : {len(existing)}")

    fresh = [r for r in candidates if r["image_url"] not in existing]
    print(f"  to insert     : {len(fresh)}")

    if args.dry_run:
        print("\n--dry-run set, not uploading.")
        if fresh[:2]:
            print("Sample row:")
            print(json.dumps(fresh[0], indent=2))
        return

    if not fresh:
        print("\nNothing to upload. Done.")
        return

    print(f"\nUploading in batches of {BATCH_SIZE} ...")
    inserted = 0
    t0 = time.time()
    for i in range(0, len(fresh), BATCH_SIZE):
        batch = fresh[i : i + BATCH_SIZE]
        n = insert_batch(SUPABASE_URL, headers, batch)
        inserted += n
        print(f"  batch {i // BATCH_SIZE + 1:>3}: +{n}  (total {inserted}/{len(fresh)})")

    dt = time.time() - t0
    print(f"\n=== DONE ===")
    print(f"Inserted        : {inserted}")
    print(f"Already existed : {len(candidates) - len(fresh)}")
    print(f"Category        : {slug}")
    print(f"Took            : {dt:.1f}s")


if __name__ == "__main__":
    main()
