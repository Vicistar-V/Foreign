import { useState } from 'react';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { 
  Send, 
  RefreshCw, 
  Search, 
  ChevronDown, 
  ChevronUp,
  Clock,
  User,
  Hash,
  Wallet,
  Building2,
  AlertCircle,
  CheckCircle,
  Loader2,
  History,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useFlutterwaveAuditLog, type FlutterwaveAuditLog as AuditLogType } from '@/hooks/useFlutterwaveAuditLog';
import { usePaystackAuditLog } from '@/hooks/usePaystackAuditLog';

interface FlutterwaveAuditLogProps {
  fromDate?: string;
  toDate?: string;
  /** Which provider's audit trail to show. Defaults to flutterwave. */
  provider?: 'flutterwave' | 'paystack';
}

// Get icon and color based on action type
const getActionConfig = (alertType: string) => {
  switch (alertType) {
    case 'admin_flutterwave_transfer':
    case 'admin_paystack_transfer':
      return {
        icon: Send,
        label: 'Money Sent',
        bgColor: 'bg-emerald-500/10',
        textColor: 'text-emerald-600',
        borderColor: 'border-emerald-500/30',
      };
    case 'admin_transfer_retry':
      return {
        icon: RefreshCw,
        label: 'Transfer Retried',
        bgColor: 'bg-amber-500/10',
        textColor: 'text-amber-600',
        borderColor: 'border-amber-500/30',
      };
    case 'admin_transfer_status_check':
    case 'admin_paystack_status_check':
      return {
        icon: Search,
        label: 'Status Checked',
        bgColor: 'bg-info/10',
        textColor: 'text-info',
        borderColor: 'border-info/30',
      };
    default:
      return {
        icon: AlertCircle,
        label: 'Action',
        bgColor: 'bg-muted',
        textColor: 'text-muted-foreground',
        borderColor: 'border-border',
      };
  }
};

// Format time in a friendly way
const formatTimeAgo = (dateString: string) => {
  const date = parseISO(dateString);
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  
  if (diffInHours < 24) {
    return formatDistanceToNow(date, { addSuffix: true });
  } else if (diffInHours < 48) {
    return `Yesterday, ${format(date, 'h:mm a')}`;
  } else {
    return format(date, 'MMM d, h:mm a');
  }
};

// Get status badge color
const getStatusColor = (status?: string) => {
  if (!status) return 'bg-muted text-muted-foreground';
  const s = status.toLowerCase();
  if (s === 'successful' || s === 'success') return 'bg-emerald-500/10 text-emerald-600';
  if (s === 'failed' || s === 'error') return 'bg-destructive/10 text-destructive';
  if (s === 'pending' || s === 'new' || s === 'queued') return 'bg-amber-500/10 text-amber-600';
  return 'bg-muted text-muted-foreground';
};

// Single audit log item component
const AuditLogItem = ({ log }: { log: AuditLogType }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = getActionConfig(log.alert_type);
  const Icon = config.icon;
  const metadata = log.metadata || {};
  
  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div 
        className={`border rounded-xl p-3 ${config.borderColor} ${config.bgColor} transition-all`}
      >
        {/* Header Row */}
        <CollapsibleTrigger asChild>
          <button className="w-full text-left">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 flex-1 min-w-0">
                <div className={`p-1.5 rounded-lg ${config.bgColor}`}>
                  <Icon className={`w-4 h-4 ${config.textColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-medium text-sm ${config.textColor}`}>
                      {config.label}
                    </span>
                    {metadata.status && (
                      <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${getStatusColor(metadata.status)}`}>
                        {metadata.status}
                      </Badge>
                    )}
                  </div>
                  
                  {/* Amount for transfers */}
                  {metadata.amount && (
                    <p className="text-base font-semibold mt-0.5">
                      ₦{metadata.amount.toLocaleString()}
                    </p>
                  )}
                  
                  {/* Account info */}
                  {metadata.account_number && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {metadata.account_number} • {metadata.bank_name || metadata.bank_code}
                    </p>
                  )}
                  
                  {/* Transfer ID for retry/status checks */}
                  {!metadata.account_number && metadata.transfer_id && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Transfer ID: {metadata.transfer_id}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {formatTimeAgo(log.created_at)}
                </span>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </div>
            </div>
          </button>
        </CollapsibleTrigger>
        
        {/* Expanded Details */}
        <CollapsibleContent className="mt-3">
          <div className="border-t border-border/50 pt-3 space-y-2">
            {/* Admin */}
            <div className="flex items-center gap-2 text-xs">
              <User className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Admin:</span>
              <span className="font-medium">{log.admin_name}</span>
            </div>
            
            {/* Reference */}
            {metadata.reference && (
              <div className="flex items-center gap-2 text-xs">
                <Hash className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Reference:</span>
                <span className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">
                  {metadata.reference}
                </span>
              </div>
            )}
            
            {/* Flutterwave ID */}
            {metadata.flutterwave_id && (
              <div className="flex items-center gap-2 text-xs">
                <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Flutterwave ID:</span>
                <span className="font-medium">{metadata.flutterwave_id}</span>
              </div>
            )}
            
            {/* Transfer ID */}
            {metadata.transfer_id && (
              <div className="flex items-center gap-2 text-xs">
                <Hash className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Transfer ID:</span>
                <span className="font-medium">{metadata.transfer_id}</span>
              </div>
            )}
            
            {/* Narration */}
            {metadata.narration && (
              <div className="flex items-start gap-2 text-xs">
                <Building2 className="w-3.5 h-3.5 text-muted-foreground mt-0.5" />
                <span className="text-muted-foreground">Note:</span>
                <span className="flex-1">{metadata.narration}</span>
              </div>
            )}
            
            {/* Exact Time */}
            <div className="flex items-center gap-2 text-xs">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Time:</span>
              <span>{format(parseISO(log.created_at), 'MMM d, yyyy • h:mm:ss a')}</span>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

// Loading skeleton
const AuditLogSkeleton = () => (
  <div className="space-y-3">
    {[1, 2, 3].map((i) => (
      <div key={i} className="border rounded-xl p-3">
        <div className="flex items-start gap-3">
          <Skeleton className="w-8 h-8 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    ))}
  </div>
);

// Empty state
const EmptyState = ({ provider }: { provider: 'flutterwave' | 'paystack' }) => (
  <div className="text-center py-8 px-4">
    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
      <History className="w-6 h-6 text-muted-foreground" />
    </div>
    <p className="text-sm font-medium text-muted-foreground">No activity yet</p>
    <p className="text-xs text-muted-foreground mt-1">
      Your {provider === 'paystack' ? 'Paystack' : 'Flutterwave'} actions will appear here
    </p>
  </div>
);

export const FlutterwaveAuditLog = ({ fromDate, toDate, provider = 'flutterwave' }: FlutterwaveAuditLogProps) => {
  const [showAll, setShowAll] = useState(false);
  const limit = showAll ? 50 : 5;

  const flw = useFlutterwaveAuditLog({ limit, offset: 0, fromDate, toDate });
  const ps = usePaystackAuditLog({ limit, offset: 0, fromDate, toDate });
  const { data, isLoading, isFetching, refetch } = provider === 'paystack' ? ps : flw;
  
  const logs = data?.logs || [];
  const total = data?.total || 0;
  const hasMore = logs.length < total;
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />
            Your Activity
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-7 px-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        {total > 0 && (
          <p className="text-xs text-muted-foreground">
            Showing {logs.length.toLocaleString()} of {total.toLocaleString()} actions
          </p>
        )}
      </CardHeader>
      
      <CardContent className="space-y-3">
        {isLoading ? (
          <AuditLogSkeleton />
        ) : logs.length === 0 ? (
          <EmptyState provider={provider} />
        ) : (
          <>
            {logs.map((log) => (
              <AuditLogItem key={log.id} log={log} />
            ))}
            
            {/* Show More/Less Button */}
            {(hasMore || showAll) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAll(!showAll)}
                className="w-full"
              >
                {showAll ? (
                  <>
                    <ChevronUp className="w-4 h-4 mr-1.5" />
                    Show Less
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4 mr-1.5" />
                    Show More ({total - logs.length} more)
                  </>
                )}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
