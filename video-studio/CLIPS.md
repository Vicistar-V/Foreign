# The Clip Library — every clip, explained one by one

**Where they live:** `video-studio/clips/` (in the repo, 30 files, ~7.5 MB total)
**Manifest:** `video-studio/clips/clips.json` (machine-readable: id, label, shows, group, file, duration, recorded_at)
**Every clip is identical technically:** 450 x 976 px, 30 fps, H.264 (yuv420p, crf 20), **no audio track**, already trimmed — the first frame is real content and the last frame is real content. Nothing needs cutting again.

> Why 976 and not 975? The phone screen is recorded at 450x975 but H.264 needs an even height, so the cut step scales to 450x**976**. Anything that composites these clips must use 450x976 or letterboxing appears.

## How to read this catalogue

Each entry gives you:

- **id / file** — the exact string you put in `timeline.py`
- **length** — real measured duration in seconds (also in `clips.json`)
- **what a viewer sees** — frame by frame, so you can judge if it fits a sentence
- **first frame / last frame** — critical for cutting: what the clip opens and closes on
- **how it was made** — the setup that ran before recording and the action that was recorded
- **safe to stretch?** — see "Stretching rules" at the bottom before reusing

Groups:

| group | meaning | browser session used |
|---|---|---|
| `pub` | public marketing pages, no login | fresh anonymous context |
| `signup` | the sign-up form, one step per clip | fresh anonymous context, form replayed to that step |
| `fresh` | a real account that has signed up but **not paid** | `_fresh_state.json` (logged-in, no share) |
| `member` | a real account that **has paid** and has 5 active shares | `state.json` (logged-in, activated) |

---

## Group `pub` — public pages (01–07)

### 01_home_top_headline_and_get_a_share_button — 9.03 s
The very top of `/` on a phone: brand mark, the big headline, the promise line, and the green **Get A Share** button.
- **First frame:** hero fully painted, page at scroll 0.
- **Body:** holds 3 s dead still on the headline, then a slow 450 px scroll over 5 steps, then holds 2 s.
- **Last frame:** just below the hero, button still visible.
- **Made by:** `_goto_landing` → `_act_land_hero`.
- **Good for:** opening shot, closing shot, "the link is in the description" call to action.
- **Stretch:** very safe (mostly static).

### 02_home_scroll_real_people_and_bank_alert_proof — 8.20 s
A continuous slow scroll (1500 px over 14 steps) through the social-proof band: member faces and screenshots of real bank credit alerts.
- **First frame:** top of the page. **Last frame:** mid-page, inside the proof cards.
- **Made by:** `_goto_landing` → `slow_scroll(1500, 14, 0.5)`.
- **Good for:** any "real people, real bank alerts" / trust / objection-handling line.
- **Stretch:** safe up to ~1.6x; beyond that the scroll looks like slow motion.

### 03_home_how_it_works_three_steps — 12.07 s
Scrolls to the **How it works** heading, holds 2.2 s, then scrolls 1500 px through the three numbered steps, then holds 2 s.
- **Made by:** `_goto_landing` → `_act_section("How it works", 1500)`.
- **Good for:** summary lines, "that is the whole thing".

### 04_home_price_5000_a_share_pays_10000 — 12.47 s
Same pattern, targeted at the **₦5,000** pricing block, so the viewer reads the price and the payout with their own eyes.
- **Made by:** `_goto_landing` → `_act_section("₦5,000", 1200)`.
- **Good for:** price, value, "one share pays ₦10,000".
- **Careful:** this shows the *live* pricing copy from the site. If pricing copy changes, re-record this clip or the video contradicts the app.

### 05_home_bottom_last_answers_and_footer — 9.83 s
Jumps to the very bottom (`End` key), holds 2.5 s, scrolls **back up** 600 px, holds 2.5 s.
- **Note:** the scroll direction is upward — do not intercut it directly after another downward scroll or the motion fights itself.

### 06_faq_page_scroll_questions_people_ask — 7.93 s
Slow scroll down `/faq` (1400 px, 13 steps). Questions and answers, nothing interactive.

### 07_results_page_scroll_people_already_paid — 7.07 s
Slow scroll down the public `/results` payout board — names and amounts already paid out.
- **Good for:** "when a share pays out it is finished", proof of payouts.
- **Careful:** the names/amounts are whatever the database held on 2026-07-31. Re-record after any data wipe.

---

## Group `signup` — the form, one step per clip (10–16)

All of these open `/signup?xse=1` (the `xse=1` parameter skips the in-app explainer video, because the YouTube video *is* the explainer). Each clip **replays the earlier steps at high speed before the flash**, so only its own step is on the finished tape. The person is `PERSON` in `recipe.py` with a randomised email suffix per run.

### 10_signup_page_opens_empty_form — 7.13 s
The link opens; a clean, empty form paints and sits there 4.5 s. Nothing is typed.
- **Good for:** "open the link in the description".

### 11_signup_pick_birth_year — 4.80 s
The year field, `1994` typed digit by digit at 210 ms per keystroke, 1.2 s pause, **Continue** tapped, next step appears.
- **Last frame:** already on the month step.

### 12_signup_pick_birth_month — 4.77 s
Month buttons, `Mar` tapped, pause, **Continue**.

### 13_signup_pick_state_of_residence — 5.83 s
"Lagos" typed into the state search, the matching option tapped, **Continue**.

### 14_signup_type_full_name_must_match_bank — 8.17 s
`CHINEDU EMEKA OKAFOR` typed letter by letter (115 ms/key), then a deliberate **3 s hold** so the "must match your bank account" warning is readable, then **Continue**.
- **Good for:** the single most important instruction in the whole flow. Give it a long narration window.

### 15_signup_type_phone_email_password — 9.47 s
Phone, email, password typed (70 ms/key) and the terms checkbox ticked.
- **Note:** a real, human-looking Gmail address is used — never "demo", "test" or "example". Keep it that way.

### 16_signup_tap_create_account_lands_on_dashboard — 6.40 s
**Create Account** pressed, the real request runs, and the brand-new dashboard loads.
- This is the only signup clip that creates a real account. When it runs with `saves_state`, its session is written to `_fresh_state.json` and the account details to `_fresh_run.json`.

---

## Group `fresh` — account exists, nothing paid yet (20–26)

Recorded with the `_fresh_state.json` session: real logged-in user, zero shares.

### 20_dashboard_locked_account_ready_no_share_yet — 10.33 s
The locked-preview dashboard: lock icons, "your dashboard unlocks when you get a share", no numbers. Holds 2 s, scrolls 700 px, holds 2.5 s.
- **Good for:** "account ready, no share turned on yet".

### 21_dashboard_tap_i_want_a_share_button — 6.40 s
The floating green **I Want A Share** button scrolled into view, held 2 s, then pressed; the drawer begins to rise.

### 22_share_calculator_opens_on_one_share — 5.60 s
The share-quantity drawer already open, sitting on **1 share**, with one extra tap of plus and a 5 s hold.

### 23_calculator_one_share_pay_5000_get_10000 — 6.63 s
Held on the single-share maths: pay ₦5,000 → get ₦10,000. Almost static, extremely safe to stretch.

### 24_calculator_tap_plus_to_five_shares_25000_gets_50000 — 15.60 s
The plus button pressed **five times, 1.6 s apart**, numbers climbing to ₦25,000 → ₦50,000, then a 4 s hold on the total.
- **Longest calculator clip.** Because taps are evenly spaced you can trim it from the *front* to shorten (each tap is ~1.6 s) rather than speeding it up.
- Reused twice in the current timeline: once for the climb, once for "want to earn again? turn on new shares".

### 25_calculator_tap_the_pay_button — 8.43 s
Final amount checked for 2 s, **Pay ₦…** pressed, the payment screen starts loading (5 s tail).

### 26_bank_transfer_page_account_number_to_send_to — 15.17 s
The bank-transfer payment page: the account number to send to, the exact amount, the countdown. 5 s hold, 500 px scroll, 5 s hold.
- **This is a real generated payment page** — the account number shown is a real temporary virtual account from the provider, already expired. Never re-use it as instruction copy.

---

## Group `member` — the live, paid account (30–38)

Recorded with `state.json`: a real account flipped to **paid with 5 active shares** by SQL (see "Making a new demo account"). Before every one of these clips the recorder writes three localStorage flags (`viketa_activation_success_seen_v2`, `viketa_activation_success_seen`, `viketa_welcome_bonus_seen`) so the full-screen activation-celebration route can never cover the shot, and if it still wins it clicks the "Stay at…" link and re-navigates.

### 30_dashboard_live_after_payment_five_shares_active — 9.13 s
The unlocked dashboard right after payment: the payout gauge, 5 shares active, live numbers. Waits for the text `UPCOMING PAYOUT` to paint before recording, so the gauge is never mid-skeleton.

### 31_dashboard_scroll_wallet_ready_money_and_pending_money — 12.07 s
4 s hold, a short 260 px scroll onto the two money tiles (**ready to withdraw** and **still coming**), 4 s hold.

### 32_dashboard_campaign_gauge_filling_towards_full_payout — 12.00 s
700 px scroll then a **6 s hold** on the big round campaign gauge and its percentage. The largest file (1 MB) because the gauge animates constantly.

### 33_task_page_todays_two_pictures_to_compare — 6.43 s
The daily picture-rating screen at rest, both pictures loaded. The setup waits until **two images with naturalWidth > 150** exist, so it can never record grey placeholders.
- The "hold" is not frozen: a ±18 px wheel drift keeps the frame alive, which stops YouTube from thinking it is a still image.

### 34_task_tap_the_better_picture_and_submit — 15.77 s
A real pick: up to five taps on **TAP TO PICK**, alternating left/right, 2.2 s apart, choices highlighting, reward added. 3 s tail.
- **Longest member clip.** Great for the "about 15 minutes a day" line.

### 35_withdraw_page_opens_with_bank_and_balance — 6.43 s
The withdraw screen at rest: saved bank account, how much can leave today. Slow drift hold, 6 s.

### 36_withdraw_type_amount_and_see_what_lands — 12.53 s
`10000` typed on the keypad at 190 ms/key with the fee and the "what actually lands" figure updating live, 4 s hold, 350 px scroll, 3 s hold.

### 37_invite_page_your_link_and_friend_bonus — 9.83 s
Scroll through `/invite`: personal link, code, and what each friend who activates pays you.
- Contains the **referral bonus amount**. If that number changes, re-record.

### 38_money_history_every_payment_written_down — 10.47 s
`/transactions` scrolling: every picture-rating reward and every payout, on the record.

---

## Stretching rules (read before reusing a clip for a different sentence)

`compose.py` fits a clip to a narration window by **slowing it down** (`setpts`, factor `k = window / clip`, never below 1.0). It never speeds a clip up and never loops it.

| clip type | safe stretch | why |
|---|---|---|
| holds / near-static (23, 33, 35, 30) | up to 3x | nothing moves, slower is invisible |
| slow scrolls (02, 03, 04, 06, 07, 37, 38, 31, 32) | up to ~1.6x | past that the scroll reads as slow motion |
| typing (11–15, 36) | up to ~1.3x | slowed typing looks wrong fast |
| discrete taps (21, 24, 25, 34) | up to ~1.2x | taps drift away from the click feeling |

If a window is much longer than any suitable clip, **split the window across two clips** in `timeline.py` instead of over-stretching one. If a window is shorter than the clip, the clip is simply cut short — so put the important frames early.

---

## Making more clips

1. Add a `dict(...)` to `CLIPS` in `video-studio/clips.py` with a self-describing `id` (`NN_screen_what_happens`), a `label`, a `shows` sentence, a `group`, a `setup` coroutine and an `action` coroutine.
2. `setup` runs **before** the sync flash and is NOT in the finished clip — use it for navigation, logging in, replaying form steps, waiting for images.
3. `action` runs **between** the flashes and IS the clip. Keep it 5–16 s. Never end on a frozen frame; use `_act_hold` (which drifts) instead of a plain sleep.
4. Record it: `python3 video-studio/clips.py --only my_new_clip_id`. Existing clips are skipped unless `--fresh` is passed, so this is cheap and resumable.
5. The manifest and duration are written automatically. Then reference the id from `timeline.py`.

Full pipeline details, sync-marker mechanics, demo-account setup and render commands: see `video-studio/README.md`.
