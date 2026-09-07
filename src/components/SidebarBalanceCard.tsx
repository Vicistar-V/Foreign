import { useAuth } from '@/hooks/useAuth';
import { useBalances } from '@/hooks/useBalances';
import { useSidebar } from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { Wallet } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export const SidebarBalanceCard = () => {
  const { user } = useAuth();
  const { data: balances, isLoading } = useBalances(user?.id);
  const { state } = useSidebar();

  const isCollapsed = state === 'collapsed';

  // Unified balance - combine all wallets
  const earningsBalance = balances?.earnings_balance || 0;
  const depositBalance = balances?.deposit_balance || 0;
  const totalBalance = earningsBalance + depositBalance;

  const formatAmount = (amount: number) => {
    return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 0 })}`;
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={`pb-4 ${isCollapsed ? 'flex justify-center' : ''}`}>
        <Skeleton className={isCollapsed ? "h-10 w-10 rounded-lg" : "h-20 w-full rounded-lg"} />
      </div>
    );
  }

  // Collapsed view - show icon with tooltip
  if (isCollapsed) {
    return (
      <div className="pb-4 flex justify-center">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-success/10">
                <Wallet className="h-6 w-6 text-success" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">{formatAmount(totalBalance)}</span>
              </div>
              <div className="text-xs text-muted-foreground space-y-0.5">
                <div>Withdrawable: {formatAmount(earningsBalance)}</div>
                <div>For Playing: {formatAmount(depositBalance)}</div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  // Expanded view - show unified balance
  return (
    <div className="pb-4">
      <div className="p-4 space-y-2">
        {/* Total Balance - Hero */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-8 w-8 rounded-md bg-success/20">
              <Wallet className="h-4 w-4 text-success" />
            </div>
            <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Balance
            </p>
          </div>
          <p className="text-xl font-bold text-success">
            {formatAmount(totalBalance)}
          </p>
        </div>
        
        {/* Breakdown - Smaller text */}
        <div className="pl-10 text-xs text-muted-foreground space-y-0.5">
          <div className="flex justify-between">
            <span>Withdrawable</span>
            <span className="font-medium text-foreground">{formatAmount(earningsBalance)}</span>
          </div>
          <div className="flex justify-between">
            <span>For Playing</span>
            <span className="font-medium text-foreground">{formatAmount(depositBalance)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
