import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
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
import { 
  X, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Copy, 
  User, 
  Building2, 
  CreditCard,
  Hash,
  Calendar,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  RotateCcw,
  Loader2,
  UserCheck,
  ExternalLink
} from 'lucide-react';
import { 
  FlutterwaveTransfer, 
  FlutterwaveTransaction, 
  formatNaira, 
  getTransferStatusColor, 
  getSimpleStatusLabel,
  formatFlutterwaveDate 
} from '@/hooks/useFlutterwaveData';
import { useCheckTransferStatus, useRetryTransfer } from '@/hooks/useAdminFlutterwaveTransfer';
import { AvatarPreviewDrawer } from '@/components/results/AvatarPreviewDrawer';
import { toast } from 'sonner';

interface FlutterwaveDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  transfer?: FlutterwaveTransfer | null;
  transaction?: FlutterwaveTransaction | null;
}

export const FlutterwaveDetailDrawer = ({ 
  isOpen, 
  onClose, 
  transfer,
  transaction 
}: FlutterwaveDetailDrawerProps) => {
  const navigate = useNavigate();
  const [showRetryConfirm, setShowRetryConfirm] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  const [currentMessage, setCurrentMessage] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  
  const checkStatus = useCheckTransferStatus();
  const retryTransfer = useRetryTransfer();
  
  const isTransfer = !!transfer;
  const data = transfer || transaction;

  if (!data) return null;
  
  const matchedUser = !isTransfer && transaction?.matched_user;
  
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  // Get status info - use updated status if available
  const status = currentStatus || (isTransfer ? transfer!.status : transaction!.status);
  const statusLabel = getSimpleStatusLabel(status);
  const statusColor = getTransferStatusColor(status);
  const StatusIcon = status.toLowerCase() === 'successful' ? CheckCircle2 
    : status.toLowerCase() === 'failed' ? XCircle 
    : Clock;

  // Check if this is a failed transfer (can be retried)
  const isFailed = status.toLowerCase() === 'failed';

  const handleCheckStatus = async () => {
    if (!transfer?.id) return;
    
    try {
      const result = await checkStatus.mutateAsync({ transfer_id: transfer.id });
      if (result.status) {
        setCurrentStatus(result.status);
        setCurrentMessage(result.complete_message || null);
      }
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleRetryTransfer = async () => {
    if (!transfer?.id) return;
    setShowRetryConfirm(false);
    
    try {
      await retryTransfer.mutateAsync({ transfer_id: transfer.id });
      // After retry, check the new status
      handleCheckStatus();
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <>
      <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="pb-2">
            <div className="flex items-center justify-between">
              <DrawerTitle className="flex items-center gap-2 text-base">
                {isTransfer ? (
                  <ArrowUpRight className="w-5 h-5 text-primary" />
                ) : (
                  <ArrowDownLeft className="w-5 h-5 text-success" />
                )}
                {isTransfer ? 'Money Sent' : 'Money Received'}
              </DrawerTitle>
              <DrawerClose asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <X className="h-4 w-4" />
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          <ScrollArea className="flex-1 px-4 pb-6">
            {/* Status Banner */}
            <div className={`p-4 rounded-lg mb-4 ${statusColor}`}>
              <div className="flex items-center gap-3">
                <StatusIcon className="w-6 h-6" />
                <div>
                  <p className="font-semibold">{statusLabel}</p>
                  {isTransfer && (currentMessage || transfer?.complete_message) && (
                    <p className="text-xs opacity-80">{currentMessage || transfer.complete_message}</p>
                  )}
                  {!isTransfer && transaction?.processor_response && (
                    <p className="text-xs opacity-80">{transaction.processor_response}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Amount Section */}
            <div className="text-center py-4 border-b border-border/50 mb-4">
              <p className="text-xs text-muted-foreground mb-1">Amount</p>
              <p className={`text-3xl font-bold ${isTransfer ? 'text-foreground' : 'text-success'}`}>
                {isTransfer ? '' : '+'}{formatNaira(isTransfer ? transfer!.amount : transaction!.amount)}
              </p>
              {isTransfer && transfer!.fee > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Fee: {formatNaira(transfer!.fee)}
                </p>
              )}
              {!isTransfer && transaction!.app_fee > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Fee: {formatNaira(transaction!.app_fee)}
                </p>
              )}
            </div>

            {/* Matched Platform User Section - For Transactions */}
            {matchedUser && (
              <div className="p-4 rounded-lg border border-primary/20 bg-primary/5 mb-4">
                <p className="text-xs text-muted-foreground mb-3 font-medium">Platform User Found</p>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setPreviewOpen(true)}
                    className="shrink-0 relative"
                  >
                    <Avatar className="h-12 w-12 ring-2 ring-primary/30">
                      <AvatarImage src={matchedUser.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getInitials(matchedUser.full_name || 'U')}
                      </AvatarFallback>
                    </Avatar>
                    {matchedUser.is_member && (
                      <UserCheck className="absolute -bottom-0.5 -right-0.5 h-4 w-4 text-success bg-background rounded-full" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <button 
                      onClick={() => navigate(`/admin/users/${matchedUser.user_id}?from=flutterwave`)}
                      className="font-semibold text-primary hover:underline text-left truncate block w-full"
                    >
                      {matchedUser.full_name || 'Unknown User'}
                    </button>
                    <div className="flex items-center gap-2 mt-1">
                      {matchedUser.is_member ? (
                        <Badge className="bg-success/10 text-success border-success/20 text-[10px]">
                          Active Member
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          Not Activated
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={() => navigate(`/admin/users/${matchedUser.user_id}?from=flutterwave`)}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Action Buttons for Transfers */}
            {isTransfer && (
              <div className="space-y-2 mb-4">
                {/* Check Status Button - Always visible for transfers */}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleCheckStatus}
                  disabled={checkStatus.isPending}
                >
                  {checkStatus.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Check Latest Status
                </Button>

                {/* Retry Button - Only visible for failed transfers */}
                {isFailed && (
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => setShowRetryConfirm(true)}
                    disabled={retryTransfer.isPending}
                  >
                    {retryTransfer.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RotateCcw className="w-4 h-4 mr-2" />
                    )}
                    Retry This Transfer
                  </Button>
                )}
              </div>
            )}

            {/* Details List */}
            <div className="space-y-3">
              {/* For Transfers */}
              {isTransfer && (
                <>
                  <DetailRow 
                    icon={<User className="w-4 h-4" />}
                    label="Recipient"
                    value={transfer!.full_name || 'Unknown'}
                  />
                  <DetailRow 
                    icon={<Building2 className="w-4 h-4" />}
                    label="Bank"
                    value={transfer!.bank_name}
                  />
                  <DetailRow 
                    icon={<CreditCard className="w-4 h-4" />}
                    label="Account Number"
                    value={transfer!.account_number}
                    onCopy={() => copyToClipboard(transfer!.account_number, 'Account number')}
                  />
                  <DetailRow 
                    icon={<Hash className="w-4 h-4" />}
                    label="Reference"
                    value={transfer!.reference}
                    onCopy={() => copyToClipboard(transfer!.reference, 'Reference')}
                  />
                  <DetailRow 
                    icon={<FileText className="w-4 h-4" />}
                    label="Flutterwave ID"
                    value={transfer!.id.toString()}
                    onCopy={() => copyToClipboard(transfer!.id.toString(), 'ID')}
                  />
                  <DetailRow 
                    icon={<Calendar className="w-4 h-4" />}
                    label="Date"
                    value={formatFlutterwaveDate(transfer!.created_at)}
                  />
                </>
              )}

              {/* For Transactions */}
              {!isTransfer && transaction && (
                <>
                  <DetailRow 
                    icon={<User className="w-4 h-4" />}
                    label="Customer"
                    value={transaction.customer?.name || 'Unknown'}
                  />
                  <DetailRow 
                    icon={<FileText className="w-4 h-4" />}
                    label="Email"
                    value={transaction.customer?.email || '-'}
                    onCopy={() => transaction.customer?.email && copyToClipboard(transaction.customer.email, 'Email')}
                  />
                  <DetailRow 
                    icon={<CreditCard className="w-4 h-4" />}
                    label="Payment Type"
                    value={transaction.payment_type}
                  />
                  <DetailRow 
                    icon={<Hash className="w-4 h-4" />}
                    label="Transaction Ref"
                    value={transaction.tx_ref}
                    onCopy={() => copyToClipboard(transaction.tx_ref, 'Reference')}
                  />
                  <DetailRow 
                    icon={<Hash className="w-4 h-4" />}
                    label="Flutterwave Ref"
                    value={transaction.flw_ref}
                    onCopy={() => copyToClipboard(transaction.flw_ref, 'FLW Reference')}
                  />
                  <DetailRow 
                    icon={<FileText className="w-4 h-4" />}
                    label="Flutterwave ID"
                    value={transaction.id.toString()}
                    onCopy={() => copyToClipboard(transaction.id.toString(), 'ID')}
                  />
                  {transaction.narration && (
                    <DetailRow 
                      icon={<FileText className="w-4 h-4" />}
                      label="Narration"
                      value={transaction.narration}
                    />
                  )}
                  <DetailRow 
                    icon={<Calendar className="w-4 h-4" />}
                    label="Date"
                    value={formatFlutterwaveDate(transaction.created_at)}
                  />
                </>
              )}
            </div>
          </ScrollArea>
        </DrawerContent>
      </Drawer>

      {/* Retry Confirmation Dialog */}
      <AlertDialog open={showRetryConfirm} onOpenChange={setShowRetryConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retry This Transfer?</AlertDialogTitle>
            <AlertDialogDescription>
              This will ask Flutterwave to try sending the money again.
              <div className="mt-3 p-3 bg-muted rounded-lg text-sm">
                <p><strong>Amount:</strong> {formatNaira(transfer?.amount || 0)}</p>
                <p><strong>To:</strong> {transfer?.full_name || 'Unknown'}</p>
                <p><strong>Bank:</strong> {transfer?.bank_name}</p>
                <p><strong>Account:</strong> {transfer?.account_number}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRetryTransfer}>
              Yes, Retry Transfer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Avatar Preview Drawer */}
      {matchedUser && (
        <AvatarPreviewDrawer
          isOpen={previewOpen}
          onClose={() => setPreviewOpen(false)}
          name={matchedUser.full_name || 'User'}
          avatarUrl={matchedUser.avatar_url}
        />
      )}
    </>
  );
};

// Helper component for detail rows
interface DetailRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  onCopy?: () => void;
}

const DetailRow = ({ icon, label, value, onCopy }: DetailRowProps) => (
  <div className="flex items-start gap-3 py-2 border-b border-border/30 last:border-0">
    <div className="text-muted-foreground shrink-0 mt-0.5">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium break-all">{value}</p>
    </div>
    {onCopy && (
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-7 w-7 shrink-0"
        onClick={onCopy}
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
    )}
  </div>
);