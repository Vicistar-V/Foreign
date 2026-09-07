/**
 * BankAccountsDrawer - Manage bank accounts in a drawer
 */
import { useState, useRef } from 'react';
import { Building2, Star, Trash2, Plus, CheckCircle2 } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useWithdrawalAccounts } from '@/hooks/useWithdrawalAccounts';
import { useWithdrawalAccountActions } from '@/hooks/useWithdrawalAccountActions';
import { AddBankAccountModal } from '@/components/AddBankAccountModal';

interface BankAccountsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

export const BankAccountsDrawer = ({ open, onOpenChange, userId }: BankAccountsDrawerProps) => {
  const { data, isLoading } = useWithdrawalAccounts(userId);
  const { 
    setAsPrimary, 
    deleteAccount, 
    isSettingPrimary, 
    isDeletingAccount,
    settingPrimaryId 
  } = useWithdrawalAccountActions(userId);
  
  const [showAddModal, setShowAddModal] = useState(false);
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
    
    if (cleanedValue.length === 4) {
      handlePinComplete(cleanedValue);
    }
  };

  const handlePinComplete = (enteredPin: string) => {
    if (!pendingAction) return;

    if (pendingAction.type === 'primary') {
      setAsPrimary({ accountId: pendingAction.accountId, pin: enteredPin });
    } else {
      deleteAccount({ accountId: pendingAction.accountId, pin: enteredPin });
    }

    setShowPinDialog(false);
    setPendingAction(null);
    setPin('');
  };

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="text-left border-b border-border pb-4">
            <DrawerTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Bank Accounts
            </DrawerTitle>
          </DrawerHeader>

          <div className="p-4 space-y-4 overflow-y-auto">
            {/* Add Button */}
            <Button
              onClick={() => setShowAddModal(true)}
              className="w-full h-12"
              variant="outline"
            >
              <Plus className="mr-2 h-5 w-5" />
              Add Bank Account
            </Button>

            {/* Accounts List */}
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
              </div>
            ) : accounts.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-muted-foreground">No bank accounts yet</p>
                <p className="text-sm text-muted-foreground/60">
                  Add one to receive withdrawals
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {accounts.map((account) => (
                  <div 
                    key={account.id} 
                    className="bg-card border border-border rounded-xl p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h4 className="font-semibold truncate">{account.bank_name}</h4>
                          {account.is_primary && (
                            <Badge className="text-xs">
                              <Star className="h-2.5 w-2.5 mr-1 fill-current" />
                              Primary
                            </Badge>
                          )}
                          {account.is_verified && (
                            <Badge variant="secondary" className="text-xs">
                              <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
                              Verified
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          ****{account.account_number.slice(-4)}
                        </p>
                        <p className="text-sm font-medium">{account.account_name}</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                      {!account.is_primary && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSetPrimary(account.id)}
                          disabled={isSettingPrimary && settingPrimaryId === account.id}
                          className="flex-1"
                        >
                          {isSettingPrimary && settingPrimaryId === account.id 
                            ? 'Setting...' 
                            : 'Set as Primary'}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteClick(account.id)}
                        disabled={isDeletingAccount}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Add Account Modal */}
      <AddBankAccountModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        userId={userId}
        onSuccess={() => setShowAddModal(false)}
      />

      {/* PIN Dialog */}
      <Dialog open={showPinDialog} onOpenChange={() => {
        setShowPinDialog(false);
        setPendingAction(null);
        setPin('');
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enter Your PIN</DialogTitle>
            <DialogDescription>
              {pendingAction?.type === 'primary'
                ? 'Confirm to set this as your primary account'
                : 'Confirm to remove this account'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div 
              className="py-6 bg-muted/30 rounded-xl border border-border cursor-text"
              onClick={() => pinInputRef.current?.focus()}
            >
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
        </DialogContent>
      </Dialog>
    </>
  );
};
