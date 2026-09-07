import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2, AlertCircle, Building2, User, Shield, ChevronRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BankCommandSelect } from '@/components/BankCommandSelect';
import { useBanks } from '@/hooks/useBanks';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface BankVerifiedNameInputProps {
  onNameVerified: (name: string, bankCode: string, accountNumber: string, bankName: string) => void;
  onSkip: () => void;
  disabled?: boolean;
}

type Step = 'bank' | 'account' | 'verifying' | 'success';

// Fun loading messages that rotate during verification
const LOADING_MESSAGES = [
  { text: "Connecting to your bank...", icon: Building2 },
  { text: "Pulling your account details...", icon: User },
  { text: "Matching your identity...", icon: Shield },
  { text: "Almost there...", icon: Check },
];

export const BankVerifiedNameInput = ({ 
  onNameVerified, 
  onSkip,
  disabled = false 
}: BankVerifiedNameInputProps) => {
  const { data: banks, isLoading: isLoadingBanks } = useBanks('NG');
  
  // Form state
  const [step, setStep] = useState<Step>('bank');
  const [bankCode, setBankCode] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [error, setError] = useState('');
  
  // Loading animation state
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [verifiedName, setVerifiedName] = useState('');
  
  const accountInputRef = useRef<HTMLInputElement>(null);

  // Rotate loading messages during verification
  useEffect(() => {
    if (step !== 'verifying') return;
    
    const interval = setInterval(() => {
      setLoadingMessageIndex(prev => (prev + 1) % LOADING_MESSAGES.length);
    }, 1200);
    
    return () => clearInterval(interval);
  }, [step]);

  // Auto-focus account input when moving to that step
  useEffect(() => {
    if (step === 'account') {
      setTimeout(() => accountInputRef.current?.focus(), 100);
    }
  }, [step]);

  // Auto-verify when account number is complete
  useEffect(() => {
    if (accountNumber.length === 10 && bankCode && step === 'account') {
      handleVerify();
    }
  }, [accountNumber]);

  const handleBankSelect = (code: string, name: string) => {
    setBankCode(code);
    setBankName(name);
    setError('');
    setStep('account');
  };

  const handleAccountNumberChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 10);
    setAccountNumber(cleaned);
    setError('');
  };

  const handleVerify = async () => {
    if (!bankCode || accountNumber.length !== 10) return;
    
    setStep('verifying');
    setLoadingMessageIndex(0);
    setError('');

    try {
      const { data, error } = await supabase.functions.invoke('public-name-lookup', {
        body: {
          bank_code: bankCode,
          account_number: accountNumber,
        },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Could not verify account');
      }

      setVerifiedName(data.account_name);
      setStep('success');
      
      // Auto-continue after 2 seconds
      setTimeout(() => {
        onNameVerified(data.account_name, bankCode, accountNumber, bankName);
      }, 2000);

    } catch (err: any) {
      console.error('Verification failed:', err);
      setError(err.message || 'Failed to verify account. Please try again.');
      setStep('account');
    }
  };

  const handleBack = () => {
    if (step === 'account') {
      setStep('bank');
      setAccountNumber('');
    }
  };

  const currentLoadingMessage = LOADING_MESSAGES[loadingMessageIndex];
  const LoadingIcon = currentLoadingMessage?.icon || Loader2;

  return (
    <div className="space-y-4">
      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {['bank', 'account', 'success'].map((s, i) => (
          <div key={s} className="flex items-center">
            <motion.div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                step === s || (step === 'verifying' && s === 'account') || 
                (step === 'success' && s !== 'success')
                  ? "bg-primary text-primary-foreground"
                  : step === 'success' && s === 'success'
                  ? "bg-success text-success-foreground"
                  : "bg-muted text-muted-foreground"
              )}
              animate={step === s || (step === 'verifying' && s === 'account') ? { scale: [1, 1.1, 1] } : {}}
              transition={{ duration: 0.3 }}
            >
              {step === 'success' && (s === 'bank' || s === 'account') ? (
                <Check className="w-4 h-4" />
              ) : step === 'success' && s === 'success' ? (
                <Check className="w-4 h-4" />
              ) : (
                i + 1
              )}
            </motion.div>
            {i < 2 && (
              <div className={cn(
                "w-8 h-0.5 mx-1 transition-colors",
                (step === 'account' || step === 'verifying' || step === 'success') && i === 0
                  ? "bg-primary"
                  : step === 'success' && i === 1
                  ? "bg-success"
                  : "bg-muted"
              )} />
            )}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* STEP 1: Select Bank */}
        {step === 'bank' && (
          <motion.div
            key="bank-step"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-2">
                <Building2 className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Which bank do you use?</h3>
              <p className="text-sm text-muted-foreground">
                We'll pull your name directly from your bank - no typing needed!
              </p>
            </div>

            <div className="space-y-2">
              <Label>Select Your Bank</Label>
              {isLoadingBanks ? (
                <Button variant="outline" className="w-full h-12 justify-start" disabled>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading banks...
                </Button>
              ) : !banks || banks.length === 0 ? (
                <Button variant="outline" className="w-full h-12 justify-start text-muted-foreground" disabled>
                  No banks available
                </Button>
              ) : (
                <BankCommandSelect
                  banks={banks}
                  value={bankCode}
                  onValueChange={handleBankSelect}
                  placeholder="Tap to choose your bank"
                  disabled={disabled}
                />
              )}
            </div>

            <Button
              variant="ghost"
              onClick={onSkip}
              className="w-full text-muted-foreground"
              disabled={disabled}
            >
              I'll type my name manually instead
            </Button>
          </motion.div>
        )}

        {/* STEP 2: Enter Account Number */}
        {step === 'account' && (
          <motion.div
            key="account-step"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-2">
                <User className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Enter your account number</h3>
              <p className="text-sm text-muted-foreground">
                Your {bankName} account number (10 digits)
              </p>
            </div>

            {/* Bank Selected Badge */}
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border">
              <Building2 className="w-5 h-5 text-primary" />
              <span className="font-medium">{bankName}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="ml-auto text-xs h-7"
              >
                Change
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="account-number">Account Number</Label>
              <Input
                ref={accountInputRef}
                id="account-number"
                type="tel"
                inputMode="numeric"
                placeholder="0123456789"
                value={accountNumber}
                onChange={(e) => handleAccountNumberChange(e.target.value)}
                maxLength={10}
                className="text-xl text-center tracking-widest h-14 font-mono"
                disabled={disabled}
              />
              <p className="text-xs text-center text-muted-foreground">
                {accountNumber.length}/10 digits
                {accountNumber.length === 10 && (
                  <span className="text-primary ml-2">✓ Auto-verifying...</span>
                )}
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleBack}
                className="flex-1"
                disabled={disabled}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleVerify}
                disabled={accountNumber.length !== 10 || disabled}
                className="flex-1"
              >
                Verify
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* STEP 3: Verifying - Animated Loading */}
        {step === 'verifying' && (
          <motion.div
            key="verifying-step"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="py-8"
          >
            <div className="text-center space-y-6">
              {/* Animated Icon */}
              <div className="relative mx-auto w-20 h-20">
                {/* Outer pulsing ring */}
                <motion.div
                  className="absolute inset-0 rounded-full bg-primary/20"
                  animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.2, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                {/* Inner circle with icon */}
                <div className="absolute inset-2 rounded-full bg-primary/10 flex items-center justify-center">
                  <motion.div
                    key={loadingMessageIndex}
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, rotate: 180 }}
                    transition={{ duration: 0.3 }}
                  >
                    <LoadingIcon className="w-8 h-8 text-primary" />
                  </motion.div>
                </div>
              </div>

              {/* Animated Message */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={loadingMessageIndex}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-1"
                >
                  <p className="text-lg font-medium text-foreground">
                    {currentLoadingMessage?.text}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Connecting with {bankName}
                  </p>
                </motion.div>
              </AnimatePresence>

              {/* Progress dots */}
              <div className="flex justify-center gap-2">
                {LOADING_MESSAGES.map((_, i) => (
                  <motion.div
                    key={i}
                    className={cn(
                      "w-2 h-2 rounded-full transition-colors",
                      i <= loadingMessageIndex ? "bg-primary" : "bg-muted"
                    )}
                    animate={i === loadingMessageIndex ? { scale: [1, 1.3, 1] } : {}}
                    transition={{ duration: 0.3 }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* STEP 4: Success */}
        {step === 'success' && (
          <motion.div
            key="success-step"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.4, type: "spring" }}
            className="py-6"
          >
            <div className="text-center space-y-4">
              {/* Success Animation */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                className="mx-auto w-20 h-20 rounded-full bg-success/10 flex items-center justify-center"
              >
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.3, type: "spring" }}
                >
                  <Check className="w-10 h-10 text-success" />
                </motion.div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="space-y-2"
              >
                <p className="text-sm text-muted-foreground">We found you!</p>
                <h3 className="text-2xl font-bold text-foreground">
                  {verifiedName}
                </h3>
                <p className="text-sm text-muted-foreground">
                  from {bankName}
                </p>
              </motion.div>

              {/* Auto-continue indicator */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="flex items-center justify-center gap-2 text-sm text-primary"
              >
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Continuing to next step...</span>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
