# Viketa V3 → Autopilot Node Calibration Engine

Re-architecture of the Viketa V3 platform from a passive liquidity cycler into a gamified, daily-task-driven "Autopilot Node Calibration" system.

## Background & Problem Statement

The current Viketa V3 is a **passive 1:2 liquidity queue** — users pay ₦1,000 once, get a "Machine" in the queue, and passively earn ₦900 per cycle forever. This creates two critical problems:

1. **Zero daily engagement** — Users have no reason to return daily, making the platform forgettable and reducing viral referral velocity.
2. **Free-rider problem** — Inactive users still earn, creating no urgency or network effects.

**The Solution:** Overlay a mandatory daily "Node Calibration" task loop (inspired by Velocity AI's click-to-earn model) that gates payouts behind daily engagement, while keeping the rock-solid 1:2 queue math completely intact on the backend.

---

## User Review Required

> [!IMPORTANT]
> **The 1:2 queue backend is NEVER modified.** The distribute-liquidity Edge Function's core math remains identical. The "Burn Rule" is implemented as a **post-distribution payout gate** — money is distributed normally by the queue, but the user's ability to *receive* it is gated by their daily calibration threshold.

> [!WARNING]
> **Breaking Change: Existing passive earners will now need to complete daily tasks.** Users who currently earn passively will see their payouts held in a "Pending Yield" state until they complete daily calibration. This needs careful communication via in-app notifications and WhatsApp announcements before deployment.

> [!CAUTION]
> **The "Burn Rule" (Capacity Threshold) is aggressive by design.** If a user's machine cycles but they haven't reached their daily threshold, a percentage of their payout is forfeited to the platform treasury. This is the #1 engagement driver but also the #1 potential complaint source. We should configure the burn percentage via `platform_config` so it can be tuned without code changes.

---

## Proposed Changes

### Component 1: Database Schema (Supabase Migrations)

New tables and columns to support the Node Calibration system.

---

#### [NEW] `public.daily_calibration_log` table

Tracks each user's daily click progress. One row per user per day.

```sql
CREATE TABLE public.daily_calibration_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id),
  calibration_date date NOT NULL DEFAULT CURRENT_DATE,
  
  -- Click tracking
  clicks_completed   integer NOT NULL DEFAULT 0,   -- Total clicks today (max = batches × 10)
  batches_completed  integer NOT NULL DEFAULT 0,   -- How many batches of 10 finished
  base_batch_limit   integer NOT NULL DEFAULT 10,  -- Default daily limit
  bonus_batches      integer NOT NULL DEFAULT 0,   -- Extra batches from referrals
  total_batch_limit  integer NOT NULL DEFAULT 10,  -- base + bonus (computed)
  
  -- Threshold state
  threshold_reached  boolean NOT NULL DEFAULT false, -- true when batches_completed >= required_threshold
  threshold_required integer NOT NULL DEFAULT 7,     -- Min batches needed to unlock payouts (configurable)
  
  -- Yield state (for the Burn Rule)
  pending_yield      numeric NOT NULL DEFAULT 0,    -- ₦ accumulated from queue cycles today, held until threshold
  released_yield     numeric NOT NULL DEFAULT 0,    -- ₦ actually released to user's earnings wallet
  burned_yield       numeric NOT NULL DEFAULT 0,    -- ₦ forfeited to platform (burn rule)
  
  -- Timestamps
  first_click_at     timestamptz,
  last_click_at      timestamptz,
  threshold_reached_at timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  
  -- Prevent duplicate rows per user per day
  UNIQUE(user_id, calibration_date)
);

-- RLS: Users can only read their own logs
ALTER TABLE public.daily_calibration_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own calibration logs"
  ON public.daily_calibration_log FOR SELECT
  USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_calibration_user_date 
  ON public.daily_calibration_log(user_id, calibration_date DESC);
```

---

#### [MODIFY] `public.platform_config` — Add calibration settings

New columns on the singleton config row:

```sql
ALTER TABLE public.platform_config
  ADD COLUMN calibration_enabled          boolean NOT NULL DEFAULT true,
  ADD COLUMN calibration_clicks_per_batch integer NOT NULL DEFAULT 10,
  ADD COLUMN calibration_base_batches     integer NOT NULL DEFAULT 10,
  ADD COLUMN calibration_threshold_batches integer NOT NULL DEFAULT 7,
  ADD COLUMN calibration_bonus_per_referral integer NOT NULL DEFAULT 5,
  ADD COLUMN calibration_burn_percentage  numeric NOT NULL DEFAULT 100,  -- % of yield burned if threshold NOT met (100 = full burn)
  ADD COLUMN calibration_burn_enabled     boolean NOT NULL DEFAULT true,
  ADD COLUMN calibration_simulation_enabled boolean NOT NULL DEFAULT true; -- Allow non-members to do calibration in sim mode
```

---

#### [MODIFY] `public.user_gamification` — Add calibration streak

```sql
ALTER TABLE public.user_gamification
  ADD COLUMN calibration_streak      integer NOT NULL DEFAULT 0,  -- Consecutive days threshold was met
  ADD COLUMN longest_calibration_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN last_calibration_date   date;  -- Last date threshold was met
```

---

#### [MODIFY] `public.profiles` — Add simulation yield tracker

```sql
ALTER TABLE public.profiles
  ADD COLUMN simulated_yield    numeric NOT NULL DEFAULT 0,  -- Accumulated "Pending Yield" for non-members (display only, not real money)
  ADD COLUMN total_burned_yield numeric NOT NULL DEFAULT 0;  -- Lifetime total of burned yield (analytics)
```

---

### Component 2: Edge Functions (Backend)

---

#### [NEW] `record-calibration-click` Edge Function

The core click handler. Called every time a user taps the "Calibrate" button.

**Logic:**
1. Authenticate user (JWT required)
2. Get or create today's `daily_calibration_log` row
3. Validate: Has user exceeded their `total_batch_limit × clicks_per_batch`?
4. Increment `clicks_completed` by 1
5. If `clicks_completed % clicks_per_batch === 0` → increment `batches_completed`
6. If `batches_completed >= threshold_required` → set `threshold_reached = true`, set timestamp
7. Return updated progress to frontend

**Anti-cheat measures:**
- Minimum 300ms between clicks (server-validated via `last_click_at`)
- Maximum burst of `clicks_per_batch` clicks per request (no batch-skip exploits)
- Rate limit: max 5 requests/second per user

**Response shape:**
```json
{
  "success": true,
  "clicks_completed": 45,
  "batches_completed": 4,
  "total_batch_limit": 15,
  "threshold_reached": false,
  "threshold_required": 7,
  "pending_yield": 900,
  "is_simulation": false
}
```

---

#### [NEW] `get-calibration-status` Edge Function

Returns the user's current calibration state for today. Called on dashboard load.

**Returns:**
- Today's click/batch progress
- Whether threshold is reached
- Pending yield amount
- Bonus batches (from referrals)
- Calibration streak info
- Whether user is in simulation mode (non-member)

---

#### [MODIFY] `distribute-liquidity` Edge Function

This is the **most critical change**. The 1:2 queue math stays IDENTICAL, but we add a post-distribution payout gate.

**Current flow:**
```
Queue fills → Drop completes → User gets ₦900 in earnings wallet
```

**New flow:**
```
Queue fills → Drop completes → Check daily_calibration_log for today:
  IF threshold_reached = true:
    → Pay ₦900 to earnings wallet (normal)
  ELSE:
    → Add ₦900 to pending_yield in daily_calibration_log
    → Do NOT credit earnings wallet yet
    → At end of day (or when threshold is reached):
      IF threshold reached: release pending_yield → earnings wallet
      ELSE: burn_percentage of pending_yield → platform treasury
```

**Implementation detail:** Instead of modifying the hot path of distribute-liquidity (risky), we implement this as a **wrapper check** using the existing `can_user_receive_payout` RPC:

```sql
-- Modify existing RPC
CREATE OR REPLACE FUNCTION can_user_receive_payout(_user_id uuid)
RETURNS boolean AS $$
DECLARE
  _config record;
  _calibration record;
BEGIN
  -- Get calibration config
  SELECT calibration_enabled, calibration_burn_enabled
  INTO _config FROM platform_config WHERE id = 1;
  
  -- If calibration not enabled, always allow
  IF NOT _config.calibration_enabled THEN
    RETURN true;
  END IF;
  
  -- Check today's calibration
  SELECT threshold_reached INTO _calibration
  FROM daily_calibration_log
  WHERE user_id = _user_id AND calibration_date = CURRENT_DATE;
  
  -- If no calibration record exists or threshold not reached
  IF _calibration IS NULL OR NOT _calibration.threshold_reached THEN
    RETURN false;  -- Payout will be held as pending_yield
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

The distribute-liquidity function already calls `canUserReceivePayout()` — we modify the **behavior when it returns false**: Instead of recycling the entire payout (current overflow behavior), we hold it in `pending_yield`.

---

#### [NEW] `process-daily-calibration-settlement` Edge Function (Cron)

Runs at midnight (or on-demand by admin) to settle the day's calibration:

1. For each user with `threshold_reached = true` AND `pending_yield > 0`:
   - Credit `pending_yield` to their earnings wallet
   - Update `released_yield` in the log
2. For each user with `threshold_reached = false` AND `pending_yield > 0`:
   - Apply burn rule: `burned = pending_yield × burn_percentage / 100`
   - Credit burned amount to platform treasury
   - If `burn_percentage < 100`, credit remainder to user
   - Update `burned_yield` in the log
3. Update calibration streaks in `user_gamification`

---

#### [MODIFY] `get-drop-status` Edge Function

Add calibration data to the response so the dashboard can show the calibration UI alongside machine status:

```json
{
  "user": { ... },
  "queue": { ... },
  "config": { ... },
  "calibration": {
    "clicks_completed": 45,
    "batches_completed": 4,
    "total_batch_limit": 15,
    "threshold_reached": false,
    "threshold_required": 7,
    "pending_yield": 900,
    "calibration_streak": 12,
    "is_simulation": false,
    "clicks_per_batch": 10
  }
}
```

---

#### [MODIFY] `get-gamification-status` Edge Function

Add calibration streak data alongside existing streak/spin data.

---

### Component 3: Frontend — New Components

---

#### [NEW] `src/components/calibration/NodeCalibrationCard.tsx`

The **primary engagement surface**. This replaces/supplements the passive MachinesCard on the dashboard.

**Visual Design:**
- Large circular "CALIBRATE" button with pulse animation
- Radial progress ring showing batch progress (e.g., 4/10 batches)
- Inner click counter (e.g., 7/10 clicks in current batch)
- Glowing threshold indicator bar at 70% (7/10 default)
- "Pending Yield" display showing accumulated ₦ waiting to be released
- Satisfying haptic + particle burst animation on each click
- Batch completion celebration micro-animation
- Threshold reached celebration (confetti + sound)

**States:**
1. **Active** — User can click, progress updates in real-time
2. **Batch Complete** — Brief 1s cooldown animation between batches
3. **Threshold Reached** — Green glow, "Yield Unlocked!" banner
4. **Daily Limit Reached** — All batches done, "Come back tomorrow" state
5. **Simulation Mode** — Same UI but with "Simulated" badge and purple accent

---

#### [NEW] `src/components/calibration/CalibrationProgressBar.tsx`

Horizontal segmented progress bar showing batch completion towards threshold.

- Segments fill as batches complete
- Threshold marker at the configured point (default: 7th batch)
- Segments before threshold: amber/yellow
- Threshold segment: green glow
- Segments after threshold: bonus green (extra yield multiplier?)

---

#### [NEW] `src/components/calibration/PendingYieldBanner.tsx`

Shown when user has pending yield that hasn't been released yet.

- Animated counter showing ₦ amount
- Warning tone: "Complete X more batches to unlock your yield!"
- Loss-aversion copy: "If you don't calibrate, ₦X will be forfeited at midnight"
- Countdown timer to midnight (burn deadline)

---

#### [NEW] `src/components/calibration/CalibrationStreakCard.tsx`

Shows the user's consecutive-day calibration streak alongside their existing login streak.

---

#### [NEW] `src/hooks/useCalibration.ts`

React Query hook for calibration data:
- `useCalibrationStatus()` — fetches today's calibration state
- `useRecordClick()` — mutation to record a click
- Optimistic updates for instant UI feedback
- Auto-refetch on window focus

---

### Component 4: Frontend — Modified Components

---

#### [MODIFY] [Dashboard.tsx](file:///c:/Users/Vicistar/Documents/Projects/viketa/src/pages/Dashboard.tsx)

- Add `NodeCalibrationCard` as the **first card after greeting** (primary engagement hook)
- Add `PendingYieldBanner` when pending yield exists
- Move existing `MachinesCard` below calibration (machines are now "background workers")
- Add `CalibrationStreakCard` alongside existing `StreakMeter`

---

#### [MODIFY] [MachinesCard.tsx](file:///c:/Users/Vicistar/Documents/Projects/viketa/src/components/dashboard/MachinesCard.tsx)

- Add calibration status indicator per machine (green check if calibrated today, red warning if not)
- Show "Pending Yield" badge on each machine that has uncollected/unreleased yield

---

#### [MODIFY] [ActivationBanner.tsx](file:///c:/Users/Vicistar/Documents/Projects/viketa/src/components/dashboard/ActivationBanner.tsx)

- Reframe activation as "Switch to Live Mode"
- Show accumulated simulated_yield: "You have ₦X,XXX in Pending Yield. Activate to make it real!"
- Stronger CTA leveraging loss aversion

---

#### [MODIFY] [MembershipPaymentDrawer.tsx](file:///c:/Users/Vicistar/Documents/Projects/viketa/src/components/MembershipPaymentDrawer.tsx)

- Add "Pending Yield" accumulation display
- Reframe "Pay ₦1,000" as "Activate Live Mode — Unlock ₦X,XXX Pending Yield"
- Show calibration streak as social proof ("12 days of calibration — don't lose your progress!")

---

#### [MODIFY] [WalletCard.tsx](file:///c:/Users/Vicistar/Documents/Projects/viketa/src/components/dashboard/WalletCard.tsx)

- Add "Pending Yield" as a separate display row (not part of real balance)
- Visual distinction: Pending = amber/locked, Available = green/unlocked

---

### Component 5: Referral Integration

---

#### [MODIFY] Referral flow (multiple files)

When a user successfully refers someone (referee activates):
1. Referrer gets existing ₦500 cash bonus (unchanged)
2. **NEW:** Referrer gets +5 bonus batches for the day
3. Update `daily_calibration_log.bonus_batches` and `total_batch_limit`
4. Show notification: "+5 Calibration Batches Unlocked!"

This creates the viral loop:
- More batches → more clicking capacity → more yield potential
- Users who refer hit threshold faster and get more yield
- Creates natural FOMO for non-referrers

---

## Open Questions

> [!IMPORTANT]
> **Q1: Burn percentage tuning.** Should the initial burn be 100% (total forfeiture) or a softer percentage like 50% (partial burn)? 100% creates maximum loss-aversion but may cause user churn. Recommendation: Start at **100%** with a **3-day grace period** for existing users where burns are 0%.

> [!IMPORTANT]
> **Q2: Simulation yield conversion.** When a non-member activates (pays ₦1,000), should their accumulated `simulated_yield` be converted into real earnings? If yes, this breaks the 1:2 math since they didn't actually earn that money. Recommendation: **Do NOT convert** — simulated yield is purely psychological. The real yield starts fresh upon activation.

> [!WARNING]
> **Q3: Existing member migration.** ~X users currently earn passively. Should we:
> - (A) Hard-cut: Enable calibration for everyone immediately with a 3-day warning
> - (B) Soft-roll: Enable calibration as opt-in initially, then make mandatory after 2 weeks
> - (C) Grandfather: Let existing members keep passive earnings, only apply to new members
>
> **Recommendation: (A)** with a 3-day grace period and in-app + WhatsApp announcements.

> [!IMPORTANT]
> **Q4: Threshold timing.** Does the "burn" happen at midnight (server time), or does each user get 24 hours from their first click? Recommendation: **Server midnight (UTC+1 Nigeria time)** for simplicity and consistency.

---

## Verification Plan

### Automated Tests

1. **Edge Function tests** (via manual Supabase function invocations):
   - `record-calibration-click`: Verify click increments, batch transitions, threshold detection, rate limiting
   - `get-calibration-status`: Verify correct state for new users, mid-progress users, threshold-met users
   - `process-daily-calibration-settlement`: Verify yield release, burn rule application, streak updates

2. **Database constraint tests**:
   - Verify `UNIQUE(user_id, calibration_date)` prevents duplicate rows
   - Verify RLS policies only allow users to read their own calibration data

3. **Build verification**:
   ```bash
   npm run build  # Ensure zero TypeScript errors
   npm run dev     # Visual verification of new components
   ```

### Manual Verification

1. **Full user journey test** (in browser):
   - Sign up as new user → See calibration in "Simulation Mode"
   - Complete 4 batches → Verify progress bar updates
   - Complete 7 batches → Verify "Threshold Reached!" celebration
   - Complete 10 batches → Verify "Daily Limit" state
   - Check pending yield display
   
2. **Paid member test**:
   - Activate membership → See calibration switch to "Live Mode"
   - Have machine complete a cycle → Verify yield goes to pending (not immediate)
   - Complete threshold → Verify pending yield releases to earnings
   
3. **Burn rule test**:
   - Do NOT complete threshold → Trigger settlement cron
   - Verify pending yield moves to platform treasury
   - Verify user gets notification about lost yield

4. **Referral integration test**:
   - Refer a friend → Verify +5 bonus batches appear
   - Confirm total batch limit increases correctly

---

## Implementation Order

| Phase | Component | Estimated Effort |
|-------|-----------|-----------------|
| 1 | Database migrations (new table + config columns) | Small |
| 2 | `record-calibration-click` Edge Function | Medium |
| 3 | `get-calibration-status` Edge Function | Small |
| 4 | `useCalibration.ts` hook | Small |
| 5 | `NodeCalibrationCard.tsx` (core UI) | Large |
| 6 | `CalibrationProgressBar.tsx` | Medium |
| 7 | `PendingYieldBanner.tsx` | Small |
| 8 | Dashboard integration | Medium |
| 9 | Modify `distribute-liquidity` (payout gate) | Medium-High (critical path) |
| 10 | `process-daily-calibration-settlement` cron | Medium |
| 11 | Referral bonus integration | Small |
| 12 | MembershipPaymentDrawer + ActivationBanner updates | Medium |
| 13 | Testing & polish | Medium |

**Total estimated: ~3-4 implementation sessions**
