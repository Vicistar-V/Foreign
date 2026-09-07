import { useState, useRef } from 'react';
import { useWithdrawalAccounts } from '@/hooks/useWithdrawalAccounts';
import { useWithdrawalAccountActions } from '@/hooks/useWithdrawalAccountActions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Building2, Star, Trash2, Plus, CheckCircle2 } from 'lucide-react';
import { AddBankAccountModal } from './AddBankAccountModal';

interface BankAccountManagerProps {
  userId: string;
}

export const BankAccountManager = ({ userId }: BankAccountManagerProps) => {
  const { data, isLoading } = useWithdrawalAccounts(userId);
  const { 
    setAsPrimary, 
    deleteAccount, 
    isSettingPrimary, 
    isDeletingAccount,
    settingPrimaryId 
  } = useWithdrawalAccountActions(userId);
  const [showAddModal, setShowAddModal] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<string | null>(null);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    type: 'primary' | 'delete';
    accountId: string;
  } | null>(null);
  const [pin, setPin] = useState('');
  const pinInputRef = useRef<HTMLInputElement>(null);

  const accounts = data?.accounts || [];

  const handleSetPrimary = (accountId: string) => {
    setPendingAction({ type: 'primary', accountId });
    setShowPinDialog(true);
    setPin('');
  };

  const handleDeleteClick = (accountId: string) => {
    setPendingAction({ type: 'delete', accountId });
    setShowPinDialog(true);
    setPin('');
  };

  const handlePinChange = (value: string) => {
    const cleanedValue = value.replace(/\D/g, '').slice(0, 4);
    setPin(cleanedValue);
    
    // Auto-submit when 4 digits entered
    if (cleanedValue.length === 4) {
      handlePinComplete(cleanedValue);
    }
  };

  const handlePinComplete = (enteredPin: string) => {
    if (!pendingAction) return;

    if (pendingAction.type === 'primary') {
      setAsPrimary({ accountId: pendingAction.accountId, pin: enteredPin });
    } else {
      setAccountToDelete(pendingAction.accountId);
      deleteAccount({ accountId: pendingAction.accountId, pin: enteredPin });
    }

    setShowPinDialog(false);
    setPendingAction(null);
    setPin('');
  };

  const handlePinCancel = () => {
    setShowPinDialog(false);
    setPendingAction(null);
    setPin('');
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Add Account Button */}
      <Button
        onClick={() => setShowAddModal(true)}
        className="w-full h-12"
        variant="outline"
        haptic="light"
      >
        <Plus className="mr-2 h-5 w-5" />
        Add Bank Account
      </Button>

      {/* Accounts List */}
      {accounts.length === 0 ? (
        <Card className="p-8 text-center">
          <Building2 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-muted-foreground">No bank accounts added yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Add a bank account to receive withdrawals
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {accounts.map((account) => (
            <Card key={account.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold truncate">{account.bank_name}</h4>
                        {account.is_primary && (
                          <Badge variant="default" className="flex items-center gap-1">
                            <Star className="h-3 w-3 fill-current" />
                            Primary
                          </Badge>
                        )}
                        {account.is_verified && (
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Verified
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        ****{account.account_number.slice(-4)}
                      </p>
                      <p className="text-sm font-medium mt-1">{account.account_name}</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 ml-2">
                    {!account.is_primary && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSetPrimary(account.id)}
                        disabled={isSettingPrimary && settingPrimaryId === account.id}
                        haptic="medium"
                      >
                        {isSettingPrimary && settingPrimaryId === account.id ? 'Setting...' : 'Set Primary'}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDeleteClick(account.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Account Modal */}
      <AddBankAccountModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        userId={userId}
        onSuccess={() => {
          setShowAddModal(false);
        }}
      />

      {/* PIN Entry Dialog - Native Mobile Keyboard */}
      <Dialog open={showPinDialog} onOpenChange={handlePinCancel}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enter Your PIN</DialogTitle>
            <DialogDescription>
              {pendingAction?.type === 'primary'
                ? 'Enter your 4-digit PIN to set this account as primary'
                : 'Enter your 4-digit PIN to remove this account'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {/* Native PIN Input */}
            <div className="space-y-2">
              <div 
                className="py-6 bg-muted/30 rounded-xl border border-border cursor-text"
                onClick={() => pinInputRef.current?.focus()}
              >
                {/* Visual PIN dots */}
                <div className="flex items-center justify-center gap-3">
                  {[0, 1, 2, 3].map((i) => (
                    <div 
                      key={i} 
                      className={`w-4 h-4 rounded-full transition-all ${
                        pin.length > i ? 'bg-primary scale-110' : 'bg-muted-foreground/30'
                      }`} 
                    />
                  ))}
                </div>
                
                {/* Hidden native input */}
                <Input
                  ref={pinInputRef}
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={pin}
                  onChange={(e) => handlePinChange(e.target.value)}
                  maxLength={4}
                  className="sr-only"
                  autoComplete="off"
                  autoFocus
                />
                
                <p className="text-xs text-muted-foreground mt-3 text-center">
                  Tap to enter your 4-digit PIN
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};