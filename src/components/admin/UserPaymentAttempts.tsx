import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  CreditCard,
  UserCheck,
  Wallet,
  ChevronDown,
} from 'lucide-react';
import { fmtDateTime } from '@/lib/formatLagos';
import { useAdminPaymentAttempts, useAdminPaymentAction, AdminPaymentAttempt } from '@/hooks/useAdminPaymentAttempts';

interface UserPaymentAttemptsProps {
  userId: string;
}

type StatusFilter = 'all' | 'pending' | 'verified' | 'failed';

export const UserPaymentAttempts = ({ userId }: UserPaymentAttemptsProps) => {
  const [selectedAttempt, setSelectedAttempt] = useState<AdminPaymentAttempt | null>(null);
  const [actionType, setActionType] = useState<'verify' | 'complete' | 'reject' | null>(null);
  const [reason, setReason] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const { data, isLoading } = useAdminPaymentAttempts(page, statusFilter, userId, pageSize);
  const paymentAction = useAdminPaymentAction();

  const attempts = data?.attempts || [];
  const total = data?.pagination?.total || 0;
  const hasMore = data?.pagination?.hasMore || false;

  const handleAction = (attempt: AdminPaymentAttempt, action: 'verify' | 'complete' | 'reject') => {
    setSelectedAttempt(attempt);
    setActionType(action);
    setReason('');
  };

  const confirmAction = async () => {
    if (!selectedAttempt || !actionType) return;
    await paymentAction.mutateAsync({
      attemptId: selectedAttempt.id,
      action: actionType,
      reason: reason || undefined,
    });
    setSelectedAttempt(null);
    setActionType(null);
    setReason('');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-[10px] h-5"><Clock className="w-2.5 h-2.5 mr-1" />Waiting</Badge>;
      case 'verified':
        return <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-[10px] h-5"><CheckCircle2 className="w-2.5 h-2.5 mr-1" />Done</Badge>;
      case 'failed':
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-[10px] h-5"><XCircle className="w-2.5 h-2.5 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px] h-5">{status}</Badge>;
    }
  };

  const getProviderBadge = (provider: string | null) => {
    const label = (provider || 'unknown').toLowerCase();
    const styles: Record<string, string> = {
      paystack: 'bg-info/10 text-info border-info/20',
      flutterwave: 'bg-accent-orange/10 text-accent-orange border-accent-orange/20',
      moniepoint: 'bg-primary/10 text-primary border-primary/20',
      unknown: 'bg-muted text-muted-foreground border-border',
    };
    return (
      <Badge variant="outline" className={`${styles[label] || styles.unknown} text-[10px] h-5`}>
        {label.charAt(0).toUpperCase() + label.slice(1)}
      </Badge>
    );
  };

  const getPurposeIcon = (purpose: string) =>
    purpose === 'membership' ? <UserCheck className="h-3.5 w-3.5 text-primary" /> : <Wallet className="h-3.5 w-3.5 text-info" />;

  const getPurposeLabel = (purpose: string) => (purpose === 'membership' ? 'Activation' : 'Add Money');

  return (
    <div className="space-y-3">
      {/* Filter tabs */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider tabular-nums">
          Payment History ({total.toLocaleString()})
        </p>
      </div>
      <Tabs value={statusFilter} onValueChange={(v) => { setStatusFilter(v as StatusFilter); setPage(1); }}>
        <TabsList className="grid grid-cols-4 w-full h-9">
          <TabsTrigger value="all" className="text-[11px]">All</TabsTrigger>
          <TabsTrigger value="pending" className="text-[11px]">Waiting</TabsTrigger>
          <TabsTrigger value="verified" className="text-[11px]">Done</TabsTrigger>
          <TabsTrigger value="failed" className="text-[11px]">Failed</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Card key={i}><CardContent className="p-3"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : attempts.length === 0 ? (
        <div className="text-center py-10 bg-muted/20 rounded-xl border border-dashed">
          <CreditCard className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No money records found for this person yet</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {attempts.map((attempt) => (
              <Card key={attempt.id} className="overflow-hidden border-border/60">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-2">
                        <div className="flex items-center gap-1 bg-muted/50 px-1.5 py-0.5 rounded text-[11px] font-medium uppercase tracking-tight">
                          {getPurposeIcon(attempt.purpose)}
                          {getPurposeLabel(attempt.purpose)}
                        </div>
                        {getStatusBadge(attempt.status)}
                        {getProviderBadge(attempt.provider)}
                      </div>
                      <div className="flex items-baseline gap-2 mb-1">
                        <p className="text-xl font-bold text-success tabular-nums">₦{attempt.amount.toLocaleString()}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[11px] text-muted-foreground tabular-nums">
                          Started {fmtDateTime(attempt.created_at)}
                        </p>
                        {attempt.verified_at && (
                          <p className="text-[11px] text-success font-medium tabular-nums">
                            Confirmed {fmtDateTime(attempt.verified_at)}
                          </p>
                        )}
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <code className="text-[10px] text-muted-foreground/80 bg-muted/30 px-1 rounded tabular-nums truncate max-w-[200px]">
                            {attempt.tx_ref}
                          </code>
                        </div>
                      </div>
                    </div>
                  </div>

                  {attempt.status === 'pending' && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleAction(attempt, 'verify')} disabled={paymentAction.isPending} className="flex-1 h-8 text-[11px] font-bold uppercase tracking-wider">
                        <Search className="h-3 w-3 mr-1.5" />Verify
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1 h-8 text-[11px] font-bold uppercase tracking-wider text-success border-success/30 hover:bg-success/10" onClick={() => handleAction(attempt, 'complete')} disabled={paymentAction.isPending}>
                        <CheckCircle2 className="h-3 w-3 mr-1.5" />Approve Payment
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1 h-8 text-[11px] font-bold uppercase tracking-wider text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => handleAction(attempt, 'reject')} disabled={paymentAction.isPending}>
                        <XCircle className="h-3 w-3 mr-1.5" />Reject
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="space-y-2 mt-4">
            {hasMore && (
              <Button variant="outline" size="sm" className="w-full h-10 font-bold uppercase tracking-widest text-[10px]" onClick={() => setPage((p) => p + 1)}>
                <ChevronDown className="h-3.5 w-3.5 mr-2" />Show more history
              </Button>
            )}
            {page > 1 && (
              <Button variant="ghost" size="sm" className="w-full text-[10px] uppercase tracking-widest font-bold text-muted-foreground" onClick={() => setPage(1)}>
                Back to newest
              </Button>
            )}
          </div>
        </>
      )}

      <AlertDialog open={!!actionType} onOpenChange={() => { setActionType(null); setSelectedAttempt(null); }}>
        <AlertDialogContent className="max-w-[90vw] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold">
              {actionType === 'verify' && 'Check this payment'}
              {actionType === 'complete' && 'Approve Payment'}
              {actionType === 'reject' && 'Reject Payment'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              {actionType === 'verify' && 'This asks the payment company if money landed, then finishes it up automatically.'}
              {actionType === 'complete' && 'This will manually approve the payment and credit the user. Only do this if you confirmed payment was received.'}
              {actionType === 'reject' && 'This will mark the payment as failed. The user will not receive any funds.'}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {(actionType === 'reject' || actionType === 'complete') && (
            <div className="py-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 block">Reason (optional)</label>
              <Textarea 
                placeholder="E.g., Payment confirmed via bank statement..." 
                value={reason} 
                onChange={(e) => setReason(e.target.value)}
                className="text-sm min-h-[80px]"
              />
            </div>
          )}

          <AlertDialogFooter className="flex-row gap-2">
            <AlertDialogCancel className="flex-1 mt-0">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAction} disabled={paymentAction.isPending} className={`flex-1 ${actionType === 'reject' ? 'bg-destructive hover:bg-destructive/90' : 'bg-primary'}`}>
              {paymentAction.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
