import { ReactNode, useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import { useReferralData } from '@/hooks/useReferralData';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { isAuthError, forceLogoutNow } from '@/lib/handleAuthError';
import { FirstTimeWelcomeModal } from '@/components/dashboard/FirstTimeWelcomeModal';
import { BirthDateRequiredDialog } from '@/components/onboarding/BirthDateRequiredDialog';
import { StateRequiredDialog } from '@/components/onboarding/StateRequiredDialog';
import { RestoreCapacityHost } from '@/components/dashboard/RestoreCapacityHost';
import { startMembershipPayment } from '@/lib/startMembershipPayment';
import { useHeartbeat } from '@/hooks/useHeartbeat';
import { useJourneyTracker } from '@/hooks/useJourneyTracker';
import { markExplainerSeenLocally } from '@/lib/explainerProgress';
import {
  hasStoredExplainerSkip,
  hasWatchedBeforeSignup,
  clearStoredExplainerSkip,
} from '@/lib/explainerSkip';
import { trackClarityEvent, ClarityEvents } from '@/lib/clarityTracking';
import { logUserActivity } from '@/lib/userActivityLogger';
import { onboardingSkip } from '@/lib/onboardingSkip';
import { hasSeenActivationSuccess } from '@/lib/activationSuccessSeen';
interface ProtectedRouteProps {
  children: ReactNode;
}

type DropStatusSpot = {
  status?: string;
};

// This ref resets on full page reload, but persists during in-app navigation
// This gives us "show once per page load" behavior

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user, loading } = useAuth();
  const { data: profile, isLoading: profileLoading, isError: profileIsError, error: profileError } = useProfile(user?.id);
  const { data: config } = usePlatformConfig();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  // Guards so the auto-skip DB write only runs once per session, even across renders
  const autoSkipInFlightRef = useRef(false);
  const autoSkipDoneRef = useRef(false);

  

  // Track activity on EVERY protected route (including /task) — fires immediately on
  // navigation so admin sees movement in real-time.
  useHeartbeat(60);
  useJourneyTracker();

  // Referral data still preloaded so the Referrer page is instant on nav
  useReferralData();
  
  
  
  // In-memory flag - reset on full page reload, persist during navigation
  const welcomeShownThisLoad = useRef(false);

  // Check if user has active spots via RPC (for legacy member detection)
  const { data: spotCount, isLoading: spotCountLoading } = useQuery({
    queryKey: ['spot-count-rpc', user?.id],
    queryFn: async () => {
      // Use explicit parameters to resolve function overload
      const { data, error } = await supabase.rpc('get_user_drops_status', {
        _user_id: user!.id,
        _limit: 100,
        _offset: 0
      });
      if (error) {
        console.error('[ProtectedRoute] Failed to get drops status:', error);
        return 0;
      }
      // The RPC returns { spots: [...], ... } - count active spots
      const dropStatus = data as { spots?: DropStatusSpot[] } | null;
      const spots = Array.isArray(dropStatus?.spots) ? dropStatus.spots : [];
      return spots.filter((s) => s.status === 'active').length;
    },
    enabled: !!user && !!profile?.is_member,
    staleTime: 60000,
  });
  
  // For non-members, spotCount query is disabled, so treat as 0
  const effectiveSpotCount = profile?.is_member ? spotCount : 0;
  const spotCountReady = profile?.is_member ? !spotCountLoading : true;

  // Routes that bypass PIN/avatar checks (to avoid redirect loops)
  const bypassRoutes = ['/activation-success', '/create-pin', '/set-profile-picture', '/change-pin', '/change-password'];
  const isOnBypassRoute = bypassRoutes.includes(location.pathname);

  // Handle profile fetch errors (especially auth errors like 401)
  useEffect(() => {
    if (profileIsError && profileError && !isLoggingOut) {
      console.error('[ProtectedRoute] Profile fetch error:', profileError);
      
      if (isAuthError(profileError)) {
        setIsLoggingOut(true);
        forceLogoutNow();
      }
    }
  }, [profileIsError, profileError, isLoggingOut]);

  useEffect(() => {
    // If not logged in, redirect to login
    if (!loading && !user) {
      navigate('/login');
      return;
    }

    // The explainer video now lives ENTIRELY before sign-up (/watch-first).
    // Nobody is ever sent to a video after they already have an account.
    // We only record "seen" once, fire-and-forget, so admin reporting stays
    // accurate. This never blocks or redirects the user.
    if (user && !profileLoading && profile) {
      if (!profile.has_seen_explainer && !autoSkipDoneRef.current && !autoSkipInFlightRef.current) {
        autoSkipInFlightRef.current = true;
        autoSkipDoneRef.current = true;
        const cameFromPreSignupVideo = hasStoredExplainerSkip() || hasWatchedBeforeSignup();

        markExplainerSeenLocally(user.id);
        queryClient.setQueryData(['profile', user.id], (old: typeof profile) =>
          old ? { ...old, has_seen_explainer: true } : old,
        );
        if (cameFromPreSignupVideo) {
          trackClarityEvent(ClarityEvents.EXPLAINER_AUTO_SKIPPED_VIA_URL);
          logUserActivity('explainer_auto_skipped_via_url', 'auto_action');
        }

        void (async () => {
          try {
            const { error: rpcErr } = await supabase.rpc('mark_explainer_seen', {
              _status: cameFromPreSignupVideo ? 'watched' : 'skipped',
            });
            if (rpcErr) {
              await supabase
                .from('profiles')
                .update({ has_seen_explainer: true })
                .eq('id', user.id);
            }
          } catch (e) {
            console.warn('[ProtectedRoute] explainer mark failed (non-blocking)', e);
          } finally {
            autoSkipInFlightRef.current = false;
            clearStoredExplainerSkip();
          }
        })();
      }

      // PIN + avatar + activation gates apply only to non-bypass routes.
      if (!isOnBypassRoute) {


        // PIN + avatar gates only apply to activated paying members.
        // Users can tap "Skip" on either screen to explore the app; the
        // in-memory flag lets them roam until they refresh the page.
        if (profile.is_member) {
          // FIRST: the activation celebration/upsell screen. Members who
          // haven't seen it (per-device localStorage) must pass through it
          // once. This is the "one screen after payment" the user requested,
          // enforced regardless of which payment provider was used.
          if (!hasSeenActivationSuccess()) {
            navigate('/activation-success', { replace: true });
            return;
          }

          if (!profile.has_pin && !onboardingSkip.pin) {
            navigate('/create-pin', { replace: true });
            return;
          }

          if (!profile.avatar_url && !onboardingSkip.avatar) {
            navigate('/set-profile-picture', { replace: true });
            return;
          }
        }
      }
    }

  }, [user, loading, profile, profileLoading, isOnBypassRoute, navigate, location.pathname]);

  // TEMPORARILY DISABLED - Set to false to re-enable welcome modal
  const WELCOME_MODAL_DISABLED = true;
  
  // Show welcome modal for non-members OR legacy members (once per page load)
  useEffect(() => {
    if (WELCOME_MODAL_DISABLED) return; // Temporarily disabled
    if (!profile || isOnBypassRoute) return;
    if (welcomeShownThisLoad.current) return; // Already shown this page load
    if (!spotCountReady) return; // Wait for spot count to be ready
    
    const hasCompletedPin = !!profile.has_pin;
    const hasCompletedAvatar = !!profile.avatar_url;
    const isAlreadyMember = !!profile.is_member;
    
    // Legacy member = is_member but has 0 active spots
    const isLegacyMember = isAlreadyMember && effectiveSpotCount === 0;
    
    console.log('[ProtectedRoute] Welcome modal check:', {
      hasCompletedPin,
      hasCompletedAvatar,
      isAlreadyMember,
      effectiveSpotCount,
      isLegacyMember,
      spotCountReady,
      welcomeShownThisLoad: welcomeShownThisLoad.current
    });
    
    // Show for non-members OR legacy members who completed setup
    if (hasCompletedPin && hasCompletedAvatar && (!isAlreadyMember || isLegacyMember)) {
      welcomeShownThisLoad.current = true; // Mark as shown immediately to prevent duplicates
      console.log('[ProtectedRoute] Triggering welcome modal in 1.5s...');
      setTimeout(() => {
        console.log('[ProtectedRoute] Opening welcome modal now');
        setShowWelcomeModal(true);
      }, 1500);
      // Don't return cleanup - we want the timer to fire even if deps change
    }
  }, [profile, isOnBypassRoute, effectiveSpotCount, spotCountReady]);

  const handleWelcomeClose = () => {
    setShowWelcomeModal(false);
  };

  const handleWelcomeActivate = () => {
    setShowWelcomeModal(false);
    startMembershipPayment(config?.membership_fee || 5000);
  };

  // Show "session expired" screen while logging out
  if (isLoggingOut) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4 p-6">
          <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Your login timed out</h2>
          <p className="text-muted-foreground">Please login again to continue.</p>
        </div>
      </div>
    );
  }

  // Show loading while auth OR profile is loading
  if (loading || (user && profileLoading)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Block rendering if profile failed to load (prevents blank screens)
  if (profileIsError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4 p-6">
          <p className="text-muted-foreground">Something went wrong. Please refresh or login again.</p>
        </div>
      </div>
    );
  }

  // Don't render children if PIN or avatar is missing (members only, except
  // bypass routes) — but honor the in-memory "Skip for now" flags so the user
  // can explore the app after tapping Skip on either setup screen.
  if (!isOnBypassRoute && profile && profile.is_member) {
    const activationBlocking = !hasSeenActivationSuccess();
    const pinBlocking = !profile.has_pin && !onboardingSkip.pin;
    const avatarBlocking = !profile.avatar_url && !onboardingSkip.avatar;
    if (activationBlocking || pinBlocking || avatarBlocking) {
      return null; // Will redirect via useEffect
    }
  }

  const membershipFee = config?.membership_fee || 5000;

  return (
    <>
      {children}
      
      {/* First-Time Welcome Modal - Shows on any protected page */}
      <FirstTimeWelcomeModal
        isOpen={showWelcomeModal}
        onClose={handleWelcomeClose}
        onActivate={handleWelcomeActivate}
        isLegacyMember={!!profile?.is_member && effectiveSpotCount === 0}
        config={config ? {
          membership_fee: config.membership_fee,
          drop_entry_fee: config.drop_entry_fee,
          drop_profit_amount: config.drop_profit_amount,
        } : null}
      />

      {/* Birth-date capture for legacy users (non-dismissible) */}
      {profile && user && !isOnBypassRoute && (!profile.birth_year || !profile.birth_month) && (
        <BirthDateRequiredDialog open={true} userId={user.id} />
      )}

      {/* State-of-residence capture for legacy users (non-dismissible).
          Only shown after birth date is filled to avoid stacked dialogs. */}
      {profile && user && !isOnBypassRoute &&
        profile.birth_year && profile.birth_month &&
        !profile.state_of_residence && (
          <StateRequiredDialog open={true} userId={user.id} />
        )}

      {/* Global 1-click Restore Capacity drawer — available on every
          authenticated page so retired users can restore from anywhere
          (transactions list, notifications, withdrawal success, etc). */}
      {profile?.is_member && <RestoreCapacityHost />}

    </>
  );
};
