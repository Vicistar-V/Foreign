import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const SEEN_KEY = 'viketa.withdrawalShare.seenIds.v1';
const SINCE_KEY = 'viketa.withdrawalShare.since.v1';

interface PendingWithdrawal {
  id: string;
  amount: number; // positive naira value
  created_at: string;
}

const readSeen = (): Set<string> => {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
};

const writeSeen = (set: Set<string>) => {
  try {
    // Keep last 50 ids only
    const arr = Array.from(set).slice(-50);
    localStorage.setItem(SEEN_KEY, JSON.stringify(arr));
  } catch {
    /* noop */
  }
};

const getSinceTimestamp = (): string => {
  try {
    const existing = localStorage.getItem(SINCE_KEY);
    if (existing) return existing;
  } catch {
    /* noop */
  }
  // First time — only look at withdrawals from now onwards
  const now = new Date().toISOString();
  try {
    localStorage.setItem(SINCE_KEY, now);
  } catch {
    /* noop */
  }
  return now;
};

const bumpSince = (iso: string) => {
  try {
    localStorage.setItem(SINCE_KEY, iso);
  } catch {
    /* noop */
  }
};

/**
 * Watches for the user's withdrawals being approved (status flips to
 * `completed`). When a new one is detected — both via realtime AND a
 * catch-up query on mount — it surfaces a celebratory share drawer.
 *
 * Uses localStorage so a user is never asked twice about the same
 * withdrawal, even across sessions.
 */
export const useWithdrawalSharePrompt = () => {
  const { user } = useAuth();
  const [pending, setPending] = useState<PendingWithdrawal | null>(null);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    seenRef.current = readSeen();
  }, []);

  const offer = useCallback((w: PendingWithdrawal) => {
    if (seenRef.current.has(w.id)) return;
    setPending((current) => current ?? w); // don't override an open prompt
  }, []);

  // Catch-up on mount: pull recent approved withdrawals we may have missed.
  useEffect(() => {
    if (!user?.id) return;
    const since = getSinceTimestamp();
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, amount, created_at, metadata')
        .eq('user_id', user.id)
        .eq('transaction_type', 'withdrawal')
        .eq('status', 'completed')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(5);

      if (cancelled || error || !data) return;

      // Show the oldest unseen first so the user always celebrates in order
      const unseen = data
        .filter((row) => !seenRef.current.has(row.id))
        .reverse();

      if (unseen.length > 0) {
        const first = unseen[0];
        offer({
          id: first.id,
          amount: extractAmount(first),
          created_at: first.created_at,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, offer]);

  // Realtime: catch approvals while the user is on the app
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`user:${user.id}:withdrawal-share`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            transaction_type: string;
            status: string;
            amount: number;
            created_at: string;
            metadata?: Record<string, unknown> | null;
          };
          if (
            row.transaction_type === 'withdrawal' &&
            row.status === 'completed'
          ) {
            offer({
              id: row.id,
              amount: extractAmount(row),
              created_at: row.created_at,
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, offer]);

  const dismiss = useCallback(() => {
    if (pending) {
      seenRef.current.add(pending.id);
      writeSeen(seenRef.current);
      bumpSince(pending.created_at);
    }
    setPending(null);
  }, [pending]);

  return { pending, dismiss };
};

const extractAmount = (row: { amount: number; metadata?: unknown }): number => {
  // Withdrawals are stored as negative amounts; the user-facing payout
  // amount (without fee) lives in metadata.transfer_amount.
  const meta =
    row.metadata && typeof row.metadata === 'object'
      ? (row.metadata as { transfer_amount?: unknown; withdrawal_fee?: unknown })
      : null;
  const transfer = meta?.transfer_amount;
  if (typeof transfer === 'number' && transfer > 0) return transfer;
  const fee = typeof meta?.withdrawal_fee === 'number' ? meta.withdrawal_fee : 50;
  return Math.max(0, Math.abs(row.amount) - fee);
};
