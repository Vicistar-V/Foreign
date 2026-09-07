import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, CheckCircle2, Loader2, Trash2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface BulkDeleteTarget {
  id: string;
  name: string;
}

interface BulkDeleteUsersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targets: BulkDeleteTarget[];
  onFinished?: (deletedIds: string[]) => void;
}

type FailedItem = { name: string; reason: string };

export const BulkDeleteUsersDialog = ({
  open,
  onOpenChange,
  targets,
  onFinished,
}: BulkDeleteUsersDialogProps) => {
  const queryClient = useQueryClient();
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [failed, setFailed] = useState<FailedItem[]>([]);
  const [finished, setFinished] = useState(false);

  const total = targets.length;
  const matches = confirmText.trim().toUpperCase() === 'WIPE';

  useEffect(() => {
    if (open) {
      setConfirmText('');
      setDone(0);
      setFailed([]);
      setFinished(false);
    }
  }, [open]);

  const close = () => {
    if (busy) return;
    onOpenChange(false);
  };

  const run = async () => {
    if (!matches || busy) return;
    setBusy(true);
    const deletedIds: string[] = [];
    const fails: FailedItem[] = [];

    for (const target of targets) {
      try {
        const { data, error } = await supabase.rpc(
          'admin_delete_user' as any,
          { _user_id: target.id, _confirm_admin_delete: false } as any,
        );
        if (error) throw error;
        if (!(data as any)?.success) throw new Error((data as any)?.error || 'Delete failed');
        deletedIds.push(target.id);
      } catch (e: any) {
        const msg: string = e?.message || 'Unknown error';
        const friendly = msg.includes('ADMIN_CONFIRM_REQUIRED')
          ? 'This is an admin account — delete it one by one'
          : msg.includes('LAST_ADMIN_BLOCK')
            ? 'Last admin — cannot be removed'
            : msg.includes('own admin account')
              ? 'You cannot delete yourself here'
              : msg;
        fails.push({ name: target.name, reason: friendly });
      } finally {
        setDone((d) => d + 1);
      }
    }

    setFailed(fails);
    setFinished(true);
    setBusy(false);

    queryClient.invalidateQueries({ queryKey: ['all-users'] });
    queryClient.invalidateQueries({ queryKey: ['admin-stats'] });

    if (deletedIds.length > 0) {
      toast.success(
        `${deletedIds.length} ${deletedIds.length === 1 ? 'person' : 'people'} removed`,
        {
          description:
            fails.length > 0
              ? `${fails.length} could not be removed — see the list.`
              : 'All their data is gone for good.',
        },
      );
    } else {
      toast.error('Nobody was removed', { description: 'See the reasons in the list.' });
    }

    onFinished?.(deletedIds);
    if (fails.length === 0) onOpenChange(false);
  };

  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <AlertDialog open={open} onOpenChange={close}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <AlertDialogTitle className="text-left">
              Remove {total} {total === 1 ? 'person' : 'people'} for good?
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-left pt-2 space-y-2">
            <span className="block">
              Everything about them goes away: login, profile, money history, ad shares, messages
              and bank details. This cannot be undone.
            </span>
            <span className="block text-xs text-muted-foreground">
              Admin accounts are skipped for safety — remove those one at a time.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Names preview */}
        {!busy && !finished && (
          <div className="max-h-28 overflow-y-auto rounded-lg border bg-muted/30 p-2 text-xs space-y-1">
            {targets.slice(0, 30).map((t) => (
              <div key={t.id} className="truncate text-muted-foreground">
                {t.name}
              </div>
            ))}
            {targets.length > 30 && (
              <div className="text-muted-foreground/70">+ {targets.length - 30} more…</div>
            )}
          </div>
        )}

        {(busy || finished) && (
          <div className="space-y-2 py-1">
            <Progress value={pct} className="h-2" />
            <p className="text-xs text-muted-foreground tabular-nums">
              {done} of {total} done
            </p>
          </div>
        )}

        {finished && failed.length > 0 && (
          <div className="max-h-40 overflow-y-auto rounded-lg border border-destructive/30 bg-destructive/5 p-2 space-y-1.5">
            <p className="text-xs font-semibold text-destructive flex items-center gap-1.5">
              <XCircle className="h-3.5 w-3.5" />
              {failed.length} could not be removed
            </p>
            {failed.map((f, i) => (
              <div key={i} className="text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">{f.name}</span> — {f.reason}
              </div>
            ))}
          </div>
        )}

        {finished && failed.length === 0 && (
          <div className="flex items-center gap-2 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" />
            All done.
          </div>
        )}

        {!busy && !finished && (
          <div className="space-y-2 py-1">
            <Label htmlFor="bulk-confirm" className="text-sm">
              Type <span className="font-semibold text-foreground">WIPE</span> to confirm:
            </Label>
            <Input
              id="bulk-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="WIPE"
              autoComplete="off"
              autoCapitalize="characters"
              autoFocus
            />
          </div>
        )}

        <AlertDialogFooter>
          {finished ? (
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          ) : (
            <>
              <Button variant="outline" onClick={close} disabled={busy}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={run} disabled={!matches || busy || total === 0}>
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Removing…
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remove {total}
                  </>
                )}
              </Button>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
