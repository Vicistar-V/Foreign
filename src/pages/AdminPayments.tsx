import { useEffect, useState } from 'react';
import { RefreshCw, CreditCard, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  useFlutterwaveData,
  FlutterwaveTransfer,
  FlutterwaveTransaction,
  DateRangeFilter,
} from '@/hooks/useFlutterwaveData';
import { usePaystackData } from '@/hooks/usePaystackData';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import {
  FlutterwaveBalanceCards,
  FlutterwaveQuickStats,
  FlutterwaveTransferTable,
  FlutterwaveTransactionTable,
  FlutterwaveDetailDrawer,
  AdminSendMoneyDrawer,
  FlutterwaveAuditLog,
} from '@/components/admin/flutterwave';
import {
  FlutterwaveDateRangePicker,
  DateRangeValue,
} from '@/components/admin/flutterwave/FlutterwaveDateRangePicker';
import { format, subDays } from 'date-fns';

type Provider = 'paystack' | 'flutterwave';
const STORAGE_KEY = 'admin_payments_provider_tab';

interface AdminPaymentsProps {
  /** Pre-select a provider regardless of platform_config (used for legacy /admin/flutterwave route). */
  defaultProvider?: Provider;
}

const AdminPayments = ({ defaultProvider }: AdminPaymentsProps = {}) => {
  const { data: platformConfig } = usePlatformConfig();

  // Tab: explicit prop > saved selection > platform_config.payment_provider > 'paystack'
  const [provider, setProvider] = useState<Provider>(() => {
    if (defaultProvider) return defaultProvider;
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Provider | null;
      if (saved === 'paystack' || saved === 'flutterwave') return saved;
    } catch { /* ignore */ }
    return 'paystack';
  });

  // Sync to platform_config once it loads (only if user has no saved preference and no explicit prop)
  useEffect(() => {
    if (defaultProvider) return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return;
    } catch { /* ignore */ }
    const active = platformConfig?.payment_provider;
    if (active === 'paystack' || active === 'flutterwave') {
      setProvider(active);
    }
  }, [platformConfig?.payment_provider, defaultProvider]);

  const handleTabChange = (v: string) => {
    if (v !== 'paystack' && v !== 'flutterwave') return;
    setProvider(v);
    try { localStorage.setItem(STORAGE_KEY, v); } catch { /* ignore */ }
  };

  const [dateRange, setDateRange] = useState<DateRangeValue>({
    fromDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    toDate: format(new Date(), 'yyyy-MM-dd'),
  });

  const dateRangeFilter: DateRangeFilter = {
    fromDate: dateRange.fromDate,
    toDate: dateRange.toDate,
  };

  // Both hooks run — but only the active provider's query is cared about visually.
  // React Query keeps them cached so switching tabs is instant.
  const flw = useFlutterwaveData(provider === 'flutterwave' ? dateRangeFilter : { fromDate: null, toDate: null });
  const ps = usePaystackData(provider === 'paystack' ? dateRangeFilter : { fromDate: null, toDate: null });
  const { data, isLoading, refetch, isFetching, dataUpdatedAt } = provider === 'paystack' ? ps : flw;

  const [selectedTransfer, setSelectedTransfer] = useState<FlutterwaveTransfer | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<FlutterwaveTransaction | null>(null);
  const [showSendMoneyDrawer, setShowSendMoneyDrawer] = useState(false);

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })
    : null;

  const livePill = platformConfig?.payment_provider === provider ? (
    <Badge variant="secondary" className="text-[10px] h-5 bg-success/15 text-success border-success/30">
      Live
    </Badge>
  ) : null;

  const providerLabel = provider === 'paystack' ? 'Paystack' : 'Flutterwave';

  return (
    <div className="p-3 md:p-6 space-y-4 pb-24 md:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <CreditCard className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base md:text-lg font-bold truncate">Payments</h1>
            {lastUpdated && (
              <p className="text-[11px] text-muted-foreground">
                {providerLabel} · Updated {lastUpdated}
              </p>
            )}
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => refetch()}
          disabled={isFetching}
          className="h-8 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Provider tabs */}
      <Tabs value={provider} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-10">
          <TabsTrigger value="paystack" className="text-xs sm:text-sm gap-1.5">
            Paystack
            {platformConfig?.payment_provider === 'paystack' && (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-success" />
            )}
          </TabsTrigger>
          <TabsTrigger value="flutterwave" className="text-xs sm:text-sm gap-1.5">
            Flutterwave
            {platformConfig?.payment_provider === 'flutterwave' && (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-success" />
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={provider} className="mt-4 space-y-4">
          {/* Date Range Picker */}
          <FlutterwaveDateRangePicker value={dateRange} onChange={setDateRange} />

          {/* Wallet Balance + Send Money */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">{providerLabel} Wallet</h2>
              {livePill}
            </div>
            <FlutterwaveBalanceCards balances={data?.balances || []} isLoading={isLoading} />

            <Button
              onClick={() => setShowSendMoneyDrawer(true)}
              className="w-full sm:w-auto gap-2"
              size="lg"
            >
              <Send className="w-4 h-4" />
              Send money to a bank
            </Button>
          </div>

          {/* Quick Stats */}
          <FlutterwaveQuickStats summary={data?.summary} isLoading={isLoading} />

          {/* Tables Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <FlutterwaveTransferTable
              transfers={data?.transfers}
              isLoading={isLoading}
              onSelectTransfer={setSelectedTransfer}
            />
            <FlutterwaveTransactionTable
              transactions={data?.transactions}
              isLoading={isLoading}
              onSelectTransaction={setSelectedTransaction}
            />
          </div>

          {/* Activity Audit Log */}
          <FlutterwaveAuditLog
            fromDate={dateRange.fromDate}
            toDate={dateRange.toDate}
            provider={provider}
          />
        </TabsContent>
      </Tabs>

      {/* Detail Drawer */}
      <FlutterwaveDetailDrawer
        isOpen={!!selectedTransfer || !!selectedTransaction}
        onClose={() => {
          setSelectedTransfer(null);
          setSelectedTransaction(null);
        }}
        transfer={selectedTransfer}
        transaction={selectedTransaction}
      />

      {/* Send Money Drawer — provider-aware */}
      <AdminSendMoneyDrawer
        isOpen={showSendMoneyDrawer}
        onClose={() => setShowSendMoneyDrawer(false)}
        provider={provider}
      />
    </div>
  );
};

export default AdminPayments;
