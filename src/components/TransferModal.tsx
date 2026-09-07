import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerFooter } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { ArrowRight, Loader2, Wallet, ArrowLeftRight, AlertTriangle, Check, Zap } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useIsMobile } from '@/hooks/use-mobile';
import { trackClarityEvent, ClarityEvents } from '@/lib/clarityTracking';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface TransferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromWallet: 'earnings' | 'deposit';
  toWallet: 'earnings' | 'deposit';
  suggestedAmount?: number;
  onTransferSuccess?: () => void;
  availableBalance?: number;
}

export const TransferModal = ({
  open,
  onOpenChange,
  fromWallet,
  toWallet,
  suggestedAmount,
  onTransferSuccess,
  availableBalance = 0,
}: TransferModalProps) => {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [currentFromWallet, setCurrentFromWallet] = useState(fromWallet);
  const [currentToWallet, setCurrentToWallet] = useState(toWallet);
  const pinInputRef = useRef<HTMLInputElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const isMember = profile?.is_member ?? false;
  const isBlockedTransfer = currentFromWallet === 'earnings' && !isMember;

  useEffect(() => {
    if (open) {
      setPin('');
      setCustomAmount('');
      setCurrentFromWallet(fromWallet);
      setCurrentToWallet(toWallet);
      trackClarityEvent(ClarityEvents.TRANSFER_STARTED);
    }
  }, [open, fromWallet, toWallet]);

  const finalAmount = suggestedAmount || parseFloat(customAmount) || 0;
  const hasValidAmount = finalAmount > 0;
  const isInsufficientFunds = finalAmount > availableBalance;

  const handlePinChange = (value: string) => {
    const cleanedValue = value.replace(/\D/g, '').slice(0, 4);
    setPin(cleanedValue);
  };

  const handleSwapDirection = () => {
    setCurrentFromWallet(currentToWallet);
    setCurrentToWallet(currentFromWallet);
    trackClarityEvent(ClarityEvents.TRANSFER_DIRECTION_SWAPPED);
  };

  const handleQuickSelect = (amount: number | 'max') => {
    if (amount === 'max') {
      setCustomAmount(availableBalance.toString());
    } else {
      setCustomAmount(Math.min(amount, availableBalance).toString());
    }
  };

  const handleTransfer = async () => {
    if (!hasValidAmount) {
      toast({ title: 'Invalid Amount', description: 'Please enter a valid amount', variant: 'destructive' });
      return;
    }

    if (isInsufficientFunds) {
      toast({ title: 'Insufficient Funds', description: `You only have ₦${availableBalance.toLocaleString()}`, variant: 'destructive' });
      return;
    }

    if (pin.length !== 4) {
      toast({ title: 'Invalid PIN', description: 'Enter your 4-digit PIN', variant: 'destructive' });
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({ title: 'Error', description: 'Please log in to continue', variant: 'destructive' });
        return;
      }

      const { data, error } = await supabase.functions.invoke('transfer-between-wallets', {
        body: { fromWallet: currentFromWallet, toWallet: currentToWallet, amount: finalAmount, pin },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: 'Transfer Complete! 🎉', description: `₦${finalAmount.toLocaleString()} transferred successfully` });
      trackClarityEvent(ClarityEvents.TRANSFER_SUCCESS);

      setPin('');
      setCustomAmount('');
      onTransferSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      trackClarityEvent(ClarityEvents.ERROR_TRANSFER_API);
      toast({ title: 'Transfer Failed', description: error.message || 'Please try again', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const getWalletLabel = (wallet: 'earnings' | 'deposit') => 
    wallet === 'earnings' ? 'Earnings' : 'Deposit';

  const getWalletEmoji = (wallet: 'earnings' | 'deposit') => 
    wallet === 'earnings' ? '💰' : '💳';

  const quickAmounts = [500, 1000, 2000];

  const content = (
    <div className="space-y-4">
      {/* Compact Direction Selector */}
      <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/50 border border-border">
        <div className="flex-1 text-center">
          <span className="text-lg">{getWalletEmoji(currentFromWallet)}</span>
          <p className="text-xs text-muted-foreground">From</p>
          <p className="font-semibold text-sm">{getWalletLabel(currentFromWallet)}</p>
        </div>
        
        <motion.button
          whileTap={{ scale: 0.9, rotate: 180 }}
          onClick={handleSwapDirection}
          className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20"
        >
          <ArrowLeftRight className="h-4 w-4 text-primary" />
        </motion.button>
        
        <div className="flex-1 text-center">
          <span className="text-lg">{getWalletEmoji(currentToWallet)}</span>
          <p className="text-xs text-muted-foreground">To</p>
          <p className="font-semibold text-sm">{getWalletLabel(currentToWallet)}</p>
        </div>
      </div>

      {/* Blocked Transfer Warning */}
      {isBlockedTransfer && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-caution/10 border border-caution/30">
          <AlertTriangle className="h-4 w-4 text-caution flex-shrink-0" />
          <p className="text-xs text-caution-foreground">
            Activate membership to transfer from earnings
          </p>
        </div>
      )}

      {/* Amount Section */}
      {!suggestedAmount ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Amount</p>
            <p className={cn(
              "text-xs",
              isInsufficientFunds ? "text-destructive font-medium" : "text-muted-foreground"
            )}>
              Available: ₦{availableBalance.toLocaleString()}
            </p>
          </div>
          
          <div 
            className="relative cursor-text"
            onClick={() => amountInputRef.current?.focus()}
          >
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-muted-foreground">₦</span>
            <Input
              ref={amountInputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="0"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value.replace(/\D/g, ''))}
              className="h-14 pl-10 pr-4 text-2xl font-bold text-center bg-muted/30 border-2 border-border rounded-xl focus:border-primary"
              autoComplete="off"
            />
          </div>

          {/* Quick Select Pills */}
          <div className="flex gap-2">
            {quickAmounts.map((amt) => (
              <button
                key={amt}
                onClick={() => handleQuickSelect(amt)}
                disabled={amt > availableBalance}
                className={cn(
                  "flex-1 py-2 rounded-lg text-sm font-medium border transition-all",
                  parseFloat(customAmount) === amt
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-foreground hover:border-primary/40",
                  amt > availableBalance && "opacity-40 cursor-not-allowed"
                )}
              >
                ₦{amt >= 1000 ? `${amt/1000}k` : amt}
              </button>
            ))}
            <button
              onClick={() => handleQuickSelect('max')}
              className={cn(
                "flex-1 py-2 rounded-lg text-sm font-medium border transition-all",
                parseFloat(customAmount) === availableBalance
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-foreground hover:border-primary/40"
              )}
            >
              Max
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/20">
          <span className="text-sm text-muted-foreground">Amount</span>
          <span className="text-xl font-bold text-primary">₦{suggestedAmount.toLocaleString()}</span>
        </div>
      )}

      {/* Compact PIN Input */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground text-center">Security PIN</p>
        
        <div 
          className="py-3 bg-muted/30 rounded-xl border border-border cursor-text"
          onClick={() => pinInputRef.current?.focus()}
        >
          <div className="flex items-center justify-center gap-3">
            {[0, 1, 2, 3].map((i) => (
              <motion.div 
                key={i}
                animate={{ 
                  scale: pin.length === i ? 1.2 : 1,
                  backgroundColor: pin.length > i ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.3)'
                }}
                className="w-3.5 h-3.5 rounded-full"
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
          />
          
          <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
            Tap to enter PIN
          </p>
        </div>
      </div>

      {/* Amount Preview */}
      <AnimatePresence>
        {hasValidAmount && !isInsufficientFunds && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center justify-center gap-2 text-xs text-muted-foreground"
          >
            <Check className="h-3.5 w-3.5 text-success" />
            <span>₦{finalAmount.toLocaleString()} will be transferred instantly</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  const actionButton = (
    <Button
      onClick={handleTransfer}
      disabled={loading || pin.length !== 4 || !hasValidAmount || isInsufficientFunds || isBlockedTransfer}
      className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-base gap-2 rounded-xl shadow-lg shadow-primary/25"
      size="lg"
      haptic="heavy"
    >
      {loading ? (
        <>
          <Loader2 className="h-5 w-5 animate-spin" />
          Processing...
        </>
      ) : isBlockedTransfer ? (
        'Activate Membership First'
      ) : (
        <>
          <Zap className="h-5 w-5" />
          Transfer ₦{finalAmount.toLocaleString()}
        </>
      )}
    </Button>
  );

  // Mobile: Compact Drawer
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85vh] flex flex-col rounded-t-[20px]">
          {/* Compact Header */}
          <div className="px-4 pt-2 pb-3 border-b border-border/50">
            <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-3" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <ArrowLeftRight className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Transfer Money</h2>
                <p className="text-xs text-muted-foreground">Move between wallets</p>
              </div>
            </div>
          </div>
          
          {/* Content */}
          <div className="px-4 py-4 overflow-y-auto flex-1">
            {content}
          </div>
          
          {/* Footer */}
          <DrawerFooter className="border-t border-border/50 pt-3 pb-4 gap-2">
            {actionButton}
            <button 
              onClick={() => onOpenChange(false)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop: Dialog
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-xl flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <ArrowLeftRight className="h-5 w-5 text-primary" />
            </div>
            Transfer Money
          </DialogTitle>
          <DialogDescription className="text-sm">
            Move money between your wallets
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-2">
          {content}
        </div>
        
        <div className="pt-2">
          {actionButton}
        </div>
      </DialogContent>
    </Dialog>
  );
};
