import { useState } from 'react';
import { RefreshCw, CreditCard, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFlutterwaveData, FlutterwaveTransfer, FlutterwaveTransaction, DateRangeFilter } from '@/hooks/useFlutterwaveData';
import {
  FlutterwaveBalanceCards,
  FlutterwaveQuickStats,
  FlutterwaveTransferTable,
  FlutterwaveTransactionTable,
  FlutterwaveDetailDrawer,
  AdminSendMoneyDrawer,
  FlutterwaveAuditLog,
} from '@/components/admin/flutterwave';
import { FlutterwaveDateRangePicker, DateRangeValue } from '@/components/admin/flutterwave/FlutterwaveDateRangePicker';
import { format, subDays } from 'date-fns';

const AdminFlutterwave = () => {
  // Default to last 30 days
  const [dateRange, setDateRange] = useState<DateRangeValue>({
    fromDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    toDate: format(new Date(), 'yyyy-MM-dd'),
  });

  const dateRangeFilter: DateRangeFilter = {
    fromDate: dateRange.fromDate,
    toDate: dateRange.toDate,
  };

  const { data, isLoading, refetch, isFetching, dataUpdatedAt } = useFlutterwaveData(dateRangeFilter);
  
  const [selectedTransfer, setSelectedTransfer] = useState<FlutterwaveTransfer | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<FlutterwaveTransaction | null>(null);
  const [showSendMoneyDrawer, setShowSendMoneyDrawer] = useState(false);

  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString('en-NG', {
    hour: '2-digit',
    minute: '2-digit',
  }) : null;

  const handleDateRangeChange = (newRange: DateRangeValue) => {
    setDateRange(newRange);
  };

  return (
    <div className="p-3 md:p-6 space-y-4 pb-24 md:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <CreditCard className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base md:text-lg font-bold truncate">Flutterwave Wallet</h1>
            {lastUpdated && (
              <p className="text-[11px] text-muted-foreground">Updated {lastUpdated}</p>
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

      {/* Date Range Picker */}
      <FlutterwaveDateRangePicker 
        value={dateRange} 
        onChange={handleDateRangeChange} 
      />

      {/* Wallet Balance + Send Money */}
      <div className="space-y-3">
        <FlutterwaveBalanceCards 
          balances={data?.balances || []} 
          isLoading={isLoading} 
        />
        
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
      <FlutterwaveQuickStats 
        summary={data?.summary} 
        isLoading={isLoading} 
      />

      {/* Tables Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Money Sent Out (Transfers/Withdrawals) */}
        <FlutterwaveTransferTable
          transfers={data?.transfers}
          isLoading={isLoading}
          onSelectTransfer={setSelectedTransfer}
        />

        {/* Money Received (Transactions/Deposits) */}
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
      />

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

      {/* Send Money Drawer */}
      <AdminSendMoneyDrawer 
        isOpen={showSendMoneyDrawer}
        onClose={() => setShowSendMoneyDrawer(false)}
      />
    </div>
  );
};

export default AdminFlutterwave;
