# Dataset Tools

Scripts you run **locally on your VPS** (not in the app) to prepare and push image data into the `comparison_images` backend table.

## Workflow

```
[Unsplash scraper]  →  campaign_*.json  →  push_to_backend.py  →  Supabase
```

## 1. Categories (must exist before pushing)

These 5 slugs are seeded in the DB. Your JSON's `_meta.task_tag` must be one of:

| Slug              | Display name      | Search query (what your scraper uses)              |
|-------------------|-------------------|----------------------------------------------------|
| `skincare_ritual` | Skincare Ritual   | woman applying face cream glowing skin natural light |
| `tech_lifestyle`  | Tech Lifestyle    | happy person using laptop cafe working remote       |
| `fitness_action`  | Fitness Action    | fitness model running urban city nike style         |
| `street_fashion`  | Street Fashion    | trendy streetwear outfit urban background           |
| `food_crave`      | Food Crave        | delicious burger juicy close up food photography    |

## 2. Push a campaign JSON

```bash
export SUPABASE_URL="https://sbprvewcfrtazdlcfvxt.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<your service role key from Supabase dashboard>"

# Dry-run first to see what will happen
python3 push_to_backend.py woman-applying-face-cream-glowing-skin-natural-light_*.json --dry-run

# Real push
python3 push_to_backend.py woman-applying-face-cream-glowing-skin-natural-light_*.json
```

The script:
- reads `_meta.task_tag` for the category slug (override with `--slug`)
- de-dupes within the file
- fetches existing `image_url`s for that category from the backend and skips them
- inserts in batches of 200 via the Supabase REST API
- requires the **service role key** (so it bypasses RLS — keep it secret, never commit it)

## 3. Verify in the app

After pushing, open `/task` in the app. Pairs are drawn at random from `comparison_images` where `is_dead = false`.

## Files

- `filter_dataset.py` — old Civitai filter (kept for reference, not used in the new flow)
- `push_to_backend.py` — the uploader you'll actually run
