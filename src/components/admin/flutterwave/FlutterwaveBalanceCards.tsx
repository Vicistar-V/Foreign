import { Card, CardContent } from '@/components/ui/card';
import { Wallet, Clock, TrendingUp } from 'lucide-react';
import { FlutterwaveBalance, formatNaira } from '@/hooks/useFlutterwaveData';
import { Skeleton } from '@/components/ui/skeleton';

interface FlutterwaveBalanceCardsProps {
  balances: FlutterwaveBalance[];
  isLoading: boolean;
}

export const FlutterwaveBalanceCards = ({ balances, isLoading }: FlutterwaveBalanceCardsProps) => {
  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-5">
          <Skeleton className="h-4 w-32 mb-3" />
          <Skeleton className="h-10 w-48 mb-2" />
          <Skeleton className="h-4 w-40" />
        </CardContent>
      </Card>
    );
  }

  // Find NGN balance only
  const ngnBalance = balances.find(b => b.currency === 'NGN');

  if (!ngnBalance) {
    return (
      <Card className="border-border/50 bg-muted/30">
        <CardContent className="p-6 text-center">
          <Wallet className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground font-medium">No Naira Wallet Found</p>
          <p className="text-xs text-muted-foreground mt-1">
            Your Flutterwave account may not have a Nigerian Naira wallet set up
          </p>
        </CardContent>
      </Card>
    );
  }

  const pendingAmount = ngnBalance.ledger_balance - ngnBalance.available_balance;
  const hasPending = pendingAmount > 0;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 shadow-sm">
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-primary/15">
            <Wallet className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Nigerian Naira Wallet</p>
            <p className="text-xs text-muted-foreground">🇳🇬 NGN</p>
          </div>
        </div>
        
        {/* Main Balance - Money You Can Use */}
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
            <span className="text-base">💰</span> Money You Can Use
          </p>
          <p className="text-3xl font-bold text-foreground tracking-tight">
            {formatNaira(ngnBalance.available_balance)}
          </p>
        </div>
        
        {/* Secondary Info - Pending or Total */}
        <div className="flex items-center gap-3 pt-3 border-t border-border/50">
          {hasPending ? (
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-warning/10">
                <Clock className="w-4 h-4 text-warning" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Money on Hold</p>
                <p className="text-sm font-semibold text-warning">
                  {formatNaira(pendingAmount)}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-success/10">
                <TrendingUp className="w-4 h-4 text-success" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total in Wallet</p>
                <p className="text-sm font-semibold text-success">
                  {formatNaira(ngnBalance.ledger_balance)}
                </p>
              </div>
            </div>
          )}
          
          {/* Show total if there's pending */}
          {hasPending && (
            <div className="ml-auto text-right">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-sm font-medium text-foreground">
                {formatNaira(ngnBalance.ledger_balance)}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
