"""
Viketa Video Studio — CLIP LIBRARY (record once, reuse forever).

Instead of two long recordings that we later guess our way through, every
piece of screen is recorded as its OWN small, labelled, frame-accurate clip:

    video-studio/clips/   (in the repo, small files, easy to browse)
        land_hero.mp4  sign_year.mp4  calc_five.mp4  task_pick.mp4 ...
        clips.json      <- id, label, what it shows, exact duration

Because every clip is a separate file with a known duration, a NEW voice
recording (new mp3 + new srt) never needs the browser again: timeline.py
just points each spoken sentence at a clip id and compose.py fits it.

HOW THE FRAME-ACCURACY WORKS
Playwright starts recording the moment the browser context opens, so the
boring setup (navigating, replaying earlier form steps, logging in) is on
the tape too. Right before the real action we flash a full-screen WHITE
card for half a second and flash it again at the end. ffmpeg finds those
two flashes (a dark app never goes pure white by itself) and cuts exactly
between them. No clocks, no guessing, no drift.

USAGE
    python3 video-studio/clips.py --list
    python3 video-studio/clips.py --group pub
    python3 video-studio/clips.py --only sign_name,sign_details
    python3 video-studio/clips.py --all --fresh

Recording is resumable: a clip that already exists is skipped unless
--fresh is passed.
"""
import asyncio, json, os, random, re, subprocess, sys, time
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from recipe import PERSON, SIGNUP_URL

BASE = os.environ.get("VIKETA_BASE_URL", "http://localhost:8080")
# The finished clips live IN THE REPO (video-studio/clips) so they travel with
# the code and are easy to look at. They are small — about 250 KB each.
REPO_CLIPS = Path(__file__).resolve().parent / "clips"
OUTDIR = Path(os.environ.get("VIKETA_CLIP_DIR", str(REPO_CLIPS)))
MANIFEST = OUTDIR / "clips.json"
STUDIO = Path(os.environ.get("VIKETA_WORK_DIR", "/mnt/documents/viketa_studio"))

# Scratch + login sessions never touch the repo (they hold access tokens).
RAW = STUDIO / "_raw"
MEMBER_STATE = STUDIO / "state.json"           # the activated demo account
FRESH_STATE = STUDIO / "_fresh_state.json"     # the brand-new, not-yet-paid one
FRESH_RUN = STUDIO / "_fresh_run.json"


VW, VH = 450, 975
FPS = 30


# --------------------------------------------------------------- tiny helpers
async def beat(sec=1.0):
    await asyncio.sleep(sec)


async def safe(coro, label=""):
    try:
        await coro
        return True
    except Exception as e:
        print(f"    ! {label}: {str(e).splitlines()[0][:120]}", flush=True)
        return False


async def human_type(locator, text, delay=90):
    await locator.click()
    await locator.type(text, delay=delay)


SCROLLER_JS = """(d) => {
  const boxes = [...document.querySelectorAll('*')].filter(e => {
    const s = getComputedStyle(e);
    return e.scrollHeight > e.clientHeight + 40
        && (s.overflowY === 'auto' || s.overflowY === 'scroll');
  });
  const el = boxes.sort((a, b) => b.clientHeight - a.clientHeight)[0]
          || document.scrollingElement || document.documentElement;
  el.scrollBy({ top: d, behavior: 'smooth' });
}"""


async def slow_scroll(page, total=900, steps=9, pause=0.45):
    """Scroll whatever actually scrolls on this screen.

    The app keeps its own scrolling box (a <main> with its own overflow), so
    the window never moves and mouse.wheel does nothing in a touch context.
    We find the tallest scrolling box on the page and move that instead.
    """
    step = max(1, total // max(1, steps))
    for _ in range(steps):
        await safe(page.evaluate(SCROLLER_JS, step), "scroll")
        await beat(pause)




async def _white(page, seconds):

    await page.evaluate(
        "() => { const d = document.createElement('div');"
        " d.id='__viketa_mark';"
        " d.style.cssText='position:fixed;inset:0;background:#fff;z-index:2147483647';"
        " document.body.appendChild(d); }")
    await asyncio.sleep(seconds)
    await page.evaluate(
        "() => { const d = document.getElementById('__viketa_mark');"
        " if (d) d.remove(); }")


async def flash(page, kind="start"):
    """Sync marker cut out of the finished clip.

    start = two white cards in quick succession (a pattern nothing else in the
    app can produce), end = one white card. That pair tells the cutter exactly
    where the real action begins and ends, so no clip is ever off by a second.
    """
    if kind == "start":
        await _white(page, 0.5)
        await asyncio.sleep(0.30)
        await _white(page, 0.5)
        await asyncio.sleep(0.30)
    else:
        await asyncio.sleep(0.30)
        await _white(page, 0.8)
        await asyncio.sleep(0.20)



async def settle(page, seconds=1.2):
    await safe(page.wait_for_load_state("networkidle", timeout=8000), "idle")
    await beat(seconds)


# --------------------------------------------------------------- signup replay
def new_person():
    suffix = random.randint(1000, 9999)
    return {**PERSON, "email": PERSON["email"].replace("@", f"{suffix}@")}


async def open_signup(page):
    await page.goto(BASE + SIGNUP_URL, wait_until="domcontentloaded")
    await safe(page.locator('input[placeholder="YYYY"]').wait_for(timeout=25000),
               "signup paint")


async def step_year(page, person, fast):
    year = page.locator('input[placeholder="YYYY"]')
    await year.wait_for(timeout=20000)
    await human_type(year, person["birth_year"], delay=10 if fast else 210)
    await beat(0.2 if fast else 1.2)
    await page.get_by_role("button", name="Continue").click()
    await beat(0.35 if fast else 1.1)


async def step_month(page, person, fast):
    await beat(0.2 if fast else 0.9)
    await page.get_by_role("button", name=person["birth_month"], exact=False).first.click()
    await beat(0.25 if fast else 1.1)
    await page.get_by_role("button", name="Continue").click()
    await beat(0.35 if fast else 1.1)


async def step_state(page, person, fast):
    st = page.get_by_placeholder("Type your state (e.g. Lagos)")
    await st.wait_for(timeout=15000)
    await human_type(st, person["state"], delay=10 if fast else 170)
    await beat(0.25 if fast else 1.1)
    await page.get_by_role("button", name=person["state"], exact=False).first.click()
    await beat(0.25 if fast else 1.1)
    await page.get_by_role("button", name="Continue").click()
    await beat(0.35 if fast else 1.2)


async def step_name(page, person, fast):
    nm = page.get_by_placeholder("e.g. JOHN ADEBAYO OKONKWO")
    await nm.wait_for(timeout=15000)
    await human_type(nm, person["full_name"], delay=10 if fast else 115)
    await beat(0.4 if fast else 3.0)
    await page.get_by_role("button", name="Continue").click()
    await beat(0.35 if fast else 1.3)


async def step_details(page, person, fast):
    d = 10 if fast else 70
    await human_type(page.get_by_placeholder("e.g. 08012345678"), person["phone"], d)
    await beat(0.15 if fast else 0.6)
    await human_type(page.get_by_placeholder("your@email.com"), person["email"], d)
    await beat(0.15 if fast else 0.6)
    await human_type(page.get_by_placeholder("At least 8 characters"), person["password"], d)
    await beat(0.2 if fast else 1.0)
    await safe(page.get_by_role("checkbox").first.click(), "terms box")
    await beat(0.3 if fast else 1.2)


SIGNUP_STEPS = [step_year, step_month, step_state, step_name, step_details]


async def replay_signup(page, person, upto):
    """Fast-forward the form to just before step `upto` (0 based)."""
    await open_signup(page)
    for fn in SIGNUP_STEPS[:upto]:
        await fn(page, person, True)


# --------------------------------------------------------------- clip actions
# Each action is: async def(page, person) -> None
# `setup` runs BEFORE the white flash (not in the finished clip).
# `action` runs AFTER it (this is the clip the viewer sees).

def signup_clip(index):
    async def setup(page, person):
        await replay_signup(page, person, index)
        await beat(0.6)

    async def action(page, person):
        await SIGNUP_STEPS[index](page, person, False)
        await beat(0.8)
    return setup, action


async def _goto_landing(page, person):
    await page.goto(BASE + "/", wait_until="domcontentloaded")
    await settle(page, 1.6)


async def _noop(page, person):
    pass


async def _dashboard(page, person):
    await page.goto(BASE + "/dashboard", wait_until="domcontentloaded")
    await settle(page, 2.2)


async def dismiss_activation_screen(page):
    """Never let the 'your share is active' celebration cover a clip.

    That screen is a full-screen route the app sends an activated member to
    once per device. It is remembered in the browser's own storage, so we
    tell the browser it has already been seen BEFORE we open any page, and
    if it somehow still shows up we tap the 'stay as I am' link.
    """
    for key in ("viketa_activation_success_seen_v2",
                "viketa_activation_success_seen",
                "viketa_welcome_bonus_seen"):
        await safe(page.evaluate(
            f"localStorage.setItem({json.dumps(key)}, 'true')"), "seen flag")


async def _member_goto(page, path, wait_text=None):
    """Open a page as the activated member, celebration screen out of the way."""
    await dismiss_activation_screen(page)
    await page.goto(BASE + path, wait_until="domcontentloaded")
    await beat(1.2)
    # Belt and braces: if the celebration route still won.
    if "/activation-success" in page.url:
        await safe(page.get_by_text("Stay at", exact=False).first
                   .click(timeout=6000), "leave celebration")
        await beat(1.0)
        await page.goto(BASE + path, wait_until="domcontentloaded")
    if wait_text:
        await safe(page.get_by_text(wait_text, exact=False).first
                   .wait_for(timeout=30000), f"{wait_text} paint")
    await settle(page, 2.0)


async def _dashboard_member(page, person):
    await _member_goto(page, "/dashboard", "UPCOMING PAYOUT")



async def _open_calculator(page, person):
    await _dashboard(page, person)
    cta = page.get_by_role("button", name="I Want A Share", exact=False).first
    await safe(cta.scroll_into_view_if_needed(timeout=8000), "cta view")
    await beat(0.6)
    await safe(cta.click(timeout=8000), "cta click")
    await beat(2.5)


async def _climb(page, n):
    plus = page.get_by_label("Increase shares")
    for _ in range(n):
        ok = await safe(plus.click(timeout=6000), "plus")
        if not ok:
            break
        await beat(0.35)


"""Every clip. The id itself is the description: 2-digit running order,
which screen it is, and exactly what happens on it. `label` is the same
thing in plain words, `shows` says what a person watching would see."""
CLIPS = [
    # ---------------- public pages (no account needed) ----------------
    dict(id="01_home_top_headline_and_get_a_share_button", group="pub",
         label="Home page top: big headline and the Get A Share button",
         shows="The very first thing a visitor sees — headline, promise line "
               "and the green button that starts everything.",
         setup=_goto_landing,
         action=lambda p, x: _act_land_hero(p)),
    dict(id="02_home_scroll_real_people_and_bank_alert_proof", group="pub",
         label="Home page scroll: real people and real bank alerts",
         shows="Slow scroll past the faces and the screenshots of money "
               "landing in people's bank accounts.",
         setup=_goto_landing,
         action=lambda p, x: slow_scroll(p, 1500, 14, 0.5)),
    dict(id="03_home_how_it_works_three_steps", group="pub",
         label="Home page: the How It Works three steps",
         shows="Scrolls to and holds on the 3-step explanation of how a "
               "share turns into money.",
         setup=_goto_landing,
         action=lambda p, x: _act_section(p, "How it works", 1500)),
    dict(id="04_home_price_5000_a_share_pays_10000", group="pub",
         label="Home page: one share costs ₦5,000 and pays ₦10,000",
         shows="The pricing block, so the viewer reads the numbers "
               "themselves instead of taking our word for it.",
         setup=_goto_landing,
         action=lambda p, x: _act_section(p, "₦5,000", 1200)),
    dict(id="05_home_bottom_last_answers_and_footer", group="pub",
         label="Home page bottom: last answers and footer",
         shows="The end of the home page — closing questions, links, footer.",
         setup=_goto_landing,
         action=lambda p, x: _act_bottom(p)),
    dict(id="06_faq_page_scroll_questions_people_ask", group="pub",
         label="FAQ page scroll: the questions people always ask",
         shows="Slow scroll down the public questions-and-answers page.",
         setup=lambda p, x: _goto(p, "/faq"),
         action=lambda p, x: slow_scroll(p, 1400, 13, 0.55)),
    dict(id="07_results_page_scroll_people_already_paid", group="pub",
         label="Results page scroll: people who have already been paid",
         shows="The public payout board — names and amounts already sent out.",
         setup=lambda p, x: _goto(p, "/results"),
         action=lambda p, x: slow_scroll(p, 1100, 11, 0.6)),

    # ---------------- the sign up form, one step per clip ----------------
    dict(id="10_signup_page_opens_empty_form", group="signup",
         label="Sign up: the link opens on a clean, empty form",
         shows="Fresh sign-up screen loading, nothing filled in yet.",
         setup=_noop, action=lambda p, x: _act_signup_open(p)),
    dict(id="11_signup_pick_birth_year", group="signup",
         label="Sign up step 1: tapping the birth year",
         shows="The year wheel opens and a year is picked by hand.",
         setup=signup_clip(0)[0], action=signup_clip(0)[1]),
    dict(id="12_signup_pick_birth_month", group="signup",
         label="Sign up step 2: tapping the birth month",
         shows="The month buttons, one gets picked, form moves on.",
         setup=signup_clip(1)[0], action=signup_clip(1)[1]),
    dict(id="13_signup_pick_state_of_residence", group="signup",
         label="Sign up step 3: picking the state you live in",
         shows="The state list opens and Lagos is chosen.",
         setup=signup_clip(2)[0], action=signup_clip(2)[1]),
    dict(id="14_signup_type_full_name_must_match_bank", group="signup",
         label="Sign up step 4: typing the name that matches the bank account",
         shows="Name typed letter by letter with the bank-matching warning "
               "clearly on screen.",
         setup=signup_clip(3)[0], action=signup_clip(3)[1]),
    dict(id="15_signup_type_phone_email_password", group="signup",
         label="Sign up step 5: phone number, email and password typed in",
         shows="The last details being typed, ready to create the account.",
         setup=signup_clip(4)[0], action=signup_clip(4)[1]),
    dict(id="16_signup_tap_create_account_lands_on_dashboard", group="signup",
         label="Sign up finish: tap Create Account and land inside",
         shows="The button press and the jump into the brand-new account.",
         setup=lambda p, x: replay_signup_all(p, x),
         action=lambda p, x: _act_create_account(p, x),
         saves_state=True),

    # ---------------- new account, share not paid yet ----------------
    dict(id="20_dashboard_locked_account_ready_no_share_yet", group="fresh",
         label="New account: dashboard is ready but no share is active yet",
         shows="The locked-preview dashboard a person sees before they pay.",
         setup=_dashboard, action=lambda p, x: _act_locked(p)),
    dict(id="21_dashboard_tap_i_want_a_share_button", group="fresh",
         label="New account: tapping the I Want A Share button",
         shows="The floating green button being pressed.",
         setup=_dashboard, action=lambda p, x: _act_cta(p)),
    dict(id="22_share_calculator_opens_on_one_share", group="fresh",
         label="Share calculator opens, sitting on one share",
         shows="The how-many-shares drawer sliding up, showing 1 share.",
         setup=_open_calculator, action=lambda p, x: beat(4.5)),
    dict(id="23_calculator_one_share_pay_5000_get_10000", group="fresh",
         label="Calculator on 1 share: pay ₦5,000, get ₦10,000",
         shows="The single-share maths held on screen long enough to read.",
         setup=_open_calculator, action=lambda p, x: _act_calc_one(p)),
    dict(id="24_calculator_tap_plus_to_five_shares_25000_gets_50000", group="fresh",
         label="Calculator: tapping plus up to 5 shares, ₦25,000 → ₦50,000",
         shows="The plus button pressed four times and the numbers climbing.",
         setup=_open_calculator, action=lambda p, x: _act_calc_five(p)),
    dict(id="25_calculator_tap_the_pay_button", group="fresh",
         label="Calculator: tapping the Pay button",
         shows="Final amount checked, then the pay button pressed.",
         setup=lambda p, x: _setup_calc_five(p, x), action=lambda p, x: _act_pay_tap(p)),
    dict(id="26_bank_transfer_page_account_number_to_send_to", group="fresh",
         label="Payment page: the bank account number to transfer to",
         shows="One bank transfer, the account details and the amount, "
               "nothing else to do.",
         setup=lambda p, x: _setup_pay_page(p, x), action=lambda p, x: _act_pay_page(p)),

    # ---------------- the live, activated account ----------------
    dict(id="30_dashboard_live_after_payment_five_shares_active", group="member",
         label="Paid account: dashboard live with 5 shares active",
         shows="The moment after payment lands — the real, unlocked "
               "dashboard with the payout gauge.",
         setup=_dashboard_member, action=lambda p, x: _act_hold(p, 8.0)),
    dict(id="31_dashboard_scroll_wallet_ready_money_and_pending_money", group="member",
         label="Paid account: wallet — money ready now and money still coming",
         shows="Scrolls onto the two money tiles: ready to withdraw, and "
               "pending until the campaign finishes.",
         setup=_dashboard_member, action=lambda p, x: _act_wallet(p)),
    dict(id="32_dashboard_campaign_gauge_filling_towards_full_payout", group="member",
         label="Paid account: the campaign gauge filling towards full payout",
         shows="The big round progress gauge and the percent filled.",
         setup=_dashboard_member, action=lambda p, x: _act_progress(p)),
    dict(id="33_task_page_todays_two_pictures_to_compare", group="member",
         label="Daily job: today's two pictures waiting to be compared",
         shows="The picture-rating screen as it opens, both pictures shown.",
         setup=lambda p, x: _setup_task(p), action=lambda p, x: _act_hold(p, 7.0)),
    dict(id="34_task_tap_the_better_picture_and_submit", group="member",
         label="Daily job: tapping the better picture and submitting it",
         shows="A real pick being made, the choice highlighting, submit "
               "pressed and money added.",
         setup=lambda p, x: _setup_task(p), action=lambda p, x: _act_task_pick(p)),
    dict(id="35_withdraw_page_opens_with_bank_and_balance", group="member",
         label="Cash out: withdraw page with the saved bank and balance",
         shows="The withdraw screen at rest — bank account on file, how "
               "much can leave today.",
         setup=lambda p, x: _member_goto(p, "/withdraw"),
         action=lambda p, x: _act_hold(p, 6.0)),
    dict(id="36_withdraw_type_amount_and_see_what_lands", group="member",
         label="Cash out: typing the amount and seeing what actually lands",
         shows="Amount typed on the keypad with the fee and final figure "
               "updating live.",
         setup=lambda p, x: _member_goto(p, "/withdraw"),
         action=lambda p, x: _act_withdraw(p)),
    dict(id="37_invite_page_your_link_and_friend_bonus", group="member",
         label="Invite page: your own link and the bonus per friend",
         shows="Scroll through the invite screen — personal link, code, "
               "and what each friend who activates pays you.",
         setup=lambda p, x: _member_goto(p, "/invite"),
         action=lambda p, x: _act_scroll_hold(p, 900, 9)),
    dict(id="38_money_history_every_payment_written_down", group="member",
         label="Money history: every naira in and out, written down",
         shows="The transactions list scrolling — each picture-rating "
               "reward and every payout on record.",
         setup=lambda p, x: _member_goto(p, "/transactions"),
         action=lambda p, x: _act_scroll_hold(p, 800, 8)),

]



# --------------------------------------------------------------- clip bodies
async def _goto(page, path):
    await page.goto(BASE + path, wait_until="domcontentloaded")
    await settle(page, 2.2)


async def _act_hold(page, sec):
    """Never a frozen picture: a very slow drift keeps the frame alive."""
    steps = max(1, int(sec / 1.5))
    for i in range(steps):
        await beat(1.2)
        await page.mouse.wheel(0, 18 if i % 2 == 0 else -18)
        await beat(0.3)


async def _act_scroll_hold(page, total, steps):
    await beat(1.5)
    await slow_scroll(page, total, steps, 0.55)
    await beat(2.5)


async def _act_land_hero(page):
    await beat(3.0)
    await slow_scroll(page, 450, 5, 0.5)
    await beat(2.0)


async def _act_section(page, text, scroll):
    target = page.get_by_role("heading", name=text, exact=False).first
    if not await safe(target.scroll_into_view_if_needed(timeout=6000), f"heading {text}"):
        await safe(page.get_by_text(text, exact=False).first
                   .scroll_into_view_if_needed(timeout=6000), f"text {text}")
    await beat(2.2)
    await slow_scroll(page, scroll, 12, 0.55)
    await beat(2.0)



async def _act_bottom(page):
    await page.keyboard.press("End")
    await beat(2.5)
    await slow_scroll(page, -600, 6, 0.5)
    await beat(2.5)


async def _act_signup_open(page):
    await open_signup(page)
    await beat(4.5)


async def replay_signup_all(page, person):
    await replay_signup(page, person, 5)


async def _act_create_account(page, person):
    await beat(1.0)
    await page.get_by_role("button", name="Create Account").click()
    await safe(page.wait_for_url("**/dashboard", timeout=70000), "reach dashboard")
    await settle(page, 3.5)


async def _act_locked(page):
    await beat(2.0)
    await slow_scroll(page, 700, 8, 0.5)
    await beat(2.5)


async def _act_cta(page):
    cta = page.get_by_role("button", name="I Want A Share", exact=False).first
    await safe(cta.scroll_into_view_if_needed(timeout=8000), "cta view")
    await beat(2.0)
    await safe(cta.click(timeout=8000), "cta click")
    await beat(3.0)


async def _act_calc_one(page):
    await _climb(page, 1)
    await beat(5.0)


async def _act_calc_five(page):
    await beat(1.0)
    plus = page.get_by_label("Increase shares")
    for _ in range(5):
        await safe(plus.click(timeout=6000), "plus")
        await beat(1.6)
    await beat(4.0)


async def _setup_calc_five(page, person):
    await _open_calculator(page, person)
    await _climb(page, 5)
    await beat(1.5)


async def _act_pay_tap(page):
    await beat(2.0)
    pay = page.get_by_role("button", name="Pay ₦", exact=False).first
    await safe(pay.click(timeout=10000), "pay")
    await beat(5.0)


async def _setup_pay_page(page, person):
    await _setup_calc_five(page, person)
    pay = page.get_by_role("button", name="Pay ₦", exact=False).first
    await safe(pay.click(timeout=12000), "pay")
    await beat(6.0)


async def _act_pay_page(page):
    await beat(5.0)
    await slow_scroll(page, 500, 5, 0.6)
    await beat(5.0)


async def _act_wallet(page):
    await beat(4.0)
    await slow_scroll(page, 260, 3, 0.7)
    await beat(4.0)


async def _act_progress(page):
    await slow_scroll(page, 700, 7, 0.6)
    await beat(6.0)


async def _setup_task(page):
    await dismiss_activation_screen(page)
    await page.goto(BASE + "/task", wait_until="domcontentloaded")
    await safe(page.wait_for_function(
        "() => [...document.querySelectorAll('img')].filter(i => i.naturalWidth > 150).length >= 2",
        timeout=45000), "task pictures")
    await settle(page, 2.0)



async def _act_task_pick(page):
    await beat(2.0)
    for i in range(5):
        ok = await safe(page.get_by_text("TAP TO PICK", exact=False)
                        .nth(i % 2).click(timeout=8000), "pick")
        if not ok:
            break
        await beat(2.2)
    await beat(3.0)


async def _act_withdraw(page):
    await beat(1.5)
    await safe(human_type(page.get_by_placeholder("0").first, "10000", 190),
               "withdraw amount")
    await beat(4.0)
    await slow_scroll(page, 350, 4, 0.6)
    await beat(3.0)


# --------------------------------------------------------------- recorder
async def make_context(pw, group):
    state = None
    if group == "member" and MEMBER_STATE.exists():
        state = str(MEMBER_STATE)
    if group == "fresh" and FRESH_STATE.exists():
        state = str(FRESH_STATE)

    browser = await pw.chromium.launch(
        headless=True, args=["--no-sandbox", "--disable-gpu", "--hide-scrollbars"])
    ctx = await browser.new_context(
        viewport={"width": VW, "height": VH},
        is_mobile=True, has_touch=True, device_scale_factor=1,
        record_video_dir=str(RAW), record_video_size={"width": VW, "height": VH},
        storage_state=state)

    async def guard(route):
        url = route.request.url
        ok = ("localhost" in url) or ("supabase.co" in url) or url.startswith("data:")
        if route.request.resource_type == "document" and not ok:
            await route.abort()
        else:
            await route.continue_()

    await ctx.route("**/*", guard)
    return browser, ctx


def white_marks(path):
    """Seconds where a full-white card starts/ends (negate + blackdetect)."""
    p = subprocess.run(
        ["ffmpeg", "-i", str(path), "-vf", "negate,blackdetect=d=0.20:pix_th=0.12",
         "-an", "-f", "null", "-"],
        capture_output=True, text=True)
    marks = []
    for m in re.finditer(r"black_start:([\d.]+) black_end:([\d.]+)", p.stderr):
        marks.append((float(m.group(1)), float(m.group(2))))
    return marks


def find_window(marks):
    """Start = the second card of the twin pair. End = the next single card."""
    pairs = [i for i in range(len(marks) - 1)
             if marks[i + 1][0] - marks[i][1] < 0.85]
    if not pairs:
        raise RuntimeError(f"no twin start marker found (cards: {len(marks)})")
    i = pairs[0]
    start = marks[i + 1][1]
    after = [m for m in marks[i + 2:] if m[0] > start + 0.5]
    if not after:
        raise RuntimeError("no end marker found")
    return start, after[0][0]


def cut(raw, dst):
    """Cut between the sync markers and encode a clean 30fps mp4."""
    marks = white_marks(raw)
    a, b = find_window(marks)
    start, end = a + 0.12, b - 0.08
    dur = max(0.8, end - start)
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{start:.3f}",
         "-t", f"{dur:.3f}", "-i", str(raw),
         "-vf", f"fps={FPS},scale={VW}:{VH + 1}:flags=lanczos,setsar=1",
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
         "-pix_fmt", "yuv420p", "-an", str(dst)], check=True)
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", str(dst)],
        capture_output=True, text=True, check=True).stdout.strip()
    return round(float(out), 3)



def load_manifest():
    if MANIFEST.exists():
        return json.loads(MANIFEST.read_text())
    return {}


def save_manifest(man):
    MANIFEST.write_text(json.dumps(man, indent=2, ensure_ascii=False))


async def record_one(spec, person, man):
    from playwright.async_api import async_playwright

    cid = spec["id"]
    dst = OUTDIR / f"{cid}.mp4"
    print(f"  recording {cid} ({spec['group']})", flush=True)
    async with async_playwright() as pw:
        browser, ctx = await make_context(pw, spec["group"])
        page = await ctx.new_page()
        try:
            await page.goto(BASE + "/", wait_until="domcontentloaded")
            await beat(1.2)
            if spec["group"] == "member":
                await dismiss_activation_screen(page)
            await spec["setup"](page, person)

            await flash(page, "start")
            await spec["action"](page, person)
            await flash(page, "end")
            if spec.get("saves_state"):
                await ctx.storage_state(path=str(FRESH_STATE))
                info = {"email": person["email"], "password": person["password"],
                        "full_name": person["full_name"]}
                try:
                    key = await page.evaluate(
                        "Object.keys(localStorage).find(k => k.startsWith('sb-')"
                        " && k.endsWith('-auth-token'))")
                    raw = await page.evaluate(
                        f"localStorage.getItem({json.dumps(key)})") if key else None
                    if raw:
                        info["user_id"] = json.loads(raw)["user"]["id"]
                except Exception:
                    pass
                FRESH_RUN.write_text(json.dumps(info, indent=2))
                print(f"    new account: {info}", flush=True)
        finally:
            vid = page.video
            await ctx.close()
            raw_path = await vid.path()
            await browser.close()

    dur = cut(raw_path, dst)
    Path(raw_path).unlink(missing_ok=True)
    man[cid] = {"id": cid, "label": spec["label"],
                "shows": spec.get("shows", ""), "group": spec["group"],
                "file": dst.name, "duration": dur,
                "recorded_at": time.strftime("%Y-%m-%d %H:%M:%S")}
    save_manifest(man)
    print(f"    -> {dst.name}  {dur:.2f}s", flush=True)


async def run(selected, fresh):
    OUTDIR.mkdir(parents=True, exist_ok=True)
    RAW.mkdir(parents=True, exist_ok=True)
    man = load_manifest()
    person = new_person()

    for spec in selected:
        cid = spec["id"]
        if not fresh and (OUTDIR / f"{cid}.mp4").exists() and cid in man:
            print(f"  {cid}: already recorded ({man[cid]['duration']}s)", flush=True)
            continue
        try:
            await record_one(spec, person, man)
        except Exception as e:
            print(f"  !! {cid} FAILED: {e}", flush=True)


def main():
    args = sys.argv[1:]
    fresh = "--fresh" in args

    if "--list" in args:
        man = load_manifest()
        for c in CLIPS:
            got = man.get(c["id"])
            state = f"{got['duration']:6.2f}s" if got else "   ----"
            print(f"{state}  {c['group']:7} {c['id']}")
            print(f"           {c['label']}")
            print(f"           {c.get('shows', '')}\n")
        return


    picked = CLIPS
    if "--group" in args:
        g = args[args.index("--group") + 1]
        picked = [c for c in CLIPS if c["group"] == g]
    if "--only" in args:
        ids = args[args.index("--only") + 1].split(",")
        picked = [c for c in CLIPS if c["id"] in ids]

    print(f"clips to record: {len(picked)}", flush=True)
    asyncio.run(run(picked, fresh))
    print("done", flush=True)


if __name__ == "__main__":
    main()
