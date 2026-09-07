import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useDropsRealtime } from '@/hooks/useDropsRealtime';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useBalances } from '@/hooks/useBalances';
import { useTransactions } from '@/hooks/useTransactions';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import { useWhatsAppGroupLink } from '@/hooks/useWhatsAppGroupLink';
import { useWithdrawalVerification } from '@/hooks/useWithdrawalVerification';
import { TimeBasedGreeting } from '@/components/dashboard/TimeBasedGreeting';
import { WalletCard } from '@/components/dashboard/WalletCard';
import { NonMemberVaultCard } from '@/components/dashboard/NonMemberVaultCard';


import { MachinesCard } from '@/components/dashboard/MachinesCard';

import { GlobalQueueStats } from '@/components/dashboard/GlobalQueueStats';


import { BuySpotDrawer } from '@/components/dashboard/BuySpotDrawer';

import { DailyTaskCard } from '@/components/dashboard/DailyTaskCard';




import { FillingQueueCarousel } from '@/components/dashboard/FillingQueueCarousel';
import { LockedDashboardPreview } from '@/components/dashboard/LockedDashboardPreview';
import { HarvestUrgencyStrip } from '@/components/dashboard/HarvestUrgencyStrip';
import { WhatsAppGroupPromo } from '@/components/WhatsAppGroupPromo';
import { DashboardActivityTicker } from '@/components/dashboard/DashboardActivityTicker';
import { EnterLineCTA } from '@/components/dashboard/EnterLineCTA';

// FirstTimeWelcomeModal and V3AnnouncementModal are now handled in ProtectedRoute
import { hasSeenActivationSuccess as hasSeenWelcomeBonus } from '@/lib/activationSuccessSeen';
import { startMembershipPayment } from '@/lib/startMembershipPayment';
import { onboardingSkip } from '@/lib/onboardingSkip';
import { useMembershipDrawer } from '@/context/MembershipDrawerContext';
import { TransactionDetailDrawer } from '@/components/TransactionDetailDrawer';
import { DepositModal } from '@/components/DepositModal';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { StaggeredList, StaggeredItem } from '@/components/animations';
import { motion } from 'framer-motion';
import { trackClarityEvent, ClarityEvents } from '@/lib/clarityTracking';
import { trackFBPurchase, FBPixelEvents } from '@/lib/facebookPixel';
import { useFBPurchaseSync } from '@/hooks/useFBPurchaseSync';
import { useTour } from '@/context/TourContext';


const FIRST_VISIT_KEY = 'viketa_dashboard_first_visit';

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { openMembershipDrawer } = useMembershipDrawer();
  
  // Enable real-time updates for earnings feed
  useDropsRealtime();
  
  const { data, isLoading, error } = useDashboardData();
  // Universal FB Purchase event safety-net: fires Purchase for any verified
  // real-money payment we haven't reported yet (covers Moniepoint, Paystack,
  // Flutterwave, AND manual admin verification). Dedupes via tx id.
  useFBPurchaseSync(user?.id);
  const { data: balances } = useBalances(user?.id);
  const { data: transactions } = useTransactions(user?.id);
  const { data: config } = usePlatformConfig();
  const whatsappGroup = useWhatsAppGroupLink();
  
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  
  
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  // showWelcomeModal and showV3Modal moved to ProtectedRoute
  const [showWelcomeBonusModal, setShowWelcomeBonusModal] = useState(false);
  // showPaymentDrawer for welcome modal moved to ProtectedRoute
  
  // Time tracking refs
  const timeTrackerRef = useRef<{
    tracked30s: boolean;
    tracked60s: boolean;
    tracked120s: boolean;
  }>({ tracked30s: false, tracked60s: false, tracked120s: false });
  
  // Scroll tracking ref
  const hasTrackedScroll = useRef(false);
  

  // Withdrawal verification
  const { mutate: verifyWithdrawal, isPending: isVerifying } = useWithdrawalVerification(user?.id || '');

  // Kick off the first-time user tour — ONLY for activated members.
  // Unpaid users see the locked dashboard and shouldn't get tour overlays
  // pointing at features they can't use.
  const { start: startTour } = useTour();
  const tourIsMember = data?.profile?.is_member ?? false;
  useEffect(() => {
    if (!authLoading && user?.id && tourIsMember) {
      // Small delay so dashboard cards mount before we try to scroll-to-cta.
      const t = setTimeout(() => startTour(), 600);
      return () => clearTimeout(t);
    }
  }, [authLoading, user?.id, tourIsMember, startTour]);


  // Track page view and first/return visit
  useEffect(() => {
    trackClarityEvent(ClarityEvents.PAGE_VIEW_DASHBOARD);
    
    // Check if first visit to dashboard
    const isFirstVisit = !localStorage.getItem(FIRST_VISIT_KEY);
    if (isFirstVisit) {
      trackClarityEvent(ClarityEvents.DASHBOARD_FIRST_VISIT);
      localStorage.setItem(FIRST_VISIT_KEY, 'true');
    } else {
      trackClarityEvent(ClarityEvents.DASHBOARD_RETURN_VISIT);
    }
  }, []);

  // Welcome modal and V3 announcement are now handled in ProtectedRoute

  // Time-on-page tracking
  useEffect(() => {
    const startTime = Date.now();
    
    const checkTimeIntervals = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      
      if (elapsed >= 30 && !timeTrackerRef.current.tracked30s) {
        trackClarityEvent(ClarityEvents.DASHBOARD_TIME_ON_PAGE_30S);
        timeTrackerRef.current.tracked30s = true;
      }
      if (elapsed >= 60 && !timeTrackerRef.current.tracked60s) {
        trackClarityEvent(ClarityEvents.DASHBOARD_TIME_ON_PAGE_60S);
        timeTrackerRef.current.tracked60s = true;
      }
      if (elapsed >= 120 && !timeTrackerRef.current.tracked120s) {
        trackClarityEvent(ClarityEvents.DASHBOARD_TIME_ON_PAGE_120S);
        timeTrackerRef.current.tracked120s = true;
      }
    };
    
    const interval = setInterval(checkTimeIntervals, 5000);
    return () => clearInterval(interval);
  }, []);

  // Scroll-to-bottom tracking
  useEffect(() => {
    const handleScroll = () => {
      if (hasTrackedScroll.current) return;
      
      const scrollTop = window.scrollY;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollPercent = ((scrollTop + windowHeight) / documentHeight) * 100;
      
      if (scrollPercent > 90) {
        trackClarityEvent(ClarityEvents.DASHBOARD_SCROLL_TO_BOTTOM);
        hasTrackedScroll.current = true;
      }
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle payment callback status
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment');
    const amount = params.get('amount');
    const reason = params.get('reason');
    const type = params.get('type');

    if (paymentStatus === 'success') {
      const message = type === 'membership' 
        ? `Membership activated! ₦${Number(amount).toLocaleString()} processed`
        : `₦${Number(amount).toLocaleString()} has been added to your wallet`;
      
      // NOTE: We do NOT fire trackFBPurchase here anymore.
      // useFBPurchaseSync (above) handles ALL payment paths uniformly,
      // firing with the real transaction id as eventID so Meta can dedup.
      if (type === 'membership') {
        // Park the user on the dashboard so ProtectedRoute doesn't bounce
        // them to /create-pin before the celebration modal appears.
        // ActivationSuccessModal re-applies these on open too as a safety net.
        onboardingSkip.skipPin();
        onboardingSkip.skipAvatar();

        // Show Activation Success Modal for new members
        if (!hasSeenWelcomeBonus()) {
          // Small delay to let the success toast show first
          setTimeout(() => {
            setShowWelcomeBonusModal(true);
          }, 1200);
        }
      }
      
      toast({
        title: 'Payment Successful! 🎉',
        description: message,
      });
      
      queryClient.invalidateQueries({ queryKey: ['balances', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-data', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['transactions', user?.id] });
      
      window.history.replaceState({}, '', '/');

      // Surface auto-buy result if the backend bought spots from this deposit.
      // Poll briefly because the webhook/callback may finish a moment after redirect.
      if (type !== 'membership' && user?.id) {
        const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        let attempts = 0;
        const checkAutoBuy = async () => {
          attempts++;
          const { data: notif } = await supabase
            .from('notifications')
            .select('id, title, message, metadata')
            .eq('user_id', user.id)
            .eq('notification_type', 'auto_spots_bought')
            .gte('created_at', since)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (notif) {
            toast({
              title: notif.title,
              description: notif.message,
            });
            queryClient.invalidateQueries({ queryKey: ['drop-status'] });
            queryClient.invalidateQueries({ queryKey: ['drops'] });
          } else if (attempts < 6) {
            setTimeout(checkAutoBuy, 2500);
          }
        };
        setTimeout(checkAutoBuy, 1500);
      }

    } else if (paymentStatus === 'failed') {
      const errorMessages: Record<string, string> = {
        'cancelled': 'You cancelled the payment',
        'failed': 'Payment failed. Please try again',
        'verification_failed': 'Could not verify payment',
        'invalid_callback': 'Invalid payment callback',
        'reference_mismatch': 'Payment verification error',
        'invalid_currency': 'Invalid payment currency',
        'invalid_reference': 'Invalid payment reference',
        'database_error': 'Database error. Contact support',
        'server_error': 'Server error. Please try again',
      };
      
      toast({
        title: 'Payment Failed',
        description: errorMessages[reason || ''] || reason || 'Please try again',
        variant: 'destructive',
      });
      window.history.replaceState({}, '', '/');

      // Re-open the membership drawer so the user can try again without
      // losing the offer context — huge conversion win on cancelled flows.
      if (type === 'membership') {
        setTimeout(() => openMembershipDrawer(), 300);
      }
    } else if (paymentStatus === 'duplicate') {
      toast({
        title: 'Already Processed',
        description: `This payment of ₦${Number(amount).toLocaleString()} was already credited to your account`,
      });
      window.history.replaceState({}, '', '/');
    }
  }, [user?.id, queryClient, openMembershipDrawer]);

  // Welcome modal handlers moved to ProtectedRoute

  if (authLoading || isLoading) {
    return (
      <div className="p-4 md:p-8">
        <Skeleton className="h-12 w-64 mb-6" />
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">Failed to load dashboard data</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isBanned = data?.profile?.is_banned ?? false;
  const bannedReason = data?.profile?.banned_reason;
  const isMember = data?.profile?.is_member ?? false;
  const isLegacyMember = data?.isLegacyMember ?? false;
  const membershipFee = config?.membership_fee || 5000;



  // SMART DEBT RESOLUTION LOGIC WITH CHARGEBACK CONTEXT
  const hasDebt = (balances?.earnings_balance ?? 0) < 0 || 
                  (balances?.deposit_balance ?? 0) < 0;
  
  const totalDebt = Math.abs(Math.min(
    0,
    balances?.earnings_balance ?? 0,
    balances?.deposit_balance ?? 0
  ));
  
  const debtWallet = (balances?.earnings_balance ?? 0) < 0 ? 'earnings' : 'deposit';
  
  const oppositeWallet = debtWallet === 'earnings' ? 'deposit' : 'earnings';
  
  const canSelfSettle = (
    (debtWallet === 'earnings' && (balances?.deposit_balance ?? 0) >= totalDebt) ||
    (debtWallet === 'deposit' && (balances?.earnings_balance ?? 0) >= totalDebt)
  );

  const chargebackDebt = transactions?.transactions?.find(t => 
    t.transaction_type === 'debt_reversal' && 
    t.metadata?.reason === 'chargeback' &&
    t.amount < 0
  );
  
  const isChargebackDebt = !!chargebackDebt;
  
  const handleOpenTransfer = () => {
    // Transfer feature temporarily disabled
    setDepositModalOpen(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <>
      <div className="p-4 md:p-8 pb-24 md:pb-8" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 6rem)' }}>

        {/* Constrained container for desktop */}
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Banned Banner (CRITICAL - Shows FIRST) */}
          {isBanned && (
            <Alert variant="destructive" className="border-2">
              <AlertTriangle className="h-5 w-5" />
              <AlertTitle className="text-lg">Account Suspended</AlertTitle>
              <AlertDescription>
                <p className="mb-2">Your account has been permanently suspended.</p>
                <p className="text-sm">{bannedReason || 'Please contact support for more information.'}</p>
              </AlertDescription>
            </Alert>
          )}
          
          {/* Smart Debt Banner with Chargeback Context */}
          {!isBanned && hasDebt && (
            <Alert variant="destructive" className="border-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Action Required</AlertTitle>
              <AlertDescription className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="font-semibold">Your account has a debt of {formatCurrency(totalDebt)}</p>
                  {isChargebackDebt ? (
                    <p className="text-sm mt-1">
                      Someone you referred disputed their payment with their bank. Your commission has been reversed.
                      {canSelfSettle && ` You can use your ${oppositeWallet} wallet to clear this debt.`}
                    </p>
                  ) : (
                    <p className="text-sm mt-1">
                      {canSelfSettle 
                        ? `You have ₦${(debtWallet === 'earnings' ? balances?.deposit_balance : balances?.earnings_balance)?.toLocaleString()} in your ${oppositeWallet} wallet that can be used to clear this debt.`
                        : `Add money to your deposit wallet to clear your debt and continue using the platform.`
                      }
                    </p>
                  )}
                </div>
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={handleOpenTransfer}
                  className="whitespace-nowrap"
                >
                  {canSelfSettle 
                    ? `Settle Debt (Use ${oppositeWallet === 'earnings' ? 'Earnings' : 'Deposit'})` 
                    : `Add ₦${totalDebt.toLocaleString()}`
                  }
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Live Activity Ticker - always visible */}
          <DashboardActivityTicker />

          {!isMember ? (
            <>
              {/* Non-member premium entrance: wallet drops in, then queue rises,
                  then queue sweeps right-and-back, blinks the front person, and
                  finally the "Enter The Line" CTA pops in beneath the carousel. */}
              <motion.div
                initial={{ opacity: 0, y: -32, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 22, mass: 0.9 }}
              >
                <NonMemberVaultCard />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 36 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1], delay: 0.7 }}
              >
                <EnterLineCTA />
              </motion.div>

              {/* "People earning right now" is hidden for non-members —
                  only shown after activation to avoid pre-payment confusion.
                  Instead we explain, in plain words, what opens up with a spot. */}
              <LockedDashboardPreview />

              {/* Clearance for the floating CTA at viewport bottom */}
              <div aria-hidden className="h-24" />
            </>

          ) : (
            <>
              {/* Member premium entrance — wallet drops in, then the rest staggers up */}
              <motion.div
                initial={{ opacity: 0, y: -24, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 210, damping: 24 }}
              >
                <TimeBasedGreeting onActivate={() => startMembershipPayment(membershipFee)} membershipFee={membershipFee} />
              </motion.div>

              {/* Harvest urgency — moved ABOVE wallet so at-risk users see the
                  loss-aversion nudge before any competing CTA. */}
              <HarvestUrgencyStrip
                spots={data?.spots}
                pendingBalance={(data?.stats as any)?.pendingBalance ?? 0}
                profitTarget={
                  config?.drop_profit_amount ??
                  10000
                }
                isMember={isMember}
              />

              <motion.div
                initial={{ opacity: 0, y: -28, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 22, delay: 0.15 }}
              >
                <WalletCard />
              </motion.div>

              {/* Earning Spots Card — promoted to slot #2 so the primary
                  revenue lever is directly under the wallet, not 5 blocks
                  down under carousels and daily task. */}
              {/* MachinesCard is visually hidden but kept mounted so the
                  Increase Spot / Restore buttons on WalletCard still open
                  the BuySpotDrawer via the buySpotDrawerStore subscription. */}
              <div className="hidden" aria-hidden="true">
                <MachinesCard onActivateMembership={() => startMembershipPayment(membershipFee)} />
              </div>


              {/* Live Filling Queue Carousel */}
              <FillingQueueCarousel isMember={isMember} />

              {/* Daily Task — entry point to /task */}
              <div id="earning-batches-card" className="scroll-mt-20">
                <DailyTaskCard />
              </div>


              {/* Global Queue Stats */}
              <GlobalQueueStats isMember={isMember} />

              {/* WhatsApp Group Promo — demoted to bottom (community, not
                  revenue). */}
              {whatsappGroup.showPromo && (
                <WhatsAppGroupPromo link={whatsappGroup.link!} />
              )}

            </>
          )}

        </div>
        </div>

      {/* Activation Success is now a dedicated route (/activation-success)
          gated by ProtectedRoute so it's shown reliably after every payment
          provider, not just URL-callback ones. */}



      
      
      <DepositModal
        open={depositModalOpen}
        onOpenChange={setDepositModalOpen}
      />


      <TransactionDetailDrawer
        transaction={selectedTransaction}
        open={!!selectedTransaction}
        onOpenChange={(open) => !open && setSelectedTransaction(null)}
        onVerifyWithdrawal={(txId) => verifyWithdrawal(txId)}
        isVerifying={isVerifying}
      />
    </>
  );
}
