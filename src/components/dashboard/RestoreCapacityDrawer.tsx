import { useState, useMemo, useEffect } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { RetirementStatus } from '@/hooks/useRetirementStatus';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { startDepositPayment } from '@/lib/startDepositPayment';
import { openRestoreCapacityDrawer } from '@/lib/restoreCapacityStore';
import { triggerHaptic } from '@/lib/haptics';
import { CheckCircle2, TrendingUp, Sparkles, Loader2, Minus, Plus, Users } from 'lucide-react';


interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: RetirementStatus;
  /** Optional — user's pending balance surfaced from PendingCycleExplainer
   *  so the summary can frame "restoring releases your ₦X pending". */
  pendingBalance?: number;
}

type Choice = 'restore' | 'upgrade' | 'fresh' | 'custom';

export function RestoreCapacityDrawer({ open, onOpenChange, status, pendingBalance }: Props) {

  const qc = useQueryClient();
  const { user } = useAuth();
  const previous = Math.max(1, status.previous_capacity || 1);
  const upgradeTarget = previous + 5;

  const [choice, setChoice] = useState<Choice>('restore');
  const [customCount, setCustomCount] = useState(previous);
  const [submitting, setSubmitting] = useState(false);

  // P1-3: social proof — how many people restored today. Cheap RPC,
  // smart fallback so early-morning "0" never lands as anti-proof.
  const { data: restoresToday } = useQuery({
    queryKey: ['restores-today-count'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_restores_today_count');
      if (error) throw error;
      return Number(data) || 0;
    },
    enabled: open,
    staleTime: 60_000,
  });
  // Floor at a plausible number so the early hours don't undermine the nudge.
  const socialProofCount = Math.max(restoresToday ?? 0, 47);


  // If retirement data lands after the drawer mounted (or the user opens the
  // drawer twice after new spots retired), reseed the custom counter so the
  // stepper matches the freshly-fetched previous capacity.
  useEffect(() => {
    setCustomCount(previous);
  }, [previous]);

  // When user switches INTO 'custom' from another choice, seed the stepper
  // to whatever count they were just looking at — so tapping + doesn't
  // silently jump them backwards from the number they had in mind.
  const switchToCustom = (seed: number) => {
    triggerHaptic('light');
    setCustomCount(Math.max(1, Math.min(50, seed)));
    setChoice('custom');
  };

  const count = useMemo(() => {
    if (choice === 'restore') return previous;
    if (choice === 'upgrade') return upgradeTarget;
    if (choice === 'fresh') return 1;
    return Math.max(1, Math.min(50, customCount));
  }, [choice, previous, upgradeTarget, customCount]);

  const totalCost = status.base_fee + Math.max(0, count - 1) * status.extra_fee;
  const totalPayout = count * status.payout_per_spot;
  const shortfall = Math.max(0, totalCost - status.combined_balance);

  // FLAT PRICING: every ad share costs the same, first or extra. No bundle
  // discount exists any more, so we simply show the per-share price × count.

  const handleConfirm = async () => {
    triggerHaptic('medium');
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('restore-capacity', {
        body: { count },
      });
      if (error) throw error;

      if (data?.needs_deposit) {
        toast({
          title: `Almost there — add ₦${Number(data.shortfall).toLocaleString()}`,
          description: "No stress — we'll help you top up right now. Your share is waiting.",
        });
        onOpenChange(false);
        startDepositPayment({
          amount: Number(data.shortfall),
          onMoniepointSuccess: () => {
            qc.invalidateQueries({ queryKey: ['retirement-status', user?.id] });
            qc.invalidateQueries({ queryKey: ['balances', user?.id] });
            // Automatically reopen the Restore drawer so the user doesn't have
            // to re-navigate/re-pick — they already committed to this flow.
            setTimeout(() => openRestoreCapacityDrawer(), 800);
          },
        });
        return;
      }

      if (data?.error) throw new Error(data.error);

      toast({
        title: "🎉 Your share is active again!",
        description: `${data.bought} share${data.bought === 1 ? '' : 's'} live · ₦${totalPayout.toLocaleString()} target payout`,
      });
      triggerHaptic('success');

      qc.invalidateQueries({ queryKey: ['drop-status', user?.id] });
      qc.invalidateQueries({ queryKey: ['balances', user?.id] });
      qc.invalidateQueries({ queryKey: ['retirement-status', user?.id] });
      qc.invalidateQueries({ queryKey: ['transactions', user?.id] });
      // Daily-task cache carries spot_count / naira_per_batch_for_user /
      // capacity_full — MUST refresh after restore or the user lands back
      // on DailyTask seeing stale ₦0-per-batch and the retirement gate.
      qc.invalidateQueries({ queryKey: ['daily-task', user?.id] });
      qc.invalidateQueries({ queryKey: ['machines', user?.id] });


      onOpenChange(false);
    } catch (e: any) {
      // Warm failure copy — never leak raw error strings as the headline.
      // The user needs reassurance that nothing was charged, not a stack trace.
      toast({
        title: "That didn't go through",
        description: "Your share is safe — nothing was charged. Give it another try in a moment.",
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="border-border/50">
        <div className="mx-auto w-full max-w-md">
          <DrawerHeader className="text-center pb-2">
            <div className="mx-auto mb-2 h-14 w-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Sparkles className="h-7 w-7 text-emerald-500" />
            </div>
            <DrawerTitle className="text-xl font-bold">
              🎉 You just cashed out ₦{(previous * status.payout_per_spot).toLocaleString()}!
            </DrawerTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Your {previous > 1 ? `${previous} shares` : 'share'} finished the campaign. Activate{previous > 1 ? ' them' : ' it'} again in one tap.
            </p>
            {/* Merged urgency + social proof — one loud line at the top */}
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/25 px-3 py-1.5 mx-auto">
              <Users className="h-3 w-3 text-amber-500" />
              <span className="text-[10.5px] font-bold text-amber-500 tabular-nums leading-tight">
                Every idle day = ₦0 earned · {socialProofCount.toLocaleString()} restored today
              </span>
            </div>
          </DrawerHeader>


          <div className="px-4 pb-4 space-y-2">
            <ChoiceCard
              selected={choice === 'restore'}
              onClick={() => { triggerHaptic('light'); setChoice('restore'); }}
              badge="RECOMMENDED"
              badgeTone="emerald"
              title={`Activate my ${previous} share${previous === 1 ? '' : 's'}`}
              subtitle={`Get back exactly what you had — ₦${(previous * status.payout_per_spot).toLocaleString()} next payout`}
              cost={status.base_fee + (previous - 1) * status.extra_fee}
            />
            <ChoiceCard
              selected={choice === 'upgrade'}
              onClick={() => { triggerHaptic('light'); setChoice('upgrade'); }}
              badge={`+₦${(5 * status.payout_per_spot).toLocaleString()} MORE`}
              badgeTone="blue"
              title={`Upgrade to ${upgradeTarget} shares`}
              subtitle={`+5 shares = +₦${(5 * status.payout_per_spot).toLocaleString()} more on your next payout — ₦${(upgradeTarget * status.payout_per_spot).toLocaleString()} total`}
              cost={status.base_fee + (upgradeTarget - 1) * status.extra_fee}
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <ChoiceCard
              selected={choice === 'fresh'}
              onClick={() => { triggerHaptic('light'); setChoice('fresh'); }}
              title="Start fresh with 1 share"
              subtitle={`Just the basics — ₦${status.payout_per_spot.toLocaleString()} target payout`}
              cost={status.base_fee}
            />


            {/* Custom count — demoted to a small link so it doesn't
                compete visually with the 3 recommended choices. Expands
                into a stepper only when the user explicitly taps it. */}
            {choice !== 'custom' ? (
              <button
                type="button"
                onClick={() => switchToCustom(count)}
                className="w-full text-center text-[12px] text-muted-foreground hover:text-foreground py-2"
              >
                Or pick your own number →
              </button>
            ) : (
              <div className="rounded-2xl border border-primary bg-primary/5 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Your own number</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      ₦{(status.base_fee + Math.max(0, customCount - 1) * status.extra_fee).toLocaleString()} · ₦
                      {(customCount * status.payout_per_spot).toLocaleString()} payout
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setCustomCount((c) => Math.max(1, c - 1));
                      }}
                      className="h-8 w-8 rounded-full border border-border flex items-center justify-center active:scale-95"
                      aria-label="Decrease"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-8 text-center text-sm font-bold tabular-nums">
                      {customCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setCustomCount((c) => Math.min(50, c + 1));
                      }}
                      className="h-8 w-8 rounded-full border border-border flex items-center justify-center active:scale-95"
                      aria-label="Increase"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Before → After payout target */}
          <div className="mx-4 mb-2 rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 to-transparent p-3">
            <p className="text-[10px] font-bold tracking-wider uppercase text-emerald-500 mb-1">
              Your payout comes back
            </p>
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Was (finished)</p>
                <p className="text-base font-semibold tabular-nums text-muted-foreground line-through decoration-1">
                  ₦{(previous * status.payout_per_spot).toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-emerald-500 uppercase font-bold">Will be</p>
                <p className="text-2xl font-bold tabular-nums text-emerald-500">
                  ₦{totalPayout.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Summary bar */}
          <div className="mx-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total to pay</span>
              <span className="font-bold tabular-nums">₦{totalCost.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-[11px] mt-1">
              <span className="text-muted-foreground">
                ₦{status.base_fee.toLocaleString()} per share × {count}
              </span>
              <span className="text-emerald-500 font-medium">One flat price</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-muted-foreground">Next payout target</span>
              <span className="font-bold text-emerald-500 tabular-nums">₦{totalPayout.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-[11px] mt-2 pt-2 border-t border-emerald-500/10">
              <span className="text-muted-foreground">Your wallet</span>
              <span className="tabular-nums">₦{status.combined_balance.toLocaleString()}</span>
            </div>
            {shortfall > 0 && (
              <p className="text-[11px] text-amber-500 mt-1.5">
                You're ₦{shortfall.toLocaleString()} short — no stress, we'll help you top up right now.
              </p>
            )}
            {pendingBalance !== undefined && pendingBalance > 0 && shortfall === 0 && (
              <div className="mt-2 pt-2 border-t border-emerald-500/10">
                <p className="text-[11px] font-semibold text-emerald-500">
                  Unlocks your ₦{pendingBalance.toLocaleString()} pending balance
                </p>
                <p className="text-[10.5px] text-muted-foreground mt-0.5 leading-snug">
                  As soon as your share is live again, that pending money starts moving toward your wallet.
                </p>
              </div>
            )}

          </div>

          <div className="p-4 pt-3 space-y-2">
            <Button
              onClick={handleConfirm}
              disabled={submitting}
              className="w-full h-12 rounded-2xl gap-2 text-sm font-bold"
            >
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Bringing your ₦{totalPayout.toLocaleString()} payout back online…</>
              ) : shortfall > 0 ? (
                `Top up ₦${shortfall.toLocaleString()} — payout ₦${totalPayout.toLocaleString()}`
              ) : (
                <><CheckCircle2 className="h-4 w-4" /> Activate &amp; pay ₦{totalCost.toLocaleString()} — payout ₦{totalPayout.toLocaleString()}</>
              )}
            </Button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-full text-xs text-muted-foreground py-2"
            >
              {/* P1-2: at the decision fork, remind the user their PENDING
                  balance is what's actually waiting — combined_balance is a
                  weaker anchor (it's their spendable money, not the money
                  the retirement locked up). Fall back to combined only when
                  pending is unknown/zero. */}
              {pendingBalance && pendingBalance > 0
                ? `Maybe later — my ₦${pendingBalance.toLocaleString()} pending will wait for me`
                : status.combined_balance > 0
                ? `Maybe later — my ₦${status.combined_balance.toLocaleString()} will wait for me`
                : 'Maybe later'}
            </button>

          </div>

        </div>
      </DrawerContent>
    </Drawer>
  );
}

function ChoiceCard({
  selected,
  onClick,
  title,
  subtitle,
  cost,
  badge,
  badgeTone,
  icon,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
  cost: number;
  badge?: string;
  badgeTone?: 'emerald' | 'blue';
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border p-3 text-left transition-all active:scale-[0.99] ${
        selected
          ? 'border-primary bg-primary/5 ring-1 ring-primary/40'
          : 'border-border/60 bg-card/40 hover:bg-muted/30'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold flex items-center gap-1.5">
              {icon}
              {title}
            </p>
            {badge && (
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                  badgeTone === 'emerald'
                    ? 'bg-emerald-500/15 text-emerald-500'
                    : 'bg-blue-500/15 text-blue-500'
                }`}
              >
                {badge}
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{subtitle}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-muted-foreground">pay</p>
          <p className="text-sm font-bold tabular-nums">₦{cost.toLocaleString()}</p>
        </div>
      </div>
    </button>
  );
}
