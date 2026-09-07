import { useEffect, useRef, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

import { openRestoreCapacityDrawer, msSinceRestoreDrawerOpened } from '@/lib/restoreCapacityStore';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Share2, TrendingUp, Users, X, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';

interface PayoutNotificationToastProps {
  amount: number;
  onInvite: () => void;
  onDismiss: () => void;
}

function PayoutNotificationToast({ 
  amount, 
  onInvite, 
  onDismiss 
}: PayoutNotificationToastProps) {
  const formattedAmount = amount.toLocaleString();

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.98 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="relative w-[min(420px,calc(100vw-1.5rem))] overflow-hidden rounded-3xl border border-primary/25 bg-card p-3 shadow-strong"
    >
      <button
        onClick={onDismiss}
        aria-label="Close reward message"
        className="absolute right-3 top-3 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="space-y-3 pr-8">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div className="min-w-0 pt-0.5">
            <p className="text-sm font-semibold leading-tight text-foreground">Money added to your earnings</p>
            <p className="mt-1 text-xs leading-snug text-muted-foreground">
              Your ad share just finished a campaign. This money is now ready in your earnings balance.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-success/20 bg-success/10 p-4 text-center">
          <div className="flex items-center justify-center gap-2 text-success">
            <TrendingUp className="h-5 w-5" />
            <p className="text-3xl font-black tracking-tight tabular-nums">+₦{formattedAmount}</p>
          </div>
          <p className="mt-1 text-xs font-medium text-success">Added successfully</p>
        </div>

        <div className="rounded-2xl bg-muted/60 p-3">
          <div className="flex items-start gap-2">
            <Users className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Want more chances to earn? Share your link so friends can activate a share too.
            </p>
          </div>
          <Button 
            size="sm" 
            onClick={onInvite}
            className="mt-3 h-11 w-full rounded-2xl font-semibold shadow-medium"
            haptic="light"
          >
            <Share2 className="h-4 w-4" />
            Share my link
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

interface UsePayoutNotificationOptions {
  onInviteClick?: () => void;
}

export function usePayoutNotification(options?: UsePayoutNotificationOptions) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const processedTransactionsRef = useRef<Set<string>>(new Set());
  // Retirement-toast dedupe: when multiple spots retire in the same cycle,
  // Postgres fires one INSERT per drop_profit row. Without this guard the
  // user gets N stacked "your spot retired" toasts. We reset the flag when
  // retirement clears (i.e. after a successful Restore) so the next cycle
  // can nudge again.
  const retiredToastFiredRef = useRef(false);

  const [lastToastId, setLastToastId] = useState<string | number | null>(null);

  const handleInvite = useCallback(() => {
    if (lastToastId) {
      toast.dismiss(lastToastId);
    }
    options?.onInviteClick?.();
  }, [lastToastId, options]);

  const handleDismiss = useCallback(() => {
    if (lastToastId) {
      toast.dismiss(lastToastId);
    }
  }, [lastToastId]);

  const showPayoutToast = useCallback((amount: number) => {
    const toastId = toast.custom(
      (id) => (
        <PayoutNotificationToast
          amount={amount}
          onInvite={handleInvite}
          onDismiss={() => toast.dismiss(id)}
        />
      ),
      {
        duration: 10000,
        position: 'top-center',
      }
    );
    setLastToastId(toastId);
  }, [handleInvite]);


  useEffect(() => {
    if (!user?.id) return;

    console.log('[PayoutNotification] Setting up subscription for user:', user.id);

    const channel = supabase
      .channel(`user:${user.id}:payout-notifications`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const transaction = payload.new as {
            id: string;
            transaction_type: string;
            amount: number;
            status: string;
          };

          // Only show toast for completed drop_profit transactions
          if (
            transaction.transaction_type === 'drop_profit' &&
            transaction.status === 'completed' &&
            !processedTransactionsRef.current.has(transaction.id)
          ) {
            console.log('[PayoutNotification] New payout detected:', transaction);
            processedTransactionsRef.current.add(transaction.id);

            // Limit the set size to prevent memory issues
            if (processedTransactionsRef.current.size > 100) {
              const entries = Array.from(processedTransactionsRef.current);
              processedTransactionsRef.current = new Set(entries.slice(-50));
            }

            // Any drop_profit reshapes retirement state — the spot that just
            // paid out may have been the user's last active spot. Refetch the
            // status immediately so Restore CTAs show up on the next paint.
            if (user?.id) {
              queryClient.invalidateQueries({ queryKey: ['retirement-status', user.id] });
              queryClient.invalidateQueries({ queryKey: ['drop-status', user.id] });
              queryClient.invalidateQueries({ queryKey: ['balances', user.id] });
              queryClient.invalidateQueries({ queryKey: ['daily-task', user.id] });
              queryClient.invalidateQueries({ queryKey: ['machines', user.id] });
            }





            // P1-3: merge the "money added" + "spot retired" into ONE
            // celebratory moment when this payout was the retiring one.
            // We fire the retirement RPC first (fast, cached) and choose
            // the toast shape based on the result — no more toast → 4s → toast.
            (async () => {
              try {
                const { data: status } = await supabase.rpc('get_retirement_status');
                const isRetired = (status as any)?.is_retired === true;

                if (!isRetired) {
                  // Ordinary mid-cycle payout — reset retirement dedupe so
                  // the next retirement episode can still fire its own toast.
                  retiredToastFiredRef.current = false;
                  showPayoutToast(transaction.amount);
                  return;
                }

                // Retirement path — dedupe per episode.
                if (msSinceRestoreDrawerOpened() < 60_000) return;
                if (retiredToastFiredRef.current) return;
                retiredToastFiredRef.current = true;

                toast(`🎉 You cashed out ₦${Number(transaction.amount).toLocaleString()}!`, {
                  description:
                    "Your ad share finished its campaign — one tap to send it back to work when you're ready.",
                  icon: <RotateCcw className="h-4 w-4 text-emerald-500" />,
                  duration: 14000,
                  action: {
                    label: 'Send it back',
                    onClick: () => openRestoreCapacityDrawer(),
                  },
                });
              } catch {
                // Fall back to the standard toast — never leave the user
                // wondering whether money landed.
                showPayoutToast(transaction.amount);
              }
            })();



          }
        }
      )
      .subscribe();

    return () => {
      console.log('[PayoutNotification] Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [user?.id, showPayoutToast]);

  return { showPayoutToast };
}
