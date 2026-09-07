import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { NativePinInput } from '@/components/NativePinInput';
import { ArrowLeft, KeyRound, Loader2, Shield } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { trackClarityEvent, ClarityEvents } from '@/lib/clarityTracking';
import { haptics } from '@/lib/haptics';

type PinStep = 'old' | 'new' | 'confirm';

export default function ChangePin() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  // State management
  const [step, setStep] = useState<PinStep>('old');
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);

  // Track page view
  useEffect(() => {
    trackClarityEvent(ClarityEvents.CHANGE_PIN_STARTED);
  }, []);

  const handlePinChange = (value: string) => {
    if (step === 'old') {
      setOldPin(value);
      if (value.length === 4) {
        haptics.medium();
        setTimeout(() => setStep('new'), 300);
      }
    } else if (step === 'new') {
      setNewPin(value);
      if (value.length === 4) {
        haptics.medium();
        setTimeout(() => setStep('confirm'), 300);
      }
    } else {
      setConfirmPin(value);
      if (value.length === 4) {
        handleSubmit(value);
      }
    }
  };

  const handleSubmit = async (finalConfirmPin: string) => {
    if (newPin !== finalConfirmPin) {
      toast({
        title: 'New PINs do not match',
        description: 'Please try again',
        variant: 'destructive',
      });
      resetToStart();
      return;
    }

    setLoading(true);

    try {
      const { error, data } = await supabase.functions.invoke('change-pin', {
        body: { oldPin, newPin },
      });

      if (error) throw error;
      if (data?.success === false) {
        throw new Error(data.error || 'Failed to change PIN');
      }

      // Refetch profile data
      await queryClient.refetchQueries({ 
        queryKey: ['profile', user?.id]
      });

      toast({
        title: 'PIN Changed Successfully',
        description: 'Your new PIN is now active',
      });
      trackClarityEvent(ClarityEvents.CHANGE_PIN_SUCCESS);

      // Navigate back to Profile
      navigate('/profile');
    } catch (error: any) {
      console.error('PIN change error:', error);
      trackClarityEvent(ClarityEvents.ERROR_CHANGE_PIN);
      toast({
        title: 'Failed to Change PIN',
        description: error.message || 'Please check your current PIN and try again',
        variant: 'destructive',
      });
      resetToStart();
    } finally {
      setLoading(false);
    }
  };

  const resetToStart = () => {
    setStep('old');
    setOldPin('');
    setNewPin('');
    setConfirmPin('');
  };

  const handleBack = () => {
    if (step === 'confirm') {
      setStep('new');
      setConfirmPin('');
    } else if (step === 'new') {
      setStep('old');
      setNewPin('');
    } else {
      navigate('/profile');
    }
  };

  // Dynamic content based on step
  const getStepContent = () => {
    switch (step) {
      case 'old':
        return {
          title: 'Enter your current PIN',
          description: 'First, confirm it is really you.',
          label: 'Current 4 numbers',
          value: oldPin,
        };
      case 'new':
        return {
          title: 'Choose a new PIN',
          description: 'Pick 4 numbers you can remember.',
          label: 'New 4 numbers',
          value: newPin,
        };
      case 'confirm':
        return {
          title: 'Repeat the new PIN',
          description: 'This makes sure there was no typing mistake.',
          label: 'Repeat your 4 numbers',
          value: confirmPin,
        };
    }
  };

  const stepContent = getStepContent();

  return (
    <div className="min-h-dvh bg-background flex flex-col overflow-x-hidden">
      {/* Header with Back button */}
      <div className="h-14 border-b bg-background sticky top-0 z-50">
        <div className="h-full px-4 flex items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="gap-2"
            disabled={loading}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 pb-8">
          <div className="w-full max-w-sm space-y-5">
          {/* Icon */}
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              {step === 'old' ? (
                <Shield className="h-7 w-7 text-primary" />
              ) : (
                <KeyRound className="h-7 w-7 text-primary" />
              )}
            </div>
          </div>

          {/* Title and Description */}
          <div className="text-center space-y-1.5">
            <h1 className="text-2xl font-bold text-foreground leading-tight">
              {stepContent.title}
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {stepContent.description}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card/50 p-4 space-y-4">
            <NativePinInput
              key={step}
              value={stepContent.value}
              onChange={handlePinChange}
              disabled={loading}
            />

            <div className="flex justify-center gap-2" aria-hidden="true">
              <div className={`h-1.5 w-8 rounded-full transition-colors ${step === 'old' ? 'bg-primary' : 'bg-primary/40'}`} />
              <div className={`h-1.5 w-8 rounded-full transition-colors ${step === 'new' ? 'bg-primary' : step === 'confirm' ? 'bg-primary/40' : 'bg-muted'}`} />
              <div className={`h-1.5 w-8 rounded-full transition-colors ${step === 'confirm' ? 'bg-primary' : 'bg-muted'}`} />
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>Saving your new PIN...</span>
            </div>
          )}

          {/* Helper Text */}
          {step === 'new' && newPin.length === 0 && !loading && (
            <p className="text-xs text-muted-foreground text-center px-2">
              Pick numbers you can remember, but do not use 1234 or your birth year.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
