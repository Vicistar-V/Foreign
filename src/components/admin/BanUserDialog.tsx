import { useState } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Ban, Loader2 } from 'lucide-react';
import { UserAvatar } from '@/components/results/UserAvatar';

interface BanUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
  avatarUrl?: string | null;
  onConfirm: (reason: string) => void;
  isLoading: boolean;
}

const BAN_REASONS = [
  { value: 'chargeback', label: 'Chargeback - Disputed a payment with bank' },
  { value: 'policy', label: 'Policy Violation - Broke platform rules' },
  { value: 'fraud', label: 'Fraud - Fake or suspicious activity' },
  { value: 'multiple', label: 'Multiple Accounts - Using more than one account' },
  { value: 'custom', label: 'Other Reason - Write your own' },
];

export const BanUserDialog = ({
  open,
  onOpenChange,
  userName,
  avatarUrl,
  onConfirm,
  isLoading,
}: BanUserDialogProps) => {
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');

  const handleConfirm = () => {
    let finalReason = '';
    
    if (selectedReason === 'custom') {
      finalReason = customReason.trim();
    } else {
      const preset = BAN_REASONS.find(r => r.value === selectedReason);
      finalReason = preset?.label || selectedReason;
    }

    if (finalReason) {
      onConfirm(finalReason);
    }
  };

  const isValid = selectedReason && (selectedReason !== 'custom' || customReason.trim().length > 0);

  const handleClose = () => {
    setSelectedReason('');
    setCustomReason('');
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={handleClose}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle className="flex items-center gap-2 text-destructive">
            <Ban className="h-5 w-5" />
            Ban User
          </DrawerTitle>
          <DrawerDescription>
            This will block the user from all platform actions
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-4 space-y-4">
          {/* User Info */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <UserAvatar name={userName} avatarUrl={avatarUrl} size="md" />
            <div>
              <p className="font-semibold">{userName}</p>
              <p className="text-sm text-muted-foreground">Will be banned</p>
            </div>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
            <div className="text-sm text-destructive">
              <p className="font-medium">Warning:</p>
              <p>The user will not be able to play, withdraw money, or perform any actions until unbanned.</p>
            </div>
          </div>

          {/* Reason Selection */}
          <div className="space-y-2">
            <Label>Why are you banning this user?</Label>
            <Select value={selectedReason} onValueChange={setSelectedReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                {BAN_REASONS.map((reason) => (
                  <SelectItem key={reason.value} value={reason.value}>
                    {reason.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom Reason Input */}
          {selectedReason === 'custom' && (
            <div className="space-y-2">
              <Label>Describe the reason</Label>
              <Textarea
                placeholder="Write the reason for banning this user..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
          )}
        </div>

        <DrawerFooter className="flex flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isValid || isLoading}
            className="flex-1"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Banning...
              </>
            ) : (
              <>
                <Ban className="h-4 w-4 mr-2" />
                Ban User
              </>
            )}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
