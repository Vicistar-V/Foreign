"""
Viketa Video Studio — THE TIMELINE (the recorded voice is the boss).

The voice recording (voice/voice.mp3 + voice/voice.srt) is the master clock.
Every slot below says which piece of screen is showing while a specific
sentence is being spoken, and each boundary is copied straight out of the
subtitle file, so the picture always changes on the same breath as the words.

Each slot is:  (start_second, end_second, clip_id_or_fx_scene, headline_text)

  fx_*  -> a fully drawn animation (video-studio/explainer.py)
  other -> a real phone recording from video-studio/clips/ (see clips.json)

To build a NEW video later: drop in a new voice.mp3 / voice.srt, re-map the
slots against the new subtitle times, then run compose.py --fresh.
"""

SLOTS = [
    # =====================================================================
    # 0:00 – 0:42   Intro: what this video will show  (drawn animation)
    # =====================================================================
    (0.00,   11.92, "fx_hook",   None),
    (11.92,  42.00, "fx_agenda", None),

    # =====================================================================
    # 0:42 – 2:41   How the money works  (drawn animation, no phone yet)
    # =====================================================================
    (42.00,  81.20, "fx_how",      None),   # companies pay for opinions
    (81.20, 102.80, "fx_price",    None),   # 1 share: 5,000 -> 10,000
    (102.80, 111.92, "fx_three",   None),   # 3 shares: 15,000 -> 30,000
    (111.92, 120.80, "fx_five",    None),   # 5 shares: 25,000 -> 50,000
    (120.80, 133.92, "fx_time",    None),   # same 15 minutes either way
    (133.92, 148.72, "fx_progress", None),  # campaign moves to 100%
    (148.72, 161.76, "fx_bank",    None),   # money lands in your bank

    # =====================================================================
    # 2:41 – 3:47   Creating the account  (real screen recording)
    # =====================================================================
    (161.76, 173.12, "10_signup_page_opens_empty_form",
     "The link opens\nthe sign up page"),
    (173.12, 177.20, "11_signup_pick_birth_year",
     "Pick the year\nyou were born"),
    (177.20, 181.20, "12_signup_pick_birth_month",
     "Pick the month\nyou were born"),
    (181.20, 187.04, "13_signup_pick_state_of_residence",
     "Pick the state\nyou live in"),
    (187.04, 213.36, "14_signup_type_full_name_must_match_bank",
     "Type your name exactly\nas it is on your bank"),
    (213.36, 220.08, "15_signup_type_phone_email_password",
     "Phone number, email\nand a password"),
    (220.08, 227.76, "16_signup_tap_create_account_lands_on_dashboard",
     "Tap Create Account\nand you are inside"),

    # =====================================================================
    # 3:47 – 5:11   Turning the shares on  (real screen recording)
    # =====================================================================
    (227.76, 240.32, "20_dashboard_locked_account_ready_no_share_yet",
     "Account ready\nNo share turned on yet"),
    (240.32, 246.64, "21_dashboard_tap_i_want_a_share_button",
     "Tap\nI Want A Share"),
    (246.64, 250.48, "22_share_calculator_opens_on_one_share",
     "Choose how many\nshares you want"),
    (250.48, 257.68, "23_calculator_one_share_pay_5000_get_10000",
     "1 share\n\u20a65,000 pays \u20a610,000"),
    (257.68, 271.12, "24_calculator_tap_plus_to_five_shares_25000_gets_50000",
     "5 shares\n\u20a625,000 pays \u20a650,000"),
    (271.12, 278.40, "25_calculator_tap_the_pay_button",
     "You see the money\nbefore you pay"),
    (278.40, 311.36, "26_bank_transfer_page_account_number_to_send_to",
     "One transfer from\nyour own bank app"),

    # =====================================================================
    # 5:11 – 6:33   Inside the live account  (real screen recording)
    # =====================================================================
    (311.36, 317.76, "30_dashboard_live_after_payment_five_shares_active",
     "Payment confirmed\nDashboard is live"),
    (317.76, 324.08, "31_dashboard_scroll_wallet_ready_money_and_pending_money",
     "Money ready now\nand money still coming"),
    (324.08, 344.32, "32_dashboard_campaign_gauge_filling_towards_full_payout",
     "The campaign bar\nclimbs to 100%"),
    (344.32, 351.76, "33_task_page_todays_two_pictures_to_compare",
     "The daily job\ntwo pictures"),
    (351.76, 372.48, "34_task_tap_the_better_picture_and_submit",
     "Pick the better picture\nabout 15 minutes"),
    (372.48, 379.84, "35_withdraw_page_opens_with_bank_and_balance",
     "Open the\nwithdraw page"),
    (379.84, 393.76, "36_withdraw_type_amount_and_see_what_lands",
     "Type the amount\nand send the request"),

    # =====================================================================
    # 6:33 – 7:08   The one rule: each share stops at ₦10,000
    # =====================================================================
    (393.76, 406.96, "38_money_history_every_payment_written_down",
     "Every naira in and out\nis written down"),
    (406.96, 413.60, "07_results_page_scroll_people_already_paid",
     "When a share pays out\nit is finished"),
    (413.60, 428.16, "24_calculator_tap_plus_to_five_shares_25000_gets_50000",
     "Want to earn again?\nTurn on new shares"),

    # =====================================================================
    # 7:08 – 7:41   Closing
    # =====================================================================
    (428.16, 436.40, "02_home_scroll_real_people_and_bank_alert_proof",
     "Real people\nReal bank alerts"),
    (436.40, 448.50, "03_home_how_it_works_three_steps",
     "That is the\nwhole thing"),
    (448.50, 461.76, "01_home_top_headline_and_get_a_share_button",
     "Link is in the\ndescription below"),
]


def total_seconds():
    return SLOTS[-1][1]


def scenes_needed():
    return sorted({s[2] for s in SLOTS})
