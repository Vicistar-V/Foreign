/**
 * ProfileEditDrawer - Edit name or phone with PIN verification
 */
import { useState, useRef, useEffect } from 'react';
import { User, Phone, Lock } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { trackClarityEvent, ClarityEvents } from '@/lib/clarityTracking';

interface ProfileEditDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  field: 'name' | 'phone' | null;
  currentValue?: string | null;
  userId: string;
}

export const ProfileEditDrawer = ({
  open,
  onOpenChange,
  field,
  currentValue,
  userId
}: ProfileEditDrawerProps) => {
  const [value, setValue] = useState('');
  const [step, setStep] = useState<'input' | 'pin'>('input');
  const [pin, setPin] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const pinInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Reset state when drawer opens/closes
  useEffect(() => {
    if (open) {
      setValue(currentValue || '');
      setStep('input');
      setPin('');
    }
  }, [open, currentValue]);

  // Focus PIN input when step changes
  useEffect(() => {
    if (step === 'pin') {
      setTimeout(() => pinInputRef.current?.focus(), 100);
    }
  }, [step]);

  const handleContinue = () => {
    if (field === 'name') {
      if (!value.trim() || value.trim().length < 2) {
        toast({
          title: 'Invalid Name',
          description: 'Name must be at least 2 characters',
          variant: 'destructive'
        });
        return;
      }
    } else if (field === 'phone') {
      if (value.trim()) {
        const phoneRegex = /^(\+?234|0)[789]\d{9}$/;
        if (!phoneRegex.test(value.replace(/[\s-]/g, ''))) {
          toast({
            title: 'Invalid Phone',
            description: 'Use Nigerian format (e.g., 08012345678)',
            variant: 'destructive'
          });
          return;
        }
      }
    }
    setStep('pin');
  };

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/\D/g, '').slice(0, 4);
    setPin(cleaned);
    
    if (cleaned.length === 4) {
      handleSubmit(cleaned);
    }
  };

  const handleSubmit = async (pinValue: string) => {
    setIsSaving(true);
    
    try {
      const endpoint = field === 'name' ? 'update-name' : 'update-phone';
      const body = field === 'name' 
        ? { fullName: value.trim(), pin: pinValue }
        : { phoneNumber: value.trim(), pin: pinValue };

      const { error, data } = await supabase.functions.invoke(endpoint, { body });
      
      if (error) throw error;
      if (data?.success === false) {
        throw new Error(data.error || 'Failed to update');
      }
      
      toast({
        title: field === 'name' ? 'Name Updated' : 'Phone Updated',
        description: 'Your profile has been saved',
      });
      
      if (field === 'name') {
        trackClarityEvent(ClarityEvents.PROFILE_NAME_UPDATED);
      } else {
        trackClarityEvent(ClarityEvents.PROFILE_PHONE_UPDATED);
      }
      
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Update Failed',
        description: error.message || 'Could not update profile',
        variant: 'destructive'
      });
      setPin('');
    } finally {
      setIsSaving(false);
    }
  };

  const config = {
    name: {
      title: 'Edit Name',
      label: 'Full Name',
      placeholder: 'Your full name',
      icon: User,
      warning: 'Make sure your name matches your bank account exactly.'
    },
    phone: {
      title: 'Edit Phone',
      label: 'Phone Number',
      placeholder: '08012345678',
      icon: Phone,
      warning: 'Used for important account notifications.'
    }
  };

  const current = field ? config[field] : null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="text-left pb-2">
          <DrawerTitle className="flex items-center gap-2">
            {current?.icon && <current.icon className="h-5 w-5 text-primary" />}
            {step === 'pin' ? 'Confirm with PIN' : current?.title}
          </DrawerTitle>
        </DrawerHeader>

        <div className="px-4 pb-8">
          {step === 'input' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{current?.label}</Label>
                <Input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={current?.placeholder}
                  type={field === 'phone' ? 'tel' : 'text'}
                  className="h-12"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">{current?.warning}</p>
              </div>

              <Button
                onClick={handleContinue}
                className="w-full h-12"
                disabled={!value.trim()}
              >
                Continue
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <p className="text-sm text-muted-foreground text-center">
                Enter your 4-digit PIN to save changes
              </p>

              {/* PIN Input */}
              <div 
                className="py-8 bg-muted/30 rounded-xl border border-border cursor-text"
                onClick={() => pinInputRef.current?.focus()}
              >
                <div className="flex items-center justify-center gap-4">
                  {[0, 1, 2, 3].map((i) => (
                    <div 
                      key={i} 
                      className={`w-4 h-4 rounded-full transition-all ${
                        pin.length > i ? 'bg-primary scale-110' : 'bg-muted-foreground/30'
                      }`} 
                    />
                  ))}
                </div>
                
                <Input
                  ref={pinInputRef}
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={pin}
                  onChange={handlePinChange}
                  maxLength={4}
                  className="sr-only"
                  autoComplete="off"
                />
                
                <p className="text-xs text-muted-foreground mt-4 text-center">
                  Tap to enter PIN
                </p>
              </div>

              {isSaving && (
                <div className="text-center">
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <p className="text-sm text-muted-foreground mt-2">Saving...</p>
                </div>
              )}

              <Button
                variant="outline"
                onClick={() => setStep('input')}
                className="w-full"
                disabled={isSaving}
              >
                Go Back
              </Button>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
