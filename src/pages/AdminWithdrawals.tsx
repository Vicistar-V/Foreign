import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
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
  ArrowDownCircle,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  Loader2,
  AlertTriangle,
  Hand,
  Copy,
  Check,
  User as UserIcon,
  Hash,
  Banknote,
  ClipboardCopy,
} from 'lucide-react';
import { fmtDateTime, fmtTimeAgo } from '@/lib/formatLagos';
import { useAdminWithdrawals, useWithdrawalAction, AdminWithdrawal } from '@/hooks/useAdminWithdrawals';
import { SimplePagination } from '@/components/ui/SimplePagination';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import { AvatarPreviewDrawer } from '@/components/results/AvatarPreviewDrawer';
import { toast } from 'sonner';
import { triggerHaptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';

type ActionType = 'verify' | 'refund' | 'mark_complete' | 'manual_approve' | 'manual_decline';

/* ------------------------------------------------------------------ */
/*  Copy field — large tap target, clear label, copy-to-clipboard      */
/* ------------------------------------------------------------------ */
function CopyField({
  label,
  value,
  display,
  mono = true,
  icon: Icon,
  highlight = false,
}: {
  label: string;
  value: string;
  display?: string;
  mono?: boolean;
  icon: React.ElementType;
  highlight?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      triggerHaptic('light');
      toast.success(`${label} copied`, { description: value });
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error('Copy failed');
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        'w-full text-left rounded-xl border p-3 flex items-center gap-3 active:scale-[0.99] transition-all',
        highlight
          ? 'bg-primary/10 border-primary/30 hover:bg-primary/15'
          : 'bg-muted/40 border-border hover:bg-muted/70',
      )}
    >
      <div
        className={cn(
          'h-9 w-9 rounded-lg flex items-center justify-center shrink-0',
          highlight ? 'bg-primary/20 text-primary' : 'bg-background text-muted-foreground',
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          {label}
        </p>
        <p
          className={cn(
            'truncate text-sm font-semibold',
            mono && 'tabular-nums tracking-wide',
            highlight && 'text-primary text-base',
          )}
        >
          {display ?? value}
        </p>
      </div>
      <div
        className={cn(
          'h-8 w-8 rounded-md flex items-center justify-center shrink-0',
          copied ? 'bg-success/15 text-success' : 'bg-background text-muted-foreground',
        )}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-3.5 w-3.5" />}
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */
export default function AdminWithdrawals() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<AdminWithdrawal | null>(null);
  const [actionType, setActionType] = useState<ActionType | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [previewUser, setPreviewUser] = useState<{ name: string; avatarUrl: string | null } | null>(null);

  const { data, isLoading, refetch, isFetching } = useAdminWithdrawals(status, page);
  const withdrawalAction = useWithdrawalAction();
  const { data: config } = usePlatformConfig();

  const isManualMode = config?.manual_withdrawal_mode ?? false;

  const handleAction = (w: AdminWithdrawal, action: ActionType) => {
    setSelectedWithdrawal(w);
    setActionType(action);
    if (action !== 'refund' && action !== 'manual_decline') setRefundReason('');
  };

  const confirmAction = async () => {
    if (!selectedWithdrawal || !actionType) return;
    await withdrawalAction.mutateAsync({
      transactionId: selectedWithdrawal.id,
      action: actionType,
      reason: refundReason || undefined,
    });
    setSelectedWithdrawal(null);
    setActionType(null);
    setRefundReason('');
  };

  const statusPill = (txStatus: string, isManual?: boolean) => {
    if (txStatus === 'pending' && isManual) {
      return (
        <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 gap-1">
          <Hand className="w-3 h-3" />
          Pay this person
        </Badge>
      );
    }
    switch (txStatus) {
      case 'pending':
        return (
          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 gap-1">
            <Clock className="w-3 h-3" />
            Sending…
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="outline" className="bg-success/10 text-success border-success/30 gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Paid
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 gap-1">
            <XCircle className="w-3 h-3" />
            Failed
          </Badge>
        );
      default:
        return <Badge variant="outline">{txStatus}</Badge>;
    }
  };

  /* ---------------- summary counters ---------------- */
  const totals = data?.withdrawals.reduce(
    (acc, w) => {
      const amt = Math.abs(w.amount);
      acc.count += 1;
      if (w.status === 'pending') {
        acc.pendingCount += 1;
        acc.pendingNaira += w.transfer_amount || amt;
      }
      return acc;
    },
    { count: 0, pendingCount: 0, pendingNaira: 0 },
  );

  const copyAllForPayment = async (w: AdminWithdrawal) => {
    if (!w.bank_account) {
      toast.error('No bank account on file');
      return;
    }
    const lines = [
      `Name:  ${w.bank_account.account_name}`,
      `Bank:  ${w.bank_account.bank_name}`,
      `Acct:  ${w.bank_account.account_number}`,
      `Send:  ₦${(w.transfer_amount || Math.abs(w.amount)).toLocaleString()}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(lines);
      triggerHaptic('medium');
      toast.success('All payment info copied', { description: 'Paste it into your bank app' });
    } catch {
      toast.error('Copy failed');
    }
  };

  return (
    <div className="p-3 md:p-6 space-y-4 pb-24 md:pb-6">
      {/* ============== Header ============== */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <ArrowDownCircle className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold leading-tight">Pay People Out</h1>
            <p className="text-[11px] text-muted-foreground truncate">
              People asking to take their money home
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 shrink-0"
          onClick={() => refetch()}
          disabled={isFetching}
          aria-label="Refresh"
        >
          <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
        </Button>
      </div>

      {/* ============== Summary strip ============== */}
      {!isLoading && totals && (
        <div className="grid grid-cols-2 gap-2">
          <Card className="bg-warning/5 border-warning/20">
            <CardContent className="p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Waiting on you
              </p>
              <p className="text-xl font-bold text-warning tabular-nums">
                {totals.pendingCount.toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground tabular-nums">
                {totals.pendingCount === 1 ? 'person' : 'people'}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Total to send
              </p>
              <p className="text-xl font-bold text-primary tabular-nums">
                ₦{totals.pendingNaira.toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground">on this page</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ============== Manual mode banner ============== */}
      {isManualMode && (
        <div className="p-3 rounded-xl bg-warning/10 border border-warning/30 flex items-start gap-3">
          <div className="h-8 w-8 rounded-lg bg-warning/20 flex items-center justify-center shrink-0">
            <Hand className="h-4 w-4 text-warning" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-warning leading-tight">
              You are paying everyone by hand
            </p>
            <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
              Tap <strong>Copy Payment Info</strong>, paste it into your bank app, send the money,
              then come back and tap <strong>I Sent It</strong>.
            </p>
          </div>
        </div>
      )}

      {/* ============== Filter tabs ============== */}
      <Tabs value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
        <TabsList className="grid grid-cols-4 w-full h-10">
          <TabsTrigger value="pending" className="text-xs">Waiting</TabsTrigger>
          <TabsTrigger value="completed" className="text-xs">Paid</TabsTrigger>
          <TabsTrigger value="failed" className="text-xs">Failed</TabsTrigger>
          <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* ============== List ============== */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-6 w-24" />
                  </div>
                </div>
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
              </CardContent>
            </Card>
          ))
        ) : data?.withdrawals.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="h-14 w-14 rounded-full bg-success/15 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-7 w-7 text-success" />
              </div>
              <h3 className="font-semibold text-base">All caught up</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Nobody is waiting for a payout right now.
              </p>
            </CardContent>
          </Card>
        ) : (
          data?.withdrawals.map((w) => {
            const isManualW = w.metadata?.manual_mode === true;
            const fullRefundAmount = Math.abs(w.amount);
            const sendAmount = w.transfer_amount || fullRefundAmount;
            const acct = w.bank_account;
            const isPending = w.status === 'pending';

            return (
              <Card
                key={w.id}
                className={cn(
                  'overflow-hidden',
                  isManualW && isPending && 'border-warning/40 ring-1 ring-warning/20',
                )}
              >
                <CardContent className="p-4 space-y-3">
                  {/* ----- Top row: user + status ----- */}
                  <div className="flex items-start gap-3">
                    <Avatar
                      className="h-11 w-11 cursor-pointer ring-2 ring-border hover:ring-primary/50 transition-all shrink-0"
                      onClick={() =>
                        setPreviewUser({ name: w.user.full_name, avatarUrl: w.user.avatar_url })
                      }
                    >
                      <AvatarImage src={w.user.avatar_url || undefined} />
                      <AvatarFallback>{w.user.full_name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <button
                        onClick={() => navigate(`/admin/users/${w.user_id}?from=withdrawals`)}
                        className="font-semibold text-sm truncate hover:text-primary hover:underline transition-colors text-left block w-full"
                      >
                        {w.user.full_name}
                      </button>
                      <p className="text-[11px] text-muted-foreground tabular-nums">
                        {fmtTimeAgo(w.created_at)} · {fmtDateTime(w.created_at)}
                      </p>
                    </div>
                    {statusPill(w.status, isManualW)}
                  </div>

                  {/* ----- Payment details — tap-to-copy ----- */}
                  {acct ? (
                    <div className="space-y-2">
                      <CopyField
                        label="Send this amount"
                        icon={Banknote}
                        value={String(sendAmount)}
                        display={`₦${sendAmount.toLocaleString()}`}
                        highlight
                      />
                      <CopyField
                        label="Account number"
                        icon={Hash}
                        value={acct.account_number}
                      />
                      <CopyField
                        label="Account name"
                        icon={UserIcon}
                        value={acct.account_name}
                        mono={false}
                      />
                      <CopyField
                        label="Bank"
                        icon={Building2}
                        value={acct.bank_name}
                        mono={false}
                      />

                      {/* Copy-all shortcut */}
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full gap-2 h-10"
                        onClick={() => copyAllForPayment(w)}
                      >
                        <ClipboardCopy className="h-4 w-4" />
                        Copy all payment info
                      </Button>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                      <p className="text-xs text-destructive">
                        No bank account on file for this user.
                      </p>
                    </div>
                  )}

                  {/* ----- Fee breakdown ----- */}
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums px-1">
                    <span>Asked for ₦{fullRefundAmount.toLocaleString()}</span>
                    <span>·</span>
                    <span>Fee ₦{w.fee.toLocaleString()}</span>
                    <span>·</span>
                    <span className="text-foreground font-semibold">
                      You send ₦{sendAmount.toLocaleString()}
                    </span>
                  </div>

                  {/* ----- Failure reason ----- */}
                  {w.failure_reason && (
                    <div className="p-3 bg-destructive/10 rounded-xl border border-destructive/20">
                      <p className="text-[11px] uppercase tracking-wider text-destructive font-semibold mb-1">
                        Bank said
                      </p>
                      <p className="text-sm text-destructive break-words">{w.failure_reason}</p>
                    </div>
                  )}

                  {/* ----- Actions ----- */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {isManualW && isPending ? (
                      <>
                        <Button
                          size="sm"
                          className="bg-success text-success-foreground hover:bg-success/90 h-11"
                          onClick={() => handleAction(w, 'manual_approve')}
                          disabled={withdrawalAction.isPending}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          I Sent It
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive border-destructive/30 hover:bg-destructive/10 h-11"
                          onClick={() => handleAction(w, 'manual_decline')}
                          disabled={withdrawalAction.isPending}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Refund
                        </Button>
                      </>
                    ) : !isManualW ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-11"
                          onClick={() => handleAction(w, 'verify')}
                          disabled={withdrawalAction.isPending}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Check status
                        </Button>
                        {isPending && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-success border-success/30 hover:bg-success/10 h-11"
                            onClick={() => handleAction(w, 'mark_complete')}
                            disabled={withdrawalAction.isPending}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Mark as sent
                          </Button>
                        )}
                      </>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* ============== Pagination ============== */}
      {data && data.pagination.total > data.pagination.limit && (
        <SimplePagination
          currentPage={page}
          totalPages={Math.ceil(data.pagination.total / data.pagination.limit)}
          totalItems={data.pagination.total}
          itemsPerPage={data.pagination.limit}
          onPageChange={setPage}
        />
      )}

      {/* ============== Confirm dialog ============== */}
      <AlertDialog
        open={!!actionType}
        onOpenChange={() => {
          setActionType(null);
          setSelectedWithdrawal(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === 'verify' && 'Check with the bank'}
              {actionType === 'refund' && 'Send money back'}
              {actionType === 'mark_complete' && 'Mark as paid'}
              {actionType === 'manual_approve' && 'Confirm you sent the money'}
              {actionType === 'manual_decline' && 'Decline and refund'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === 'verify' &&
                'We will ask Flutterwave for the latest status of this transfer.'}
              {actionType === 'refund' &&
                `This puts ₦${selectedWithdrawal ? Math.abs(selectedWithdrawal.amount).toLocaleString() : 0} back into the person's earnings wallet (fee included).`}
              {actionType === 'mark_complete' &&
                'Only do this if the money already left your bank but the system did not update.'}
              {actionType === 'manual_approve' &&
                'Only tap this AFTER you have actually sent the money from your bank app.'}
              {actionType === 'manual_decline' &&
                `This puts ₦${selectedWithdrawal ? Math.abs(selectedWithdrawal.amount).toLocaleString() : 0} back into the person's earnings wallet (fee included).`}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {(actionType === 'refund' || actionType === 'manual_decline') && (
            <div className="py-2">
              <label className="text-sm font-medium mb-2 block">
                Reason (so we remember why)
              </label>
              <Textarea
                placeholder="E.g., Wrong account number, person asked to cancel…"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
              />
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAction}
              disabled={withdrawalAction.isPending}
              className={cn(
                (actionType === 'refund' || actionType === 'manual_decline') &&
                  'bg-destructive text-destructive-foreground hover:bg-destructive/90',
                actionType === 'manual_approve' &&
                  'bg-success text-success-foreground hover:bg-success/90',
              )}
            >
              {withdrawalAction.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AvatarPreviewDrawer
        isOpen={!!previewUser}
        onClose={() => setPreviewUser(null)}
        name={previewUser?.name || ''}
        avatarUrl={previewUser?.avatarUrl}
      />
    </div>
  );
}
