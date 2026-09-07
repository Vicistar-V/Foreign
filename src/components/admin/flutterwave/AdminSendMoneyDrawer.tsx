import { useState, useEffect } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2, CheckCircle, AlertCircle, Search, Send, User, Building2, Banknote, FileText } from 'lucide-react';
import { useBanks } from '@/hooks/useBanks';
import { useResolveAccount, useAdminSendMoney } from '@/hooks/useAdminFlutterwaveTransfer';
import { usePaystackResolveAccount, usePaystackSendMoney } from '@/hooks/useAdminPaystackTransfer';
import { BankCommandSelect } from '@/components/BankCommandSelect';

export type SendMoneyProvider = 'flutterwave' | 'paystack';

interface AdminSendMoneyDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Which payment provider's wallet to send from. Defaults to flutterwave. */
  provider?: SendMoneyProvider;
}

type Step = 'bank' | 'account' | 'amount' | 'confirm';

export const AdminSendMoneyDrawer = ({ isOpen, onClose, provider = 'flutterwave' }: AdminSendMoneyDrawerProps) => {
  const [step, setStep] = useState<Step>('bank');
  const [selectedBankCode, setSelectedBankCode] = useState<string>('');
  const [selectedBankName, setSelectedBankName] = useState<string>('');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [accountName, setAccountName] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [narration, setNarration] = useState<string>('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const { data: banks } = useBanks('NG');
  // Pick hooks for the chosen provider — same shape on both sides.
  const flwResolve = useResolveAccount();
  const flwSend = useAdminSendMoney();
  const psResolve = usePaystackResolveAccount();
  const psSend = usePaystackSendMoney();
  const resolveAccount = provider === 'paystack' ? psResolve : flwResolve;
  const sendMoney = provider === 'paystack' ? psSend : flwSend;

  // Reset form when drawer closes
  useEffect(() => {
    if (!isOpen) {
      setStep('bank');
      setSelectedBankCode('');
      setSelectedBankName('');
      setAccountNumber('');
      setAccountName('');
      setAmount('');
      setNarration('');
      resolveAccount.reset();
      sendMoney.reset();
    }
  }, [isOpen]);

  // Auto-verify account when account number is 10 digits
  useEffect(() => {
    if (accountNumber.length === 10 && selectedBankCode && step === 'account') {
      handleVerifyAccount();
    }
  }, [accountNumber, selectedBankCode]);

  const handleBankSelect = (bankCode: string, bankName: string) => {
    setSelectedBankCode(bankCode);
    setSelectedBankName(bankName);
    setAccountName('');
    resolveAccount.reset();
    setStep('account');
  };

  const handleVerifyAccount = async () => {
    if (accountNumber.length !== 10) return;
    
    const result = await resolveAccount.mutateAsync({
      bank_code: selectedBankCode,
      account_number: accountNumber,
    });

    if (result.success && result.account_name) {
      setAccountName(result.account_name);
    }
  };

  const handleProceedToAmount = () => {
    if (accountName) {
      setStep('amount');
    }
  };

  const handleProceedToConfirm = () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) return;
    if (!narration.trim()) return;
    setStep('confirm');
  };

  const handleSendMoney = async () => {
    setShowConfirmDialog(false);
    
    await sendMoney.mutateAsync({
      bank_code: selectedBankCode,
      account_number: accountNumber,
      amount: parseFloat(amount),
      narration: narration.trim(),
    });

    // Close drawer after successful send
    onClose();
  };

  const formatAmountDisplay = (val: string) => {
    const num = parseFloat(val);
    if (isNaN(num)) return '₦0';
    return `₦${num.toLocaleString()}`;
  };

  return (
    <>
      <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="border-b pb-4">
            <DrawerTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-primary" />
              Send Money to Bank
            </DrawerTitle>
            <DrawerDescription>
              Send money directly from {provider === 'paystack' ? 'Paystack' : 'Flutterwave'} to any Nigerian bank account
            </DrawerDescription>
          </DrawerHeader>

          <div className="p-4 space-y-6 overflow-y-auto">
            {/* Step Indicator */}
            <div className="flex items-center justify-center gap-2 pb-2">
              {(['bank', 'account', 'amount', 'confirm'] as Step[]).map((s, i) => (
                <div key={s} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors
                    ${step === s ? 'bg-primary text-primary-foreground' : 
                      ['bank', 'account', 'amount', 'confirm'].indexOf(step) > i 
                        ? 'bg-success text-white' 
                        : 'bg-muted text-muted-foreground'}`}>
                    {['bank', 'account', 'amount', 'confirm'].indexOf(step) > i ? '✓' : i + 1}
                  </div>
                  {i < 3 && <div className={`w-8 h-0.5 ${['bank', 'account', 'amount', 'confirm'].indexOf(step) > i ? 'bg-success' : 'bg-muted'}`} />}
                </div>
              ))}
            </div>

            {/* Step 1: Select Bank */}
            {step === 'bank' && (
              <div className="space-y-4">
                <div className="text-center pb-2">
                  <Building2 className="w-12 h-12 mx-auto mb-2 text-primary/60" />
                  <h3 className="font-semibold">Select Bank</h3>
                  <p className="text-sm text-muted-foreground">Choose the recipient's bank</p>
                </div>
                
                <BankCommandSelect
                  value={selectedBankCode}
                  onValueChange={handleBankSelect}
                  banks={banks || []}
                  placeholder="Search for a bank..."
                />
              </div>
            )}

            {/* Step 2: Enter Account Number */}
            {step === 'account' && (
              <div className="space-y-4">
                <div className="text-center pb-2">
                  <User className="w-12 h-12 mx-auto mb-2 text-primary/60" />
                  <h3 className="font-semibold">Account Details</h3>
                  <p className="text-sm text-muted-foreground">Enter the 10-digit account number</p>
                </div>

                {/* Selected Bank Display */}
                <div className="p-3 bg-muted/50 rounded-lg flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{selectedBankName}</p>
                    <p className="text-xs text-muted-foreground">Selected Bank</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="ml-auto text-xs"
                    onClick={() => setStep('bank')}
                  >
                    Change
                  </Button>
                </div>

                {/* Account Number Input */}
                <div className="space-y-2">
                  <Label htmlFor="account-number">Account Number</Label>
                  <Input
                    id="account-number"
                    type="text"
                    inputMode="numeric"
                    placeholder="0123456789"
                    maxLength={10}
                    value={accountNumber}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setAccountNumber(val);
                      if (val.length < 10) {
                        setAccountName('');
                        resolveAccount.reset();
                      }
                    }}
                    className="text-lg tracking-widest font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    {accountNumber.length}/10 digits
                  </p>
                </div>

                {/* Account Verification Status */}
                {resolveAccount.isPending && (
                  <div className="flex items-center gap-2 p-3 bg-info/10 dark:bg-info/30 rounded-lg">
                    <Loader2 className="w-5 h-5 text-info animate-spin" />
                    <span className="text-sm text-info dark:text-info">Verifying account...</span>
                  </div>
                )}

                {resolveAccount.isError && (
                  <div className="flex items-center gap-2 p-3 bg-destructive/10 dark:bg-destructive/30 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-destructive" />
                    <span className="text-sm text-destructive dark:text-destructive">
                      {resolveAccount.error?.message || 'Could not verify account'}
                    </span>
                  </div>
                )}

                {accountName && (
                  <div className="flex items-center gap-2 p-3 bg-success/10 dark:bg-success/30 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-success" />
                    <div>
                      <p className="text-sm font-medium text-success dark:text-success">{accountName}</p>
                      <p className="text-xs text-success dark:text-success">Account verified</p>
                    </div>
                  </div>
                )}

                <Button 
                  className="w-full" 
                  disabled={!accountName}
                  onClick={handleProceedToAmount}
                >
                  Continue
                </Button>
              </div>
            )}

            {/* Step 3: Enter Amount */}
            {step === 'amount' && (
              <div className="space-y-4">
                <div className="text-center pb-2">
                  <Banknote className="w-12 h-12 mx-auto mb-2 text-primary/60" />
                  <h3 className="font-semibold">Amount & Reason</h3>
                  <p className="text-sm text-muted-foreground">How much do you want to send?</p>
                </div>

                {/* Recipient Summary */}
                <div className="p-3 bg-muted/50 rounded-lg space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">To:</span>
                    <span className="text-sm font-medium">{accountName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Account:</span>
                    <span className="text-sm font-mono">{accountNumber}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Bank:</span>
                    <span className="text-sm">{selectedBankName}</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full mt-2 text-xs"
                    onClick={() => setStep('account')}
                  >
                    Change Recipient
                  </Button>
                </div>

                {/* Amount Input */}
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (₦)</Label>
                  <Input
                    id="amount"
                    type="text"
                    inputMode="numeric"
                    placeholder="50000"
                    value={amount}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^\d.]/g, '');
                      setAmount(val);
                    }}
                    className="text-2xl font-bold text-center"
                  />
                  {amount && parseFloat(amount) > 0 && (
                    <p className="text-center text-lg font-semibold text-primary">
                      {formatAmountDisplay(amount)}
                    </p>
                  )}
                </div>

                {/* Narration Input */}
                <div className="space-y-2">
                  <Label htmlFor="narration" className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Reason for Transfer
                  </Label>
                  <Textarea
                    id="narration"
                    placeholder="e.g., Vendor payment, Refund, Salary..."
                    value={narration}
                    onChange={(e) => setNarration(e.target.value)}
                    maxLength={100}
                    className="resize-none"
                    rows={2}
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {narration.length}/100
                  </p>
                </div>

                <Button 
                  className="w-full" 
                  disabled={!amount || parseFloat(amount) <= 0 || !narration.trim()}
                  onClick={handleProceedToConfirm}
                >
                  Review Transfer
                </Button>
              </div>
            )}

            {/* Step 4: Confirm */}
            {step === 'confirm' && (
              <div className="space-y-4">
                <div className="text-center pb-2">
                  <CheckCircle className="w-12 h-12 mx-auto mb-2 text-success" />
                  <h3 className="font-semibold">Confirm Transfer</h3>
                  <p className="text-sm text-muted-foreground">Review the details before sending</p>
                </div>

                {/* Final Summary */}
                <div className="p-4 bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl border border-primary/20 space-y-3">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Amount to Send</p>
                    <p className="text-3xl font-bold text-primary">{formatAmountDisplay(amount)}</p>
                  </div>
                  
                  <div className="h-px bg-border" />
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Recipient:</span>
                      <span className="text-sm font-medium text-right max-w-[60%] truncate">{accountName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Account:</span>
                      <span className="text-sm font-mono">{accountNumber}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Bank:</span>
                      <span className="text-sm text-right max-w-[60%] truncate">{selectedBankName}</span>
                    </div>
                    <div className="flex items-start justify-between">
                      <span className="text-sm text-muted-foreground">Reason:</span>
                      <span className="text-sm text-right max-w-[60%]">{narration}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => setStep('amount')}
                    disabled={sendMoney.isPending}
                  >
                    Go Back
                  </Button>
                  <Button 
                    className="flex-1"
                    onClick={() => setShowConfirmDialog(true)}
                    disabled={sendMoney.isPending}
                  >
                    {sendMoney.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Send Money
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Final Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Transfer</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>You are about to send:</p>
              <p className="text-2xl font-bold text-primary">{formatAmountDisplay(amount)}</p>
              <p>to <span className="font-medium">{accountName}</span></p>
              <p className="text-sm">({accountNumber} - {selectedBankName})</p>
              <p className="mt-4 text-amber-600 dark:text-amber-400 font-medium">
                This action cannot be undone. The money will be sent immediately.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSendMoney}>
              Yes, Send Money
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
