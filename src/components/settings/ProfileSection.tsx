import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, Copy, Check, Edit2, Phone, User, Mail, Camera, AlertTriangle, Cake } from 'lucide-react';
import { BirthdayEditDialog } from '@/components/settings/BirthdayEditDialog';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UserAvatar } from '@/components/results/UserAvatar';
import { trackClarityEvent, ClarityEvents } from '@/lib/clarityTracking';
import { buildInviteUrl } from '@/lib/inviteKey';

interface ProfileSectionProps {
  userId: string;
}

export const ProfileSection = ({ userId }: ProfileSectionProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: profile, isLoading } = useProfile(userId);
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [newName, setNewName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<'phone' | 'name' | null>(null);
  const [pin, setPin] = useState('');
  const pinInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [showBirthdayDialog, setShowBirthdayDialog] = useState(false);

  const MONTH_NAMES = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ];

  const handleCopyReferralCode = async () => {
    if (!profile?.referral_code) return;
    
    const referralLink = buildInviteUrl('/signup', { ref: profile.referral_code });
    await navigator.clipboard.writeText(referralLink);
    
    setCopied(true);
    toast({
      title: 'Copied!',
      description: 'Your referral link has been copied',
    });
    trackClarityEvent(ClarityEvents.PROFILE_REFERRAL_COPIED);
    
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSavePhoneClick = () => {
    // Validate phone format first
    if (phoneNumber && phoneNumber.trim() !== '') {
      const phoneRegex = /^(\+?234|0)[789]\d{9}$/;
      if (!phoneRegex.test(phoneNumber.replace(/[\s-]/g, ''))) {
        toast({
          title: 'Invalid Phone Number',
          description: 'Please use Nigerian format (e.g., 08012345678)',
          variant: 'destructive'
        });
        return;
      }
    }
    // Open PIN dialog
    setPendingAction('phone');
    setShowPinDialog(true);
    setPin('');
  };

  const handleSaveNameClick = () => {
    if (!newName.trim()) {
      toast({
        title: 'Name Required',
        description: 'Please enter your full name',
        variant: 'destructive'
      });
      return;
    }
    if (newName.trim().length < 2) {
      toast({
        title: 'Name Too Short',
        description: 'Name must be at least 2 characters',
        variant: 'destructive'
      });
      return;
    }
    // Open PIN dialog
    setPendingAction('name');
    setShowPinDialog(true);
    setPin('');
  };

  const handlePinChange = (value: string) => {
    const cleanedValue = value.replace(/\D/g, '').slice(0, 4);
    setPin(cleanedValue);
    
    // Auto-submit when 4 digits entered
    if (cleanedValue.length === 4) {
      handlePinComplete(cleanedValue);
    }
  };

  const handlePinComplete = async (pinValue: string) => {
    setIsSaving(true);
    
    try {
      if (pendingAction === 'name') {
        const { error, data } = await supabase.functions.invoke('update-name', {
          body: { 
            fullName: newName.trim(),
            pin: pinValue
          }
        });
        
        if (error) throw error;
        if (data?.success === false) {
          throw new Error(data.error || 'Failed to update name');
        }
        
        toast({
          title: 'Name Updated',
          description: 'Your full name has been saved',
        });
        trackClarityEvent(ClarityEvents.PROFILE_NAME_UPDATED);
        
        setIsEditingName(false);
        setShowPinDialog(false);
        setPendingAction(null);
        setPin('');
        queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      } else if (pendingAction === 'phone') {
        const { error, data } = await supabase.functions.invoke('update-phone', {
          body: { 
            phoneNumber: phoneNumber.trim(),
            pin: pinValue
          }
        });
        
        if (error) throw error;
        if (data?.success === false) {
          throw new Error(data.error || 'Failed to update phone');
        }
        
        toast({
          title: 'Phone Updated',
          description: 'Your phone number has been saved',
        });
        trackClarityEvent(ClarityEvents.PROFILE_PHONE_UPDATED);
        
        setIsEditingPhone(false);
        setShowPinDialog(false);
        setPendingAction(null);
        setPin('');
        queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      }
    } catch (error: any) {
      if (pendingAction === 'name') {
        trackClarityEvent(ClarityEvents.ERROR_PROFILE_NAME_UPDATE);
      } else if (pendingAction === 'phone') {
        trackClarityEvent(ClarityEvents.ERROR_PROFILE_PHONE_UPDATE);
      }
      toast({
        title: 'Update Failed',
        description: error.message || `Could not update ${pendingAction}`,
        variant: 'destructive'
      });
      setPin('');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !profile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Your basic account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
        <CardDescription>
          Your basic account details
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Profile Picture Section */}
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-4 py-4">
            {/* Avatar Display */}
            <div className="relative">
              <UserAvatar
                name={profile.full_name}
                avatarUrl={profile.avatar_url}
                size="xl"
              />
            </div>

            {/* Change Picture Button */}
            <Button
              onClick={() => {
                trackClarityEvent(ClarityEvents.PROFILE_AVATAR_CLICKED);
                navigate('/set-profile-picture?change=true', { state: { from: '/profile' } });
              }}
              variant="outline"
              className="w-full sm:w-auto"
            >
              <Camera className="mr-2 h-4 w-4" />
              Change Picture
            </Button>
          </div>

          {/* Warning Notice */}
          <Alert className="border-warning bg-warning/10">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <AlertDescription className="text-sm text-foreground">
              <strong>Important:</strong> Please use a real photo of yourself. Your picture appears on winner pages. Using fake images may result in account suspension.
            </AlertDescription>
          </Alert>
        </div>

        {/* Full Name */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <User className="h-4 w-4" />
            Full Name
            {profile.is_name_locked && (
              <Badge variant="secondary" className="text-xs">
                <Lock className="h-3 w-3 mr-1" />
                Locked
              </Badge>
            )}
          </Label>
          
          {!profile.is_name_locked ? (
            isEditingName ? (
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Your full name"
                  className="flex-1 h-11"
                />
                <div className="flex gap-2">
                  <Button 
                    onClick={handleSaveNameClick}
                    disabled={isSaving}
                    className="h-11 flex-1 sm:flex-initial"
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setIsEditingName(false);
                      setPin('');
                    }}
                    className="h-11 flex-1 sm:flex-initial"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input 
                  value={profile.full_name} 
                  disabled 
                  className="flex-1 h-11 bg-muted"
                />
                <Button 
                  variant="outline"
                  onClick={() => {
                    setNewName(profile.full_name);
                    setIsEditingName(true);
                  }}
                  className="h-11"
                >
                  <Edit2 className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Edit</span>
                </Button>
              </div>
            )
          ) : (
            <Input 
              value={profile.full_name} 
              disabled 
              className="h-11 bg-muted"
            />
          )}
          
          {isEditingName && (
            <p className="text-xs text-caution-foreground">
              ⚠️ Make sure your name matches your bank account exactly. Once you activate membership or add a bank account, your name will be permanently locked.
            </p>
          )}
          
          {profile.is_name_locked ? (
            <p className="text-xs text-muted-foreground">
              Name is permanently locked. It was locked when you {' '}
              {profile.is_member 
                ? 'activated your membership' 
                : 'added a bank account'}. 
              Contact support if you need to change it (requires ID verification).
            </p>
          ) : !isEditingName && (
            <p className="text-xs text-muted-foreground">
              Name will be locked after activating membership or adding a bank account
            </p>
          )}
        </div>

        {/* Email (Locked) */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <Mail className="h-4 w-4" />
            Email Address
            <Badge variant="secondary" className="text-xs">
              <Lock className="h-3 w-3 mr-1" />
              Locked
            </Badge>
          </Label>
          <Input 
            value={user?.email || ''} 
            disabled 
            className="h-11 bg-muted"
          />
          <p className="text-xs text-muted-foreground">
            Contact support to change email
          </p>
        </div>

        {/* Phone Number (Editable) */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <Phone className="h-4 w-4" />
            Phone Number
          </Label>
          {isEditingPhone ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="08012345678"
                className="flex-1 h-11"
              />
              <div className="flex gap-2">
                <Button 
                  onClick={handleSavePhoneClick}
                  disabled={isSaving}
                  className="h-11 flex-1 sm:flex-initial"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    setIsEditingPhone(false);
                    setPendingAction(null);
                    setPin('');
                  }}
                  className="h-11 flex-1 sm:flex-initial"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                value={profile.phone_number || 'Not set'}
                disabled
                className="flex-1 h-11 bg-muted"
              />
              <Button 
                variant="outline"
                onClick={() => {
                  setPhoneNumber(profile.phone_number || '');
                  setIsEditingPhone(true);
                }}
                className="h-11"
              >
                <Edit2 className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Edit</span>
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Used for important account notifications
          </p>
        </div>

        {/* Birthday */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <Cake className="h-4 w-4" />
            Birthday
          </Label>
          <div className="flex gap-2">
            <Input
              value={
                profile.birth_year && profile.birth_month
                  ? `${MONTH_NAMES[profile.birth_month - 1]} ${profile.birth_year}`
                  : 'Not set'
              }
              disabled
              className="flex-1 h-11 bg-muted"
            />
            <Button
              variant="outline"
              onClick={() => setShowBirthdayDialog(true)}
              className="h-11"
            >
              <Edit2 className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Edit</span>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Your birth month and year — kept private for account safety
          </p>
        </div>

        {/* Referral Code */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Your Referral Code</Label>
          <div className="flex gap-2">
            <Input
              value={profile.referral_code}
              disabled
              className="flex-1 h-11 font-mono bg-muted"
            />
            <Button
              variant="outline"
              onClick={handleCopyReferralCode}
              className="h-11 px-3"
            >
              {copied ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Share this code to earn ₦500 per friend who joins
          </p>
        </div>
      </CardContent>

      {/* PIN Verification Dialog - Native Mobile Keyboard */}
      <Dialog open={showPinDialog} onOpenChange={(open) => {
        if (!open && !isSaving) {
          setShowPinDialog(false);
          setPin('');
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Lock className="h-8 w-8 text-primary" />
              </div>
            </div>
            <DialogTitle className="text-center text-xl">Enter Your PIN</DialogTitle>
            <DialogDescription className="text-center">
              Confirm this action with your 4-digit security PIN
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            {/* Native PIN Input */}
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
          </div>

          {isSaving && (
            <div className="text-center">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
              <p className="text-sm text-muted-foreground mt-2">Verifying PIN...</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BirthdayEditDialog
        open={showBirthdayDialog}
        onOpenChange={setShowBirthdayDialog}
        userId={userId}
        initialYear={profile.birth_year}
        initialMonth={profile.birth_month}
      />
    </Card>
  );
};