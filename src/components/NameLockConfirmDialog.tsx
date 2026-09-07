import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { Lock } from "lucide-react";
import { useEffect } from "react";
import { trackClarityEvent, ClarityEvents } from "@/lib/clarityTracking";

interface NameLockConfirmDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  profileName: string;
  action: 'membership' | 'bank_account';
}

export const NameLockConfirmDialog = ({ 
  open, 
  onConfirm, 
  onCancel, 
  profileName, 
  action 
}: NameLockConfirmDialogProps) => {
  // Track when dialog is shown
  useEffect(() => {
    if (open) {
      trackClarityEvent(ClarityEvents.ACTIVATION_NAME_CONFIRM_SHOWN);
    }
  }, [open]);

  const handleConfirm = () => {
    trackClarityEvent(ClarityEvents.ACTIVATION_NAME_CONFIRMED);
    onConfirm();
  };

  const handleCancel = () => {
    trackClarityEvent(ClarityEvents.ACTIVATION_NAME_CANCELLED);
    onCancel();
  };

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-caution">
            <Lock className="h-5 w-5" />
            Confirm Name Lock
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 pt-2 text-sm text-muted-foreground">
              <p className="font-semibold text-foreground text-base">
                Your account name will be permanently locked:
              </p>
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-xl font-bold text-center text-foreground">
                  {profileName}
                </p>
              </div>
              <div className="space-y-2 text-sm">
                <p className="text-foreground">
                  {action === 'membership' 
                    ? '🔒 Once you pay membership, you cannot change this name.'
                    : '🔒 Once you add a bank account, you cannot change this name.'}
                </p>
                <p className="font-semibold text-destructive">
                  ⚠️ Make sure this matches your bank account name exactly!
                </p>
                <p className="text-xs">
                  If it doesn't match, you won't be able to withdraw money. Only support can change it (with ID proof).
                </p>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel onClick={handleCancel}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleConfirm} 
            className="bg-caution hover:bg-caution/90"
          >
            Yes, My Name Is Correct
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
