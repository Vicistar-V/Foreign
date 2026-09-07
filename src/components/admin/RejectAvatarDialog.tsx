import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserAvatar } from '@/components/results/UserAvatar';
import { AlertTriangle, Trash2 } from 'lucide-react';

interface RejectAvatarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
  avatarUrl: string;
  onConfirm: (reason: string) => void;
  isLoading: boolean;
}

const REJECTION_REASONS = [
  'Not a real photo of yourself',
  'Inappropriate content',
  'Contains text or graphics',
  'Cannot identify a person',
  'Photo quality too low',
  'Other violation of terms',
];

export const RejectAvatarDialog = ({
  open,
  onOpenChange,
  userName,
  avatarUrl,
  onConfirm,
  isLoading,
}: RejectAvatarDialogProps) => {
  const [selectedReason, setSelectedReason] = useState<string>('');

  const handleConfirm = () => {
    if (!selectedReason) return;
    onConfirm(selectedReason);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Reject Avatar?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            {/* Avatar Preview */}
            <div className="flex justify-center py-4">
              <div className="relative">
                <UserAvatar name={userName} avatarUrl={avatarUrl} size="lg" />
                <div className="absolute inset-0 bg-destructive/20 rounded-full flex items-center justify-center">
                  <Trash2 className="h-6 w-6 text-destructive" />
                </div>
              </div>
            </div>

            {/* User Name */}
            <p className="text-center font-semibold text-foreground">{userName}</p>

            {/* Reason Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Reason for rejection:
              </label>
              <Select value={selectedReason} onValueChange={setSelectedReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason..." />
                </SelectTrigger>
                <SelectContent>
                  {REJECTION_REASONS.map((reason) => (
                    <SelectItem key={reason} value={reason}>
                      {reason}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Warning Message */}
            <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 flex gap-2">
              <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground space-y-1">
                <p>This will remove the photo and notify the user.</p>
                <p>They will be asked to upload a real picture when they reload the app.</p>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!selectedReason || isLoading}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {isLoading ? 'Removing...' : 'Reject Avatar'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
