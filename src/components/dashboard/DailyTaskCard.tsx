import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useDailyTask } from '@/hooks/useDailyTask';
import { useProfile } from '@/hooks/useProfile';
import { useMembershipDrawer } from '@/context/MembershipDrawerContext';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Zap, Play, CheckCircle2, ChevronRight, Lock, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { triggerHaptic } from '@/lib/haptics';
import { requestBuySpot } from '@/lib/buySpotDrawerStore';

/**
 * Earning Batches card — premium tap-to-earn entry point.
 * Open to all users; not gated by membership.
 */
export const DailyTaskCard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: state, isLoading } = useDailyTask(user?.id);
  const { data: profile } = useProfile(user?.id);
  const { openMembershipDrawer } = useMembershipDrawer();

  if (isLoading || !state) {
    return <Skeleton className="h-56 w-full rounded-3xl" />;
  }

  const isUnlimited = !!state.unlimited;
  const batchesDone = state.batches_done;
  const totalToday = state.total_batches_today;
  const remaining = Math.max(0, totalToday - batchesDone);
  const pendingCap = Number(state.pending_cap ?? 0);
  const pending = Number(state.pending_balance ?? 0);
  const capacityFull = !!state.capacity_full;
  // In unlimited mode "done" means the pending balance is full; otherwise batch cap hit.
  const isComplete = isUnlimited ? capacityFull : batchesDone >= totalToday && totalToday > 0;
  const naira = state.naira_per_batch_for_user;
  const taskEnabled = state.task_enabled;
  const isMember = !!profile?.is_member;

  const handleClick = () => {
    triggerHaptic('light');
    // Open to everyone — non-members get a 1-batch trial handled inside /task.
    navigate('/task');
  };


  // Always keep the CTA inviting — even after all batches are done,
  // the user should still be able to tap and land on the task page
  // where the proper "all done" message lives.
  const ctaLabel = !taskEnabled ? 'Earning Paused' : 'Start Working';

  // The indicator marks the batch the user is CURRENTLY on
  // (the latest one they've worked on). With 1 done → it sits on
  // dash #1 (the first one), not the next un-done one.
  const activeIndex = batchesDone > 0 ? batchesDone - 1 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'relative overflow-hidden rounded-2xl border bg-card p-4',
        isComplete ? 'border-emerald-500/20' : 'border-border',
      )}
    >
      {/* Soft glow — very subtle */}
      <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-emerald-500/[0.04] pointer-events-none" />

      {/* Header */}
      <div className="relative flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center">
              <Zap className="h-5 w-5 text-emerald-400" strokeWidth={2.2} />
            </div>
            {taskEnabled && (
              <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-card" />
            )}
          </div>
          <div>
            <div className="font-semibold text-sm leading-tight text-foreground">
              Today's Picture Rating
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {isUnlimited
                ? (capacityFull ? 'Pending Balance full — tell a friend to keep going' : 'Unlimited today — fill your pending balance')
                : isComplete
                  ? `${totalToday} ${totalToday === 1 ? 'rating' : 'ratings'} available`
                  : `${remaining} ${remaining === 1 ? 'rating' : 'ratings'} available`}
            </div>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="text-lg font-bold tabular-nums text-emerald-400 leading-none">
            ₦{naira.toLocaleString()}
          </div>
          <div className="text-[9px] text-muted-foreground mt-0.5 uppercase tracking-wider">
            per picture rated
          </div>
        </div>
      </div>

      {/* Segmented progress — only for capped mode. Unlimited mode uses the pending balance bar below. */}
      {!isUnlimited && totalToday > 0 && (
        <div className="relative flex items-center gap-1.5 mb-3">
          <div className="flex-1 flex items-center gap-1">
            {Array.from({ length: totalToday }).map((_, i) => {
              const filled = i < batchesDone;
              const isActive = !isComplete && batchesDone > 0 && i === activeIndex;
              return (
                <div
                  key={i}
                  className={cn(
                    'relative h-1 flex-1 rounded-full transition-colors',
                    filled ? 'bg-emerald-400' : 'bg-muted',
                  )}
                >
                  {isActive && (
                    <span className="absolute -top-1 left-1/2 -translate-x-1/2 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-card animate-pulse" />
                  )}
                </div>
              );
            })}
          </div>
          <span className="text-[11px] font-semibold tabular-nums text-emerald-400 ml-1">
            {batchesDone}/{totalToday}
          </span>
        </div>
      )}

      {/* CTA — compact and discreet */}
      <Button
        data-tour="start-working"
        onClick={handleClick}
        disabled={!taskEnabled}
        size="sm"
        className={cn(
          'w-full h-10 rounded-xl font-semibold text-sm gap-2 group',
          'bg-emerald-500 hover:bg-emerald-600 text-white',
        )}
      >
        {!taskEnabled ? (
          <Lock className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4 fill-current" />
        )}
        {ctaLabel}

        {taskEnabled && (
          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        )}
      </Button>

      {/* Footer info row — pending balance fullness */}
      {pending > 0 && (
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between px-1 text-xs">
            <span className="text-muted-foreground">Pending Balance</span>
            <span className="font-bold tabular-nums text-foreground">
              ₦{pending.toLocaleString()}
              {state.pending_cap > 0 && (
                <span className="text-muted-foreground font-normal"> / ₦{Number(state.pending_cap).toLocaleString()}</span>
              )}
            </span>
          </div>
          {state.pending_cap > 0 && (
            <div className="h-1 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  'h-full transition-all',
                  state.capacity_full ? 'bg-amber-400' : 'bg-emerald-400',
                )}
                style={{ width: `${Math.min(100, (pending / state.pending_cap) * 100)}%` }}
              />
            </div>
          )}
          {state.capacity_full && (
            <button
              type="button"
              onClick={() => { triggerHaptic('medium'); requestBuySpot(); }}
              className="w-full mt-1 flex items-center justify-between gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 hover:bg-amber-400/15 active:scale-[0.99] transition-all px-3 py-2 text-left"
            >
              <span className="text-[11.5px] font-semibold text-amber-400 leading-tight">
                Pending Balance full — activate another share to keep earning
              </span>
              <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-amber-400">
                <Plus className="h-3.5 w-3.5" />
                Add share
              </span>
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
};
