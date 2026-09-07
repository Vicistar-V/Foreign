import { useState } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ArrowDown,
  ArrowUp,
  Gift,
  Trophy,
  Coins,
  CreditCard,
  AlertCircle,
  Copy,
  CheckCircle2,
  Clock,
  XCircle,
  Wallet,
  TrendingDown,
  Hash,
  RefreshCw,
} from 'lucide-react';
import { formatNigerianRelativeTime, formatNigerianDateTime } from '@/lib/nigerianTime';
import { toast } from '@/hooks/use-toast';
import { formatTransactionAmount, DEFAULT_ENTRY_FEE } from '@/lib/currencyUtils';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';

interface Transaction {
  id: string;
  amount: number;
  wallet_type: string;
  transaction_type: string;
  description: string;
  status: string;
  created_at: string;
  payment_reference?: string | null;
  metadata?: {
    reason?: string;
    failure_reason?: string;
    cycle_number?: number;
    position_number?: number;
    cash_amount?: number;
    credit_amount?: number;
    flutterwave_transfer_id?: string;
    withdrawal_failed?: boolean;
    chargeback?: boolean;
    [key: string]: any;
  };
}

interface TransactionDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  onVerifyWithdrawal?: (reference: string) => void;
  isVerifying?: boolean;
}

export const TransactionDetailDrawer = ({
  open,
  onOpenChange,
  transaction,
  onVerifyWithdrawal,
  isVerifying,
}: TransactionDetailDrawerProps) => {
  const [copied, setCopied] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const { data: config } = usePlatformConfig();
  const entryFee = config?.drop_entry_fee ?? DEFAULT_ENTRY_FEE;

  if (!transaction) return null;

  const {
    amount,
    transaction_type,
    description,
    wallet_type,
    status,
    created_at,
    payment_reference,
    metadata,
  } = transaction;

  // Transaction type mapping
  const getTransactionDetails = () => {
    const details = {
      icon: AlertCircle,
      label: transaction_type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
      iconColor: 'text-muted-foreground',
      bgColor: 'bg-muted/10',
      amountColor: 'text-foreground',
      amountSign: '',
    };

    switch (transaction_type) {
      case 'membership_bonus':
        return {
          ...details,
          icon: Gift,
          label: 'Membership Bonus',
          iconColor: 'text-success',
          bgColor: 'bg-success/10',
          amountColor: 'text-success',
          amountSign: '+',
        };
      case 'referral_payout':
      case 'cycle_referral':
        return {
          ...details,
          icon: Gift,
          label: 'Friend Bonus',
          iconColor: 'text-success',
          bgColor: 'bg-success/10',
          amountColor: 'text-success',
          amountSign: '+',
        };
      case 'deposit':
        return {
          ...details,
          icon: ArrowDown,
          label: 'Money Added',
          iconColor: 'text-success',
          bgColor: 'bg-success/10',
          amountColor: 'text-success',
          amountSign: '+',
        };
      case 'cycle_payout':
        return {
          ...details,
          icon: Trophy,
          label: 'Campaign Payout',
          iconColor: 'text-success',
          bgColor: 'bg-success/10',
          amountColor: 'text-success',
          amountSign: '+',
        };
      case 'withdrawal':
        return {
          ...details,
          icon: ArrowUp,
          label: 'Withdrawal',
          iconColor: 'text-destructive',
          bgColor: 'bg-destructive/10',
          amountColor: 'text-destructive',
          amountSign: '-',
        };
      case 'cycle_entry':
        return {
          ...details,
          icon: Coins,
          label: 'Ad Share Activated',
          iconColor: 'text-destructive',
          bgColor: 'bg-destructive/10',
          amountColor: 'text-destructive',
          amountSign: '-',
        };
      case 'cycle_reentry':
        return {
          ...details,
          icon: RefreshCw,
          label: 'Extra Ad Share',
          iconColor: 'text-primary',
          bgColor: 'bg-primary/10',
          amountColor: 'text-primary',
          amountSign: '-',
        };
      case 'membership_fee':
        return {
          ...details,
          icon: CreditCard,
          label: 'Membership Fee',
          iconColor: 'text-destructive',
          bgColor: 'bg-destructive/10',
          amountColor: 'text-destructive',
          amountSign: '-',
        };
      case 'debt_reversal':
        return {
          ...details,
          icon: AlertCircle,
          label: 'Balance Adjustment',
          iconColor: 'text-accent-orange',
          bgColor: 'bg-accent-orange/10',
          amountColor: 'text-accent-orange',
          amountSign: amount >= 0 ? '+' : '-',
        };
      case 'voucher_issuance':
        return {
          ...details,
          icon: Gift,
          label: 'Voucher Received',
          iconColor: 'text-success',
          bgColor: 'bg-success/10',
          amountColor: 'text-success',
          amountSign: '+',
        };
      case 'subsidy':
        return {
          ...details,
          icon: Wallet,
          label: 'Platform Support',
          iconColor: 'text-success',
          bgColor: 'bg-success/10',
          amountColor: 'text-success',
          amountSign: '+',
        };
      case 'platform_fee':
        return {
          ...details,
          icon: TrendingDown,
          label: 'Platform Fee',
          iconColor: 'text-muted-foreground',
          bgColor: 'bg-muted/10',
          amountColor: 'text-muted-foreground',
          amountSign: '-',
        };
      case 'admin_expense':
        return {
          ...details,
          icon: AlertCircle,
          label: 'System Adjustment',
          iconColor: 'text-muted-foreground',
          bgColor: 'bg-muted/10',
          amountColor: 'text-muted-foreground',
          amountSign: amount >= 0 ? '+' : '-',
        };
      default:
        return details;
    }
  };

  const txDetails = getTransactionDetails();
  const Icon = txDetails.icon;

  // Wallet label
  const walletLabel = wallet_type === 'earnings' ? 'Profit' : 'Deposit';
  const walletIcon = wallet_type === 'earnings' ? '💰' : '💵';

  // Format amount based on wallet type
  const displayAmount = formatTransactionAmount(Math.abs(amount), wallet_type, entryFee);

  // Status details
  const isPending = status === 'pending';
  const isFailed = status === 'failed';
  const isCompleted = status === 'completed';

  const statusBadge = () => {
    if (isCompleted) {
      return (
        <Badge className="bg-success/10 text-success border-success/30 gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Completed
        </Badge>
      );
    }
    if (isPending) {
      return (
        <Badge className="bg-warning/10 text-warning border-warning/30 gap-1 animate-pulse">
          <Clock className="h-3 w-3" />
          Pending
        </Badge>
      );
    }
    if (isFailed) {
      return (
        <Badge className="bg-destructive/10 text-destructive border-destructive/30 gap-1">
          <XCircle className="h-3 w-3" />
          Failed
        </Badge>
      );
    }
    return null;
  };

  // Copy reference
  const handleCopyReference = () => {
    if (payment_reference) {
      navigator.clipboard.writeText(payment_reference);
      setCopied(true);
      toast({
        title: 'Copied!',
        description: 'Reference number copied to clipboard',
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Copy transaction ID
  const handleCopyId = () => {
    navigator.clipboard.writeText(transaction.id);
    setCopiedId(true);
    toast({
      title: 'Copied!',
      description: 'Transaction ID copied to clipboard',
    });
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Get failure reason (check both fields)
  const failureReason = metadata?.failure_reason || metadata?.reason;

  // Can verify
  const canVerify =
    isPending && transaction_type === 'withdrawal' && payment_reference && onVerifyWithdrawal;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="pb-4">
          <DrawerTitle className="sr-only">Transaction Details</DrawerTitle>
        </DrawerHeader>

        <div className="px-4 pb-8 space-y-6 animate-fade-in overflow-y-auto max-h-[calc(90vh-80px)]">
          {/* Hero Section */}
          <div className="flex flex-col items-center text-center space-y-4 pt-2">
            {/* Large Icon */}
            <div
              className={`w-20 h-20 md:w-24 md:h-24 rounded-2xl ${txDetails.bgColor} flex items-center justify-center`}
              style={{ animationDelay: '50ms' }}
            >
              <Icon className={`h-10 w-10 md:h-12 md:w-12 ${txDetails.iconColor}`} />
            </div>

            {/* Type Label */}
            <div className="space-y-2" style={{ animationDelay: '100ms' }}>
              <p className="text-sm md:text-base text-muted-foreground uppercase tracking-wide font-medium">
                {txDetails.label}
              </p>
              <div className="h-0.5 w-16 bg-border mx-auto" />
            </div>

            {/* Hero Amount */}
            <div className="space-y-2" style={{ animationDelay: '150ms' }}>
              <p className={`text-3xl md:text-4xl font-bold ${txDetails.amountColor}`}>
                {txDetails.amountSign}{displayAmount}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {statusBadge()}
              </div>
            </div>
          </div>

          {/* Details Section */}
          <div className="space-y-4" style={{ animationDelay: '200ms' }}>
            {/* Description */}
            <div className="space-y-2">
              <p className="text-xs md:text-sm font-medium text-muted-foreground flex items-center gap-2">
                📝 What Happened
              </p>
              <div className="bg-muted/50 rounded-lg p-3 md:p-4">
                <p className="text-sm md:text-base text-foreground">{description}</p>
              </div>
            </div>

            {/* Wallet */}
            <div className="space-y-2">
              <p className="text-xs md:text-sm font-medium text-muted-foreground flex items-center gap-2">
                💼 Wallet
              </p>
              <div className="bg-muted/50 rounded-lg p-3 md:p-4">
                <Badge variant="outline" className="text-sm md:text-base bg-muted/50 text-muted-foreground border-border">
                  {walletIcon} {walletLabel}
                </Badge>
              </div>
            </div>

            {/* Date/Time */}
            <div className="space-y-2">
              <p className="text-xs md:text-sm font-medium text-muted-foreground flex items-center gap-2">
                📅 When
              </p>
              <div className="bg-muted/50 rounded-lg p-3 md:p-4 space-y-1">
                <p className="text-sm md:text-base text-foreground font-medium">
                  {formatNigerianDateTime(created_at)}
                </p>
                <p className="text-xs md:text-sm text-muted-foreground">
                  ({formatNigerianRelativeTime(created_at)})
                </p>
              </div>
            </div>

            {/* Transaction ID */}
            <div className="space-y-2">
              <p className="text-xs md:text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Hash className="h-3 w-3" />
                Transaction ID
              </p>
              <div className="bg-muted/50 rounded-lg p-3 md:p-4 flex items-center justify-between gap-2">
                <p className="text-xs md:text-sm text-foreground font-mono truncate">
                  {transaction.id}
                </p>
                <Button
                  onClick={handleCopyId}
                  variant="ghost"
                  size="sm"
                  className="flex-shrink-0 h-8 px-3"
                >
                  {copiedId ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Reference */}
            {payment_reference && (
              <div className="space-y-2">
                <p className="text-xs md:text-sm font-medium text-muted-foreground flex items-center gap-2">
                  🔗 Reference
                </p>
                <div className="bg-muted/50 rounded-lg p-3 md:p-4 flex items-center justify-between gap-2">
                  <p className="text-sm md:text-base text-foreground font-mono truncate">
                    {payment_reference}
                  </p>
                  <Button
                    onClick={handleCopyReference}
                    variant="ghost"
                    size="sm"
                    className="flex-shrink-0 h-8 px-3"
                  >
                    {copied ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Cycle Details */}
            {(transaction_type === 'cycle_payout' || transaction_type === 'cycle_entry' || transaction_type === 'cycle_reentry') && 
              metadata?.cycle_number && (
              <div className="space-y-2">
                <p className="text-xs md:text-sm font-medium text-muted-foreground flex items-center gap-2">
                  🔄 Campaign Details
                </p>
                <div className="bg-muted/50 rounded-lg p-3 md:p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Campaign Number</span>
                    <Badge variant="secondary" className="font-bold">
                      #{metadata.cycle_number}
                    </Badge>
                  </div>
                  {metadata.position_number && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Ad Share #</span>
                      <Badge variant="outline">
                        #{metadata.position_number}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Rich Metadata - Payment Breakdown */}
            {transaction_type === 'cycle_entry' &&
              (metadata?.cash_amount !== undefined || metadata?.credit_amount !== undefined) && (
                <div className="space-y-2">
                  <p className="text-xs md:text-sm font-medium text-muted-foreground flex items-center gap-2">
                    💰 Payment Breakdown
                  </p>
                  <div className="bg-muted/50 rounded-lg p-3 md:p-4 space-y-2">
                    {metadata.cash_amount !== undefined && metadata.cash_amount > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">💚 From Earnings</span>
                        <span className="text-sm font-medium text-foreground">
                          ₦{metadata.cash_amount.toLocaleString()}
                        </span>
                      </div>
                    )}
                    {metadata.credit_amount !== undefined && metadata.credit_amount > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">💵 From Deposit</span>
                        <span className="text-sm font-medium text-foreground">
                          ₦{metadata.credit_amount.toLocaleString()}
                        </span>
                      </div>
                    )}
                    <div className="border-t border-border pt-2 flex justify-between items-center">
                      <span className="text-sm font-medium text-foreground">Total</span>
                      <span className="text-sm font-bold text-foreground">
                        ₦{amount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}

            {/* Rich Metadata - Failed Withdrawal Flutterwave ID */}
            {isFailed &&
              transaction_type === 'withdrawal' &&
              metadata?.flutterwave_transfer_id && (
                <div className="space-y-2">
                  <p className="text-xs md:text-sm font-medium text-muted-foreground flex items-center gap-2">
                    🔧 Support Reference
                  </p>
                  <div className="bg-muted/50 rounded-lg p-3 md:p-4">
                    <p className="text-xs text-muted-foreground mb-1">Flutterwave Transfer ID</p>
                    <p className="text-sm font-mono text-foreground break-all">
                      {metadata.flutterwave_transfer_id}
                    </p>
                  </div>
                </div>
              )}

            {/* Rich Metadata - Debt Reversal Reason */}
            {transaction_type === 'debt_reversal' && metadata && (
              <div className="space-y-2">
                <p className="text-xs md:text-sm font-medium text-muted-foreground flex items-center gap-2">
                  ℹ️ Adjustment Reason
                </p>
                <div className="bg-muted/50 rounded-lg p-3 md:p-4">
                  <p className="text-sm text-foreground">
                    {metadata.withdrawal_failed
                      ? 'Money returned from failed withdrawal'
                      : metadata.chargeback
                      ? 'Chargeback reversal - payment issue detected'
                      : 'Balance adjustment by system'}
                  </p>
                </div>
              </div>
            )}

            {/* Pending Withdrawal - Status Timeline */}
            {canVerify && (
              <div className="space-y-3 pt-2 border-t">
                <p className="text-xs md:text-sm font-medium text-muted-foreground flex items-center gap-2">
                  ⏳ Status Timeline
                </p>
                <div className="bg-muted/50 rounded-lg p-4 space-y-4">
                  {/* Timeline */}
                  <div className="flex items-center justify-between relative">
                    <div className="absolute top-4 left-0 right-0 h-0.5 bg-border -z-10" />
                    
                    <div className="flex flex-col items-center gap-2 relative">
                      <div className="w-8 h-8 rounded-full bg-success flex items-center justify-center">
                        <CheckCircle2 className="h-4 w-4 text-success-foreground" />
                      </div>
                      <p className="text-xs text-center text-muted-foreground">Requested</p>
                    </div>

                    <div className="flex flex-col items-center gap-2 relative">
                      <div className="w-8 h-8 rounded-full bg-warning/20 border-2 border-warning animate-pulse" />
                      <p className="text-xs text-center text-muted-foreground">Processing</p>
                    </div>

                    <div className="flex flex-col items-center gap-2 relative">
                      <div className="w-8 h-8 rounded-full bg-muted border-2 border-border" />
                      <p className="text-xs text-center text-muted-foreground">Done</p>
                    </div>
                  </div>

                  {/* Check Status Button */}
                  <Button
                    onClick={() => onVerifyWithdrawal(payment_reference!)}
                    disabled={isVerifying}
                    className="w-full"
                    size="lg"
                  >
                    {isVerifying ? (
                      <>
                        <Clock className="h-4 w-4 mr-2 animate-spin" />
                        Checking Status...
                      </>
                    ) : (
                      <>
                        🔄 Check Withdrawal Status
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Failed - Reason */}
            {isFailed && failureReason && (
              <div className="space-y-2 pt-2 border-t">
                <p className="text-xs md:text-sm font-medium text-destructive flex items-center gap-2">
                  ⚠️ Why It Failed
                </p>
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 md:p-4">
                  <p className="text-sm md:text-base text-destructive">{failureReason}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
