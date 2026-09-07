import React from 'react';
import { Trophy, ArrowDown, ArrowUp, Gift, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatNigerianRelativeTime } from '@/lib/nigerianTime';
import { formatTransactionAmount, DEFAULT_ENTRY_FEE } from '@/lib/currencyUtils';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';

interface UnifiedActivityItemProps {
  item: {
    id: string;
    type: 'transaction';
    timestamp: string;
    transactionData?: {
      amount: number;
      wallet_type: string;
      transaction_type: string;
      description: string;
      status: string;
      payment_reference?: string | null;
      metadata?: {
        reason?: string;
        [key: string]: any;
      };
    };
  };
  onClick?: (item: UnifiedActivityItemProps['item']) => void;
}

export const UnifiedActivityItem = ({ item, onClick }: UnifiedActivityItemProps) => {
  const { data: config } = usePlatformConfig();
  const entryFee = config?.drop_entry_fee ?? DEFAULT_ENTRY_FEE;

  const renderTransaction = () => {
    const { amount, transaction_type, description, wallet_type } = item.transactionData!;
    
    let icon = ArrowDown;
    let iconColor = 'text-foreground';
    let bgColor = 'bg-muted/10';
    let amountColor = 'text-foreground';
    let amountSign = '';

    // Money in (green)
    if (['deposit', 'membership_bonus', 'referral_payout', 'cycle_payout', 'welcome_bonus', 'cycle_referral'].includes(transaction_type)) {
      if (transaction_type === 'welcome_bonus' || transaction_type === 'membership_bonus' || transaction_type === 'referral_payout' || transaction_type === 'cycle_referral') {
        icon = Gift;
      } else if (transaction_type === 'cycle_payout') {
        icon = Trophy;
      } else {
        icon = ArrowDown;
      }
      iconColor = 'text-success';
      bgColor = 'bg-success/10';
      amountColor = 'text-success';
      amountSign = '+';
    }
    
    // Money out (red)
    if (['withdrawal', 'cycle_entry', 'cycle_reentry', 'membership_fee'].includes(transaction_type)) {
      if (transaction_type === 'cycle_reentry') {
        icon = RefreshCw;
      } else {
        icon = ArrowUp;
      }
      iconColor = 'text-destructive';
      bgColor = 'bg-destructive/10';
      amountColor = 'text-destructive';
      amountSign = '-';
    }

    // Format amount based on wallet type
    const formattedAmount = formatTransactionAmount(Math.abs(amount), wallet_type, entryFee);
    const displayAmount = `${amountSign}${formattedAmount}`;

    // Wallet label
    const walletLabel = wallet_type === 'earnings' ? 'Profit' : 'Deposit';
    const walletEmoji = wallet_type === 'earnings' ? '💰' : '💵';

    return (
      <>
        <div className={`p-2 md:p-2.5 rounded-lg ${bgColor} flex-shrink-0`}>
          {React.createElement(icon, { className: `h-4 w-4 md:h-5 md:w-5 ${iconColor}` })}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm md:text-base font-medium truncate">{description}</p>
              <p className="text-xs md:text-sm text-muted-foreground">
                {formatNigerianRelativeTime(item.timestamp)}
              </p>
              <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5">
                {new Date(item.timestamp).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric', 
                  year: 'numeric' 
                })}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className={`text-base md:text-lg font-bold ${amountColor}`}>
                {displayAmount}
              </p>
              <Badge variant="outline" className="mt-1 text-[10px] md:text-xs bg-muted/50 text-muted-foreground border-border">
                {walletEmoji} {walletLabel}
              </Badge>
            </div>
          </div>
        </div>
      </>
    );
  };

  return (
    <div 
      className="flex items-start gap-2 md:gap-3 p-3 md:p-4 rounded-lg border bg-card hover:shadow-md transition-all duration-200 animate-fade-in cursor-pointer active:scale-[0.98]"
      onClick={() => onClick?.(item)}
    >
      {renderTransaction()}
    </div>
  );
};
