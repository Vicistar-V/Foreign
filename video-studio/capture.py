"""
Viketa Video Studio — SCREEN CAPTURE (Playwright).

Records the real app on a real phone-sized screen. Two parts, because in the
middle we flip the freshly created account to "paid" in the database (no real
money leaves anywhere).

    python3 video-studio/capture.py a     public pages + signup + payment page
    python3 video-studio/grant.sql step   (agent flips the account to active)
    python3 video-studio/capture.py b     the live, activated account

Everything is written to a PERSISTENT folder (never /tmp) so a re-render never
needs the browser again:

    /mnt/documents/viketa_studio/
        part_a.webm  part_b.webm     raw phone recordings
        scenes_a.json scenes_b.json  real start/end second of every scene
        run.json                     who signed up (email + user id)
"""
import asyncio, json, os, random, sys, time
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from recipe import PERSON, SCENES, SIGNUP_URL

BASE = os.environ.get("VIKETA_BASE_URL", "http://localhost:8080")
WORK = Path(os.environ.get("VIKETA_WORK_DIR", "/mnt/documents/viketa_studio"))
WORK.mkdir(parents=True, exist_ok=True)

VW, VH = 450, 975          # phone screen we record at


class Director:
    """Keeps the clock so every scene knows exactly when it started/ended."""

    def __init__(self):
        self.t0 = time.time()
        self.scenes = []
        self._cur = None

    def mark(self, scene_id):
        self.close()
        self._cur = {"id": scene_id, "start": round(time.time() - self.t0, 3)}
        print(f"  scene: {scene_id}", flush=True)

    def close(self):
        if self._cur:
            self._cur["end"] = round(time.time() - self.t0, 3)
            self.scenes.append(self._cur)
            self._cur = None

    def dump(self, path):
        self.close()
        out = [{**s, "title": SCENES.get(s["id"], {}).get("title", "")}
               for s in self.scenes]
        Path(path).write_text(json.dumps(out, indent=2))
        print(f"  saved {path} ({out[-1]['end'] if out else 0}s)", flush=True)


async def beat(sec=1.0):
    await asyncio.sleep(sec)


async def human_type(page, locator, text, delay=90):
    await locator.click()
    await locator.type(text, delay=delay)


async def slow_scroll(page, total=900, steps=9, pause=0.45):
    """Human-looking scroll instead of one violent jump."""
    for _ in range(steps):
        await page.mouse.wheel(0, total // steps)
        await beat(pause)


async def make_context(pw, tag, storage_state=None):
    browser = await pw.chromium.launch(
        headless=True, args=["--no-sandbox", "--disable-gpu", "--hide-scrollbars"])
    ctx = await browser.new_context(
        viewport={"width": VW, "height": VH},
        is_mobile=True, has_touch=True, device_scale_factor=1,
        record_video_dir=str(WORK / f"raw_{tag}"),
        record_video_size={"width": VW, "height": VH},
        storage_state=storage_state,
    )

    async def guard(route):
        url = route.request.url
        ok = ("localhost" in url) or ("supabase.co" in url) or url.startswith("data:")
        if route.request.resource_type == "document" and not ok:
            await route.abort()
        else:
            await route.continue_()

    await ctx.route("**/*", guard)
    return browser, ctx


async def finish(browser, ctx, out_name):
    page = ctx.pages[0]
    vid = page.video
    await ctx.close()
    src = await vid.path()
    dst = WORK / out_name
    if dst.exists():
        dst.unlink()
    os.replace(src, dst)
    await browser.close()
    print(f"  video -> {dst}", flush=True)


async def safe(coro, label=""):
    try:
        await coro
        return True
    except Exception as e:
        print(f"  ! {label}: {e}", flush=True)
        return False


# ----------------------------------------------------------------- PART A
async def part_a():
    from playwright.async_api import async_playwright

    suffix = random.randint(100, 999)
    email = PERSON["email"].replace("@", f"{suffix}@")
    person = {**PERSON, "email": email}

    async with async_playwright() as pw:
        browser, ctx = await make_context(pw, "a")
        page = await ctx.new_page()
        d = Director()

        # ---------- public landing page ----------
        d.mark("landing_hero")
        await page.goto(BASE + "/", wait_until="domcontentloaded")
        await beat(4.0)
        await slow_scroll(page, 500, 5, 0.5)

        d.mark("landing_proof")
        await slow_scroll(page, 1400, 12, 0.5)

        d.mark("how_it_works")
        await safe(page.get_by_text("How It Works", exact=False).first
                   .scroll_into_view_if_needed(timeout=8000), "how it works")
        await beat(2.0)
        await slow_scroll(page, 1800, 16, 0.55)

        d.mark("pricing")
        await safe(page.get_by_text("₦5,000", exact=False).last
                   .scroll_into_view_if_needed(timeout=8000), "pricing")
        await beat(2.0)
        await slow_scroll(page, 1600, 14, 0.55)

        # ---------- signup ----------
        d.mark("signup_open")
        await page.goto(BASE + SIGNUP_URL, wait_until="domcontentloaded")
        await beat(5.0)

        d.mark("birth_year")
        year = page.locator('input[placeholder="YYYY"]')
        await year.wait_for(timeout=20000)
        await human_type(page, year, person["birth_year"], delay=200)
        await beat(1.4)
        await page.get_by_role("button", name="Continue").click()
        await beat(1.2)

        d.mark("birth_month")
        await beat(1.0)
        await page.get_by_role("button", name=person["birth_month"], exact=False).first.click()
        await beat(1.2)
        await page.get_by_role("button", name="Continue").click()
        await beat(1.2)

        d.mark("state")
        st = page.get_by_placeholder("Type your state (e.g. Lagos)")
        await st.wait_for(timeout=15000)
        await human_type(page, st, person["state"], delay=160)
        await beat(1.2)
        await page.get_by_role("button", name=person["state"], exact=False).first.click()
        await beat(1.2)
        await page.get_by_role("button", name="Continue").click()
        await beat(1.4)

        d.mark("name")
        nm = page.get_by_placeholder("e.g. JOHN ADEBAYO OKONKWO")
        await nm.wait_for(timeout=15000)
        await human_type(page, nm, person["full_name"], delay=110)
        await beat(3.0)
        await page.get_by_role("button", name="Continue").click()
        await beat(1.4)

        d.mark("details")
        await human_type(page, page.get_by_placeholder("e.g. 08012345678"), person["phone"], delay=70)
        await beat(0.6)
        await human_type(page, page.get_by_placeholder("your@email.com"), person["email"], delay=40)
        await beat(0.6)
        await human_type(page, page.get_by_placeholder("At least 8 characters"), person["password"], delay=60)
        await beat(1.0)
        await safe(page.get_by_role("checkbox").first.click(), "terms box")
        await beat(1.4)
        await page.get_by_role("button", name="Create Account").click()
        await safe(page.wait_for_url("**/dashboard", timeout=60000), "reach dashboard")
        await beat(3.0)

        # who is this? (needed for the SQL step + part B login)
        run = {"email": person["email"], "password": person["password"],
               "full_name": person["full_name"], "url": page.url}
        try:
            key = await page.evaluate(
                "Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))")
            raw = await page.evaluate(f"localStorage.getItem({json.dumps(key)})") if key else None
            if raw:
                run["user_id"] = json.loads(raw)["user"]["id"]
        except Exception as e:
            print("  ! could not read user id:", e, flush=True)
        (WORK / "run.json").write_text(json.dumps(run, indent=2))
        await ctx.storage_state(path=str(WORK / "state.json"))
        print("  person:", run, flush=True)

        d.mark("locked_dash")
        await slow_scroll(page, 700, 7, 0.5)
        await beat(2.0)

        d.mark("cta")
        cta = page.get_by_role("button", name="I Want A Share", exact=False).first
        await safe(cta.scroll_into_view_if_needed(timeout=6000), "cta into view")
        await beat(2.0)
        await cta.click()
        await beat(1.4)

        d.mark("calc_open")
        await beat(3.5)

        d.mark("calc_one")
        await beat(5.0)

        d.mark("calc_five")
        plus = page.get_by_label("Increase shares")
        for _ in range(max(0, int(person["shares_to_buy"]) - 1)):
            await safe(plus.click(timeout=6000), "plus")
            await beat(1.8)
        await beat(4.0)

        d.mark("pay_click")
        pay = page.get_by_role("button", name="Pay ₦", exact=False).first
        await safe(pay.click(timeout=10000), "pay")
        await beat(4.0)

        d.mark("pay_page")
        await beat(6.0)
        await slow_scroll(page, 600, 6, 0.6)
        await beat(4.0)

        # ---------- outro: back to the public page, bottom CTA ----------
        d.mark("outro")
        await page.goto(BASE + "/", wait_until="domcontentloaded")
        await beat(3.0)
        await slow_scroll(page, 1200, 10, 0.5)
        await beat(4.0)

        d.dump(WORK / "scenes_a.json")
        await finish(browser, ctx, "part_a.webm")


# ----------------------------------------------------------------- PART B
async def part_b():
    """The same person, now activated in the database, touring the live app."""
    from playwright.async_api import async_playwright

    run = json.loads((WORK / "run.json").read_text())
    saved = WORK / "state.json"

    async with async_playwright() as pw:
        # Re-use the signed-in session saved during part A. Typing the password
        # again on camera was fragile — one missed click and the whole tour
        # recorded the login screen instead of the real account.
        browser, ctx = await make_context(
            pw, "b", storage_state=str(saved) if saved.exists() else None)
        page = await ctx.new_page()
        d = Director()

        await page.goto(BASE + "/dashboard", wait_until="domcontentloaded")
        await beat(2.5)

        if "/login" in page.url or "/signup" in page.url:
            print("  session gone — logging in", flush=True)
            await page.goto(BASE + "/login", wait_until="domcontentloaded")
            try:
                await page.get_by_placeholder("your@email.com").wait_for(timeout=25000)
                await human_type(page, page.get_by_placeholder("your@email.com"),
                                 run["email"], delay=10)
                await human_type(page, page.locator('input[type="password"]').first,
                                 run["password"], delay=10)
                await page.get_by_role("button", name="Log In", exact=False).first.click()
                await page.wait_for_url("**/dashboard", timeout=45000)
            except Exception as e:
                print("  ! login trouble:", e, "| at:", page.url, flush=True)

        await safe(page.evaluate(
            "localStorage.setItem('viketa_activation_success_seen_v2','true')"), "seen flag")
        await page.goto(BASE + "/dashboard", wait_until="domcontentloaded")
        ok = await safe(page.get_by_text("UPCOMING PAYOUT", exact=False).first
                        .wait_for(timeout=25000), "dashboard paint")
        if not ok:
            print("  ! NOT on the member dashboard — at:", page.url, flush=True)
        await beat(1.5)


        (WORK / "trim_b.txt").write_text(str(round(time.time() - d.t0, 3)))
        d.t0 = time.time()

        d.mark("dash_active")
        await beat(7.0)

        d.mark("wallet")
        await beat(6.0)
        await slow_scroll(page, 300, 3, 0.6)

        d.mark("progress")
        await slow_scroll(page, 700, 7, 0.6)
        await beat(6.0)

        d.mark("task")
        await page.goto(BASE + "/task", wait_until="domcontentloaded")
        await safe(page.wait_for_function(
            "() => [...document.querySelectorAll('img')].filter(i => i.naturalWidth > 150).length >= 2",
            timeout=40000), "task pictures")
        await beat(3.0)
        for i in range(6):
            ok = await safe(page.get_by_text("TAP TO PICK", exact=False)
                            .nth(i % 2).click(timeout=8000), "pick")
            if not ok:
                break
            await beat(2.2)
        await beat(3.0)

        d.mark("withdraw")
        await page.goto(BASE + "/withdraw", wait_until="domcontentloaded")
        await beat(4.0)
        await safe(human_type(page, page.get_by_placeholder("0").first, "10000", delay=180),
                   "withdraw amount")
        await beat(5.0)
        await slow_scroll(page, 400, 4, 0.6)
        await beat(3.0)

        d.mark("rules")
        await page.goto(BASE + "/dashboard", wait_until="domcontentloaded")
        await safe(page.get_by_text("UPCOMING PAYOUT", exact=False).first
                   .wait_for(timeout=25000), "dashboard paint")
        await beat(3.0)
        await slow_scroll(page, 1100, 11, 0.6)
        await beat(6.0)

        d.dump(WORK / "scenes_b.json")
        await finish(browser, ctx, "part_b.webm")


if __name__ == "__main__":
    part = (sys.argv[1] if len(sys.argv) > 1 else "a").lower()
    if part in ("all", "ab"):
        asyncio.run(part_a())
        asyncio.run(part_b())
    else:
        asyncio.run(part_a() if part == "a" else part_b())
