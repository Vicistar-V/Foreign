import { useState, useRef } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, AlertCircle } from 'lucide-react';

interface ActivateMembershipDrawerProps {
  userId: string | null;
  userName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ActivateMembershipDrawer = ({
  userId,
  userName,
  open,
  onOpenChange,
}: ActivateMembershipDrawerProps) => {
  const [pin, setPin] = useState('');
  const pinInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const activateMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('No user selected');

      const { data, error } = await supabase.functions.invoke('admin-set-membership', {
        body: {
          userId,
          adminPin: pin,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to activate membership');

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-details', userId] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      toast.success('Membership Activated', {
        description: `${userName} is now a member`,
      });
      handleClose();
    },
    onError: (error: Error) => {
      toast.error('Failed to Activate Membership', {
        description: error.message,
      });
      setPin('');
    },
  });

  const handleClose = () => {
    setPin('');
    onOpenChange(false);
  };

  const handlePinChange = (value: string) => {
    const cleanedValue = value.replace(/\D/g, '').slice(0, 4);
    setPin(cleanedValue);
    
    // Auto-submit when 4 digits entered
    if (cleanedValue.length === 4) {
      activateMutation.mutate();
    }
  };

  if (!userId) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh] flex flex-col">
        <DrawerHeader>
          <DrawerTitle>Activate Membership</DrawerTitle>
          <DrawerDescription>Manually activate membership for {userName}</DrawerDescription>
        </DrawerHeader>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Warning Alert */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This will activate {userName}'s membership without requiring payment. 
              This action will lock their name and grant full access.
            </AlertDescription>
          </Alert>

          {/* Summary */}
          <div className="p-4 rounded-lg bg-muted space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Member Name:</span>
              <span className="font-medium">{userName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Action:</span>
              <span className="font-medium">Manual Activation</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Cost:</span>
              <span className="font-medium text-success">Free (Admin Override)</span>
            </div>
          </div>

          {/* PIN Input - Native Mobile Keyboard */}
          <div className="space-y-4">
            <Label>Enter Your Admin PIN to Confirm</Label>
            {activateMutation.isPending ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <p className="text-sm text-muted-foreground">Activating membership...</p>
              </div>
            ) : (
              <div 
                className="py-6 bg-muted/30 rounded-xl border border-border cursor-text"
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
                
                <p className="text-xs text-muted-foreground mt-3 text-center">
                  Tap to enter your 4-digit PIN
                </p>
              </div>
            )}
          </div>

          <Button
            onClick={handleClose}
            variant="outline"
            className="w-full"
            disabled={activateMutation.isPending}
          >
            Cancel
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};