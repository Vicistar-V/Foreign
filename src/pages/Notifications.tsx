import { useState, useEffect, useRef } from 'react';
import { Bell, Loader2, Filter } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  useNotifications,
  type Notification,
  type NotificationFilter,
} from '@/hooks/useNotifications';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useDailyTask } from '@/hooks/useDailyTask';
import { useDropStatus } from '@/hooks/useDropStatus';
import { PendingCycleStrip, RestoreCapacityChip } from '@/components/PendingCycleExplainer';
import { useRetirementStatus } from '@/hooks/useRetirementStatus';
import { BannedBanner } from '@/components/BannedBanner';
import { NotificationItem } from '@/components/notifications/NotificationItem';
import { StaggeredList } from '@/components/animations/StaggeredList';
import { StaggeredItem } from '@/components/animations/StaggeredItem';
import { SimplePagination } from '@/components/ui/SimplePagination';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { trackClarityEvent, ClarityEvents } from '@/lib/clarityTracking';

const ITEMS_PER_PAGE = 10;

export default function Notifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: profile } = useProfile(user?.id);
  const { data: dailyTask } = useDailyTask(user?.id);
  const { data: dropStatus } = useDropStatus();
  const { data: retirement } = useRetirementStatus();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<NotificationFilter>('all');

  const pendingBalance = Number(dailyTask?.pending_balance ?? 0);
  const perCyclePayout = Number(dropStatus?.config?.profit_amount ?? 900);
  const hasSpots =
    (dropStatus?.user?.total_spots_count ?? dropStatus?.user?.spots?.length ?? 0) > 0;
  const isMember = !!profile?.is_member;
  const isRetired = !!retirement?.is_retired;

  const isBanned = profile?.is_banned ?? false;
  const bannedReason = profile?.banned_reason;

  useEffect(() => {
    trackClarityEvent(ClarityEvents.PAGE_VIEW_NOTIFICATIONS);
  }, []);

  const offset = (page - 1) * ITEMS_PER_PAGE;

  const {
    notifications,
    unreadCount,
    totalCount,
    filteredCount,
    isLoading,
    isFetching,
    markAsRead,
    markAllAsRead,
  } = useNotifications(ITEMS_PER_PAGE, offset, filter);

  // Auto-mark all as read on first load when there are unread items
  const hasAutoMarkedRef = useRef(false);
  useEffect(() => {
    if (!isLoading && unreadCount > 0 && !hasAutoMarkedRef.current) {
      hasAutoMarkedRef.current = true;
      markAllAsRead();
    }
  }, [isLoading, unreadCount, markAllAsRead]);

  // Pagination loading state — show skeletons (not stale rows) while next page loads
  const [isPaginating, setIsPaginating] = useState(false);
  const listTopRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isFetching && isPaginating) setIsPaginating(false);
  }, [isFetching, isPaginating]);

  const totalForPagination = filter === 'all' ? totalCount : filteredCount;
  const totalPages = Math.max(1, Math.ceil(totalForPagination / ITEMS_PER_PAGE));

  const handlePageChange = (next: number) => {
    if (next === page) return;
    setIsPaginating(true);
    setPage(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleMarkAsRead = (notification: Notification) => {
    if (!notification.read_at) {
      markAsRead([{ id: notification.id, source: notification.source }]);
    }
  };

  const handleNotificationNavigate = (notification: Notification, route: string) => {
    handleMarkAsRead(notification);
    trackClarityEvent(ClarityEvents.NOTIFICATION_CLICKED);
    navigate(route);
  };

  const handleFilterChange = (value: NotificationFilter) => {
    setFilter(value);
    setPage(1);
  };

  const showSkeletons = isLoading || isPaginating;

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

      {/* Header */}
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {unreadCount > 0 ? `${unreadCount} new` : 'All caught up'}
          </p>
        </div>
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

      {/* Tiny stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <StatTile label="All" value={totalCount} accent="text-foreground" />
        <StatTile label="Unread" value={unreadCount} accent="text-primary" />
        <StatTile
          label="In view"
          value={totalForPagination}
          accent="text-muted-foreground"
        />
      </div>

      {/* Filter */}
      <div className="mb-4">
        <Select value={filter} onValueChange={(value) => handleFilterChange(value as NotificationFilter)}>
          <SelectTrigger className="w-full h-11">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Filter notifications" />
            </div>
          </SelectTrigger>
          <SelectContent className="z-50 bg-popover">
            <SelectItem value="all">All notifications</SelectItem>
            <SelectItem value="unread">Unread only</SelectItem>
            <SelectItem value="wins">Wins</SelectItem>
            <SelectItem value="money">Money updates</SelectItem>
            <SelectItem value="alerts">Alerts</SelectItem>
            <SelectItem value="support">Support</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <div ref={listTopRef} />
      {showSkeletons ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border/50 bg-card p-4 flex items-center gap-3"
            >
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <StaggeredList className="space-y-3" animationKey={`${filter}-${page}`}>
          {notifications.map((notification: Notification) => (
            <StaggeredItem key={notification.id}>
              <NotificationItem
                notification={notification}
                onNavigate={(route) => handleNotificationNavigate(notification, route)}
                truncate
                showNavigationHint
              />
            </StaggeredItem>
          ))}
        </StaggeredList>
      )}

      {/* Pagination — server-side */}
      {totalForPagination > ITEMS_PER_PAGE && (
        <div className="mt-6">
          <SimplePagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalForPagination}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={handlePageChange}
          />
        </div>
      )}
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
    <p className={`text-base font-bold tabular-nums leading-tight ${accent}`}>{value}</p>
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5 leading-tight">
      {label}
    </p>
  </div>
);

function EmptyState({ filter }: { filter: NotificationFilter }) {
  const messages: Record<NotificationFilter, string> = {
    all: 'No notifications yet',
    unread: 'No unread notifications',
    wins: 'No win notifications',
    money: 'No money updates',
    alerts: 'No alerts',
    support: 'No support updates',
  };

  return (
    <motion.div
      className="text-center py-16"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Bell className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
      <p className="text-muted-foreground">{messages[filter]}</p>
    </motion.div>
  );
}
