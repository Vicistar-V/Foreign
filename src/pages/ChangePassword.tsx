import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Key, Eye, EyeOff, Check, X, Loader2, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { NativePinInput } from '@/components/NativePinInput';
import { trackClarityEvent, ClarityEvents } from '@/lib/clarityTracking';

type Step = 'current' | 'new' | 'confirm' | 'pin';

export default function ChangePassword() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // State management
  const [step, setStep] = useState<Step>('current');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pin, setPin] = useState('');
  
  // UI state
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Track page view
  useEffect(() => {
    trackClarityEvent(ClarityEvents.CHANGE_PASSWORD_STARTED);
  }, []);

  // Move to next step with basic validation (frontend UX only)
  const handleVerifyCurrentPassword = () => {
    if (currentPassword.length === 0) {
      toast({
        title: 'Password Required',
        description: 'Please enter your current password',
        variant: 'destructive',
      });
      return;
    }
    setStep('new');
  };

  // Validate new password (frontend UX only)
  const handleSetNewPassword = () => {
    if (newPassword.length < 8) {
      toast({
        title: 'Password Too Short',
        description: 'Password must be at least 8 characters',
        variant: 'destructive',
      });
      return;
    }

    const hasLetter = /[a-zA-Z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    
    if (!hasLetter || !hasNumber) {
      toast({
        title: 'Weak Password',
        description: 'Use a mix of letters and numbers for better security',
        variant: 'destructive',
      });
      return;
    }

    setStep('confirm');
  };

  // Move to PIN step after confirming passwords match
  const handleMoveToPin = () => {
    // Basic frontend validation
    if (newPassword !== confirmPassword) {
      toast({
        title: 'Passwords Do Not Match',
        description: 'Please make sure both passwords are the same',
        variant: 'destructive',
      });
      setConfirmPassword('');
      return;
    }
    setStep('pin');
  };

  // Final submission with PIN - Send all data to edge function for server-side verification
  const handlePinComplete = async (pinValue: string) => {
    setPin(pinValue);
    setLoading(true);

    try {
      console.log('Calling change-password edge function with PIN');
      
      // Call secure edge function with all data including PIN
      const { data, error } = await supabase.functions.invoke('change-password', {
        body: {
          currentPassword,
          newPassword,
          confirmPassword,
          pin: pinValue,
        },
      });

      if (!data?.success) {
        console.error('Password change error:', data?.error || error);
        throw new Error(data?.error || error?.message || 'Failed to change password');
      }

      toast({
        title: 'Password Changed Successfully',
        description: 'Your new password is now active',
      });
      trackClarityEvent(ClarityEvents.CHANGE_PASSWORD_SUCCESS);

      // Clear sensitive data
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPin('');

      // Navigate back to Profile
      navigate('/profile');
    } catch (error: any) {
      console.error('Password change error:', error);
      trackClarityEvent(ClarityEvents.ERROR_CHANGE_PASSWORD);
      
      toast({
        title: 'Failed to Change Password',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
      
      // Reset to start on error
      resetToStart();
    } finally {
      setLoading(false);
    }
  };

  const resetToStart = () => {
    setStep('current');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPin('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  const handleBack = () => {
    if (step === 'pin') {
      setStep('confirm');
      setPin('');
    } else if (step === 'confirm') {
      setStep('new');
      setConfirmPassword('');
      setShowConfirmPassword(false);
    } else if (step === 'new') {
      setStep('current');
      setNewPassword('');
      setShowNewPassword(false);
    } else {
      navigate('/profile');
    }
  };

  // Dynamic content based on step
  const getStepContent = () => {
    switch (step) {
      case 'current':
        return {
          title: 'Enter Current Password',
          description: 'Verify your identity first',
          value: currentPassword,
          onChange: setCurrentPassword,
          showPassword: showCurrentPassword,
          toggleShow: () => setShowCurrentPassword(!showCurrentPassword),
          onContinue: handleVerifyCurrentPassword,
          buttonText: 'Continue',
          label: 'Current Password',
        };
      case 'new':
        return {
          title: 'Enter New Password',
          description: 'Choose a strong password',
          value: newPassword,
          onChange: setNewPassword,
          showPassword: showNewPassword,
          toggleShow: () => setShowNewPassword(!showNewPassword),
          onContinue: handleSetNewPassword,
          buttonText: 'Continue',
          label: 'New Password',
        };
      case 'confirm':
        return {
          title: 'Confirm New Password',
          description: 'Enter your new password again',
          value: confirmPassword,
          onChange: setConfirmPassword,
          showPassword: showConfirmPassword,
          toggleShow: () => setShowConfirmPassword(!showConfirmPassword),
          onContinue: handleMoveToPin,
          buttonText: 'Continue',
          label: 'Confirm Password',
        };
      case 'pin':
        return {
          title: 'Enter Your PIN',
          description: 'Confirm this action with your security PIN',
          value: pin,
          onChange: setPin,
          showPassword: false,
          toggleShow: () => {},
          onContinue: () => {},
          buttonText: '',
          label: 'PIN',
        };
    }
  };

  const stepContent = getStepContent();
  const currentStepNumber = step === 'current' ? 1 : step === 'new' ? 2 : step === 'confirm' ? 3 : 4;

  // Password strength checks
  const hasMinLength = newPassword.length >= 8;
  const hasLetterAndNumber = /[a-zA-Z]/.test(newPassword) && /[0-9]/.test(newPassword);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header with Back button */}
      <div className="p-4 border-b">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          disabled={loading}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8">
          {/* Icon */}
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Key className="h-10 w-10 text-primary" />
            </div>
          </div>

          {/* Title and Description */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-foreground">
              {stepContent.title}
            </h1>
            <p className="text-muted-foreground">
              {stepContent.description}
            </p>
          </div>

          {/* Step Indicators */}
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4].map((num) => (
              <div
                key={num}
                className={cn(
                  "h-2 w-8 rounded-full transition-colors",
                  num <= currentStepNumber
                    ? "bg-primary"
                    : "bg-muted"
                )}
              />
            ))}
          </div>

          {/* Input Area - Password or PIN */}
          {step === 'pin' ? (
            // PIN Entry
            <div className="space-y-4">
              <div className="flex justify-center mb-4">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <Shield className="h-10 w-10 text-primary" />
                </div>
              </div>
              <NativePinInput
                value={pin}
                onChange={setPin}
                onComplete={handlePinComplete}
                disabled={loading}
              />
              {loading && (
                <div className="text-center space-y-2">
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                  <p className="text-sm text-muted-foreground">
                    Changing password...
                  </p>
                </div>
              )}
            </div>
          ) : (
            // Password Input
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-base">
                  {stepContent.label}
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={stepContent.showPassword ? 'text' : 'password'}
                    value={stepContent.value}
                    onChange={(e) => stepContent.onChange(e.target.value)}
                    className="h-12 text-base pr-12"
                    placeholder="Enter password"
                    disabled={loading}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && stepContent.value) {
                        stepContent.onContinue();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                    onClick={stepContent.toggleShow}
                    disabled={loading}
                  >
                    {stepContent.showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

            {/* Password Requirements (only on new password step) */}
            {step === 'new' && (
              <div className="space-y-2 text-sm">
                <p className="font-medium text-muted-foreground">Requirements:</p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {hasMinLength ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className={hasMinLength ? 'text-success' : 'text-muted-foreground'}>
                      At least 8 characters
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasLetterAndNumber ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className={hasLetterAndNumber ? 'text-success' : 'text-muted-foreground'}>
                      Mix of letters and numbers
                    </span>
                  </div>
                </div>
              </div>
            )}

              {/* Continue Button */}
              <Button
                onClick={stepContent.onContinue}
                disabled={loading || !stepContent.value}
                className="w-full h-12 text-base"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {step === 'current' ? 'Verifying...' : 
                     step === 'confirm' ? 'Processing...' : 
                     'Processing...'}
                  </>
                ) : (
                  stepContent.buttonText
                )}
              </Button>
            </div>
          )}

          {/* Helper Text */}
          {step === 'current' && !loading && (
            <div className="text-center">
              <p className="text-xs text-muted-foreground">
                We need to verify your identity before changing your password
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
