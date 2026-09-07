import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { AlertTriangle, Loader2, ShieldAlert, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DeleteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  isMember?: boolean;
  hasSpots?: boolean;
}

type Stage = 'wipe' | 'admin-warning';

export const DeleteUserDialog = ({
  open,
  onOpenChange,
  userId,
  userName,
  isMember,
  hasSpots,
}: DeleteUserDialogProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmName, setConfirmName] = useState('');
  const [adminConfirm, setAdminConfirm] = useState('');
  const [stage, setStage] = useState<Stage>('wipe');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSelf, setIsSelf] = useState(false);
  const [targetIsAdmin, setTargetIsAdmin] = useState(false);

  const expected = 'WIPE';
  const adminExpected = 'DELETE ADMIN';
  const matches = confirmName.trim().toUpperCase() === expected;
  const adminMatches = adminConfirm.trim().toUpperCase() === adminExpected;

  // Detect high-risk targets (self OR another admin) when dialog opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      const selfId = authData?.user?.id ?? null;
      const { data: roleRow } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();
      if (cancelled) return;
      setIsSelf(!!selfId && selfId === userId);
      setTargetIsAdmin(!!roleRow);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  const highRisk = isSelf || targetIsAdmin;

  const reset = () => {
    setConfirmName('');
    setAdminConfirm('');
    setStage('wipe');
  };

  const handleClose = () => {
    if (isDeleting) return;
    reset();
    onOpenChange(false);
  };

  const runDelete = async (confirmAdminDelete: boolean) => {
    setIsDeleting(true);
    try {
      const { data, error } = await supabase.rpc(
        'admin_delete_user' as any,
        { _user_id: userId, _confirm_admin_delete: confirmAdminDelete } as any,
      );
      if (error) {
        // Backend asked for the second confirmation — advance stage instead of failing
        if (
          (error as any)?.message?.includes('ADMIN_CONFIRM_REQUIRED') &&
          stage === 'wipe'
        ) {
          setStage('admin-warning');
          setIsDeleting(false);
          return;
        }
        throw error;
      }
      if (!(data as any)?.success) throw new Error((data as any)?.error || 'Delete failed');

      toast.success('User deleted', {
        description: `${userName} and all their data have been permanently removed.`,
      });
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      queryClient.invalidateQueries({ queryKey: ['user-details', userId] });
      onOpenChange(false);
      reset();

      if (isSelf) {
        // Self-deleted — sign out and bounce to login
        await supabase.auth.signOut().catch(() => {});
        navigate('/login', { replace: true });
      } else {
        navigate('/admin/users');
      }
    } catch (e: any) {
      const msg = e?.message || 'Unknown error';
      const friendly = msg.includes('LAST_ADMIN_BLOCK')
        ? 'This is the last admin — you cannot delete it. Promote another user to admin first.'
        : msg;
      toast.error('Could not delete user', { description: friendly });
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePrimary = async () => {
    if (stage === 'wipe') {
      if (!matches) return;
      if (highRisk) {
        // Skip the roundtrip — jump straight to the admin warning stage
        setStage('admin-warning');
        return;
      }
      await runDelete(false);
    } else {
      if (!adminMatches) return;
      await runDelete(true);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="max-w-md">
        {stage === 'wipe' ? (
          <>
            <AlertDialogHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <AlertDialogTitle>Delete this user permanently?</AlertDialogTitle>
              </div>
              <AlertDialogDescription className="text-left pt-2 space-y-2">
                <p>
                  This will permanently remove{' '}
                  <span className="font-semibold text-foreground">{userName}</span> and every piece
                  of their personal data:
                </p>
                <ul className="text-sm list-disc pl-5 space-y-1 text-muted-foreground">
                  <li>Profile, login & PIN</li>
                  <li>Wallet balances and full money history</li>
                  <li>
                    {hasSpots
                      ? 'All active machines (spots) and queue positions'
                      : 'Any machines/queue positions'}
                  </li>
                  <li>Notifications, support chats, bank accounts</li>
                </ul>
                <p className="text-xs text-muted-foreground pt-1">
                  System-wide audit logs (webhooks, drop fills, alerts) stay intact so reports
                  don't break.
                  {isMember && ' This user is ACTIVATED — be extra sure.'}
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-2 py-2">
              <Label htmlFor="confirm-name" className="text-sm">
                Type <span className="font-semibold text-foreground">WIPE</span> to confirm:
              </Label>
              <Input
                id="confirm-name"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder="WIPE"
                disabled={isDeleting}
                autoComplete="off"
                autoCapitalize="characters"
              />
            </div>

            <AlertDialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={isDeleting}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handlePrimary}
                disabled={!matches || isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : highRisk ? (
                  <>
                    <ShieldAlert className="h-4 w-4 mr-2" />
                    Continue
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete forever
                  </>
                )}
              </Button>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-destructive/20 flex items-center justify-center shrink-0 ring-2 ring-destructive/40">
                  <ShieldAlert className="h-5 w-5 text-destructive" />
                </div>
                <AlertDialogTitle className="text-destructive">
                  {isSelf ? 'You are deleting YOUR OWN admin account' : 'You are deleting an ADMIN'}
                </AlertDialogTitle>
              </div>
              <AlertDialogDescription className="text-left pt-2 space-y-3">
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-foreground space-y-2">
                  {isSelf ? (
                    <>
                      <p className="font-semibold">
                        You will lose access to this admin panel immediately.
                      </p>
                      <p className="text-muted-foreground">
                        You'll be signed out and unable to sign back in with this account. Only
                        another admin can bring your access back — and only by inviting you as a
                        brand-new user.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold">
                        {userName} will lose ALL admin powers instantly.
                      </p>
                      <p className="text-muted-foreground">
                        Their login, profile and every trace of their account will be wiped. This
                        cannot be undone.
                      </p>
                    </>
                  )}
                  <p className="text-xs text-muted-foreground pt-1">
                    Make sure another trusted admin still exists before you continue.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="admin-confirm" className="text-sm">
                    Type{' '}
                    <span className="font-semibold text-foreground">DELETE ADMIN</span> to
                    proceed:
                  </Label>
                  <Input
                    id="admin-confirm"
                    value={adminConfirm}
                    onChange={(e) => setAdminConfirm(e.target.value)}
                    placeholder="DELETE ADMIN"
                    disabled={isDeleting}
                    autoComplete="off"
                    autoCapitalize="characters"
                  />
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  if (isDeleting) return;
                  setAdminConfirm('');
                  setStage('wipe');
                }}
                disabled={isDeleting}
              >
                Go back
              </Button>
              <Button
                variant="destructive"
                onClick={handlePrimary}
                disabled={!adminMatches || isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    {isSelf ? 'Delete my admin account' : 'Delete admin forever'}
                  </>
                )}
              </Button>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
};
