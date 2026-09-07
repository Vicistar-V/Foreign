import { useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  Wallet, TrendingUp, Calendar, Users as UsersIcon, MessageSquare, UserCheck,
  Trash2, Camera, Ban, ShieldCheck, Mail, Phone, Lock,
  AlertCircle, Trophy, Pencil, Bell, Gift, RefreshCcw,
  ChevronLeft, CreditCard, MapPin, Navigation, Landmark, CheckCircle2,
  Clock, MessageCircle, ArrowDownRight, ArrowUpRight, Banknote,
  Star, ExternalLink, Boxes, FileText, MousePointer2, LogIn, Cake,
  Upload, Loader2, Video
} from 'lucide-react';
import { buildLogRocketUserURL } from '@/lib/logrocket';
import { toast } from 'sonner';
import { SimplePagination } from '@/components/ui/SimplePagination';
import { NotificationItem, type Notification } from '@/components/notifications/NotificationItem';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UserAvatar } from '@/components/results/UserAvatar';
import { AvatarPreviewDrawer } from '@/components/results/AvatarPreviewDrawer';
import { RejectAvatarDialog } from '@/components/admin/RejectAvatarDialog';
import { AdminEditProfileDrawer } from '@/components/admin/AdminEditProfileDrawer';
import { useAvatarModeration } from '@/hooks/useAvatarModeration';
import { useAdminSetAvatar } from '@/hooks/useAdminSetAvatar';
import { useBanUser } from '@/hooks/useBanUser';
import { formatLastSeen, getActivityStatus } from '@/hooks/useAllUsers';
import { fmtTimeAgo } from '@/lib/formatLagos';
import { UserPaymentAttempts } from '@/components/admin/UserPaymentAttempts';
import { ClickablePhone } from '@/components/admin/ClickablePhone';
import { CreditBonusDrawer } from '@/components/admin/CreditBonusDrawer';
import { SendDirectNotificationDrawer } from '@/components/admin/SendDirectNotificationDrawer';
import { ActivateMembershipDrawer } from '@/components/admin/ActivateMembershipDrawer';
import { AdminCreateSpotDrawer } from '@/components/admin/AdminCreateSpotDrawer';
import { BanUserDialog } from '@/components/admin/BanUserDialog';
import { UnbanUserDialog } from '@/components/admin/UnbanUserDialog';
import { DeleteUserDialog } from '@/components/admin/DeleteUserDialog';
import { UserDailyTaskPanel } from '@/components/admin/UserDailyTaskPanel';
import { UserTourProgressCard } from '@/components/admin/UserTourProgressCard';
import { estimateAge, formatBirthDisplay } from '@/lib/ageUtils';


const AdminUserDetails = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  
  // Check where we came from for smart back navigation
  const cameFrom = searchParams.get('from');
  
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);
  const [creditBonusOpen, setCreditBonusOpen] = useState(false);
  const [sendMessageOpen, setSendMessageOpen] = useState(false);
  const [activateMembershipOpen, setActivateMembershipOpen] = useState(false);
  const [createSpotOpen, setCreateSpotOpen] = useState(false);
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [unbanDialogOpen, setUnbanDialogOpen] = useState(false);
  const [deleteUserOpen, setDeleteUserOpen] = useState(false);
  const [impersonating, setImpersonating] = useState(false);

  const handleImpersonate = async () => {
    if (!userId) return;
    const confirmed = window.confirm(
      `Log in as this user in a new tab?\n\nThis is recorded for audit. Your admin session here stays signed in.`
    );
    if (!confirmed) return;
    setImpersonating(true);
    try {
      const { data: res, error } = await supabase.functions.invoke('admin-impersonate-user', {
        body: {
          userId,
          redirectTo: '/dashboard',
          origin: window.location.origin,
        },
      });
      if (error) throw error;
      if (!res?.success) throw new Error(res?.error || 'Failed to start session');
      const win = window.open(res.action_link, '_blank', 'noopener');
      if (!win) {
        toast.error('Pop-up blocked', { description: 'Allow pop-ups and try again.' });
      } else {
        toast.success(`Logging in as ${res.target_email}…`);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Could not start session');
    } finally {
      setImpersonating(false);
    }
  };
  
  const { rejectAvatar, isRejecting } = useAvatarModeration();
  const { setAvatar, isSetting } = useAdminSetAvatar();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { banUser, unbanUser, isBanning, isUnbanning } = useBanUser();

  const handleUploadAvatarClick = () => fileInputRef.current?.click();
  const handleAvatarFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !userId) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please pick an image file');
      return;
    }
    setAvatar({ userId, file });
  };

  // Notification pagination state
  const [notifPage, setNotifPage] = useState(1);
  const notifLimit = 10;

  const { data, isLoading, error } = useQuery({
    queryKey: ['user-details', userId, notifPage],
    queryFn: async () => {
      if (!userId) throw new Error('No userId');

      const { data, error } = await supabase.functions.invoke('get-user-details', {
        body: { userId, notifPage, notifLimit },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to load user details');

      return data;
    },
    enabled: !!userId,
  });

  const handleRejectAvatar = (reason: string) => {
    if (!userId) return;
    rejectAvatar({ userId, reason });
    setRejectDialogOpen(false);
  };

  const handleBackNavigation = () => {
    switch (cameFrom) {
      case 'withdrawals': navigate('/admin/withdrawals'); break;
      case 'deposits': navigate('/admin/deposits'); break;
      case 'support': navigate('/admin/support'); break;
      case 'referrals': navigate('/admin/referrals'); break;
      case 'dashboard': navigate('/admin'); break;
      case 'flutterwave': navigate('/admin/flutterwave'); break;
      default: navigate('/admin/users');
    }
  };

  if (!userId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">No user selected</p>
      </div>
    );
  }

  // Get activity status using TRUE last activity
  const trueLastActivity = data?.lastActivity || data?.profile?.last_sign_in_at || null;
  const activityStatus = trueLastActivity 
    ? getActivityStatus(trueLastActivity)
    : 'never';
  
  const activityColors = {
    active: 'text-success',
    idle: 'text-warning',
    dormant: 'text-destructive',
    never: 'text-muted-foreground',
  };

  const activityLabels = {
    active: 'Active Now',
    idle: 'Away',
    dormant: 'Inactive',
    never: 'Never Seen',
  };

  // Get pagination info from stats
  const notifStats = data?.notifications?.stats;
  const totalPages = notifStats?.total_pages || 1;

  // Combine notifications and transactions
  const combinedNotifications = [
    ...(data?.notifications?.items || []).map((e: any) => ({ ...e, source: 'notification' })),
    ...(data?.notifications?.transactions || []).map((t: any) => ({ ...t, source: 'transaction' })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Format money with K suffix
  const formatMoney = (amount: number) => {
    if (Math.abs(amount) >= 1000) {
      return `₦${(amount / 1000).toFixed(1)}k`;
    }
    return `₦${amount.toLocaleString()}`;
  };

  // Get ticket status color
  const getTicketStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-info/10 text-info border-info/20';
      case 'in_progress': return 'bg-warning/10 text-warning border-warning/20';
      case 'waiting_user': return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
      case 'resolved': case 'closed': return 'bg-success/10 text-success border-success/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  // Format ticket status for display
  const formatTicketStatus = (status: string) => {
    switch (status) {
      case 'open': return 'Open';
      case 'in_progress': return 'In Progress';
      case 'waiting_user': return 'Waiting';
      case 'resolved': return 'Resolved';
      case 'closed': return 'Closed';
      default: return status;
    }
  };

  // Format ticket category for display
  const formatTicketCategory = (category: string) => {
    switch (category) {
      case 'money_issue': return 'Money Issue';
      case 'account_problem': return 'Account Problem';
      case 'how_to_use': return 'How To Use';
      case 'complaint': return 'Complaint';
      case 'suggestion': return 'Suggestion';
      default: return 'Other';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Fixed Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center gap-3 p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBackNavigation}
            className="shrink-0"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold truncate">
              {isLoading ? 'Loading...' : data?.profile?.full_name || 'User Details'}
            </h1>
            {data?.profile && (
              <p className="text-xs text-muted-foreground truncate">
                {data.profile.referral_code}
              </p>
            )}
          </div>
          {userId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(buildLogRocketUserURL(userId), '_blank', 'noopener,noreferrer')}
              className="shrink-0 gap-1.5"
              title="Watch this user's sessions in LogRocket"
            >
              <Video className="h-4 w-4" />
              <span className="hidden sm:inline">Watch</span>
            </Button>
          )}
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="p-4 space-y-4">
          <Skeleton className="h-32 w-32 mx-auto rounded-full" />
          <Skeleton className="h-6 w-48 mx-auto" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-4 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
          <p className="text-destructive">Failed to load user details</p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={handleBackNavigation}
          >
            Go Back
          </Button>
        </div>
      )}

      {/* Main Content */}
      {!isLoading && data && (
        <ScrollArea className="h-[calc(100vh-65px)]">
          <div className="p-4 space-y-4 pb-24">
            
            {/* Profile Card */}
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                {/* Avatar & Basic Info */}
                <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-6">
                  <div className="flex flex-col items-center">
                    <div 
                      className="relative cursor-pointer"
                      onClick={() => setAvatarPreviewOpen(true)}
                    >
                      <UserAvatar
                        name={data.profile.full_name}
                        avatarUrl={data.profile.avatar_url}
                        size="xl"
                      />
                      <Button
                        variant="secondary"
                        size="icon"
                        className="absolute -bottom-1 -right-1 h-8 w-8 shadow-md"
                        title={data.profile.avatar_url ? 'Replace photo' : 'Add photo'}
                        disabled={isSetting}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUploadAvatarClick();
                        }}
                      >
                        {isSetting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarFileSelected}
                      />
                    </div>

                    {data.profile.avatar_url && (
                      <button
                        type="button"
                        onClick={() => setRejectDialogOpen(true)}
                        className="mt-2 text-xs text-destructive/80 hover:text-destructive underline-offset-2 hover:underline"
                      >
                        Remove current photo
                      </button>
                    )}
                    
                    <h2 className="mt-4 text-xl font-bold text-center">
                      {data.profile.full_name}
                    </h2>
                    
                    {/* Status Badges */}
                    <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
                      <Badge 
                        variant="outline" 
                        className={`${activityColors[activityStatus]} border-current/20 bg-current/10`}
                      >
                        ● {activityLabels[activityStatus]}
                      </Badge>
                      
                      {data.profile.is_banned ? (
                        <Badge variant="destructive">Banned</Badge>
                      ) : data.profile.is_member ? (
                        <Badge className="bg-success/10 text-success border-success/20">
                          <UserCheck className="h-3 w-3 mr-1" />
                          Member
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Not Activated</Badge>
                      )}
                      
                      
                      {data.spotStats?.auto_compound_enabled && (
                        <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20">
                          <RefreshCcw className="h-3 w-3 mr-1" />
                          Auto-Reinvest
                        </Badge>
                      )}
                      
                      {data.profile.avatar_url && (
                        <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                          <Camera className="h-3 w-3 mr-1" />
                          Photo
                        </Badge>
                      )}
                    </div>
                    
                    {/* Current Location */}
                    {data.currentLocation && (
                      <div className={`mt-3 flex items-center gap-1.5 text-sm ${
                        activityStatus === 'active' ? 'text-success font-medium' : 'text-muted-foreground'
                      }`}>
                        <MapPin className="h-4 w-4" />
                        <span>
                          {activityStatus === 'active' ? 'Now on: ' : 'Last on: '}
                          {data.currentLocation.page_name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Quick Stats Row */}
                <div className="grid grid-cols-2 divide-x">
                  <div className="p-4 text-center">
                    <Clock className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                    <p className="text-xs text-muted-foreground">Last Seen</p>
                    <p className="text-sm font-medium">{formatLastSeen(trueLastActivity)}</p>
                  </div>
                  <div className="p-4 text-center">
                    <Calendar className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                    <p className="text-xs text-muted-foreground">Joined</p>
                    <p className="text-sm font-medium">
                      {fmtTimeAgo(data.profile.created_at)}
                    </p>
                  </div>
                </div>
                
                {/* Ban Info */}
                {data.profile.is_banned && (
                  <div className="p-4 bg-destructive/10 border-t border-destructive/20">
                    <p className="text-sm font-medium text-destructive">Ban Reason:</p>
                    <p className="text-sm text-destructive/80 mt-1">{data.profile.banned_reason}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button 
                variant="outline" 
                className="h-12"
                onClick={() => setEditProfileOpen(true)}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button 
                variant="outline" 
                className="h-12"
                onClick={() => setSendMessageOpen(true)}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Message
              </Button>
              <Button 
                variant="outline" 
                className="h-12"
                onClick={() => setCreditBonusOpen(true)}
              >
                <Gift className="h-4 w-4 mr-2" />
                Bonus
              </Button>
              {data.profile.is_banned ? (
                <Button 
                  variant="outline"
                  className="h-12 text-success border-success/30 hover:bg-success/10"
                  onClick={() => setUnbanDialogOpen(true)}
                >
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  Restore
                </Button>
              ) : !data.profile.is_member ? (
                <Button 
                  variant="outline"
                  className="h-12 text-success border-success/30 hover:bg-success/10"
                  onClick={() => setActivateMembershipOpen(true)}
                >
                  <UserCheck className="h-4 w-4 mr-2" />
                  Activate
                </Button>
              ) : (
                <Button 
                  variant="outline"
                  className="h-12 text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => setBanDialogOpen(true)}
                >
                  <Ban className="h-4 w-4 mr-2" />
                  Ban
                </Button>
              )}
            </div>

            {/* Create Spot for User (admin) */}
            {data.profile.is_member && !data.profile.is_banned && (
              <Button
                variant="outline"
                className="w-full h-12 border-primary/30 text-primary hover:bg-primary/10"
                onClick={() => setCreateSpotOpen(true)}
              >
                <Boxes className="h-4 w-4 mr-2" />
                Create Spot for User
              </Button>
            )}


            {/* Login as user (impersonate) */}
            <Button
              variant="outline"
              className="w-full h-12 border-primary/30 text-primary hover:bg-primary/10"
              onClick={handleImpersonate}
              disabled={impersonating || data.profile.is_banned}
            >
              <LogIn className="h-4 w-4 mr-2" />
              {impersonating ? 'Opening session…' : 'Log in as this user'}
            </Button>





            {/* Contact & Security */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Contact & Security
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate">{data.profile.email}</span>
                  </div>
                  <Badge variant="outline" className={`shrink-0 ml-2 ${
                    data.profile.email_confirmed_at 
                      ? 'bg-success/10 text-success border-success/20' 
                      : 'bg-orange-500/10 text-orange-600 border-orange-500/20'
                  }`}>
                    {data.profile.email_confirmed_at ? 'Verified' : 'Pending'}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <ClickablePhone phone={data.profile.phone_number} className="text-sm" />
                  </div>
                </div>

                {(() => {
                  const by = (data.profile as any).birth_year as number | null | undefined;
                  const bm = (data.profile as any).birth_month as number | null | undefined;
                  const age = estimateAge(by, bm);
                  const display = formatBirthDisplay(by, bm);
                  return (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Cake className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Age</span>
                      </div>
                      {age !== null ? (
                        <div className="text-right">
                          <div className="text-sm font-semibold tabular-nums">
                            {age} years old
                          </div>
                          {display && (
                            <div className="text-[11px] text-muted-foreground">
                              Born {display}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not provided</span>
                      )}
                    </div>
                  );
                })()}

                {(() => {
                  const state = (data.profile as any).state_of_residence as string | null | undefined;
                  return (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">State</span>
                      </div>
                      {state ? (
                        <span className="text-sm font-semibold">{state}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not provided</span>
                      )}
                    </div>
                  );
                })()}

                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Security PIN</span>
                  </div>
                  <Badge variant="outline" className={
                    data.profile.has_pin 
                      ? 'bg-success/10 text-success border-success/20' 
                      : 'bg-warning/10 text-warning border-warning/20'
                  }>
                    {data.profile.has_pin ? 'Set' : 'Not Set'}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UsersIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Referred By</span>
                  </div>
                  {data.referredByUser ? (
                    <button
                      onClick={() => navigate(`/admin/users/${data.referredByUser.id}?from=${cameFrom || 'users'}`)}
                      className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
                    >
                      {data.referredByUser.name}
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  ) : (
                    <span className="text-sm text-muted-foreground">Direct Sign-up</span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* ============================================ */}
            {/* WALLETS — 3 stacked rows incl. PENDING        */}
            {/* ============================================ */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  Wallets
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {/* Earnings */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-success/10 border border-success/20">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-success/20 flex items-center justify-center shrink-0">
                      <TrendingUp className="h-5 w-5 text-success" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">Earnings</p>
                      <p className="text-[11px] text-muted-foreground">Can withdraw</p>
                    </div>
                  </div>
                  <span className="text-lg font-bold text-success tabular-nums">
                    ₦{Number(data.balances?.earnings_balance || 0).toLocaleString()}
                  </span>
                </div>

                {/* Deposit */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-info/10 border border-info/20">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-info/20 flex items-center justify-center shrink-0">
                      <Wallet className="h-5 w-5 text-info" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">Deposit</p>
                      <p className="text-[11px] text-muted-foreground">For buying spots</p>
                    </div>
                  </div>
                  <span className="text-lg font-bold text-info tabular-nums">
                    ₦{Number(data.balances?.deposit_balance || 0).toLocaleString()}
                  </span>
                </div>

                {/* Pending — NEW */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-warning/10 border border-warning/20">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-warning/20 flex items-center justify-center shrink-0">
                      <Clock className="h-5 w-5 text-warning" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">Pending (Task Pending Balance)</p>
                      <p className="text-[11px] text-muted-foreground">Fills next harvest</p>
                    </div>
                  </div>
                  <span className="text-lg font-bold text-warning tabular-nums">
                    ₦{Number(data.balances?.pending_balance || 0).toLocaleString()}
                  </span>
                </div>

                {/* Referral earnings */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                      <UsersIcon className="h-5 w-5 text-purple-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">Referral Earnings</p>
                      <p className="text-[11px] text-muted-foreground">
                        { (data.referralStats?.total_invited || 0).toLocaleString() } invited · {data.referralStats?.active_referrals || 0} active
                      </p>
                    </div>
                  </div>
                  <span className="text-lg font-bold text-purple-600 tabular-nums">
                    ₦{Number(data.referralStats?.total_earned || 0).toLocaleString()}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* ============================================ */}
            {/* MONEY FLOW SUMMARY                            */}
            {/* ============================================ */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Banknote className="h-4 w-4" />
                  Money Flow (All Time)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-3 bg-info/10 rounded-xl">
                    <ArrowDownRight className="h-4 w-4 mx-auto text-info" />
                    <p className="text-[10px] text-muted-foreground mt-1">Money In</p>
                    <p className="text-sm font-bold text-info tabular-nums">
                      {formatMoney(data.financialSummary?.total_deposited || 0)}
                    </p>
                  </div>
                  <div className="text-center p-3 bg-orange-500/10 rounded-xl">
                    <ArrowUpRight className="h-4 w-4 mx-auto text-orange-500" />
                    <p className="text-[10px] text-muted-foreground mt-1">Money Out</p>
                    <p className="text-sm font-bold text-orange-600 tabular-nums">
                      {formatMoney(data.financialSummary?.total_withdrawn || 0)}
                    </p>
                  </div>
                  <div className={`text-center p-3 rounded-xl ${
                    (data.financialSummary?.net_position || 0) >= 0
                      ? 'bg-success/10'
                      : 'bg-destructive/10'
                  }`}>
                    <Banknote className={`h-4 w-4 mx-auto ${
                      (data.financialSummary?.net_position || 0) >= 0 ? 'text-success' : 'text-destructive'
                    }`} />
                    <p className="text-[10px] text-muted-foreground mt-1">Net</p>
                    <p className={`text-sm font-bold tabular-nums ${
                      (data.financialSummary?.net_position || 0) >= 0 ? 'text-success' : 'text-destructive'
                    }`}>
                      {(data.financialSummary?.net_position || 0) >= 0 ? '+' : ''}
                      {formatMoney(data.financialSummary?.net_position || 0)}
                    </p>
                  </div>
                </div>

                {(data.financialSummary?.pending_withdrawals || 0) > 0 && (
                  <div className="flex items-center justify-between p-3 bg-warning/10 border border-warning/20 rounded-xl mt-3">
                    <span className="text-sm text-warning flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Pending Withdrawal
                    </span>
                    <span className="text-base font-bold text-warning tabular-nums">
                      ₦{data.financialSummary?.pending_withdrawals?.toLocaleString()}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ============================================ */}
            {/* SPOTS HEADLINE                                */}
            {/* ============================================ */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Boxes className="h-4 w-4" />
                  Spots Snapshot
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-3 bg-primary/10 rounded-xl text-center">
                    <p className="text-xl font-bold tabular-nums">{data.spotStats?.total_spots || 0}</p>
                    <p className="text-[10px] text-muted-foreground">Spots</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-xl text-center">
                    <p className="text-xl font-bold tabular-nums">{data.spotStats?.total_cycles || 0}</p>
                    <p className="text-[10px] text-muted-foreground">Cycles Done</p>
                  </div>
                  <div className="p-3 bg-success/10 rounded-xl text-center">
                    <p className="text-xl font-bold text-success tabular-nums">
                      {formatMoney(data.spotStats?.total_earnings || 0)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Spot Earnings</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 text-sm bg-muted/30 rounded-lg p-2.5">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-warning" />
                    <span className="tabular-nums">{data.spotStats?.spots_in_queue || 0} waiting</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Trophy className="h-4 w-4 text-success" />
                    <span className="tabular-nums">{data.spotStats?.paid_out_count || 0} payouts</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ============================================ */}
            {/* DETAILED SECTIONS — ACCORDION (mobile-first) */}
            {/* ============================================ */}
            <Accordion type="multiple" className="space-y-2.5">
              {/* Bank Accounts */}
              <AccordionItem value="banks" className="border rounded-xl px-4 bg-card">
                <AccordionTrigger className="hover:no-underline py-3.5">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                      <Landmark className="h-4 w-4 text-foreground" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold">Bank Accounts</p>
                      <p className="text-[11px] text-muted-foreground">
                        {data?.withdrawalAccounts?.length || 0} saved
                      </p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-2 pt-1 pb-3">
                  {(!data?.withdrawalAccounts || data.withdrawalAccounts.length === 0) ? (
                    <div className="text-center py-6">
                      <p className="text-sm text-muted-foreground">No bank accounts added</p>
                    </div>
                  ) : (
                    data.withdrawalAccounts.map((account: any) => (
                      <div key={account.id} className={`p-3 rounded-lg border ${account.is_primary ? 'border-primary/50 bg-primary/5' : 'border-border bg-muted/30'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm">{account.bank_name}</p>
                            <p className="text-sm text-muted-foreground font-mono">
                              {account.account_number.slice(0, 4)}****{account.account_number.slice(-2)}
                            </p>
                            <p className="text-[11px] text-muted-foreground uppercase mt-0.5 truncate">
                              {account.account_name}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            {account.is_primary && (
                              <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">Primary</Badge>
                            )}
                            {account.is_verified && (
                              <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-[10px]">
                                <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Verified
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </AccordionContent>
              </AccordionItem>

              {/* Spots & Queue */}
              <AccordionItem value="spots" className="border rounded-xl px-4 bg-card">
                <AccordionTrigger className="hover:no-underline py-3.5">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                      <Boxes className="h-4 w-4 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold">Spots & Queue</p>
                      <p className="text-[11px] text-muted-foreground">
                        {data?.spots?.length || 0} spots · {data?.queueEntries?.length || 0} queue entries
                      </p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-1 pb-3">
                  <div>
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Spots</p>
                    {(!data?.spots || data.spots.length === 0) ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No spots yet</p>
                    ) : (
                      <div className="space-y-1.5">
                        {data.spots.map((spot: any) => (
                          <div key={spot.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border border-border/50">
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{spot.spot_name}</p>
                              <p className="text-[11px] text-muted-foreground tabular-nums">
                                {spot.total_cycles} cycles · ₦{Number(spot.total_earnings).toLocaleString()}
                              </p>
                            </div>
                            <Badge variant={spot.status === 'active' ? 'default' : 'outline'} className="text-[10px]">
                              {spot.status === 'active' ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Queue Entries</p>
                    {(!data?.queueEntries || data.queueEntries.length === 0) ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No entries in queue</p>
                    ) : (
                      <div className="space-y-1.5">
                        {data.queueEntries.slice(0, 10).map((entry: any) => (
                          <div key={entry.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border border-border/50">
                            <div className="min-w-0">
                              <p className="text-sm font-medium flex items-center gap-1.5">
                                #<span className="tabular-nums">{entry.position}</span>
                                {entry.source_type === 'reentry' && (
                                  <Badge variant="outline" className="text-[9px] h-4 px-1">Re-entry</Badge>
                                )}
                              </p>
                              <Badge
                                variant="outline"
                                className={`mt-0.5 text-[10px] ${
                                  entry.status === 'paid'
                                    ? 'bg-success/10 text-success border-success/20'
                                    : entry.status === 'completed'
                                      ? 'bg-info/10 text-info border-info/20'
                                      : entry.status === 'filling'
                                        ? 'bg-warning/10 text-warning border-warning/20'
                                        : ''
                                }`}
                              >
                                {entry.status === 'paid' ? 'Paid' :
                                  entry.status === 'completed' ? 'Done' :
                                    entry.status === 'filling' ? 'Filling' : 'Waiting'}
                              </Badge>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-medium tabular-nums">
                                ₦{Number(entry.fill_amount).toLocaleString()} / ₦{Number(entry.target_amount).toLocaleString()}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {new Date(entry.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Daily Task */}
              <AccordionItem value="dailyTask" className="border rounded-xl px-4 bg-card">
                <AccordionTrigger className="hover:no-underline py-3.5">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="h-9 w-9 rounded-full bg-warning/10 flex items-center justify-center">
                      <Trophy className="h-4 w-4 text-warning" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold">Daily Task</p>
                      <p className="text-[11px] text-muted-foreground">
                        Today: {data.dailyTask?.today?.batches_done || 0} batches
                      </p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-1 pb-3">
                  <UserDailyTaskPanel userId={userId!} dailyTask={data.dailyTask} />
                </AccordionContent>
              </AccordionItem>

              {/* Money History */}
              <AccordionItem value="money" className="border rounded-xl px-4 bg-card">
                <AccordionTrigger className="hover:no-underline py-3.5">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="h-9 w-9 rounded-full bg-info/10 flex items-center justify-center">
                      <CreditCard className="h-4 w-4 text-info" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold">Money History</p>
                      <p className="text-[11px] text-muted-foreground">
                        {data?.recentTransactions?.length || 0} recent transactions
                      </p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-1 pb-3">
                  <UserPaymentAttempts userId={userId!} />

                  <div>
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Recent Transactions</p>
                    {(!data?.recentTransactions || data.recentTransactions.length === 0) ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No transactions yet</p>
                    ) : (
                      <div className="space-y-1.5">
                        {data.recentTransactions.slice(0, 15).map((tx: any) => (
                          <div key={tx.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-muted/30 border border-border/50">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{tx.description}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {new Date(tx.created_at).toLocaleString()}
                              </p>
                            </div>
                            <span className={`text-sm font-bold tabular-nums shrink-0 ${tx.amount >= 0 ? 'text-success' : 'text-destructive'}`}>
                              {tx.amount >= 0 ? '+' : ''}₦{Math.abs(tx.amount).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Referrals */}
              <AccordionItem value="referrals" className="border rounded-xl px-4 bg-card">
                <AccordionTrigger className="hover:no-underline py-3.5">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="h-9 w-9 rounded-full bg-purple-500/10 flex items-center justify-center">
                      <UsersIcon className="h-4 w-4 text-purple-600" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold">Referrals</p>
                      <p className="text-[11px] text-muted-foreground">
                        { (data.referralStats?.total_invited || 0).toLocaleString() } invited · ₦{Number(data.referralStats?.total_earned || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-2 pt-1 pb-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center p-2.5 bg-muted/50 rounded-lg">
                      <p className="text-lg font-bold tabular-nums">{data.referralStats?.total_invited || 0}</p>
                      <p className="text-[10px] text-muted-foreground">Invited</p>
                    </div>
                    <div className="text-center p-2.5 bg-success/10 rounded-lg">
                      <p className="text-lg font-bold text-success tabular-nums">{data.referralStats?.active_referrals || 0}</p>
                      <p className="text-[10px] text-muted-foreground">Active</p>
                    </div>
                    <div className="text-center p-2.5 bg-purple-500/10 rounded-lg">
                      <p className="text-lg font-bold text-purple-600 tabular-nums">{formatMoney(data.referralStats?.total_earned || 0)}</p>
                      <p className="text-[10px] text-muted-foreground">Earned</p>
                    </div>
                  </div>

                  {(!data?.referrals || data.referrals.length === 0) ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No referrals yet</p>
                  ) : (
                    <div className="space-y-1.5">
                      {data.referrals.map((ref: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border border-border/50">
                          <div className="flex items-center gap-2 min-w-0">
                            <UserAvatar name={ref.name} avatarUrl={ref.avatar_url} size="sm" />
                            <div className="min-w-0">
                              <button
                                onClick={() => navigate(`/admin/users/${ref.id}?from=${cameFrom || 'users'}`)}
                                className="text-sm font-medium hover:underline text-left truncate block"
                              >
                                {ref.name}
                              </button>
                              <p className="text-[10px] text-muted-foreground">
                                {new Date(ref.date).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge variant={ref.is_member ? 'default' : 'outline'} className="text-[10px]">
                              {ref.is_member ? 'Member' : 'Pending'}
                            </Badge>
                            {ref.earned > 0 && (
                              <span className="text-xs font-bold text-success tabular-nums">
                                +₦{ref.earned.toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>

              {/* Support Tickets */}
              <AccordionItem value="tickets" className="border rounded-xl px-4 bg-card">
                <AccordionTrigger className="hover:no-underline py-3.5">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="h-9 w-9 rounded-full bg-info/10 flex items-center justify-center relative">
                      <MessageCircle className="h-4 w-4 text-info" />
                      {(data.ticketStats?.open || 0) > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 text-[9px] bg-info text-white rounded-full flex items-center justify-center font-bold">
                          {data.ticketStats.open}
                        </span>
                      )}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold">Support Tickets</p>
                      <p className="text-[11px] text-muted-foreground">
                        {(data.ticketStats?.total || 0).toLocaleString()} total · {(data.ticketStats?.open || 0).toLocaleString()} open
                      </p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-1.5 pt-1 pb-3">
                  {(!data?.supportTickets || data.supportTickets.length === 0) ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No support tickets</p>
                  ) : (
                    data.supportTickets.map((ticket: any) => (
                      <div key={ticket.id} className="p-3 rounded-lg bg-muted/30 border border-border/50">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{ticket.subject}</p>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <Badge variant="outline" className="text-[10px]">
                                {formatTicketCategory(ticket.category)}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">
                                {ticket.message_count} msg
                              </span>
                              <span className="text-[10px] text-muted-foreground">·</span>
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(ticket.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <Badge variant="outline" className={`text-[10px] ${getTicketStatusColor(ticket.status)}`}>
                              {formatTicketStatus(ticket.status)}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-[10px] h-6 px-2"
                              onClick={() => navigate(`/admin/support/${ticket.id}`)}
                            >
                              Open <ExternalLink className="h-2.5 w-2.5 ml-0.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </AccordionContent>
              </AccordionItem>

              {/* Alerts & Notifications */}
              <AccordionItem value="alerts" className="border rounded-xl px-4 bg-card">
                <AccordionTrigger className="hover:no-underline py-3.5">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="h-9 w-9 rounded-full bg-destructive/10 flex items-center justify-center relative">
                      <Bell className="h-4 w-4 text-destructive" />
                      {(notifStats?.total_unread || 0) > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 text-[9px] bg-destructive text-destructive-foreground rounded-full flex items-center justify-center font-bold">
                          {notifStats.total_unread > 99 ? '99+' : notifStats.total_unread}
                        </span>
                      )}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold">Alerts & Updates</p>
                      <p className="text-[11px] text-muted-foreground">
                        {notifStats?.total_notifications || 0} alerts · {notifStats?.total_transactions || 0} money updates
                      </p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-1 pb-3">
                  {combinedNotifications.length > 0 ? (
                    <div className="space-y-2">
                      {combinedNotifications.map((item: any) => {
                        const formattedNotification: Notification = {
                          id: item.id,
                          source: 'notification',
                          event_type: item.source === 'notification' ? item.notification_type : item.transaction_type,
                          event_data: item.source === 'notification'
                            ? item.metadata || {}
                            : { amount: item.amount, message: item.description },
                          created_at: item.created_at,
                          read_at: item.read_at,
                        };

                        return (
                          <NotificationItem
                            key={`${item.source}-${item.id}`}
                            notification={formattedNotification}
                            truncate={true}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No alerts found</p>
                  )}

                  {totalPages > 1 && (
                    <SimplePagination
                      currentPage={notifPage}
                      totalPages={totalPages}
                      totalItems={(notifStats?.total_notifications || 0) + (notifStats?.total_transactions || 0)}
                      itemsPerPage={notifLimit}
                      onPageChange={setNotifPage}
                    />
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>


            {/* Welcome tour progress */}
            <UserTourProgressCard userId={userId!} />

            {/* Recent Journey */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Navigation className="h-4 w-4" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.recentJourney && data.recentJourney.length > 0 ? (
                  <ScrollArea className="h-[420px] pr-2">
                    <div className="space-y-2">
                      {data.recentJourney.slice(0, 25).map((activity: any, index: number) => {
                      const isPageView = activity.action_type === 'page_view';
                      // Convert slugs like "activation_pay_clicked" → "Activation pay clicked"
                      const prettyDetail = activity.action_detail
                        ? String(activity.action_detail).replace(/_/g, ' ').replace(/^./, (c: string) => c.toUpperCase())
                        : null;
                      return (
                        <div key={index} className="flex items-center justify-between text-sm p-2 bg-muted/30 rounded-lg">
                          <div className="flex items-center gap-2 min-w-0">
                            {isPageView ? (
                              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            ) : (
                              <MousePointer2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                            )}
                            <div className="flex min-w-0 flex-col">
                              <span className="font-medium truncate">
                                {prettyDetail && !isPageView ? prettyDetail : activity.page_name}
                              </span>
                              {prettyDetail && !isPageView && activity.page_name && (
                                <span className="truncate text-[10px] text-muted-foreground">
                                  on {activity.page_name}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="shrink-0 text-right text-[10px] leading-tight text-muted-foreground">
                            {new Date(activity.at).toLocaleString('en-NG', {
                              timeZone: 'Africa/Lagos',
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      );
                    })}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="rounded-lg bg-muted/30 p-4 text-center">
                    <Navigation className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
                    <p className="text-sm font-medium">No movement recorded yet</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      When this person opens a page or taps important buttons, it will show here.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quiet delete link — tucked at the very bottom */}
            <div className="pt-6 pb-2 text-center">
              <button
                onClick={() => setDeleteUserOpen(true)}
                className="text-xs text-muted-foreground/70 hover:text-destructive underline-offset-4 hover:underline transition-colors"
              >
                Delete this user permanently
              </button>
            </div>
          </div>
        </ScrollArea>
      )}

      {/* Dialogs & Drawers */}
      {data?.profile && (
        <>
          <RejectAvatarDialog
            open={rejectDialogOpen}
            onOpenChange={setRejectDialogOpen}
            userName={data.profile.full_name}
            avatarUrl={data.profile.avatar_url || ''}
            onConfirm={handleRejectAvatar}
            isLoading={isRejecting}
          />
          
          <AdminEditProfileDrawer
            open={editProfileOpen}
            onOpenChange={setEditProfileOpen}
            profile={{
              id: userId!,
              full_name: data.profile.full_name,
              phone_number: data.profile.phone_number,
              is_name_locked: data.profile.is_name_locked,
              has_pin: data.profile.has_pin,
              email: data.profile.email,
              email_confirmed_at: data.profile.email_confirmed_at,
            }}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['user-details', userId] });
            }}
          />
          
          <AvatarPreviewDrawer
            isOpen={avatarPreviewOpen}
            onClose={() => setAvatarPreviewOpen(false)}
            name={data.profile.full_name}
            avatarUrl={data.profile.avatar_url}
          />
          
          <CreditBonusDrawer
            open={creditBonusOpen}
            onOpenChange={setCreditBonusOpen}
            userId={userId!}
            userName={data.profile.full_name}
          />
          
          <SendDirectNotificationDrawer
            open={sendMessageOpen}
            onOpenChange={setSendMessageOpen}
            userId={userId!}
            userName={data.profile.full_name}
          />
          
          <ActivateMembershipDrawer
            open={activateMembershipOpen}
            onOpenChange={setActivateMembershipOpen}
            userId={userId!}
            userName={data.profile.full_name}
          />

          <AdminCreateSpotDrawer
            open={createSpotOpen}
            onOpenChange={setCreateSpotOpen}
            userId={userId!}
            userName={data.profile.full_name}
            isMember={!!data.profile.is_member}
            isBanned={!!data.profile.is_banned}
            depositBalance={Number(data.balances?.deposit_balance || 0)}
            earningsBalance={Number(data.balances?.earnings_balance || 0)}
          />
          
          
          <BanUserDialog
            open={banDialogOpen}
            onOpenChange={setBanDialogOpen}
            userName={data.profile.full_name}
            avatarUrl={data.profile.avatar_url}
            isLoading={isBanning}
            onConfirm={(reason) => {
              banUser({ userId: userId!, reason }, {
                onSuccess: () => {
                  setBanDialogOpen(false);
                  queryClient.invalidateQueries({ queryKey: ['user-details', userId] });
                  queryClient.invalidateQueries({ queryKey: ['all-users'] });
                }
              });
            }}
          />
          
          <UnbanUserDialog
            open={unbanDialogOpen}
            onOpenChange={setUnbanDialogOpen}
            userName={data.profile.full_name}
            bannedReason={data.profile.banned_reason}
            avatarUrl={data.profile.avatar_url}
            isLoading={isUnbanning}
            onConfirm={() => {
              unbanUser({ userId: userId! }, {
                onSuccess: () => {
                  setUnbanDialogOpen(false);
                  queryClient.invalidateQueries({ queryKey: ['user-details', userId] });
                  queryClient.invalidateQueries({ queryKey: ['all-users'] });
                }
              });
            }}
          />

          <DeleteUserDialog
            open={deleteUserOpen}
            onOpenChange={setDeleteUserOpen}
            userId={userId!}
            userName={data.profile.full_name}
            isMember={!!data.profile.is_member}
            hasSpots={(data?.spots?.length ?? 0) > 0}
          />
        </>
      )}
    </div>
  );
};

export default AdminUserDetails;
