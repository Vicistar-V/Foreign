import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2, ShieldCheck } from 'lucide-react';
import { UserAvatar } from '@/components/results/UserAvatar';

interface UnbanUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
  avatarUrl?: string | null;
  bannedReason?: string | null;
  onConfirm: () => void;
  isLoading: boolean;
}

export const UnbanUserDialog = ({
  open,
  onOpenChange,
  userName,
  avatarUrl,
  bannedReason,
  onConfirm,
  isLoading,
}: UnbanUserDialogProps) => {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle className="flex items-center gap-2 text-success">
            <ShieldCheck className="h-5 w-5" />
            Restore Access
          </DrawerTitle>
          <DrawerDescription>
            This will give the user full access to the platform again
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-4 space-y-4">
          {/* User Info */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <UserAvatar name={userName} avatarUrl={avatarUrl} size="md" />
            <div>
              <p className="font-semibold">{userName}</p>
              <p className="text-sm text-destructive">Currently banned</p>
            </div>
          </div>

          {/* Ban Reason */}
          {bannedReason && (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Current ban reason:</p>
              <p className="text-sm font-medium p-2 bg-destructive/10 border border-destructive/20 rounded">
                {bannedReason}
              </p>
            </div>
          )}

          {/* Info */}
          <div className="flex items-start gap-2 p-3 bg-success/10 border border-success/20 rounded-lg">
            <CheckCircle className="h-5 w-5 text-success mt-0.5 shrink-0" />
            <div className="text-sm text-success">
              <p className="font-medium">What happens next:</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>User can play again</li>
                <li>User can withdraw money</li>
                <li>User will receive a notification</li>
              </ul>
            </div>
          </div>
        </div>

        <DrawerFooter className="flex flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 bg-success hover:bg-success/90"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Restoring...
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4 mr-2" />
                Restore Access
              </>
            )}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
