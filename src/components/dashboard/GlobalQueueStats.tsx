import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useDropStatus } from '@/hooks/useDropStatus';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import {
  Activity,
  Gift,
  Star,
  Users,
  TrendingUp,
  ChevronRight,

} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useState, useMemo } from 'react';
import { QuickShareDrawer } from './QuickShareDrawer';
import { useMembershipDrawer } from '@/context/MembershipDrawerContext';
import mockAvatar01 from '@/assets/queue-mocks/person-01.jpg';
import mockAvatar02 from '@/assets/queue-mocks/person-02.jpg';
import mockAvatar03 from '@/assets/queue-mocks/person-03.jpg';
import mockAvatar04 from '@/assets/queue-mocks/person-04.jpg';
import mockAvatar05 from '@/assets/queue-mocks/person-05.jpg';
import mockAvatar06 from '@/assets/queue-mocks/person-06.jpg';
import mockAvatar07 from '@/assets/queue-mocks/person-07.jpg';
import mockAvatar08 from '@/assets/queue-mocks/person-08.jpg';
import mockAvatar09 from '@/assets/queue-mocks/person-09.jpg';
import mockAvatar10 from '@/assets/queue-mocks/person-10.jpg';

type PayoutItem = {
  type: 'payout';
  position: number;
  paid_at: string;
  created_at: string;
  user_id: string | null;
  user_name: string;
  avatar_url: string | null;
  referred_by_code: string | null;
  profit: number;
};

type ReferralItem = {
  type: 'referral';
  id: string;
  created_at: string;
  earner_name: string;
  earner_avatar: string | null;
  referee_name: string;
  amount: number;
  bonus_type: 'activation' | 'cycle';
};

type FeedItem = PayoutItem | ReferralItem;

interface GlobalQueueStatsProps {
  isMember?: boolean;
}

export function GlobalQueueStats({ isMember = true }: GlobalQueueStatsProps) {
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const { data, isLoading } = useDropStatus();
  const [showAll, setShowAll] = useState(false);
  const [showShareDrawer, setShowShareDrawer] = useState(false);
  const { openMembershipDrawer } = useMembershipDrawer();

  const myReferralCode = profile?.referral_code;

  const combinedFeed = useMemo<FeedItem[]>(() => {
    const payouts: FeedItem[] = (data?.recent_payouts || []).map((p: any) => ({
      ...p,
      type: 'payout' as const,
    }));
    const referrals: FeedItem[] = (data?.recent_referral_bonuses || []).map((r: any) => ({
      ...r,
      type: 'referral' as const,
    }));
    return [...payouts, ...referrals].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [data?.recent_payouts, data?.recent_referral_bonuses]);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-3">
        <Skeleton className="h-6 w-44" />
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
    );
  }

  const queue = data?.queue;

  // Mock fallback feed so the "people earning right now" card is never empty
  // during quiet periods / early days. Amounts are realistic Nigerian payouts.
  const MOCK_FEED: FeedItem[] = [
    { type: 'payout', position: 128, paid_at: new Date(Date.now() - 3 * 60_000).toISOString(), created_at: new Date(Date.now() - 3 * 60_000).toISOString(), user_id: null, user_name: 'Chinedu Okafor', avatar_url: mockAvatar01, referred_by_code: null, profit: 10000 },
    { type: 'referral', id: 'mock-r1', created_at: new Date(Date.now() - 8 * 60_000).toISOString(), earner_name: 'Aisha Bello', earner_avatar: mockAvatar02, referee_name: 'Musa I.', amount: 500, bonus_type: 'activation' },
    { type: 'payout', position: 127, paid_at: new Date(Date.now() - 14 * 60_000).toISOString(), created_at: new Date(Date.now() - 14 * 60_000).toISOString(), user_id: null, user_name: 'Emeka Nwosu', avatar_url: mockAvatar03, referred_by_code: null, profit: 10000 },
    { type: 'payout', position: 126, paid_at: new Date(Date.now() - 22 * 60_000).toISOString(), created_at: new Date(Date.now() - 22 * 60_000).toISOString(), user_id: null, user_name: 'Funke Adeyemi', avatar_url: mockAvatar04, referred_by_code: null, profit: 10000 },
    { type: 'referral', id: 'mock-r2', created_at: new Date(Date.now() - 31 * 60_000).toISOString(), earner_name: 'Ibrahim Sani', earner_avatar: mockAvatar05, referee_name: 'Blessing O.', amount: 500, bonus_type: 'activation' },
    { type: 'payout', position: 125, paid_at: new Date(Date.now() - 42 * 60_000).toISOString(), created_at: new Date(Date.now() - 42 * 60_000).toISOString(), user_id: null, user_name: 'Ngozi Eze', avatar_url: mockAvatar06, referred_by_code: null, profit: 20000 },
    { type: 'payout', position: 124, paid_at: new Date(Date.now() - 55 * 60_000).toISOString(), created_at: new Date(Date.now() - 55 * 60_000).toISOString(), user_id: null, user_name: 'Tunde Balogun', avatar_url: mockAvatar07, referred_by_code: null, profit: 10000 },
    { type: 'referral', id: 'mock-r3', created_at: new Date(Date.now() - 68 * 60_000).toISOString(), earner_name: 'Amaka Uche', earner_avatar: mockAvatar08, referee_name: 'Grace K.', amount: 500, bonus_type: 'activation' },
    { type: 'payout', position: 123, paid_at: new Date(Date.now() - 80 * 60_000).toISOString(), created_at: new Date(Date.now() - 80 * 60_000).toISOString(), user_id: null, user_name: 'Bola Adewale', avatar_url: mockAvatar09, referred_by_code: null, profit: 30000 },
    { type: 'payout', position: 122, paid_at: new Date(Date.now() - 95 * 60_000).toISOString(), created_at: new Date(Date.now() - 95 * 60_000).toISOString(), user_id: null, user_name: 'Kelechi Obi', avatar_url: mockAvatar10, referred_by_code: null, profit: 10000 },
  ];

  // Always show real events first, then pad with mock fallbacks so the feed
  // is never sparse. Real earnings must sit at the top regardless of fallback.
  const MIN_FEED = 5;
  const needed = Math.max(0, MIN_FEED - combinedFeed.length);
  const feedToUse: FeedItem[] = [...combinedFeed, ...MOCK_FEED.slice(0, needed)];
  const usingMock = combinedFeed.length < MIN_FEED;

  const isFriendPayout = (p: PayoutItem) =>
    !!myReferralCode && p.referred_by_code === myReferralCode;

  // Cap the feed at the most recent 25 events
  const cappedFeed = feedToUse.slice(0, 25);
  const displayedItems = showAll ? cappedFeed : cappedFeed.slice(0, 5);
  const hasMore = cappedFeed.length > 5;

  // Prefer real queue stats; fall back to believable numbers when the queue
  // hasn't warmed up yet so the 3-stat row is never empty.
  const paidToday = usingMock ? 12 : (queue?.paid_today_count || 0);
  const paidTodayAmount = usingMock ? 140000 : (queue?.paid_today_amount || 0);
  const inQueue = usingMock ? 84 : (queue?.total_in_queue || 0);

  return (
    <section className="rounded-2xl border border-border/50 bg-card overflow-hidden">
      {/* ── Hero Header ────────────────────────────────────── */}
      <div className="relative px-4 pt-4 pb-3 border-b border-border/50">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="relative">
              <span className="absolute inset-0 rounded-full bg-emerald-500/40 animate-ping" />
              <span className="relative block h-2 w-2 rounded-full bg-emerald-500" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">
              People earning right now
            </h3>
          </div>
          <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-500">
            Live
          </span>
        </div>

        {/* Premium stat tiles — shown to everyone so non-members see the social proof too */}
        <div className="grid grid-cols-3 gap-2">
          <StatTile
            value={paidToday.toLocaleString()}
            label="Paid"
            tone="muted"
          />
          <StatTile
            value={`₦${paidTodayAmount.toLocaleString()}`}
            label="Given out"
            tone="emerald"
            emphasized
          />
          <StatTile
            value={inQueue.toLocaleString()}
            label="In campaign"
            tone="muted"
          />
        </div>
      </div>

      {/* ── Feed ───────────────────────────────────────────── */}
      {feedToUse.length > 0 ? (
        <div className="p-4 pt-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Recent earnings
            </p>
          </div>

          <ul
            className={`space-y-2 ${
              showAll ? 'max-h-80 overflow-y-auto pr-1' : ''
            }`}
          >
            {displayedItems.map((item) => {
              if (item.type === 'referral') {
                return (
                  <li
                    key={`referral-${item.id}`}
                    className="relative overflow-hidden rounded-xl border border-amber-500/20 bg-gradient-to-r from-amber-500/[0.08] via-amber-400/[0.04] to-yellow-500/[0.08]"
                  >
                    <div className="flex items-center gap-3 p-3">
                      <div className="h-9 w-9 rounded-full bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center shadow-sm shrink-0">
                        <Gift className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-amber-700 dark:text-amber-300 break-words">
                          {item.earner_name} earned an invite bonus
                        </p>
                        <p className="text-[11px] text-amber-600/80 dark:text-amber-400/70">
                          {item.bonus_type === 'activation'
                            ? `When ${item.referee_name} joined`
                            : `From ${item.referee_name}`}
                          {' • '}
                          {formatDistanceToNow(new Date(item.created_at), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold tabular-nums text-amber-600 dark:text-amber-300">
                          +₦{item.amount.toLocaleString()}
                        </p>
                        <p className="text-[9px] uppercase tracking-wider text-amber-600/70 dark:text-amber-400/70">
                          Invite
                        </p>
                      </div>
                    </div>
                  </li>
                );
              }

              const payout = item as PayoutItem;
              const friend = isFriendPayout(payout);

              return (
                <li
                  key={`payout-${payout.position}-${payout.paid_at}`}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                    friend
                      ? 'border border-primary/25 bg-primary/[0.06]'
                      : 'border border-border/40 bg-muted/20'
                  }`}
                >
                  <div className="relative shrink-0">
                    <Avatar
                      className={`h-9 w-9 ${friend ? 'ring-2 ring-primary/40' : ''}`}
                    >
                      <AvatarImage src={payout.avatar_url || undefined} />
                      <AvatarFallback className="text-xs bg-muted">
                        {payout.user_name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {friend && (
                      <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-amber-500 flex items-center justify-center">
                        <Star className="h-2.5 w-2.5 text-white fill-white" />
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p
                        className={`text-sm font-medium break-words ${
                          friend ? 'text-primary' : 'text-foreground'
                        }`}
                      >
                        {payout.user_name}
                      </p>
                      {friend && (
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1 py-0 h-4 border-primary/30 text-primary shrink-0"
                        >
                          Friend
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      #{payout.position}
                      {' • '}
                      {formatDistanceToNow(new Date(payout.paid_at), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold tabular-nums text-emerald-500">
                      +₦{payout.profit.toLocaleString()}
                    </p>
                    {friend && (
                      <p className="text-[10px] text-primary">Friend payout</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {hasMore && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="w-full py-2 text-xs text-primary font-medium flex items-center justify-center gap-1 hover:bg-primary/5 rounded-lg transition-colors"
            >
              {showAll ? 'Show less' : `See ${cappedFeed.length - 5} more`}
              <ChevronRight
                className={`h-3 w-3 transition-transform ${
                  showAll ? 'rotate-90' : ''
                }`}
              />
            </button>
          )}

          {/* Premium Invite CTA — members only */}
          {isMember && (
            <button
              onClick={() => setShowShareDrawer(true)}
              className="group w-full mt-1 rounded-xl p-[1px] bg-gradient-to-r from-amber-500/40 via-primary/40 to-amber-500/40"
            >
              <div className="flex items-center gap-3 rounded-[11px] bg-card px-3 py-2.5">
                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-amber-500 to-primary flex items-center justify-center shrink-0">
                  <Users className="h-3.5 w-3.5 text-white" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-[12px] font-semibold text-foreground leading-tight">
                    Earn up to ₦5K+ daily with referrals
                  </p>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Build your earning network
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
              </div>
            </button>
          )}
        </div>
      ) : (
        <div className="px-4 py-8 text-center">
          <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-muted/40 flex items-center justify-center">
            <Activity className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No earnings yet today</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Be the first to earn today
          </p>
        </div>
      )}

      <QuickShareDrawer
        open={showShareDrawer}
        onOpenChange={setShowShareDrawer}
        contextMessage="People are earning bonuses by inviting friends! Start inviting now to earn too."
      />
    </section>
  );
}

/* ──────────── small premium stat tile ──────────── */
function StatTile({
  value,
  label,
  tone,
  emphasized = false,
}: {
  value: string;
  label: string;
  tone: 'emerald' | 'muted';
  emphasized?: boolean;
}) {
  const isEmerald = tone === 'emerald';
  return (
    <div
      className={`relative overflow-hidden rounded-xl px-2 py-2.5 text-center border ${
        isEmerald
          ? 'border-emerald-500/25 bg-emerald-500/[0.08]'
          : 'border-border/50 bg-muted/20'
      }`}
    >
      {emphasized && (
        <TrendingUp className="absolute top-1 right-1 h-2.5 w-2.5 text-emerald-500/70" />
      )}
      <p
        className={`text-base font-bold tabular-nums leading-tight ${
          isEmerald ? 'text-emerald-500' : 'text-foreground'
        }`}
      >
        {value}
      </p>
      <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
        {label}
      </p>
    </div>
  );
}
