/**
 * Transactions page — server-side filter, sort, pagination + tiny stats.
 */
import { useEffect, useRef, useState } from 'react';
import { StaggeredList } from '@/components/animations/StaggeredList';
import { StaggeredItem } from '@/components/animations/StaggeredItem';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useDailyTask } from '@/hooks/useDailyTask';
import { useDropStatus } from '@/hooks/useDropStatus';
import { PendingCycleStrip, RestoreCapacityChip } from '@/components/PendingCycleExplainer';
import { useRetirementStatus } from '@/hooks/useRetirementStatus';
import {
  useTransactions,
  type Transaction,
  type TxCategory,
  type TxDirection,
  type TxSort,
} from '@/hooks/useTransactions';
import { useWithdrawalVerification } from '@/hooks/useWithdrawalVerification';
import { BannedBanner } from '@/components/BannedBanner';
import { TransactionDetailDrawer } from '@/components/TransactionDetailDrawer';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SimplePagination } from '@/components/ui/SimplePagination';
import {
  History,
  ArrowDownLeft,
  ArrowUpRight,
  Trophy,
  Gift,
  Users,
  CreditCard,
  TrendingUp,
  ArrowDownUp,
  Filter as FilterIcon,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { trackClarityEvent, ClarityEvents } from '@/lib/clarityTracking';

const PAGE_SIZE = 15;

const getTransactionIcon = (type: string) => {
  switch (type) {
    case 'membership_bonus':
    case 'referral_payout':
    case 'drop_referral_cycle':
    case 'referral_first_cycle_bonus':
      return { Icon: Gift, color: 'text-primary', bg: 'bg-primary/10' };
    case 'drop_profit':
      return { Icon: Trophy, color: 'text-success', bg: 'bg-success/10' };
    case 'deposit':
      return { Icon: ArrowDownLeft, color: 'text-success', bg: 'bg-success/10' };
    case 'withdrawal':
      return { Icon: ArrowUpRight, color: 'text-destructive', bg: 'bg-destructive/10' };
    case 'drop_entry':
    case 'drop_reentry':
      return { Icon: Users, color: 'text-primary', bg: 'bg-primary/10' };
    case 'membership_fee':
      return { Icon: CreditCard, color: 'text-highlight', bg: 'bg-highlight/10' };
    default:
      return { Icon: TrendingUp, color: 'text-muted-foreground', bg: 'bg-muted' };
  }
};

export default function Transactions() {
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const { data: dailyTask } = useDailyTask(user?.id);
  const { data: dropStatus } = useDropStatus();
  const { data: retirement } = useRetirementStatus();
  const verifyWithdrawal = useWithdrawalVerification(user?.id || '');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  const [category, setCategory] = useState<TxCategory>('all');
  const [direction, setDirection] = useState<TxDirection>('all');
  const [sort, setSort] = useState<TxSort>('date_desc');
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching } = useTransactions(user?.id, {
    category,
    direction,
    sort,
    page,
    pageSize: PAGE_SIZE,
  });

  const isBanned = profile?.is_banned ?? false;
  const bannedReason = profile?.banned_reason;
  const pendingBalance = Number(dailyTask?.pending_balance ?? 0);
  const perCyclePayout = Number(dropStatus?.config?.profit_amount ?? 900);
  const hasSpots =
    (dropStatus?.user?.total_spots_count ?? dropStatus?.user?.spots?.length ?? 0) > 0;
  const isMember = !!profile?.is_member;
  const isRetired = !!retirement?.is_retired;

  const transactions = data?.transactions || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const stats = data?.stats;

  // Track pagination loading state so the list shows skeletons (not stale rows)
  // while the next page is being pulled.
  const [isPaginating, setIsPaginating] = useState(false);
  const listTopRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    trackClarityEvent(ClarityEvents.PAGE_VIEW_TRANSACTIONS);
  }, []);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [category, direction, sort]);

  // When the fetch settles, clear the paginating flag
  useEffect(() => {
    if (!isFetching && isPaginating) setIsPaginating(false);
  }, [isFetching, isPaginating]);

  const handlePageChange = (next: number) => {
    if (next === page) return;
    setIsPaginating(true);
    setPage(next);
    // Smooth scroll the page (and the dashboard main container) to the very top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const showSkeletons = isLoading || isPaginating;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(Math.abs(amount));

  const resetFilters = () => {
    setCategory('all');
    setDirection('all');
    setSort('date_desc');
    setPage(1);
  };

  const hasActiveFilter = category !== 'all' || direction !== 'all' || sort !== 'date_desc';

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto pb-24">
      {isBanned && <BannedBanner reason={bannedReason} />}

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <History className="h-7 w-7 text-primary" />
          Transactions
        </h1>
        {isFetching && !isLoading && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Retirement chip — surfaces even when pending is 0 */}
      {isRetired && <RestoreCapacityChip className="mb-3" />}

      {/* Pending → cycle explainer (only shows when user has pending) */}
      <PendingCycleStrip
        pendingBalance={pendingBalance}
        perCyclePayout={perCyclePayout}
        hasSpots={hasSpots}
        isMember={isMember}
        isRetired={isRetired}
        className="mb-3"
      />

      {/* Tiny stats strip — counts, not money amounts */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <StatTile label="All" value={stats?.all ?? 0} accent="text-foreground" />
        <StatTile label="Money in" value={stats?.money_in ?? 0} accent="text-success" />
        <StatTile label="Money out" value={stats?.money_out ?? 0} accent="text-destructive" />
        <StatTile label="Pending" value={stats?.pending ?? 0} accent="text-warning" />
      </div>

      {/* Filters / sort */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        <Select value={category} onValueChange={(v) => setCategory(v as TxCategory)}>
          <SelectTrigger className="h-10 text-[12px]">
            <FilterIcon className="h-3.5 w-3.5 text-muted-foreground mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-50 bg-popover">
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="drops">Campaign earnings</SelectItem>
            <SelectItem value="referrals">Referrals</SelectItem>
            <SelectItem value="money">Deposits & withdrawals</SelectItem>
            <SelectItem value="membership">Membership</SelectItem>
          </SelectContent>
        </Select>

        <Select value={direction} onValueChange={(v) => setDirection(v as TxDirection)}>
          <SelectTrigger className="h-10 text-[12px]">
            <ArrowDownUp className="h-3.5 w-3.5 text-muted-foreground mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-50 bg-popover">
            <SelectItem value="all">In & out</SelectItem>
            <SelectItem value="in">Money in</SelectItem>
            <SelectItem value="out">Money out</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={(v) => setSort(v as TxSort)}>
          <SelectTrigger className="h-10 text-[12px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-50 bg-popover">
            <SelectItem value="date_desc">Newest first</SelectItem>
            <SelectItem value="date_asc">Oldest first</SelectItem>
            <SelectItem value="amount_desc">Largest first</SelectItem>
            <SelectItem value="amount_asc">Smallest first</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {hasActiveFilter && (
        <div className="flex items-center justify-between mb-3 px-1">
          <p className="text-[11px] text-muted-foreground">
            {total.toLocaleString()} match{total === 1 ? '' : 'es'}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="h-7 text-[11px] gap-1"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </Button>
        </div>
      )}

      {/* List */}
      <div ref={listTopRef} />
      {showSkeletons ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-3/4 mb-2" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-5 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <History className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="font-semibold text-muted-foreground mb-1">
              {hasActiveFilter ? 'No matches for these filters' : 'No transactions yet'}
            </p>
            <p className="text-sm text-muted-foreground">
              {hasActiveFilter ? 'Try adjusting or resetting them' : 'Your activity will appear here'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <StaggeredList className="space-y-3" animationKey={`${category}-${direction}-${sort}-${page}`}>
          {transactions.map((tx) => {
            const { Icon, color, bg } = getTransactionIcon(tx.transaction_type);
            const isPositive = tx.amount > 0;
            const timeAgo = formatDistanceToNow(new Date(tx.created_at), { addSuffix: true });

            return (
              <StaggeredItem key={tx.id}>
                <Card
                  className="hover:bg-accent/5 transition-colors cursor-pointer"
                  onClick={() => setSelectedTransaction(tx)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-full ${bg} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`h-5 w-5 ${color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {tx.description}
                        </p>
                        <p className="text-xs text-muted-foreground">{timeAgo}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p
                          className={`text-sm font-bold tabular-nums ${
                            isPositive ? 'text-success' : 'text-destructive'
                          }`}
                        >
                          {isPositive ? '+' : '-'}
                          {formatCurrency(tx.amount)}
                        </p>
                        {tx.status === 'pending' && (
                          <Badge variant="outline" className="text-xs text-warning border-warning/30">
                            Pending
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </StaggeredItem>
            );
          })}
        </StaggeredList>
      )}

      {total > PAGE_SIZE && (
        <div className="mt-4">
          <SimplePagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={total}
            itemsPerPage={PAGE_SIZE}
            onPageChange={handlePageChange}
          />
        </div>
      )}

      <TransactionDetailDrawer
        open={!!selectedTransaction}
        onOpenChange={(open) => !open && setSelectedTransaction(null)}
        transaction={selectedTransaction}
        onVerifyWithdrawal={(ref) => verifyWithdrawal.mutate(ref)}
        isVerifying={verifyWithdrawal.isPending}
      />
    </div>
  );
}

const StatTile = ({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) => (
  <div className="rounded-xl border border-border/50 bg-card px-2 py-2 text-center">
    <p className={`text-base font-bold tabular-nums leading-tight ${accent}`}>{(typeof value === "number" ? value.toLocaleString() : value)}</p>
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5 leading-tight">
      {label}
    </p>
  </div>
);
