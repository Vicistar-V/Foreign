import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  FileText, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  ChevronDown,
  Search,
  Bell,
  Webhook,
  Eye,
  Copy,
  X
} from 'lucide-react';
import { fmtDateTime, fmtDateTimeLong } from '@/lib/formatLagos';
import { useEffect } from 'react';
import { useSystemLogs, useAcknowledgeAlert, WebhookLog, SystemAlert } from '@/hooks/useSystemLogs';
import { SimplePagination } from '@/components/ui/SimplePagination';
import { toast } from 'sonner';

export default function AdminLogs() {
  const [logType, setLogType] = useState<'webhooks' | 'alerts'>('webhooks');
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading, refetch } = useSystemLogs(logType, page, search);
  const acknowledgeAlert = useAcknowledgeAlert();

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedLogs(newExpanded);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Badge variant="destructive" className="tabular-nums"><AlertTriangle className="w-3 h-3 mr-1" />Critical</Badge>;
      case 'warning':
        return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 tabular-nums"><AlertTriangle className="w-3 h-3 mr-1" />Warning</Badge>;
      default:
        return <Badge variant="outline" className="tabular-nums">{severity}</Badge>;
    }
  };

  const WEBHOOK_LABELS: Record<string, string> = {
    'charge.completed': 'Payment received',
    'transfer.completed': 'Bank transfer sent',
    'transfer.failed': 'Bank transfer failed',
    'transfer.reversed': 'Transfer reversed',
    'payment.failed': 'Payment failed',
  };
  const humaniseEvent = (raw: string) =>
    WEBHOOK_LABELS[raw] ?? raw.replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="p-4 md:p-6 space-y-4 pb-24 md:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold leading-tight">Activity Log</h1>
            <p className="text-xs text-muted-foreground">Payment events &amp; system alerts</p>
          </div>
        </div>
        <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={() => refetch()} aria-label="Refresh">
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder={logType === 'webhooks' ? 'Search by event or reference…' : 'Search alerts…'}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-10 pr-10 h-10"
        />
        {searchInput && (
          <button 
            onClick={() => setSearchInput('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={logType} onValueChange={(v) => { setLogType(v as typeof logType); setPage(1); }}>
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur py-2 -mx-1 px-1">
          <TabsList className="grid grid-cols-2 w-full h-10">
            <TabsTrigger value="webhooks" className="gap-2">
              <Webhook className="h-4 w-4" />
              Payment Events
            </TabsTrigger>
            <TabsTrigger value="alerts" className="gap-2">
              <Bell className="h-4 w-4" />
              Alerts
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Webhooks Tab */}
        <TabsContent value="webhooks" className="mt-4 space-y-3">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-5 w-5 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : data?.logs.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Webhook className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold text-base">No Webhook Logs</h3>
                <p className="text-sm text-muted-foreground">No payment activities have happened lately</p>
              </CardContent>
            </Card>
          ) : (
            data?.logs.map((log) => {
              const webhookLog = log as WebhookLog;
              return (
                <Collapsible key={webhookLog.id} open={expandedLogs.has(webhookLog.id)}>
                  <Card className={webhookLog.success ? '' : 'border-destructive/30'}>
                    <CardContent className="p-3">
                      <CollapsibleTrigger
                        className="w-full text-left"
                        onClick={() => toggleExpand(webhookLog.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            {webhookLog.success ? (
                              <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                            ) : (
                              <XCircle className="h-5 w-5 text-destructive shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{humaniseEvent(webhookLog.event_type)}</p>
                              <p className="text-xs text-muted-foreground tabular-nums">
                                {fmtDateTimeLong(webhookLog.created_at)}
                              </p>
                            </div>
                          </div>
                          <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform shrink-0 ${expandedLogs.has(webhookLog.id) ? 'rotate-180' : ''}`} />
                        </div>
                      </CollapsibleTrigger>

                      {webhookLog.error_message && (
                        <div className="mt-2 p-2 bg-destructive/5 rounded-lg border border-destructive/10">
                          <p className="text-[11px] text-destructive leading-tight">{webhookLog.error_message}</p>
                        </div>
                      )}

                      <CollapsibleContent className="mt-3">
                        <div className="p-2.5 bg-muted/50 rounded-lg border border-border/50 relative group">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Raw Event Payload</p>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => copyToClipboard(JSON.stringify(webhookLog.data, null, 2))}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                          <pre className="text-xs overflow-x-auto max-h-64 overflow-y-auto tabular-nums font-mono">
                            {JSON.stringify(webhookLog.data, null, 2)}
                          </pre>
                        </div>
                      </CollapsibleContent>
                    </CardContent>
                  </Card>
                </Collapsible>
              );
            })
          )}
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="mt-4 space-y-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <Skeleton className="h-5 w-5 rounded-md mt-1" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-1/4" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : data?.logs.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-4" />
                <h3 className="font-semibold text-base">All Clear!</h3>
                <p className="text-sm text-muted-foreground">Everything is working smoothly, no alerts to show</p>
              </CardContent>
            </Card>
          ) : (
            data?.logs.map((log) => {
              const alert = log as SystemAlert;
              return (
                <Card key={alert.id} className={alert.acknowledged_at ? 'opacity-70' : 'border-warning/30 shadow-sm'}>
                  <CardContent className="p-3">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className={`h-5 w-5 shrink-0 mt-0.5 ${
                          alert.severity === 'critical' ? 'text-destructive' : 'text-warning'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            {getSeverityBadge(alert.severity)}
                            <Badge variant="outline" className="text-[10px] h-5 tabular-nums uppercase">{humaniseEvent(alert.alert_type)}</Badge>
                          </div>
                          <p className="font-medium text-sm leading-snug">{alert.message}</p>
                          <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">
                            {fmtDateTime(alert.created_at)}
                          </p>
                        </div>

                        {!alert.acknowledged_at && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-primary shrink-0 -mt-1 -mr-1"
                            onClick={() => acknowledgeAlert.mutate(alert.id)}
                            disabled={acknowledgeAlert.isPending}
                            title="Mark as read"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      {alert.acknowledged_at && (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-success/10 text-success rounded-md w-fit">
                          <CheckCircle2 className="w-3 h-3" />
                          <span className="text-[10px] font-medium uppercase tracking-wider">Reviewed</span>
                        </div>
                      )}

                      {alert.data && Object.keys(alert.data).length > 0 && (
                        <Collapsible>
                          <CollapsibleTrigger className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors py-1">
                            <ChevronDown className="h-3.5 w-3.5" />
                            VIEW DETAILS
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-2">
                            <div className="p-2.5 bg-muted/50 rounded-lg border border-border/50 relative group">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Metadata</p>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => copyToClipboard(JSON.stringify(alert.data, null, 2))}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                              <pre className="text-xs overflow-x-auto tabular-nums font-mono max-h-48">
                                {JSON.stringify(alert.data, null, 2)}
                              </pre>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>

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
  );
}
