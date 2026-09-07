import { useState } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  User, Phone, Lock, LockOpen, KeyRound, Mail, 
  Pencil, Check, X, AlertTriangle 
} from 'lucide-react';
import { AdminActionConfirmDialog } from './AdminActionConfirmDialog';
import { useAdminEditProfile } from '@/hooks/useAdminEditProfile';
import { ClickablePhone } from './ClickablePhone';

interface UserProfileData {
  id: string;
  full_name: string;
  phone_number: string | null;
  is_name_locked: boolean;
  has_pin: boolean;
  email: string;
  email_confirmed_at: string | null;
}

interface AdminEditProfileDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: UserProfileData | null;
  onSuccess?: () => void;
}

type ConfirmAction = {
  type: 'update_name' | 'update_phone' | 'toggle_name_lock' | 'reset_pin' | 'force_verify_email';
  title: string;
  description: string;
  actionLabel: string;
  variant: 'default' | 'destructive' | 'warning';
  data?: any;
};

export const AdminEditProfileDrawer = ({
  open,
  onOpenChange,
  profile,
  onSuccess,
}: AdminEditProfileDrawerProps) => {
  const { editProfileAsync, isLoading } = useAdminEditProfile();
  
  // Edit states
  const [editingName, setEditingName] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  
  // Confirmation dialog state
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  if (!profile) return null;

  const handleStartEditName = () => {
    setNewName(profile.full_name);
    setEditingName(true);
  };

  const handleStartEditPhone = () => {
    setNewPhone(profile.phone_number || '');
    setEditingPhone(true);
  };

  const handleSaveName = () => {
    if (newName.trim().length < 2) return;
    if (newName.trim() === profile.full_name) {
      setEditingName(false);
      return;
    }
    
    setConfirmAction({
      type: 'update_name',
      title: 'Confirm Name Change',
      description: `You are about to change this user's name. This action will be logged.`,
      actionLabel: 'Update Name',
      variant: 'default',
      data: { oldName: profile.full_name, newName: newName.trim() }
    });
  };

  const handleSavePhone = () => {
    const trimmedPhone = newPhone.trim();
    if (trimmedPhone === (profile.phone_number || '')) {
      setEditingPhone(false);
      return;
    }
    
    setConfirmAction({
      type: 'update_phone',
      title: 'Confirm Phone Change',
      description: `You are about to change this user's phone number. This action will be logged.`,
      actionLabel: 'Update Phone',
      variant: 'default',
      data: { oldPhone: profile.phone_number, newPhone: trimmedPhone || null }
    });
  };

  const handleToggleNameLock = () => {
    const newStatus = !profile.is_name_locked;
    setConfirmAction({
      type: 'toggle_name_lock',
      title: newStatus ? 'Lock User Name' : 'Unlock User Name',
      description: newStatus 
        ? 'This will prevent the user from changing their name.'
        : 'This will allow the user to change their name.',
      actionLabel: newStatus ? 'Lock Name' : 'Unlock Name',
      variant: 'warning',
    });
  };

  const handleResetPin = () => {
    setConfirmAction({
      type: 'reset_pin',
      title: 'Reset User PIN',
      description: 'This will clear the user\'s security PIN. They will need to create a new one. Use this only if the user has forgotten their PIN.',
      actionLabel: 'Reset PIN',
      variant: 'destructive',
    });
  };

  const handleForceVerifyEmail = () => {
    setConfirmAction({
      type: 'force_verify_email',
      title: 'Force Verify Email',
      description: 'This will mark the user\'s email as verified without them clicking a verification link. Use with caution.',
      actionLabel: 'Verify Email',
      variant: 'warning',
    });
  };

  const handleConfirm = async (pin: string) => {
    if (!confirmAction) return;

    try {
      await editProfileAsync({
        action: confirmAction.type,
        userId: profile.id,
        pin,
        ...(confirmAction.type === 'update_name' && { newName: confirmAction.data?.newName }),
        ...(confirmAction.type === 'update_phone' && { newPhone: confirmAction.data?.newPhone }),
      });

      // Reset edit states
      setEditingName(false);
      setEditingPhone(false);
      setConfirmAction(null);
      onSuccess?.();
    } catch {
      // Error is handled by the hook
    }
  };

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="h-[85vh]">
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Edit Profile - {profile.full_name}
            </DrawerTitle>
          </DrawerHeader>

          <ScrollArea className="flex-1 px-6">
            <div className="space-y-4 pb-6">
              {/* Basic Information */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Basic Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Name Field */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4" />
                      Full Name
                    </Label>
                    {editingName ? (
                      <div className="flex gap-2">
                        <Input
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          placeholder="Enter new name"
                          className="flex-1"
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={handleSaveName}
                          disabled={newName.trim().length < 2}
                        >
                          <Check className="h-4 w-4 text-success" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setEditingName(false)}
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <span>{profile.full_name}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleStartEditName}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Phone Field */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4" />
                      Phone Number
                    </Label>
                    {editingPhone ? (
                      <div className="flex gap-2">
                        <Input
                          value={newPhone}
                          onChange={(e) => setNewPhone(e.target.value)}
                          placeholder="Enter phone number"
                          className="flex-1"
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={handleSavePhone}
                        >
                          <Check className="h-4 w-4 text-success" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setEditingPhone(false)}
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        {profile.phone_number ? (
                          <ClickablePhone phone={profile.phone_number} />
                        ) : (
                          <span className="text-muted-foreground">Not provided</span>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleStartEditPhone}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Name Lock Toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {profile.is_name_locked ? (
                        <Lock className="h-5 w-5 text-warning" />
                      ) : (
                        <LockOpen className="h-5 w-5 text-success" />
                      )}
                      <div>
                        <p className="font-medium">Name Lock</p>
                        <p className="text-xs text-muted-foreground">
                          {profile.is_name_locked 
                            ? 'User cannot change their name' 
                            : 'User can change their name'}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={profile.is_name_locked}
                      onCheckedChange={handleToggleNameLock}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Security Actions */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    Security Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Reset PIN */}
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <KeyRound className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Security PIN</p>
                        <p className="text-xs text-muted-foreground">
                          {profile.has_pin ? 'PIN is set' : 'No PIN set'}
                        </p>
                      </div>
                    </div>
                    {profile.has_pin && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleResetPin}
                        className="text-destructive border-destructive/30 hover:bg-destructive/10"
                      >
                        Reset PIN
                      </Button>
                    )}
                  </div>

                  {/* Force Verify Email */}
                  {!profile.email_confirmed_at && (
                    <div className="flex items-center justify-between p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                      <div className="flex items-center gap-3">
                        <Mail className="h-5 w-5 text-orange-500" />
                        <div>
                          <p className="font-medium">Email Not Verified</p>
                          <p className="text-xs text-muted-foreground">
                            {profile.email}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleForceVerifyEmail}
                        className="text-orange-600 border-orange-500/30 hover:bg-orange-500/10"
                      >
                        Force Verify
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Info Card */}
              <Card className="bg-info/5 border-info/20">
                <CardContent className="p-4">
                  <p className="text-sm text-info dark:text-info">
                    <strong>Note:</strong> All changes require PIN confirmation and are logged for audit purposes.
                  </p>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </DrawerContent>
      </Drawer>

      {/* Confirmation Dialog */}
      <AdminActionConfirmDialog
        open={!!confirmAction}
        onOpenChange={() => setConfirmAction(null)}
        title={confirmAction?.title || ''}
        description={confirmAction?.description || ''}
        actionLabel={confirmAction?.actionLabel || 'Confirm'}
        variant={confirmAction?.variant || 'default'}
        onConfirm={handleConfirm}
        isLoading={isLoading}
      >
        {confirmAction?.type === 'update_name' && confirmAction.data && (
          <div className="p-3 bg-muted rounded-lg text-sm">
            <p><strong>From:</strong> {confirmAction.data.oldName}</p>
            <p><strong>To:</strong> {confirmAction.data.newName}</p>
          </div>
        )}
        {confirmAction?.type === 'update_phone' && confirmAction.data && (
          <div className="p-3 bg-muted rounded-lg text-sm">
            <p><strong>From:</strong> {confirmAction.data.oldPhone || 'Not set'}</p>
            <p><strong>To:</strong> {confirmAction.data.newPhone || 'Clear phone'}</p>
          </div>
        )}
      </AdminActionConfirmDialog>
    </>
  );
};
