/**
 * Profile Page - Premium Mobile-First Design
 * Clean, modern profile with elegant sections
 */
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Camera, ChevronRight, Shield, Key, Building2, 
  MessageCircle, FileText, Lock, Crown, Settings,
  Phone, Mail, Copy, Check, Edit2, User, AlertTriangle
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useReferralData } from '@/hooks/useReferralData';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BannedBanner } from '@/components/BannedBanner';
import { UserAvatar } from '@/components/results/UserAvatar';
import { ProfileEditDrawer } from '@/components/settings/ProfileEditDrawer';
import { BankAccountsDrawer } from '@/components/settings/BankAccountsDrawer';
import { trackClarityEvent, ClarityEvents } from '@/lib/clarityTracking';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { generateReferralLink } from '@/lib/shareUtils';

export default function Profile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: profile, isLoading } = useProfile(user?.id);
  const { data: referralData } = useReferralData();
  const [copied, setCopied] = useState(false);
  const [editField, setEditField] = useState<'name' | 'phone' | null>(null);
  const [showBankAccounts, setShowBankAccounts] = useState(false);
  
  const isBanned = profile?.is_banned ?? false;
  const bannedReason = profile?.banned_reason;

  // Referral data still queried elsewhere; tier system removed (not in backend).
  void referralData;

  // Track page view
  useEffect(() => {
    trackClarityEvent(ClarityEvents.PAGE_VIEW_PROFILE);
  }, []);

  const handleCopyCode = async () => {
    if (!profile?.referral_code) return;
    
    // Use canonical /signup/:code path + cloak access key (?k=…)
    const referralLink = generateReferralLink(profile.referral_code);
    await navigator.clipboard.writeText(referralLink);
    
    setCopied(true);
    toast({ title: 'Copied!', description: 'Referral link copied' });
    trackClarityEvent(ClarityEvents.PROFILE_REFERRAL_COPIED);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!user || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const menuItems = [
    {
      id: 'security',
      label: 'Security',
      description: 'Password & PIN',
      icon: Shield,
      onClick: () => navigate('/change-password'),
    },
    {
      id: 'pin',
      label: 'Change PIN',
      description: 'Update security PIN',
      icon: Key,
      onClick: () => navigate('/change-pin'),
    },
    {
      id: 'bank',
      label: 'Bank Accounts',
      description: 'Withdrawal destinations',
      icon: Building2,
      onClick: () => setShowBankAccounts(true),
    },
    {
      id: 'support',
      label: 'Get Help',
      description: 'Contact support',
      icon: MessageCircle,
      onClick: () => navigate('/support'),
      primary: true,
    },
  ];

  const legalItems = [
    { label: 'Terms & Conditions', href: '/terms', icon: FileText },
    { label: 'Privacy Policy', href: '/privacy', icon: Lock },
  ];

  return (
    <div className="min-h-screen pb-24">
      {/* Banned Banner */}
      {isBanned && (
        <div className="p-4">
          <BannedBanner reason={bannedReason} />
        </div>
      )}

      {/* Hero Section - Profile Header */}
      <div className="relative overflow-hidden">
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-primary/5 to-transparent" />
        
        <div className="relative px-4 pt-6 pb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center text-center"
          >
            {/* Avatar with Edit Button */}
            <div className="relative mb-4">
              <div className="relative">
                <UserAvatar
                  name={profile?.full_name || 'User'}
                  avatarUrl={profile?.avatar_url}
                  size="xl"
                />
              </div>
              
              {/* Camera Button */}
              <button
                onClick={() => {
                  trackClarityEvent(ClarityEvents.PROFILE_AVATAR_CLICKED);
                  navigate('/set-profile-picture?change=true', { state: { from: '/profile' } });
                }}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg border-2 border-background"
              >
                <Camera className="h-4 w-4" />
              </button>
            </div>

            {/* Name & Status */}
            <h1 className="text-xl font-bold mb-1">{profile?.full_name}</h1>
            
            <div className="flex items-center gap-2 mb-3">
              {profile?.is_member ? (
                <Badge className="bg-primary/10 text-primary border-primary/20">
                  <Crown className="h-3 w-3 mr-1" />
                  Active Member
                </Badge>
              ) : (
                <Badge variant="secondary">Free Account</Badge>
              )}
            </div>

            {/* Referral Code */}
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border shadow-sm active:scale-95 transition-transform"
            >
              <span className="text-sm font-mono text-muted-foreground">
                {profile?.referral_code}
              </span>
              {copied ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <Copy className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </motion.div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 space-y-4">
        {/* Photo Warning */}
        <Alert className="border-warning/50 bg-warning/5">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertDescription className="text-xs">
            Use a real photo of yourself. Fake images may result in suspension.
          </AlertDescription>
        </Alert>

        {/* Profile Info Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-2xl border border-border overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-border bg-muted/30">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Profile Information
            </h2>
          </div>
          
          <div className="divide-y divide-border">
            {/* Full Name */}
            <button
              onClick={() => !profile?.is_name_locked && setEditField('name')}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-muted/30 transition-colors"
              disabled={profile?.is_name_locked}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Full Name</p>
                  <p className="text-sm font-medium">{profile?.full_name}</p>
                </div>
              </div>
              {profile?.is_name_locked ? (
                <Lock className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Edit2 className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            {/* Email */}
            <div className="px-4 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium truncate max-w-[200px]">{user?.email}</p>
                </div>
              </div>
              <Lock className="h-4 w-4 text-muted-foreground" />
            </div>

            {/* Phone */}
            <button
              onClick={() => setEditField('phone')}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="text-sm font-medium">
                    {profile?.phone_number || 'Not set'}
                  </p>
                </div>
              </div>
              <Edit2 className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card rounded-2xl border border-border overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-border bg-muted/30">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Settings className="h-4 w-4 text-primary" />
              Settings
            </h2>
          </div>
          
          <div className="divide-y divide-border">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={item.onClick}
                className={cn(
                  "w-full px-4 py-3.5 flex items-center justify-between text-left transition-colors",
                  item.primary 
                    ? "bg-primary/5 hover:bg-primary/10" 
                    : "hover:bg-muted/30"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center",
                    item.primary ? "bg-primary/10" : "bg-muted"
                  )}>
                    <item.icon className={cn(
                      "h-4 w-4",
                      item.primary ? "text-primary" : "text-muted-foreground"
                    )} />
                  </div>
                  <div>
                    <p className={cn(
                      "text-sm font-medium",
                      item.primary && "text-primary"
                    )}>{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
            ))}
          </div>
        </motion.div>

        {/* Legal Links */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="flex gap-3"
        >
          {legalItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="flex-1 flex items-center gap-2 px-4 py-3 rounded-xl bg-card border border-border text-sm text-muted-foreground hover:bg-muted/30 transition-colors"
            >
              <item.icon className="h-4 w-4" />
              <span className="truncate">{item.label}</span>
            </a>
          ))}
        </motion.div>

        {/* Activity Log */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-center py-4 text-xs text-muted-foreground"
        >
          Last login: {new Intl.DateTimeFormat('en-NG', {
            timeZone: 'Africa/Lagos',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }).format(new Date(user?.last_sign_in_at || Date.now()))}
        </motion.div>
      </div>

      {/* Edit Drawer */}
      <ProfileEditDrawer
        open={editField !== null}
        onOpenChange={(open) => !open && setEditField(null)}
        field={editField}
        currentValue={editField === 'name' ? profile?.full_name : profile?.phone_number}
        userId={user.id}
      />

      {/* Bank Accounts Drawer */}
      <BankAccountsDrawer
        open={showBankAccounts}
        onOpenChange={setShowBankAccounts}
        userId={user.id}
      />
    </div>
  );
}
