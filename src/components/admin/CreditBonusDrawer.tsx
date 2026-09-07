import { useState, useRef } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreditBonusDrawerProps {
  userId: string | null;
  userName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type WalletType = 'earnings' | 'deposit' | 'pending';
type Operation = 'add' | 'remove';

export const CreditBonusDrawer = ({
  userId,
  userName,
  open,
  onOpenChange,
}: CreditBonusDrawerProps) => {
  const [step, setStep] = useState<'form' | 'pin'>('form');
  const [operation, setOperation] = useState<Operation>('add');
  const [amount, setAmount] = useState('');
  const [walletType, setWalletType] = useState<WalletType>('earnings');
  const [reason, setReason] = useState('');
  const [pin, setPin] = useState('');
  const pinInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const adjustMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('No user selected');

      const { data, error } = await supabase.functions.invoke('credit-bonus', {
        body: {
          userId,
          amount: parseFloat(amount),
          walletType,
          operation,
          reason,
          adminPin: pin,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to adjust balance');
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['user-details', userId] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      toast.success(operation === 'add' ? 'Money Added' : 'Money Removed', {
        description: data.message,
      });
      handleClose();
    },
    onError: (error: Error) => {
      toast.error('Could not adjust balance', { description: error.message });
      setStep('form');
      setPin('');
    },
  });

  const handleClose = () => {
    setStep('form');
    setOperation('add');
    setAmount('');
    setWalletType('earnings');
    setReason('');
    setPin('');
    onOpenChange(false);
  };

  const handleProceedToPin = () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Invalid Amount', { description: 'Enter an amount greater than zero' });
      return;
    }
    if (!reason.trim()) {
      toast.error('Reason Required', { description: 'Type a short reason' });
      return;
    }
    setStep('pin');
  };

  const handlePinChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 4);
    setPin(cleaned);
    if (cleaned.length === 4) adjustMutation.mutate();
  };

  if (!userId) return null;

  const walletLabels: Record<WalletType, string> = {
    earnings: 'Earnings (can be withdrawn)',
    deposit: 'Deposit (used to join drops)',
    pending: 'Pending (locked until cycle finishes)',
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh] flex flex-col">
        <DrawerHeader>
          <DrawerTitle>Adjust Balance</DrawerTitle>
          <DrawerDescription>Add or remove money for {userName}</DrawerDescription>
        </DrawerHeader>

        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {step === 'form' && (
            <>
              {/* Add / Remove toggle */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setOperation('add')}
                  className={cn(
                    'flex items-center justify-center gap-2 h-14 rounded-xl border text-sm font-semibold transition-all',
                    operation === 'add'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/30 border-border text-muted-foreground',
                  )}
                >
                  <Plus className="h-4 w-4" /> Add money
                </button>
                <button
                  type="button"
                  onClick={() => setOperation('remove')}
                  className={cn(
                    'flex items-center justify-center gap-2 h-14 rounded-xl border text-sm font-semibold transition-all',
                    operation === 'remove'
                      ? 'bg-destructive text-destructive-foreground border-destructive'
                      : 'bg-muted/30 border-border text-muted-foreground',
                  )}
                >
                  <Minus className="h-4 w-4" /> Remove money
                </button>
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (₦)</Label>
                <Input
                  id="amount"
                  type="number"
                  inputMode="numeric"
                  placeholder="Enter amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-12 text-lg"
                />
              </div>

              {/* Wallet picker */}
              <div className="space-y-3">
                <Label>Which wallet?</Label>
                <RadioGroup value={walletType} onValueChange={(v) => setWalletType(v as WalletType)}>
                  {(['earnings', 'deposit', 'pending'] as WalletType[]).map((w) => (
                    <div key={w} className="flex items-center space-x-2 p-3 rounded-lg border">
                      <RadioGroupItem value={w} id={w} />
                      <Label htmlFor={w} className="flex-1 cursor-pointer text-sm">
                        {walletLabels[w]}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              {/* Reason */}
              <div className="space-y-2">
                <Label htmlFor="reason">Why?</Label>
                <Textarea
                  id="reason"
                  placeholder={
                    operation === 'add'
                      ? 'E.g. compensation for delayed payout'
                      : 'E.g. reversing a mistaken credit'
                  }
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>

              <Button
                onClick={handleProceedToPin}
                className={cn(
                  'w-full h-12 text-base',
                  operation === 'remove' && 'bg-destructive hover:bg-destructive/90 text-destructive-foreground',
                )}
                size="lg"
              >
                Continue to PIN
              </Button>
            </>
          )}

          {step === 'pin' && (
            <div className="space-y-6">
              <div className="p-4 rounded-lg bg-muted space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Action:</span>
                  <span className={cn('font-bold', operation === 'remove' ? 'text-destructive' : 'text-primary')}>
                    {operation === 'add' ? 'Add' : 'Remove'} ₦{parseFloat(amount).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Wallet:</span>
                  <span className="font-medium capitalize">{walletType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">User:</span>
                  <span className="font-medium">{userName}</span>
                </div>
              </div>

              <div className="space-y-4">
                <Label>Enter Your Admin PIN</Label>
                {adjustMutation.isPending ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                    <p className="text-sm text-muted-foreground">Processing...</p>
                  </div>
                ) : (
                  <div
                    className="py-6 bg-muted/30 rounded-xl border border-border cursor-text"
                    onClick={() => pinInputRef.current?.focus()}
                  >
                    <div className="flex items-center justify-center gap-3">
                      {[0, 1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className={cn(
                            'w-4 h-4 rounded-full transition-all',
                            pin.length > i ? 'bg-primary scale-110' : 'bg-muted-foreground/30',
                          )}
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
                )}
              </div>

              <Button
                onClick={() => {
                  setStep('form');
                  setPin('');
                }}
                variant="outline"
                className="w-full"
                disabled={adjustMutation.isPending}
              >
                Back
              </Button>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
