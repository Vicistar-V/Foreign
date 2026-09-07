import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useBalances } from '@/hooks/useBalances';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import { useWithdrawalAccounts } from '@/hooks/useWithdrawalAccounts';
import { useRetirementStatus } from '@/hooks/useRetirementStatus';
import { AddBankAccountModal } from '@/components/AddBankAccountModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ArrowDownToLine,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Wallet,
  Banknote,
  Lock,
  Building2,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { trackClarityEvent, ClarityEvents } from '@/lib/clarityTracking';
import { haptics } from '@/lib/haptics';
import { openRestoreCapacityDrawer } from '@/lib/restoreCapacityStore';

/**
 * Dedicated withdraw page. Replaces the old WithdrawalModal drawer.
 *
 * Flow: members-only redirect → single open withdraw form.
 */
export default function Withdraw() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const { data: balances } = useBalances(user?.id);
  const { data: config } = usePlatformConfig();
  const { data: accountsData } = useWithdrawalAccounts(user?.id);
  const { data: retirement } = useRetirementStatus();

  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState<'amount' | 'pin' | 'success'>('amount');
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const pinInputRef = useRef<HTMLInputElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);

  const isMember = profile?.is_member ?? false;
  const currentBalance = Math.max(0, balances?.earnings_balance ?? 0);
  const minimumWithdrawal = config?.minimum_withdrawal ?? 1000;
  const withdrawalFee = config?.withdrawal_fee ?? 50;
  const maintenanceMode = config?.maintenance_mode || false;
  const withdrawalsDisabled = !config?.withdrawals_enabled;
  const primaryAccount = accountsData?.accounts.find((a) => a.is_primary && a.is_verified);

  useEffect(() => {
    trackClarityEvent(ClarityEvents.WITHDRAWAL_STARTED);
  }, []);

  useEffect(() => {
    if (step === 'pin') setTimeout(() => pinInputRef.current?.focus(), 100);
  }, [step]);

  const withdrawalMutation = useMutation({
    mutationFn: async ({ amount, pin }: { amount: number; pin: string }) => {
      const { data, error } = await supabase.functions.invoke('initiate-withdrawal', {
        body: { amount, pin },
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.error || 'Withdrawal failed');
      return data;
    },
    onSuccess: () => {
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ['balances', user.id] });
        queryClient.invalidateQueries({ queryKey: ['transactions', user.id] });
        // CRITICAL: the retirement flag flips the moment this withdrawal lands
        // — if we don't invalidate here, the dashboard renders the OLD
        // "not retired" state for up to 15s (staleTime) and the retirement
        // hero / Restore drawer never shows up on time.
        queryClient.invalidateQueries({ queryKey: ['retirement-status', user.id] });
        queryClient.invalidateQueries({ queryKey: ['drop-status', user.id] });
      }
      setStep('success');
      haptics.success();
      trackClarityEvent(ClarityEvents.WITHDRAWAL_SUCCESS);
    },
    onError: (err: any) => {
      setError(err.message || 'Withdrawal failed');
      setPin('');
      trackClarityEvent(ClarityEvents.ERROR_WITHDRAWAL_API);
    },
  });

  // Not even a member yet → redirect to dashboard activation
  if (!isMember) {
    navigate('/dashboard', { replace: true, state: { shakeCTA: true, ts: Date.now() } });
    return null;
  }


  // ─── Open withdraw form (STAGE 5) ──────────────────────────────────────────
  const numAmount = parseFloat(amount) || 0;
  const receiveAmount = Math.max(0, numAmount - withdrawalFee);
  const quickAmounts = [1000, 2500, 5000];

  const handleAmountSubmit = () => {
    setError('');
    if (!numAmount || numAmount <= 0) return setError('Please enter a valid amount');
    if (numAmount < minimumWithdrawal)
      return setError(`Minimum: ₦${minimumWithdrawal.toLocaleString()}`);
    if (numAmount > currentBalance) return setError('Not enough in your wallet');
    if (!primaryAccount) return setError('Add a bank account first');
    trackClarityEvent(ClarityEvents.WITHDRAWAL_AMOUNT_ENTERED);
    setStep('pin');
  };

  const handlePinChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 4);
    setPin(cleaned);
    if (cleaned.length === 4) {
      withdrawalMutation.mutate({ amount: numAmount, pin: cleaned });
    }
  };

  const handleQuickSelect = (amt: number | 'max') => {
    if (amt === 'max') setAmount(String(currentBalance));
    else setAmount(String(Math.min(amt, currentBalance)));
  };

  return (
    <div
      className="p-4 md:p-8 pb-24 max-w-2xl mx-auto"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 6rem)' }}
    >
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 active:scale-95 transition-transform"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 flex items-center justify-center">
          <ArrowDownToLine className="h-6 w-6 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Withdraw</h1>
          <p className="text-xs text-muted-foreground">
            Send money to your bank account
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {step === 'amount' && (
          <>
            {maintenanceMode && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <AlertCircle className="h-4 w-4 text-amber-400 flex-shrink-0" />
                <p className="text-xs text-amber-300">
                  Platform under maintenance. Try again soon.
                </p>
              </div>
            )}
            {!maintenanceMode && withdrawalsDisabled && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/30">
                <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                <p className="text-xs text-destructive">
                  Withdrawals temporarily disabled.
                </p>
              </div>
            )}
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/30">
                <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                <p className="text-xs text-destructive">{error}</p>
              </div>
            )}

            {/* Balance hero */}
            <div className="rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-card to-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-400/90">
                  Available
                </span>
              </div>
              <p className="text-3xl sm:text-4xl font-extrabold tabular-nums text-foreground">
                ₦{currentBalance.toLocaleString()}
              </p>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Amount to withdraw</p>
              <div
                className="relative cursor-text"
                onClick={() => amountInputRef.current?.focus()}
              >
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-muted-foreground">
                  ₦
                </span>
                <Input
                  ref={amountInputRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                  className="h-14 pl-10 pr-4 text-2xl font-bold text-center bg-muted/30 border-2 border-border rounded-xl focus:border-primary"
                  autoComplete="off"
                />
              </div>

              <div className="flex gap-2">
                {quickAmounts.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => handleQuickSelect(amt)}
                    disabled={amt > currentBalance}
                    className={cn(
                      'flex-1 py-2 rounded-lg text-sm font-medium border transition-all',
                      numAmount === amt
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-card text-foreground hover:border-primary/40',
                      amt > currentBalance && 'opacity-40 cursor-not-allowed'
                    )}
                  >
                    ₦{amt >= 1000 ? `${amt / 1000}k` : amt}
                  </button>
                ))}
                <button
                  onClick={() => handleQuickSelect('max')}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-sm font-medium border transition-all',
                    numAmount === currentBalance
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card text-foreground hover:border-primary/40'
                  )}
                >
                  Max
                </button>
              </div>
            </div>

            {/* Breakdown */}
            <AnimatePresence>
              {numAmount >= minimumWithdrawal && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-3 rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Amount</span>
                      <span className="font-medium tabular-nums">
                        ₦{numAmount.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Fee</span>
                      <span className="text-destructive tabular-nums">-₦{withdrawalFee.toLocaleString()}</span>
                    </div>
                    <div className="h-px bg-border" />
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">You'll receive</span>
                      <span className="text-lg font-bold text-primary tabular-nums">
                        ₦{receiveAmount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bank account */}
            {primaryAccount ? (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <Banknote className="h-5 w-5 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Sending to</p>
                  <p className="font-medium text-sm truncate">{primaryAccount.bank_name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {primaryAccount.account_number} • {primaryAccount.account_name}
                  </p>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setBankModalOpen(true)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/15 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-amber-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-foreground">Add Bank Account</p>
                  <p className="text-xs text-muted-foreground">
                    Required before withdrawing
                  </p>
                </div>
                <span className="text-primary text-sm font-medium">Add →</span>
              </button>
            )}

            <Button
              onClick={handleAmountSubmit}
              disabled={
                !amount ||
                numAmount <= 0 ||
                maintenanceMode ||
                withdrawalsDisabled ||
                !primaryAccount
              }
              className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-base gap-2 rounded-xl shadow-lg shadow-primary/25"
              size="lg"
              haptic="heavy"
            >
              {!primaryAccount ? (
                'Add Bank Account First'
              ) : (
                <>
                  <ArrowDownToLine className="h-5 w-5" />
                  Continue to PIN
                </>
              )}
            </Button>
          </>
        )}

        {step === 'pin' && (
          <div className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/30">
                <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                <p className="text-xs text-destructive">{error}</p>
              </div>
            )}

            <div className="text-center p-4 rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20">
              <p className="text-xs text-muted-foreground">Withdrawing</p>
              <p className="text-2xl font-bold text-primary tabular-nums">
                ₦{receiveAmount.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                to {primaryAccount?.bank_name}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground text-center">
                Security PIN
              </p>
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
                        backgroundColor:
                          pin.length > i
                            ? 'hsl(var(--primary))'
                            : 'hsl(var(--muted-foreground) / 0.3)',
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
                  autoFocus
                />
                <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
                  Tap to enter PIN
                </p>
              </div>
            </div>

            {withdrawalMutation.isPending && (
              <div className="flex items-center justify-center gap-2 py-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">
                  Processing withdrawal...
                </span>
              </div>
            )}

            {!withdrawalMutation.isPending && (
              <button
                onClick={() => {
                  setStep('amount');
                  setPin('');
                  setError('');
                }}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
              >
                ← Back to amount
              </button>
            )}
          </div>
        )}

        {step === 'success' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-8"
          >
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Withdrawal Sent!</h2>
            <p className="text-sm text-muted-foreground mb-4 px-4">
              ₦{receiveAmount.toLocaleString()} is on its way to your bank.
              You'll get a notification when it arrives.
            </p>
            {retirement?.is_retired && (
              <div className="mb-6 px-4 space-y-1">
                <p className="text-sm text-emerald-500 font-medium">
                  Your ad share just finished its campaign — want to send another one to work?
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Tap below and we'll show you a quick 1-tap Restore option next.
                </p>
              </div>
            )}

            <Button
              onClick={async () => {
                // Refetch retirement freshly BEFORE deciding whether to open
                // the Restore drawer — the cached value can lag the DB by up
                // to 15s (query staleTime) and firing openRestoreCapacityDrawer()
                // blind sets the module-level open flag to true even when
                // RestoreCapacityHost doesn't render, causing a ghost pop-up
                // later in the session when retirement finally flips true.
                if (user?.id) {
                  await queryClient.invalidateQueries({ queryKey: ['retirement-status', user.id] });
                }
                let stillRetired = false;
                try {
                  const { data: fresh } = await supabase.rpc('get_retirement_status');
                  stillRetired = (fresh as any)?.is_retired === true;
                  if (stillRetired) {
                    openRestoreCapacityDrawer();
                  }
                } catch {
                  /* fall through — dashboard hero still nudges if retired */
                }
                if (!stillRetired && retirement?.is_retired) {
                  // Recheck came back "not retired" — reassure the user their
                  // spot is still active so the CTA doesn't feel like a no-op.
                  toast({ title: "Your ad share is still active — keep earning!" });
                }
                navigate('/dashboard');
              }}
              className="w-full h-12 rounded-xl"
              haptic="medium"
            >
              {retirement?.is_retired ? 'Back to your campaign →' : 'Back to Home'}
            </Button>

          </motion.div>
        )}

      </div>

      {user?.id && (
        <AddBankAccountModal
          open={bankModalOpen}
          onOpenChange={setBankModalOpen}
          userId={user.id}
        />
      )}
    </div>
  );
}
