import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Loader2, Trash2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WipeUnactivatedDialog({ open, onOpenChange }: Props) {
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();

  const handleWipe = async () => {
    if (confirmText !== 'WIPE') return;
    setBusy(true);
    const { data, error } = await supabase.rpc('admin_wipe_unactivated_users' as any);
    setBusy(false);
    if (error) {
      toast({ title: 'Wipe failed', description: error.message, variant: 'destructive' });
      return;
    }
    const count = (data as any)?.deleted_count ?? 0;
    toast({
      title: 'Unactivated users wiped',
      description: `${count.toLocaleString()} user${count === 1 ? '' : 's'} and all their data removed.`,
    });
    queryClient.invalidateQueries({ queryKey: ['all-users'] });
    queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    setConfirmText('');
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Wipe all unactivated users?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              This deletes EVERY user who has not paid the activation fee — instantly and permanently.
            </span>
            <span className="block">
              Their wallets, transactions, spots, tasks, notifications, PINs, roles, tour progress,
              bank accounts, referral grants, support tickets and login row will all be removed.
            </span>
            <span className="block font-semibold text-destructive">
              Paying members are NOT touched. This cannot be undone.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <label className="text-sm font-medium">Type <span className="font-mono">WIPE</span> to confirm</label>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="WIPE"
            autoFocus
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleWipe();
            }}
            disabled={confirmText !== 'WIPE' || busy}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Wiping…
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Wipe now
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
