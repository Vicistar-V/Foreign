import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/hooks/useProfile';
import { useBanks } from '@/hooks/useBanks';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Building2, CheckCircle2, AlertCircle, Loader2, Shield, Search, UserCheck, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BankCommandSelect } from './BankCommandSelect';
import { haptics } from '@/lib/haptics';

import { trackClarityEvent, ClarityEvents } from '@/lib/clarityTracking';

interface AddBankAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onSuccess?: () => void;
}

type Step = 'details' | 'resolving' | 'pin' | 'success';

export const AddBankAccountModal = ({ 
  open, 
  onOpenChange, 
  userId,
  onSuccess 
}: AddBankAccountModalProps) => {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile(userId);
  const { data: banks, isLoading: isLoadingBanks } = useBanks('NG');
  const [step, setStep] = useState<Step>('details');
  const pinInputRef = useRef<HTMLInputElement>(null);
  
  // Form state
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  
  // Loading states
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Verification result
  const [verifiedName, setVerifiedName] = useState('');
  const [bankName, setBankName] = useState('');



  // Track when modal opens
  useEffect(() => {
    if (open) {
      trackClarityEvent(ClarityEvents.BANK_ACCOUNT_STARTED);
    }
  }, [open]);

  // Auto-focus PIN input when step changes to pin
  useEffect(() => {
    if (step === 'pin') {
      setTimeout(() => pinInputRef.current?.focus(), 100);
    }
  }, [step]);

  const resetForm = () => {
    setStep('details');
    setBankCode('');
    setAccountNumber('');
    setPin('');
    setError('');
    setVerifiedName('');
    setBankName('');
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleBankSelect = (code: string, name: string) => {
    setBankCode(code);
    setBankName(name);
    setError('');
  };

  const handleAccountNumberChange = (value: string) => {
    // Only allow digits and max 10 characters
    const cleaned = value.replace(/\D/g, '').slice(0, 10);
    setAccountNumber(cleaned);
    setError('');
  };

  const handleVerify = async () => {
    if (!bankCode || !accountNumber) {
      setError('Please select a bank and enter account number');
      return;
    }

    if (accountNumber.length !== 10) {
      setError('Account number must be 10 digits');
      return;
    }

    try {
      setIsVerifying(true);
      setError('');
      setStep('resolving');
      haptics.medium();

      // Fire the real verification AND a minimum-duration timer in parallel
      // so the cinematic stages always get to play their full sequence.
      const MIN_DURATION_MS = 3200;
      const startedAt = Date.now();

      const apiCall = supabase.functions.invoke('add-bank-account', {
        body: {
          bank_code: bankCode,
          account_number: accountNumber,
          verify_only: true,
        },
      });

      const [{ data, error }] = await Promise.all([
        apiCall,
        new Promise((resolve) => setTimeout(resolve, MIN_DURATION_MS)),
      ]);

      if (error) throw error;

      if (!data?.verified) {
        throw new Error('Unable to verify account');
      }

      setVerifiedName(data.account_name);
      haptics.success();
      // Small reveal beat so users see the "Found you!" pop on the resolving screen.
      await new Promise((r) => setTimeout(r, 900));
      setStep('pin');

    } catch (error: any) {
      trackClarityEvent(ClarityEvents.ERROR_BANK_VERIFICATION);
      setError(error.message || 'Failed to verify account');
      setStep('details');
      haptics.error();
    } finally {
      setIsVerifying(false);
    }
  };




  const handlePinChange = (value: string) => {
    const cleanedValue = value.replace(/\D/g, '').slice(0, 4);
    setPin(cleanedValue);
    
    // Auto-submit when 4 digits entered
    if (cleanedValue.length === 4) {
      handlePinComplete(cleanedValue);
    }
  };

  const handlePinComplete = async (enteredPin: string) => {
    try {
      setIsSaving(true);
      setError('');

      // Call add-bank-account edge function to save
      const { data, error } = await supabase.functions.invoke('add-bank-account', {
        body: {
          bank_code: bankCode,
          account_number: accountNumber,
          pin: enteredPin,
        },
      });

      if (error) throw error;

      // Check for backend-reported errors (returned as 200 with success: false)
      if (data && data.success === false) {
        setError(data.message || 'Failed to add bank account');
        setPin('');
        return;
      }

      setStep('success');
      trackClarityEvent(ClarityEvents.BANK_ACCOUNT_SUCCESS);
      
      // Invalidate withdrawal accounts cache so new account shows immediately
      queryClient.invalidateQueries({ queryKey: ['withdrawal-accounts', userId] });
      
      // Auto-close after 2 seconds
      setTimeout(() => {
        handleClose();
        onSuccess?.();
      }, 2000);
    } catch (error: any) {
      trackClarityEvent(ClarityEvents.ERROR_BANK_ADD);
      setError(error.message || 'Failed to add bank account');
      setPin('');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={handleClose}>
      <DrawerContent className={step === 'pin' ? '' : 'max-h-[90vh]'}>
        {/* Scrollable area - header + content */}
        <div className={step === 'pin' ? '' : 'overflow-y-auto max-h-[calc(90vh-120px)]'}>
          <DrawerHeader className="pb-2">
            <DrawerTitle>
              {step === 'details' && 'Add Bank Account'}
              {step === 'resolving' && 'Talking to your bank…'}
              {step === 'pin' && 'Confirm with PIN'}
              {step === 'success' && 'Account Added!'}
            </DrawerTitle>
            <DrawerDescription>
              {step === 'details' && 'Enter your bank account details for withdrawals'}
              {step === 'resolving' && 'Pulling your name straight from the bank — no typing needed.'}
              {step === 'pin' && 'Enter your 4-digit security PIN'}
              {step === 'success' && 'Your bank account has been added successfully'}
            </DrawerDescription>
          </DrawerHeader>

          <div className={`px-4 pb-4 ${step === 'pin' ? 'space-y-3' : 'space-y-4'}`}>
          {/* STEP 1: Bank Details */}
          {step === 'details' && (
            <>
              {/* Bank Selection */}
              <div className="space-y-2">
                <Label htmlFor="bank">Bank Name</Label>
                {isLoadingBanks ? (
                  <Button variant="outline" className="w-full h-11 justify-start" disabled>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading banks...
                  </Button>
                ) : !banks || banks.length === 0 ? (
                  <>
                    <Button variant="outline" className="w-full h-11 justify-start text-muted-foreground" disabled>
                      No banks available
                    </Button>
                    <p className="text-xs text-destructive">
                      Bank list not available. Please run the sync command first.
                    </p>
                  </>
                ) : (
                  <BankCommandSelect
                    banks={banks}
                    value={bankCode}
                    onValueChange={handleBankSelect}
                    placeholder="Select your bank"
                  />
                )}
              </div>

              {/* Account Number */}
              <div className="space-y-2">
                <Label htmlFor="account">Account Number</Label>
                <Input
                  id="account"
                  type="tel"
                  inputMode="numeric"
                  placeholder="0123456789"
                  value={accountNumber}
                  onChange={(e) => handleAccountNumberChange(e.target.value)}
                  maxLength={10}
                  className="text-lg"
                />
                <p className="text-xs text-muted-foreground">
                  Enter your 10-digit account number
                </p>
              </div>

              {/* Error Alert */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Name-matching restriction removed — PIN keeps withdrawals safe. */}

            </>
          )}

          {/* STEP 1.5: Cinematic resolving — "talking to the bank" */}
          {step === 'resolving' && (
            <ResolvingStage bankName={bankName} accountNumber={accountNumber} verifiedName={verifiedName} />
          )}



          {/* STEP 2: PIN Entry - Compact with Native Mobile Keyboard */}
          {step === 'pin' && (
            <>
              {/* Compact Verified Account Info */}
              <div className="bg-success/10 rounded-lg p-3 border border-success/20">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium">{bankName}</p>
                    <p className="text-muted-foreground text-xs">{accountNumber} • {verifiedName}</p>
                  </div>
                </div>
              </div>

              {/* Error Alert */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Native PIN Input */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-center">Enter Your Security PIN</p>
                
                <div 
                  className="py-4 bg-muted/30 rounded-xl border border-border cursor-text"
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
                  
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Tap to enter your 4-digit PIN
                  </p>
                </div>
              </div>

              {isSaving && (
                <div className="text-center py-2">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />
                  <p className="text-xs text-muted-foreground mt-1">Saving...</p>
                </div>
              )}

              {/* Back button */}
              {!isSaving && (
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setStep('details');
                    setPin('');
                  }}
                  className="w-full h-10"
                >
                  Back
                </Button>
              )}
            </>
          )}

          {/* STEP 3: Success */}
          {step === 'success' && (
            <div className="text-center py-8">
              <div className="mx-auto w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="h-8 w-8 text-success" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Bank Account Added!</h3>
              <p className="text-sm text-muted-foreground">
                You can now withdraw money to this account
              </p>
            </div>
          )}
          </div>
        </div>

        {/* Fixed footer with action buttons */}
        {step === 'details' && (
          <DrawerFooter className="sticky bottom-0 bg-background border-t">
            <Button
              onClick={handleVerify}
              disabled={isVerifying || !bankCode || accountNumber.length !== 10}
              className="h-12"
              haptic="medium"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify Account'
              )}
            </Button>
            <Button variant="outline" onClick={handleClose} className="h-10">
              Cancel
            </Button>
          </DrawerFooter>
        )}

      </DrawerContent>
    </Drawer>
  );
};

// ─── Cinematic resolving stage ─────────────────────────────────────────────
// Plays a 3-beat "talking to the bank" sequence while the real API call runs
// underneath. Even on a 200ms response, users feel a satisfying ritual.
interface ResolvingStageProps {
  bankName: string;
  accountNumber: string;
  verifiedName: string;
}

const RESOLVING_STEPS = [
  { icon: Shield, label: 'Securely connecting', sub: 'Encrypted handshake with your bank' },
  { icon: Search, label: 'Looking up your account', sub: 'Asking your bank to confirm the number' },
  { icon: UserCheck, label: 'Confirming the name on file', sub: 'Matching the account to a real person' },
];

const ResolvingStage = ({ bankName, accountNumber, verifiedName }: ResolvingStageProps) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const revealed = !!verifiedName;

  useEffect(() => {
    // Advance through the 3 beats over ~3.2s — matches MIN_DURATION_MS in handleVerify.
    const timers = [
      setTimeout(() => setActiveIdx(1), 1000),
      setTimeout(() => setActiveIdx(2), 2100),
      setTimeout(() => setActiveIdx(3), 3100), // all complete
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="py-3">
      {/* Bank header card */}
      <div className="rounded-2xl border border-border bg-card p-3 mb-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Building2 className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{bankName || 'Your bank'}</p>
          <p className="text-xs text-muted-foreground tabular-nums">{accountNumber}</p>
        </div>
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </span>
      </div>

      {/* Step timeline */}
      <div className="space-y-2.5">
        {RESOLVING_STEPS.map((s, i) => {
          const done = i < activeIdx;
          const active = i === activeIdx;
          const Icon = s.icon;
          return (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className={cnLocal(
                'flex items-center gap-3 rounded-xl border p-3 transition-colors',
                done
                  ? 'bg-emerald-500/5 border-emerald-500/20'
                  : active
                  ? 'bg-primary/5 border-primary/30'
                  : 'bg-muted/30 border-border',
              )}
            >
              <div
                className={cnLocal(
                  'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                  done
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : active
                    ? 'bg-primary/15 text-primary'
                    : 'bg-muted text-muted-foreground/60',
                )}
              >
                {done ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : active ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={cnLocal(
                    'text-sm font-semibold',
                    done ? 'text-foreground' : active ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {s.label}
                </p>
                <p className="text-[11px] text-muted-foreground leading-tight">{s.sub}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Reveal */}
      <AnimatePresence>
        {revealed && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="mt-5 rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent p-4 text-center relative overflow-hidden"
          >
            <motion.div
              initial={{ opacity: 0, rotate: -10, scale: 0.5 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 14 }}
              className="absolute top-2 right-2"
            >
              <Sparkles className="h-4 w-4 text-emerald-400" />
            </motion.div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-400 mb-1">
              Found you
            </p>
            <p className="text-xl font-extrabold text-foreground leading-tight">{verifiedName}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {bankName} • {accountNumber}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Local cn helper so we don't add another import line up top.
function cnLocal(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
