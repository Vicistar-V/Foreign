import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useDailyTask } from '@/hooks/useDailyTask';
import { useProfile } from '@/hooks/useProfile';
import { useBalances } from '@/hooks/useBalances';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';

import { useCountUp } from '@/hooks/useCountUp';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DepositModal } from '@/components/DepositModal';
import { AddBankAccountModal } from '@/components/AddBankAccountModal';
import { motion } from 'framer-motion';
import {
  ArrowUpRight,
  ArrowDownLeft,
  Lock,
  Wallet,
  ChevronRight,
  ShieldCheck,
  Info,
  Loader2,
} from 'lucide-react';
import { PendingCycleExplainerDrawer } from '@/components/PendingCycleExplainer';
import { useDropStatus } from '@/hooks/useDropStatus';
import { useMembershipDrawer } from '@/context/MembershipDrawerContext';
import { useMembershipPaymentLoading } from '@/lib/startMembershipPayment';
import {
  getCachedIsRetired,
  openRestoreCapacityDrawer,
} from '@/lib/restoreCapacityStore';
import { requestBuySpot } from '@/lib/buySpotDrawerStore';
import { PayoutGauge } from './PayoutGauge';

interface WalletCardProps {
  /** Strip the card down to just the total balance hero for non-members. */
  simplified?: boolean;
}

export function WalletCard({ simplified = false }: WalletCardProps = {}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const { data: balances, isLoading } = useBalances(user?.id);
  const { data: config } = usePlatformConfig();
  const { data: dailyTask } = useDailyTask(user?.id);
  

  const pendingBalance = Number(dailyTask?.pending_balance ?? 0);
  const { data: dropStatus } = useDropStatus();
  const totalSpotsCount = dropStatus?.user?.total_spots_count ?? dropStatus?.user?.spots?.length ?? 0;
  const hasSpots = totalSpotsCount > 0;
  const sharedDrop = dropStatus?.user?.shared_drop ?? null;
  const perCyclePayout = Number(config?.drop_profit_amount ?? 10000);
  const entryFee = Number(config?.drop_entry_fee ?? 5000);
  const lineTargetPayout = Number(sharedDrop?.target_amount ?? perCyclePayout) || perCyclePayout;
  const lineFillAmount = Number(sharedDrop?.fill_amount ?? 0);
  const lineFillPercent = Math.min(100, Math.max(0, Number(sharedDrop?.fill_percentage ?? 0)));
  const peopleAhead = Math.max(0, Number(sharedDrop?.position ?? 0) - 1);
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [bankAccountModalOpen, setBankAccountModalOpen] = useState(false);
  const [pendingExplainerOpen, setPendingExplainerOpen] = useState(false);
  const { openMembershipDrawer } = useMembershipDrawer();
  const paying = useMembershipPaymentLoading();

  const earningsBalance = Math.max(0, balances?.earnings_balance || 0);
  const depositBalance = Math.max(0, balances?.deposit_balance || 0);
  const totalBalance = earningsBalance;

  const animatedTotal = useCountUp({
    start: 0,
    end: totalBalance,
    duration: 900,
    delay: 80,
  });
  const isMember = profile?.is_member;
  const minWithdrawal = config?.minimum_withdrawal ?? 500;

  // Progress to next withdrawal threshold (visual only)
  const progressPct = Math.min(
    100,
    Math.round((earningsBalance / minWithdrawal) * 100),
  );
  const canWithdraw = earningsBalance >= minWithdrawal;

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-72 w-full rounded-3xl" />
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  // Members: gauge IS the wallet hero (no wrapper chrome). Non-members: legacy balance card.
  if (!simplified && isMember) {
    return (
      <>
        <div className="space-y-3">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-border bg-card overflow-hidden"
          >
            <PayoutGauge
              target={lineTargetPayout}
              fillAmount={lineFillAmount}
              fillPercent={lineFillPercent}
              peopleAhead={peopleAhead}
              hasSpots={hasSpots}
              entryFee={entryFee}
              spotsCount={totalSpotsCount}

              flush
              onTap={() => {
                if (getCachedIsRetired()) {
                  openRestoreCapacityDrawer();
                } else {
                  requestBuySpot();
                }
              }}
            />

            {/* Attached tiles — visually inset info panels, not action buttons */}
            <div className="grid grid-cols-2 border-t border-border/60 bg-muted/30">
              <button
                type="button"
                onClick={() => canWithdraw && navigate('/withdraw')}
                className="text-left px-4 py-3 border-r border-border/60 cursor-default"
              >
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400/90">
                    Earnings
                  </span>
                </div>
                <div className="text-xl font-bold tabular-nums text-foreground mt-1 leading-tight">
                  ₦{animatedTotal.toLocaleString()}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  {canWithdraw
                    ? 'Ready to withdraw'
                    : `₦${Math.max(0, minWithdrawal - earningsBalance).toLocaleString()} to go`}
                </div>
              </button>

              <button
                type="button"
                data-tour="wallet-pending"
                onClick={() => setPendingExplainerOpen(true)}
                className="text-left px-4 py-3 cursor-default"
              >
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-60 animate-ping" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sky-400" />
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-400/90">
                      Pending
                    </span>
                  </div>
                  <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </div>
                <div className="text-xl font-bold tabular-nums text-foreground mt-1 leading-tight">
                  ₦{pendingBalance.toLocaleString()}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  Pays out on your turn
                </div>
              </button>
            </div>


            {/* Attached action row — same card, hairline divider */}
            <div className="grid grid-cols-2 border-t border-border/60">
              <button
                type="button"
                onClick={() => {
                  if (getCachedIsRetired()) {
                    openRestoreCapacityDrawer();
                  } else {
                    requestBuySpot();
                  }
                }}
                className="flex items-center justify-center gap-2 h-12 font-semibold text-sm text-amber-400 hover:bg-amber-500/10 transition-colors border-r border-border/60"
              >
                <ArrowDownLeft className="h-4 w-4 text-amber-400" />
                {getCachedIsRetired() ? 'Activate Another Share' : 'Add a Share'}
              </button>

              <button
                type="button"
                onClick={() => navigate('/withdraw')}
                className="flex items-center justify-center gap-2 h-12 font-semibold text-sm text-foreground hover:bg-muted/40 transition-colors"
              >
                <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                Withdraw
              </button>
            </div>
          </motion.div>


          <PendingCycleExplainerDrawer
            open={pendingExplainerOpen}
            onOpenChange={setPendingExplainerOpen}
            pendingBalance={pendingBalance}
            perCyclePayout={perCyclePayout}
            hasSpots={hasSpots}
            isMember={!!isMember}
            isRetired={getCachedIsRetired()}
          />

        </div>

        <DepositModal open={depositModalOpen} onOpenChange={setDepositModalOpen} />
        {user?.id && (
          <AddBankAccountModal
            open={bankAccountModalOpen}
            onOpenChange={setBankAccountModalOpen}
            userId={user.id}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {/* Hero balance card (non-member / simplified) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl border border-border bg-card p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Wallet className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                Your Money
              </span>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Lock className="h-3 w-3" />
              Locked
            </span>
          </div>

          <div className="text-center py-2">
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
              Total Balance
            </span>
            <p className="text-4xl sm:text-5xl font-bold tabular-nums text-foreground mt-1 leading-none">
              ₦{animatedTotal.toLocaleString()}
            </p>
            <p className="text-[11px] text-muted-foreground mt-2">
              {canWithdraw
                ? 'Ready to withdraw'
                : `You're ₦${Math.max(0, minWithdrawal - earningsBalance).toLocaleString()} away from your first withdrawal`}
            </p>
          </div>
        </motion.div>



        <PendingCycleExplainerDrawer
          open={pendingExplainerOpen}
          onOpenChange={setPendingExplainerOpen}
          pendingBalance={pendingBalance}
          perCyclePayout={perCyclePayout}
          hasSpots={hasSpots}
          isMember={!!isMember}
          isRetired={getCachedIsRetired()}
        />

        {/* Action buttons + history link — hidden in simplified mode */}
        {!simplified && (
          <>
            <div className="grid grid-cols-5 gap-2">
              {/* Add Spots — dominant primary CTA (3/5 width) */}
              <Button
                onClick={() => {
                  if (!isMember) {
                    openMembershipDrawer();
                  } else if (getCachedIsRetired()) {
                    openRestoreCapacityDrawer();
                  } else {
                    requestBuySpot();
                  }
                }}
                disabled={!isMember && paying}
                className="col-span-3 h-12 rounded-xl gap-2 font-bold bg-neutral-900 text-white hover:bg-neutral-900/90 transition-all disabled:opacity-80"
              >
                {!isMember && paying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : !isMember ? (
                  <Lock className="h-4 w-4" />
                ) : (
                  <ArrowDownLeft className="h-4 w-4" />
                )}
                {isMember
                  ? getCachedIsRetired()
                    ? 'Activate Another Share'
                    : 'Add a Share'
                  : paying
                    ? 'Starting…'
                    : 'Activate'}
              </Button>

              {/* Withdraw — demoted secondary (2/5 width, outline) */}
              <Button
                onClick={() => navigate('/withdraw')}
                disabled={!isMember}
                variant="outline"
                className="col-span-2 h-12 rounded-xl border-2 gap-1.5 font-semibold bg-neutral-900 text-white border-neutral-800 hover:bg-neutral-800 hover:text-white transition-all disabled:opacity-50"
              >
                <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                <span className="text-sm">Withdraw</span>
              </Button>
            </div>

            <button
              onClick={() => navigate('/transactions')}
              className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover:bg-muted rounded-xl transition-colors text-sm"
            >
              <span className="text-muted-foreground">View money history</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </>
        )}
      </div>

      {/* Modals */}
      <DepositModal
        open={depositModalOpen}
        onOpenChange={setDepositModalOpen}
      />
      {user?.id && (
        <AddBankAccountModal
          open={bankAccountModalOpen}
          onOpenChange={setBankAccountModalOpen}
          userId={user.id}
        />
      )}
    </>
  );
}
