# Viketa UI Copy Spec — "Ad Share + Campaign" system (frontend only)

Source: `docs/viketa-narrative-share-system.md`

## The story users must get (grandma-simple, no big grammar)

Companies pay Viketa to find out which advert picture people like better.
A person activates an **ad share**, joins a **campaign**, picks a picture each day,
and when the campaign reaches **100%**, that share pays **₦10,000** and is finished.

## Word swaps (user-facing text ONLY — never rename code, vars, tables, routes, query keys)

| Old wording | New wording |
| --- | --- |
| spot / buy a spot / I Want A Spot | ad share / activate a share / "I Want A Share" |
| the line / queue / queue position / position #N | your campaign / campaign progress (0–100%) |
| people ahead of you / people joining behind you | (delete — never mention new joiners) |
| line moves / line fills | campaign moves towards 100% |
| cycle / drop / payout cycle | campaign |
| spot retired / cycle complete | share finished — ₦10,000 paid |
| daily task / batches | daily picture rating (pick A or B, about 15 minutes a day) |
| target amount ₦10,000 | what this share pays: ₦10,000 |
| extension / restore capacity | activate another share |

## Money facts (unchanged, pull from platform_config where already wired)
- First share: ₦5,000. Extra shares: ₦3,000 each (member price).
- Each share pays ₦10,000 maximum, then it is finished.
- Campaign usually reaches 100% in about 3–5 days.
- Withdrawals go to the bank account the name matches.

## Tone rules
- Short sentences. No "corporate ad verification", "batch clearing", "yield", "node",
  "maturation", "calibration", "distribution", "capacity".
- Say "companies pay to know which picture people like better".
- Never create fear about the line stopping. Frame waiting as "your campaign is still filling up".
- Mobile-first. No emojis. No backdrop-blur. Dark mode default.
- Social sharing buttons stay "Send to a friend" / "Tell a friend" so "share" never gets confused
  with the paid ad share.

## Scope
Frontend presentation only: copy, labels, headings, toasts, empty states, SEO titles/descriptions.
No backend, schema, RPC, edge function or business-logic changes.
