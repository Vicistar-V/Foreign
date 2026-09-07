import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Loader2,
  Inbox,
  UserCheck,
  Wallet,
  ChevronRight,
  CircleSlash,
  Copy,
  ExternalLink,
  ChevronUp,
} from 'lucide-react';
import { fmtDateTime } from '@/lib/formatLagos';
import {
  useAdminPaymentAttempts,
  useAdminPaymentAction,
  AdminPaymentAttempt,
} from '@/hooks/useAdminPaymentAttempts';
import { SimplePagination } from '@/components/ui/SimplePagination';
import { toast } from 'sonner';
import { triggerHaptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';

type FilterKey = 'all' | 'pending' | 'verified' | 'failed' | 'expired';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Waiting' },
  { key: 'verified', label: 'Done' },
  { key: 'failed', label: 'Failed' },
  { key: 'expired', label: 'Expired' },
];

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { cls: string; Icon: typeof Clock; label: string }> = {
    pending: { cls: 'bg-warning/10 text-warning', Icon: Clock, label: 'Waiting' },
    verified: { cls: 'bg-success/10 text-success', Icon: CheckCircle2, label: 'Done' },
    failed: { cls: 'bg-destructive/10 text-destructive', Icon: XCircle, label: 'Failed' },
    expired: { cls: 'bg-muted text-muted-foreground', Icon: CircleSlash, label: 'Expired' },
  };
  const v = map[status] ?? map.pending;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
        v.cls
      )}
    >
      <v.Icon className="h-3 w-3" />
      {v.label}
    </span>
  );
}

function ProviderChip({ provider }: { provider: string | null }) {
  if (!provider) return null;
  const label = provider.charAt(0).toUpperCase() + provider.slice(1);
  return (
    <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      {label}
    </span>
  );
}

export default function AdminDeposits() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<FilterKey>('pending');
  const [query, setQuery] = useState('');
  const [openAttempt, setOpenAttempt] = useState<AdminPaymentAttempt | null>(null);
  const [actionType, setActionType] = useState<'verify' | 'complete' | 'reject' | null>(null);
  const [reason, setReason] = useState('');

  const { data, isLoading, isFetching, refetch } = useAdminPaymentAttempts(page, filter);
  const paymentAction = useAdminPaymentAction();

  const attempts = useMemo(() => {
    const list = data?.attempts ?? [];
    if (!query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter(
      (a) =>
        a.user.full_name.toLowerCase().includes(q) ||
        a.tx_ref.toLowerCase().includes(q) ||
        (a.flutterwave_id || '').toLowerCase().includes(q)
    );
  }, [data?.attempts, query]);

  // Quick totals from current page (cheap, accurate for the loaded page)
  const totals = useMemo(() => {
    const list = data?.attempts ?? [];
    let waiting = 0,
      done = 0,
      failed = 0,
      expired = 0,
      sumDone = 0;
    for (const a of list) {
      if (a.status === 'pending') waiting++;
      else if (a.status === 'verified') {
        done++;
        sumDone += a.amount;
      } else if (a.status === 'failed') failed++;
      else if ((a.status as string) === 'expired') expired++;
    }
    return { waiting, done, failed, expired, sumDone };
  }, [data?.attempts]);

  const handleChangeFilter = (k: FilterKey) => {
    triggerHaptic('light');
    setFilter(k);
    setPage(1);
  };

  const confirmAction = async () => {
    if (!openAttempt || !actionType) return;
    await paymentAction.mutateAsync({
      attemptId: openAttempt.id,
      action: actionType,
      reason: reason || undefined,
    });
    setActionType(null);
    setReason('');
    setOpenAttempt(null);
  };

  const copy = (s: string) => {
    navigator.clipboard.writeText(s);
    toast.success('Copied');
    triggerHaptic('light');
  };

  return (
    <div className="pb-24 md:pb-6">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-background/95 border-b border-border">
        <div className="px-4 md:px-6 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-base font-bold leading-tight">Deposits</h1>
            <p className="text-[11px] text-muted-foreground">
              {data ? `${data.pagination.total.toLocaleString()} total` : 'Loading…'}
              {isFetching && ' · refreshing…'}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => refetch()}
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          </Button>
        </div>

        {/* Filter chips with counts */}
        <div className="px-4 md:px-6 pb-3 flex gap-1.5 overflow-x-auto scrollbar-none">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            const count =
              f.key === 'pending'
                ? totals.waiting
                : f.key === 'verified'
                  ? totals.done
                  : f.key === 'failed'
                    ? totals.failed
                    : f.key === 'expired'
                      ? totals.expired
                      : data?.pagination.total ?? 0;
            return (
              <button
                key={f.key}
                onClick={() => handleChangeFilter(f.key)}
                className={cn(
                  'shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                )}
              >
                {f.label}
                {count > 0 && (
                  <span
                    className={cn(
                      'tabular-nums rounded-full px-1.5 py-0 text-[10px]',
                      active ? 'bg-primary-foreground/20' : 'bg-background'
                    )}
                  >
                    {count.toLocaleString()}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 md:px-6 pt-3 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or reference…"
            className="pl-9 h-10"
          />
        </div>

        {/* List */}
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-3 py-3 border-b border-border last:border-0"
              >
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))
          ) : attempts.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Inbox className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm font-medium">Nothing here</p>
              <p className="text-xs text-muted-foreground">
                {query ? 'No matches for your search' : `No ${filter === 'all' ? '' : filter} payments`}
              </p>
            </div>
          ) : (
            attempts.map((a) => (
              <button
                key={a.id}
                onClick={() => {
                  triggerHaptic('light');
                  setOpenAttempt(a);
                }}
                className="w-full flex items-center gap-3 px-3 py-3 border-b border-border last:border-0 hover:bg-muted/40 active:bg-muted/60 transition-colors text-left"
              >
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarImage src={a.user.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">
                    {a.user.full_name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold truncate">{a.user.full_name}</p>
                    {a.purpose === 'membership' ? (
                      <UserCheck className="h-3 w-3 text-primary shrink-0" />
                    ) : (
                      <Wallet className="h-3 w-3 text-info shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <StatusPill status={a.status} />
                    <ProviderChip provider={a.provider} />
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      · {timeAgo(a.created_at)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end shrink-0">
                  <span className="text-sm font-bold tabular-nums">
                    ₦{a.amount.toLocaleString()}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                </div>
              </button>
            ))
          )}
        </div>

        {/* Pagination */}
        {data && data.pagination.total > data.pagination.limit && (
          <SimplePagination
            currentPage={page}
            totalPages={Math.ceil(data.pagination.total / data.pagination.limit)}
            totalItems={data.pagination.total}
            itemsPerPage={data.pagination.limit}
            onPageChange={setPage}
          />
        )}
      </div>

      {/* Detail Drawer */}
      <Drawer open={!!openAttempt} onOpenChange={(o) => !o && setOpenAttempt(null)}>
        <DrawerContent className="max-h-[90dvh]">
          {openAttempt && (
            <>
              <DrawerHeader className="text-left">
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={openAttempt.user.avatar_url || undefined} />
                    <AvatarFallback>{openAttempt.user.full_name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <DrawerTitle className="text-base truncate">
                      {openAttempt.user.full_name}
                    </DrawerTitle>
                    <DrawerDescription className="flex items-center gap-2 mt-1">
                      <StatusPill status={openAttempt.status} />
                      <ProviderChip provider={openAttempt.provider} />
                    </DrawerDescription>
                  </div>
                </div>
              </DrawerHeader>

              <div className="px-4 pb-4 space-y-3 overflow-y-auto">
                {/* Amount */}
                <div className="rounded-xl bg-muted p-4 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Amount
                  </p>
                  <p className="text-3xl font-bold tabular-nums">
                    ₦{openAttempt.amount.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {openAttempt.purpose === 'membership' ? 'Activation' : 'Wallet top-up'}
                  </p>
                </div>

                {/* Metadata grid */}
                <div className="rounded-xl border border-border divide-y divide-border">
                  <Row label="Started" value={fmtDateTime(openAttempt.created_at)} />
                  {openAttempt.verified_at && (
                    <Row label="Verified" value={fmtDateTime(openAttempt.verified_at)} />
                  )}
                  <Row
                    label="Reference"
                    value={openAttempt.tx_ref}
                    mono
                    onCopy={() => copy(openAttempt.tx_ref)}
                  />
                  {openAttempt.flutterwave_id && (
                    <Row
                      label="Gateway ID"
                      value={openAttempt.flutterwave_id}
                      mono
                      onCopy={() => copy(openAttempt.flutterwave_id!)}
                    />
                  )}
                </div>

                {/* Open user */}
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => {
                    setOpenAttempt(null);
                    navigate(`/admin/users/${openAttempt.user_id}?from=deposits`);
                  }}
                >
                  Open user profile
                  <ExternalLink className="h-4 w-4" />
                </Button>

                {/* Actions */}
                <div className="grid grid-cols-1 gap-2 pt-1">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setActionType('verify');
                      setReason('');
                    }}
                    disabled={paymentAction.isPending}
                  >
                    <Search className="h-4 w-4 mr-2" />
                    Re-check with gateway
                  </Button>

                  {openAttempt.status === 'pending' && (
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        className="bg-success text-success-foreground hover:bg-success/90"
                        onClick={() => {
                          setActionType('complete');
                          setReason('');
                        }}
                        disabled={paymentAction.isPending}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => {
                          setActionType('reject');
                          setReason('');
                        }}
                        disabled={paymentAction.isPending}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Decline
                      </Button>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setOpenAttempt(null)}
                  className="w-full text-xs text-muted-foreground py-2 inline-flex items-center justify-center gap-1"
                >
                  <ChevronUp className="h-3 w-3" /> Close
                </button>
              </div>
            </>
          )}
        </DrawerContent>
      </Drawer>

      {/* Confirm dialog */}
      <AlertDialog
        open={!!actionType}
        onOpenChange={(o) => {
          if (!o) {
            setActionType(null);
            setReason('');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === 'verify' && 'Re-check with gateway?'}
              {actionType === 'complete' && 'Manually approve this payment?'}
              {actionType === 'reject' && 'Decline this payment?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === 'verify' &&
                'We will ask the payment gateway for the latest status. If it succeeded, the user will be credited automatically.'}
              {actionType === 'complete' &&
                `${openAttempt?.user.full_name} will be credited immediately. Only do this if you've confirmed the money actually arrived.`}
              {actionType === 'reject' &&
                `This marks the payment as failed. ${openAttempt?.user.full_name} will not receive any money.`}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {(actionType === 'reject' || actionType === 'complete') && (
            <div className="pt-1">
              <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
                Note (optional)
              </label>
              <Textarea
                placeholder="E.g., confirmed via bank statement"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAction}
              disabled={paymentAction.isPending}
              className={
                actionType === 'reject'
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : ''
              }
            >
              {paymentAction.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  onCopy,
}: {
  label: string;
  value: string;
  mono?: boolean;
  onCopy?: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-3 py-2.5">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground pt-0.5">
        {label}
      </span>
      <div className="flex items-center gap-1.5 min-w-0">
        <span
          className={cn(
            'text-xs text-right truncate min-w-0',
            mono && 'font-mono tabular-nums'
          )}
        >
          {value}
        </span>
        {onCopy && (
          <button
            onClick={onCopy}
            className="p-1 rounded hover:bg-muted text-muted-foreground"
            aria-label="Copy"
          >
            <Copy className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}
