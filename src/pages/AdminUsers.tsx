import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SimplePagination } from '@/components/ui/SimplePagination';
import { CreditBonusDrawer } from '@/components/admin/CreditBonusDrawer';
import { SendDirectNotificationDrawer } from '@/components/admin/SendDirectNotificationDrawer';
import { ActivateMembershipDrawer } from '@/components/admin/ActivateMembershipDrawer';
import { BanUserDialog } from '@/components/admin/BanUserDialog';
import { UnbanUserDialog } from '@/components/admin/UnbanUserDialog';
import { UserListFiltersComponent } from '@/components/admin/UserListFilters';
import { UserListCard } from '@/components/admin/UserListCard';
import { ExportPhoneNumbersDrawer } from '@/components/admin/ExportPhoneNumbersDrawer';
import { WipeUnactivatedDialog } from '@/components/admin/WipeUnactivatedDialog';
import { BulkDeleteUsersDialog } from '@/components/admin/BulkDeleteUsersDialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useBanUser } from '@/hooks/useBanUser';
import { useAllUsers, type UserListFilters } from '@/hooks/useAllUsers';
import { UsersRound, Users, UserCheck, Ban, AlertCircle, Wifi, Download, Trash2, CheckSquare, X } from 'lucide-react';

export default function AdminUsers() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  // Initialize filters from URL params
  const getInitialFilters = (): UserListFilters => {
    const membership = searchParams.get('membership');
    const sort = searchParams.get('sort');
    
    return {
      search: '',
      membership_status: membership === 'member' ? 'member' : membership === 'not_member' ? 'not_member' : 'all',
      banned_status: 'all',
      activity_status: 'all',
      email_status: 'all',
      has_drops: 'all',
      phone_status: 'all',
      tour_status: 'all',
      sort_by: sort === 'balance' ? 'earnings' : 'created_at',
      sort_order: 'desc'
    };
  };

  // Filter state
  const [filters, setFilters] = useState<UserListFilters>(getInitialFilters);

  // Clear URL params after initial load (keep URL clean)
  useEffect(() => {
    if (searchParams.has('membership') || searchParams.has('sort')) {
      setSearchParams({}, { replace: true });
    }
  }, []);

  // Selected user state (for dialogs that stay in this page)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserName, setSelectedUserName] = useState('');
  const [selectedUserAvatar, setSelectedUserAvatar] = useState<string | null>(null);
  const [selectedUserBannedReason, setSelectedUserBannedReason] = useState<string | null>(null);
  
  // Drawer/dialog state (only dialogs that make sense on list page)
  const [showCreditBonus, setShowCreditBonus] = useState(false);
  const [showDirectMessage, setShowDirectMessage] = useState(false);
  const [showActivateMembership, setShowActivateMembership] = useState(false);
  const [showBanDialog, setShowBanDialog] = useState(false);
  const [showUnbanDialog, setShowUnbanDialog] = useState(false);
  const [showExportDrawer, setShowExportDrawer] = useState(false);
  const [showWipeDialog, setShowWipeDialog] = useState(false);

  // Bulk pick + remove state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedNames, setSelectedNames] = useState<Record<string, string>>({});
  const [showBulkDelete, setShowBulkDelete] = useState(false);

  const { banUser, unbanUser, isBanning, isUnbanning } = useBanUser();
  const { data, isLoading, error } = useAllUsers(page, limit, filters);

  // Reset to page 1 when filters change
  const handleFiltersChange = (newFilters: UserListFilters) => {
    setFilters(newFilters);
    setPage(1);

  };

  // Navigate to full user details page
  const handleUserSelect = (userId: string) => {
    navigate(`/admin/users/${userId}`);
  };

  const handleCreditBonus = (userId: string, userName: string) => {
    setSelectedUserId(userId);
    setSelectedUserName(userName);
    setShowCreditBonus(true);
  };

  const handleSendMessage = (userId: string, userName: string) => {
    setSelectedUserId(userId);
    setSelectedUserName(userName);
    setShowDirectMessage(true);
  };

  const handleActivateMembership = (userId: string, userName: string) => {
    setSelectedUserId(userId);
    setSelectedUserName(userName);
    setShowActivateMembership(true);
  };

  const handleBanUser = (userId: string, userName: string, isBanned: boolean, bannedReason?: string | null, avatarUrl?: string | null) => {
    setSelectedUserId(userId);
    setSelectedUserName(userName);
    setSelectedUserAvatar(avatarUrl || null);
    setSelectedUserBannedReason(bannedReason || null);
    
    if (isBanned) {
      setShowUnbanDialog(true);
    } else {
      setShowBanDialog(true);
    }
  };

  const handleConfirmBan = (reason: string) => {
    if (!selectedUserId) return;
    banUser({ userId: selectedUserId, reason }, {
      onSuccess: () => {
        setShowBanDialog(false);
      }
    });
  };

  const handleConfirmUnban = () => {
    if (!selectedUserId) return;
    unbanUser({ userId: selectedUserId }, {
      onSuccess: () => {
        setShowUnbanDialog(false);
      }
    });
  };

  const stats = data?.stats;
  const users = data?.users || [];
  const pagination = data?.pagination;

  // ---- Bulk pick helpers ----
  const toggleSelect = (userId: string) => {
    const name = users.find((u) => u.id === userId)?.full_name || 'This person';
    setSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
    setSelectedNames((prev) => ({ ...prev, [userId]: name }));
  };

  const pageIds = users.map((u) => u.id);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));

  const toggleSelectAllOnPage = () => {
    if (allOnPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
      setSelectedNames((prev) => {
        const next = { ...prev };
        users.forEach((u) => (next[u.id] = u.full_name));
        return next;
      });
    }
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds([]);
  };

  const bulkTargets = selectedIds.map((id) => ({
    id,
    name: selectedNames[id] || 'Unknown person',
  }));

  return (
    <div className="p-4 md:p-6 space-y-5 pb-24 md:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <UsersRound className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate">Everyone</h1>
            <p className="text-xs text-muted-foreground truncate">{stats?.total_users ? `${stats.total_users.toLocaleString()} registered users` : "People who joined Viketa"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={selectMode ? 'default' : 'outline'}
            size="sm"
            onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
          >
            {selectMode ? (
              <>
                <X className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Done picking</span>
              </>
            ) : (
              <>
                <CheckSquare className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Pick people</span>
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowWipeDialog(true)}
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Clear inactive</span>
          </Button>
        </div>
      </div>

      {/* Pick-mode helper bar */}
      {selectMode && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <Checkbox
              checked={allOnPageSelected}
              onCheckedChange={toggleSelectAllOnPage}
              className="h-5 w-5"
              aria-label="Pick everyone on this page"
            />
            <span className="text-sm font-medium">Pick everyone on this page</span>
          </label>
          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
            {selectedIds.length} picked
          </span>
        </div>
      )}


      {/* Stats Cards - Clickable to filter */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <Card
          className={`cursor-pointer transition-all hover:border-primary/50 active:scale-[0.98] ${filters.membership_status === 'all' && filters.banned_status === 'all' && filters.activity_status === 'all' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => handleFiltersChange({ ...filters, membership_status: 'all', banned_status: 'all', activity_status: 'all' })}
        >
          <CardContent className="p-2 sm:p-3 text-center">
            <Users className="h-4 w-4 sm:h-5 sm:w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-lg sm:text-xl font-bold tabular-nums">{stats?.total_users?.toLocaleString() || '—'}</p>
            <p className="text-[10px] sm:text-[10px] text-muted-foreground uppercase tracking-wide">Everyone</p>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all hover:border-success/50 active:scale-[0.98] border-success/30 bg-success/5 ${filters.activity_status === 'active' ? 'ring-2 ring-success' : ''}`}
          onClick={() => handleFiltersChange({ ...filters, activity_status: 'active', banned_status: 'all' })}
        >
          <CardContent className="p-2 sm:p-3 text-center">
            <Wifi className="h-4 w-4 sm:h-5 sm:w-5 mx-auto text-success mb-1" />
            <p className="text-lg sm:text-xl font-bold text-success tabular-nums">{stats?.online_now ?? '—'}</p>
            <p className="text-[10px] sm:text-[10px] text-muted-foreground uppercase tracking-wide">Online</p>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all hover:border-primary/50 active:scale-[0.98] ${filters.membership_status === 'member' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => handleFiltersChange({ ...filters, membership_status: 'member', banned_status: 'not_banned' })}
        >
          <CardContent className="p-2 sm:p-3 text-center">
            <UserCheck className="h-4 w-4 sm:h-5 sm:w-5 mx-auto text-primary mb-1" />
            <p className="text-lg sm:text-xl font-bold text-primary tabular-nums">{stats?.active_members?.toLocaleString() || '—'}</p>
            <p className="text-[10px] sm:text-[10px] text-muted-foreground uppercase tracking-wide">Joined</p>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all hover:border-destructive/50 active:scale-[0.98] ${filters.banned_status === 'banned' ? 'ring-2 ring-destructive' : ''}`}
          onClick={() => handleFiltersChange({ ...filters, banned_status: 'banned', membership_status: 'all' })}
        >
          <CardContent className="p-2 sm:p-3 text-center">
            <Ban className="h-4 w-4 sm:h-5 sm:w-5 mx-auto text-destructive mb-1" />
            <p className="text-lg sm:text-xl font-bold text-destructive tabular-nums">{stats?.banned_users || 0}</p>
            <p className="text-[10px] sm:text-[10px] text-muted-foreground uppercase tracking-wide">Locked</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <UserListFiltersComponent filters={filters} onFiltersChange={handleFiltersChange} />

      {/* User List */}
      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-64" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : error ? (
          <Card>
            <CardContent className="p-8 text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="font-semibold text-lg">Couldn't load people</h3>
              <p className="text-muted-foreground text-sm">{error.message || 'Something went wrong'}</p>
            </CardContent>
          </Card>
        ) : users.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-lg">Nobody matches</h3>
              <p className="text-muted-foreground text-sm">Try changing the filters above</p>
            </CardContent>
          </Card>
        ) : (
          users.map((user) => (
            <UserListCard 
              key={user.id} 
              user={user} 
              onSelect={handleUserSelect}
              selectMode={selectMode}
              selected={selectedIds.includes(user.id)}
              onToggleSelect={toggleSelect}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.total_pages > 1 && (
        <SimplePagination
          currentPage={page}
          totalPages={pagination.total_pages}
          totalItems={pagination.total}
          itemsPerPage={limit}
          onPageChange={setPage}
          onItemsPerPageChange={(newLimit) => {
            setLimit(newLimit);
            setPage(1);
          }}
          showItemsPerPageSelector
        />
      )}

      {/* Mobile Floating Action Button for Export */}
      {!selectMode && (
        <Button
          onClick={() => setShowExportDrawer(true)}
          className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg sm:hidden z-50"
          size="icon"
        >
          <Download className="h-6 w-6" />
        </Button>
      )}

      {/* Sticky bulk action bar */}
      {selectMode && selectedIds.length > 0 && (
        <div
          className="fixed left-0 right-0 z-50 px-4 md:px-6"
          style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}
        >
          <div className="mx-auto max-w-2xl flex items-center gap-3 rounded-2xl border border-destructive/30 bg-card p-3 shadow-lg">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">
                {selectedIds.length} {selectedIds.length === 1 ? 'person' : 'people'} picked
              </p>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Clear picks
              </button>
            </div>
            <Button
              variant="destructive"
              onClick={() => setShowBulkDelete(true)}
              className="shrink-0"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remove
            </Button>
          </div>
        </div>
      )}



      {/* Drawers and Dialogs */}
      <CreditBonusDrawer
        userId={selectedUserId}
        userName={selectedUserName}
        open={showCreditBonus}
        onOpenChange={setShowCreditBonus}
      />

      <SendDirectNotificationDrawer
        userId={selectedUserId}
        userName={selectedUserName}
        open={showDirectMessage}
        onOpenChange={setShowDirectMessage}
      />

      <ActivateMembershipDrawer
        userId={selectedUserId}
        userName={selectedUserName}
        open={showActivateMembership}
        onOpenChange={setShowActivateMembership}
      />

      <BanUserDialog
        open={showBanDialog}
        onOpenChange={setShowBanDialog}
        userName={selectedUserName}
        avatarUrl={selectedUserAvatar}
        onConfirm={handleConfirmBan}
        isLoading={isBanning}
      />

      <UnbanUserDialog
        open={showUnbanDialog}
        onOpenChange={setShowUnbanDialog}
        userName={selectedUserName}
        avatarUrl={selectedUserAvatar}
        bannedReason={selectedUserBannedReason}
        onConfirm={handleConfirmUnban}
        isLoading={isUnbanning}
      />

      <ExportPhoneNumbersDrawer
        open={showExportDrawer}
        onOpenChange={setShowExportDrawer}
      />

      <WipeUnactivatedDialog
        open={showWipeDialog}
        onOpenChange={setShowWipeDialog}
      />

      <BulkDeleteUsersDialog
        open={showBulkDelete}
        onOpenChange={setShowBulkDelete}
        targets={bulkTargets}
        onFinished={(deletedIds) => {
          setSelectedIds((prev) => prev.filter((id) => !deletedIds.includes(id)));
        }}
      />
    </div>
  );
}
