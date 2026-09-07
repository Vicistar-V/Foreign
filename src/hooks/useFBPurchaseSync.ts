import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { trackFBPurchase } from '@/lib/facebookPixel';

const TRACKED_KEY = 'viketa_fb_tracked_purchase_ids_v1';
// Only scan the last 60 days. Meta CAPI's optimisation window is 7 days
// anyway; older purchases would still report but we don't need to keep
// re-checking ancient rows on every dashboard load.
const LOOKBACK_DAYS = 60;

function getTracked(): Set<string> {
  try {
    const raw = localStorage.getItem(TRACKED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveTracked(set: Set<string>) {
  try {
    // Cap stored ids so localStorage never bloats.
    const arr = Array.from(set).slice(-500);
    localStorage.setItem(TRACKED_KEY, JSON.stringify(arr));
  } catch {
    /* ignore quota errors */
  }
}

/**
 * Universal Facebook Purchase event sync.
 *
 * Why this exists:
 *   Real-money payments enter the system through MANY paths — the
 *   Moniepoint in-app drawer, Flutterwave redirect, Paystack redirect,
 *   AND manual admin verification (where the user isn't even in the
 *   browser). A single hard-coded fire-on-success call cannot catch all
 *   of these reliably.
 *
 * What this does:
 *   Every time the logged-in user lands on the dashboard, we read their
 *   recent COMPLETED `membership_fee` + `deposit` transactions. Any
 *   transaction id we have NOT already reported to Facebook gets a
 *   `Purchase` event fired, using the transaction id as Meta's `eventID`
 *   for natural dedup (so it cannot double-count even if the drawer also
 *   fired immediately at verification time).
 *
 *   This is the safety-net: even if a payment was approved while the
 *   user was offline (manual admin verification, slow webhook, app
 *   closed), the Purchase event lands as soon as they next open the app.
 */
export function useFBPurchaseSync(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    (async () => {
      const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('transactions')
        .select('id, amount, transaction_type, status, created_at, metadata')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .in('transaction_type', ['membership_fee', 'deposit'])
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(50);

      if (cancelled || error || !data) return;

      const tracked = getTracked();
      let changed = false;

      for (const tx of data) {
        if (tracked.has(tx.id)) continue;
        // membership_fee tracking rows are stored with amount=0 — the real
        // paid amount lives in metadata.paid_amount. Fall back to that so
        // activations (which are our most valuable conversion event) actually
        // report to Meta.
        let value = Number(tx.amount);
        if ((!Number.isFinite(value) || value <= 0) && tx.metadata) {
          const meta = tx.metadata as Record<string, unknown>;
          const paid = Number(meta.paid_amount);
          if (Number.isFinite(paid) && paid > 0) value = paid;
        }
        if (!Number.isFinite(value) || value <= 0) continue;
        trackFBPurchase(value, 'NGN', tx.id);
        tracked.add(tx.id);
        changed = true;
      }

      if (changed) saveTracked(tracked);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);
}
