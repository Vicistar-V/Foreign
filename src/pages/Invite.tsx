/**
 * Referrer Page — calm, mobile-first, stats-first.
 * Order: stats → reward tiles + collapsible info → share → unified tabbed activity.
 * No personal greeting, no walls of text, no tier system (not in backend).
 */
import { useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BannedBanner } from '@/components/BannedBanner';

import { ReferrerStatsRow } from '@/components/invite/ReferrerStatsRow';
import { ReferrerHowYouEarn } from '@/components/invite/ReferrerHowYouEarn';
import { ReferrerShareRow } from '@/components/invite/ReferrerShareRow';
import { ReferrerActivity } from '@/components/invite/ReferrerActivity';

import { useMinerData } from '@/hooks/useMinerData';
import { useReferralData } from '@/hooks/useReferralData';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { useDailyTask } from '@/hooks/useDailyTask';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import { trackClarityEvent, ClarityEvents } from '@/lib/clarityTracking';

export default function Invite() {
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const { data: config } = usePlatformConfig();
  const { data: taskState } = useDailyTask(user?.id);
  const { data: minerData, isLoading: minerLoading, error: minerError, refetch } = useMinerData();
  const { data: referralData, isLoading: referralLoading } = useReferralData();

  useEffect(() => {
    trackClarityEvent(ClarityEvents.PAGE_VIEW_INVITE);
  }, []);

  const isBanned = profile?.is_banned ?? false;
  const referralCode = minerData?.referralCode || profile?.referral_code || '';

  const summary = minerData?.summary || {
    total_members: 0,
    active_members: 0,
    pending_members: 0,
    total_spots_in_network: 0,
    total_network_yields: 0,
    total_royalty_earnings: 0,
    per_yield_potential: 0,
  };

  const bonusBatches = Number(
    taskState?.referral_bonus_batches ?? config?.task_referral_bonus_batches ?? 5,
  );
  const referralCashBonus = Number(
    taskState?.referral_cash_bonus ?? config?.referral_cash_bonus ?? 1000,
  );
  const referralPendingBonus = Number(
    taskState?.referral_pending_bonus ?? config?.referral_pending_bonus ?? 3000,
  );
  const nairaPerBatch = Number(taskState?.naira_per_batch_for_user ?? 0);
  const isUnlimited = !!taskState?.unlimited;

  const totalEarned = referralData?.stats?.totalEarned ?? summary.total_royalty_earnings;
  // Retirement Economy: friend activations bump the sponsor's pending balance.
  // Approximate the total jump from confirmed active friends × configured bump.
  const pendingJumped = Number(summary.active_members ?? 0) * referralPendingBonus;
  const recentRoyalties = referralData?.royalties?.recentRoyalties ?? [];

  return (
    <div className="min-h-screen pb-24">
      <div className="px-4 pt-5 pb-2 max-w-lg mx-auto space-y-4">
        {isBanned && <BannedBanner reason={profile?.banned_reason} />}

        {/* Page title — small, no name */}
        <div className="px-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Referrer
          </p>
          <h1 className="text-[22px] font-bold tracking-tight text-foreground leading-tight mt-0.5">
            Invite & earn
          </h1>
        </div>

        {minerError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between gap-2">
              <span className="text-sm">Couldn't load your friends list</span>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* 1. STATS FIRST — your real numbers */}
        <ReferrerStatsRow
          activeFriends={summary.active_members}
          pendingFriends={summary.pending_members}
          totalEarned={totalEarned}
          pendingJumped={pendingJumped}
          isLoading={minerLoading || referralLoading}
        />

        {/* 2. Reward tiles + collapsible "How you earn" */}
        <ReferrerHowYouEarn
          bonusBatches={bonusBatches}
          referralCashBonus={referralCashBonus}
          referralPendingBonus={referralPendingBonus}
          nairaPerBatch={nairaPerBatch}
          unlimited={isUnlimited}
        />

        {/* 3. Share */}
        {!isBanned && (
          <ReferrerShareRow referralCode={referralCode} isLoading={minerLoading} />
        )}

        {/* 4. Unified network activity (tabs, both virtualized) */}
        <ReferrerActivity
          members={minerData?.members || []}
          royalties={recentRoyalties}
          referralCashBonus={referralCashBonus}
          isLoading={minerLoading || referralLoading}
        />
      </div>
    </div>
  );
}
