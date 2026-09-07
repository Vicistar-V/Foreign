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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Boxes, Wallet, TrendingUp, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminCreateSpotDrawerProps {
  userId: string | null;
  userName: string;
  isMember: boolean;
  isBanned: boolean;
  depositBalance: number;
  earningsBalance: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type WalletType = 'deposit' | 'earnings';

export const AdminCreateSpotDrawer = ({
  userId,
  userName,
  isMember,
  isBanned,
  depositBalance,
  earningsBalance,
  open,
  onOpenChange,
}: AdminCreateSpotDrawerProps) => {
  const [step, setStep] = useState<'form' | 'pin'>('form');
  const [sourceWallet, setSourceWallet] = useState<WalletType>('deposit');
  const [quantity, setQuantity] = useState<number>(1);
  const [pin, setPin] = useState('');
  const pinInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Spot cost from platform config (cached widely already)
  const { data: spotCost = 0 } = useQuery({
    queryKey: ['platform-config-spot-cost'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_config')
        .select('drop_entry_fee')
        .eq('id', 1)
        .single();
      if (error) throw error;
      return Number(data?.drop_entry_fee || 0);
    },
    staleTime: 5 * 60 * 1000,
    enabled: open,
  });

  const walletBalance = sourceWallet === 'deposit' ? depositBalance : earningsBalance;
  const maxAffordable = spotCost > 0 ? Math.floor(walletBalance / spotCost) : 0;
  const totalCost = spotCost * quantity;
  const hasEnough = walletBalance >= totalCost && quantity >= 1;

  // Clamp quantity when wallet/cost changes
  if (quantity > maxAffordable && maxAffordable > 0 && quantity > 1) {
    // schedule clamp without setState-in-render warning
    queueMicrotask(() => setQuantity(Math.max(1, maxAffordable)));
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('No user selected');
      const { data, error } = await supabase.functions.invoke('admin-create-spot', {
        body: { userId, sourceWallet, adminPin: pin, quantity },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to create spot');
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['user-details', userId] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      toast.success(data.partial ? 'Partly done' : 'Spots Created', { description: data.message });
      handleClose();
    },
    onError: (error: Error) => {
      toast.error('Could not create spot', { description: error.message });
      setStep('form');
      setPin('');
    },
  });

  const handleClose = () => {
    setStep('form');
    setSourceWallet('deposit');
    setQuantity(1);
    setPin('');
    onOpenChange(false);
  };

  const handleProceed = () => {
    if (!isMember) {
      toast.error('User not activated', { description: 'Activate the user first' });
      return;
    }
    if (isBanned) {
      toast.error('User is banned');
      return;
    }
    if (maxAffordable < 1) {
      toast.error('Not enough money', {
        description: `${sourceWallet} wallet needs at least ₦${spotCost.toLocaleString()}`,
      });
      return;
    }
    if (!hasEnough) {
      toast.error('Too many spots', {
        description: `Wallet can only afford ${maxAffordable} spot${maxAffordable === 1 ? '' : 's'}`,
      });
      return;
    }
    setStep('pin');
  };

  const handlePinChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 4);
    setPin(cleaned);
    if (cleaned.length === 4) createMutation.mutate();
  };

  if (!userId) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh] flex flex-col">
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <Boxes className="h-5 w-5 text-primary" />
            Create Spot
          </DrawerTitle>
          <DrawerDescription>Buy a spot for {userName}</DrawerDescription>
        </DrawerHeader>

        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {step === 'form' && (
            <>
              {/* Cost card */}
              <div className="rounded-xl border bg-muted/30 p-4 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Cost per spot</span>
                <span className="text-xl font-bold">₦{spotCost.toLocaleString()}</span>
              </div>

              {/* Wallet picker */}
              <div className="space-y-3">
                <Label>Charge from which wallet?</Label>
                <RadioGroup value={sourceWallet} onValueChange={(v) => { setSourceWallet(v as WalletType); setQuantity(1); }}>
                  <div
                    className={cn(
                      'flex items-center gap-3 p-4 rounded-xl border transition-all',
                      sourceWallet === 'deposit' && 'border-primary bg-primary/5',
                    )}
                  >
                    <RadioGroupItem value="deposit" id="deposit" />
                    <Wallet className="h-5 w-5 text-muted-foreground" />
                    <Label htmlFor="deposit" className="flex-1 cursor-pointer">
                      <div className="font-semibold">Deposit wallet</div>
                      <div className="text-xs text-muted-foreground">
                        Balance: ₦{depositBalance.toLocaleString()}
                      </div>
                    </Label>
                  </div>
                  <div
                    className={cn(
                      'flex items-center gap-3 p-4 rounded-xl border transition-all',
                      sourceWallet === 'earnings' && 'border-primary bg-primary/5',
                    )}
                  >
                    <RadioGroupItem value="earnings" id="earnings" />
                    <TrendingUp className="h-5 w-5 text-muted-foreground" />
                    <Label htmlFor="earnings" className="flex-1 cursor-pointer">
                      <div className="font-semibold">Earnings wallet</div>
                      <div className="text-xs text-muted-foreground">
                        Balance: ₦{earningsBalance.toLocaleString()}
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Quantity picker */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>How many spots?</Label>
                  <span className="text-xs text-muted-foreground">
                    Wallet can afford {maxAffordable}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-12 w-12 rounded-xl"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                  >
                    <Minus className="h-5 w-5" />
                  </Button>
                  <div className="flex-1 h-12 rounded-xl border bg-muted/30 flex items-center justify-center text-2xl font-bold tabular-nums">
                    {quantity}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-12 w-12 rounded-xl"
                    onClick={() => setQuantity((q) => Math.min(Math.max(1, maxAffordable), q + 1))}
                    disabled={quantity >= maxAffordable}
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-12 px-3 rounded-xl text-xs"
                    onClick={() => setQuantity(Math.max(1, maxAffordable))}
                    disabled={maxAffordable < 1 || quantity === maxAffordable}
                  >
                    Max
                  </Button>
                </div>
              </div>

              {/* Total card */}
              <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total to charge</span>
                  <span className="text-2xl font-bold text-primary">
                    ₦{totalCost.toLocaleString()}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {quantity} × ₦{spotCost.toLocaleString()} from {sourceWallet} wallet
                </div>
              </div>

              {!isMember && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
                  This user has not activated yet. Activate first before buying a spot.
                </div>
              )}

              {isMember && maxAffordable < 1 && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
                  Not enough money in {sourceWallet} wallet. Short by ₦
                  {(spotCost - walletBalance).toLocaleString()}.
                </div>
              )}

              <Button
                onClick={handleProceed}
                className="w-full h-12 text-base"
                size="lg"
                disabled={!isMember || isBanned || !hasEnough || spotCost <= 0 || maxAffordable < 1}
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
                  <span className="font-bold text-primary">
                    Buy {quantity} spot{quantity === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total cost:</span>
                  <span className="font-medium">₦{totalCost.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Wallet:</span>
                  <span className="font-medium capitalize">{sourceWallet}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">User:</span>
                  <span className="font-medium">{userName}</span>
                </div>
              </div>

              <div className="space-y-4">
                <Label>Enter Your Admin PIN</Label>
                {createMutation.isPending ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                    <p className="text-sm text-muted-foreground">Creating {quantity} spot{quantity === 1 ? '' : 's'}...</p>
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
                disabled={createMutation.isPending}
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
