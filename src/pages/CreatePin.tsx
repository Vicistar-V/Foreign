import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Loader2, Shield, CheckCircle2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { Skeleton } from '@/components/ui/skeleton';
import { NativePinInput } from '@/components/NativePinInput';
import { onboardingSkip } from '@/lib/onboardingSkip';

export default function CreatePin() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: profile, isLoading } = useProfile(user?.id);
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && profile && !profile.is_member) {
      navigate('/dashboard', { replace: true });
    }
  }, [isLoading, profile, navigate]);

  // Note: we no longer auto-redirect when has_pin is true.
  // Stale cached profile data was bouncing users out of this screen.
  // Instead we render a friendly "PIN already set" card below.

  const handlePinChange = (value: string) => {
    if (step === 'enter') {
      setPin(value);
      if (value.length === 4) {
        setTimeout(() => {
          setStep('confirm');
        }, 300);
      }
    } else {
      setConfirmPin(value);
      if (value.length === 4) {
        handleSubmit(value);
      }
    }
  };

  const handleSubmit = async (finalConfirmPin?: string) => {
    const confirmValue = finalConfirmPin || confirmPin;
    
    if (pin !== confirmValue) {
      toast({
        title: 'PINs do not match',
        description: 'Please try again',
        variant: 'destructive',
      });
      setStep('enter');
      setPin('');
      setConfirmPin('');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-pin', {
        body: { pin },
      });

      if (error) throw error;
      if (data?.success === false) {
        throw new Error(data.error || 'Failed to create PIN');
      }

      // Refetch both profile and dashboard-data to ensure fresh data before navigation
      await Promise.all([
        queryClient.refetchQueries({ 
          queryKey: ['profile', user?.id],
          exact: true 
        }),
        queryClient.refetchQueries({ 
          queryKey: ['dashboard-data', user?.id]
        })
      ]);

      toast({
        title: data?.alreadySet ? 'PIN is already active' : 'PIN Created Successfully',
        description: 'Your money is protected',
      });

      // Navigate to dashboard with fresh data already loaded
      navigate('/dashboard');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Please try again';
      console.error('Error creating PIN:', error);
      toast({
        title: 'Failed to create PIN',
        description: message,
        variant: 'destructive',
      });
      setStep('enter');
      setPin('');
      setConfirmPin('');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    onboardingSkip.skipPin();
    navigate('/dashboard');
  };

  const handleStartOver = () => {
    setStep('enter');
    setPin('');
    setConfirmPin('');
  };

  // Show loading state while checking PIN status
  if (isLoading) {
    return (
      <div className="min-h-[100svh] bg-background flex flex-col">
        <div className="h-14 border-b bg-background flex items-center justify-end px-3 shrink-0">
          <Button variant="ghost" size="sm" onClick={handleSkip} className="text-muted-foreground">
            Skip for now
          </Button>
        </div>
        <div className="flex-1 flex flex-col items-center px-4 pt-10">
          <div className="w-full max-w-sm space-y-6">
            <div className="flex justify-center">
              <Skeleton className="h-14 w-14 rounded-full" />
            </div>
            <div className="text-center space-y-2">
              <Skeleton className="h-7 w-56 max-w-full mx-auto" />
              <Skeleton className="h-4 w-72 max-w-full mx-auto" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (profile && !profile.is_member) {
    return null;
  }

  // If a PIN is already set, show a friendly recovery card instead of bouncing.
  if (profile?.has_pin) {
    return (
      <div className="min-h-[100svh] bg-background flex flex-col overflow-x-hidden">
        <div className="h-14 border-b bg-background flex items-center justify-end px-3 shrink-0 sticky top-0 z-10">
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="text-muted-foreground">
            Close
          </Button>
        </div>
        <div className="flex-1 flex flex-col items-center px-4 pt-10 pb-8">
          <div className="w-full max-w-sm space-y-5 text-center">
            <div className="flex justify-center">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-primary" />
              </div>
            </div>
            <div className="space-y-1.5">
              <h1 className="text-2xl font-bold text-foreground leading-tight">
                You already have a PIN
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your money is already protected. You can change your PIN any time, or contact support if you've forgotten it.
              </p>
            </div>
            <div className="space-y-2 pt-2">
              <Button className="w-full" onClick={() => navigate('/change-pin')}>
                Change my PIN
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/support')}>
                I forgot my PIN
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => navigate('/dashboard')}>
                Back to dashboard
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100svh] bg-background flex flex-col overflow-x-hidden">
      {/* Header */}
      <div className="h-14 border-b bg-background flex items-center justify-between px-3 shrink-0 sticky top-0 z-10">
        {step === 'confirm' ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleStartOver}
            className="text-muted-foreground"
            disabled={loading}
          >
            Start over
          </Button>
        ) : (
          <div className="w-16" />
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSkip}
          className="text-muted-foreground"
          disabled={loading}
        >
          Skip for now
        </Button>
      </div>

      {/* Content — top-anchored so keyboard doesn't reflow the layout */}
      <div className="flex-1 flex flex-col items-center px-4 pt-10 pb-8">
        <div className="w-full max-w-sm space-y-5">
          {/* Icon */}
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              {step === 'enter' ? (
                <Shield className="h-7 w-7 text-primary" />
              ) : (
                <CheckCircle2 className="h-7 w-7 text-primary" />
              )}
            </div>
          </div>

          {/* Title and Description */}
          <div className="text-center space-y-1.5">
            <h1 className="text-2xl font-bold text-foreground leading-tight">
              {step === 'enter' ? 'Protect your money' : 'Enter it one more time'}
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {step === 'enter'
                ? 'Create a simple 4-digit PIN. You will use it before money leaves your account.'
                : 'This makes sure you typed the PIN you want.'}
            </p>
          </div>

          <NativePinInput
            key={step}
            value={step === 'enter' ? pin : confirmPin}
            onChange={handlePinChange}
            disabled={loading}
          />

          <div className="flex justify-center gap-2" aria-hidden="true">
            <div className={`h-1.5 w-10 rounded-full ${step === 'enter' ? 'bg-primary' : 'bg-primary/40'}`} />
            <div className={`h-1.5 w-10 rounded-full ${step === 'confirm' ? 'bg-primary' : 'bg-muted'}`} />
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>Saving your PIN...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
