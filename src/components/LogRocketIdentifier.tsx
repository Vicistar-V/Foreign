import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import {
  identifyLogRocketUser,
  trackLogRocketEvent,
  LREvents,
} from '@/lib/logrocket';

/**
 * Mounts inside AppLayout. Whenever we
 * have an authenticated user + their profile, we identify them in LogRocket
 * so every session replay is searchable by email, name, member status, etc.
 *
 * Also fires a one-time `BECAME_MEMBER` conversion event the first time we
 * see `is_member = true` for a given session, which lets us measure the
 * full activation funnel inside LogRocket dashboards.
 */
export function LogRocketIdentifier() {
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const lastMemberState = useRef<boolean | null>(null);
  const guestEventFired = useRef(false);

  useEffect(() => {
    if (!user?.id) return;
    // Prefix the name with a status dot so LogRocket's session list makes
    // activation state visible at a glance (same convention as admin replays):
    //   🔴 banned · 🟢 activated member · 🟠 not activated yet
    const statusEmoji = profile?.is_banned
      ? '🔴'
      : profile?.is_member === true
      ? '🟢'
      : profile?.is_member === false
      ? '🟠'
      : '';
    const baseName = profile?.full_name ?? null;
    const displayName = baseName && statusEmoji ? `${statusEmoji} ${baseName}` : baseName;
    identifyLogRocketUser(user.id, {
      email: user.email ?? null,
      name: displayName,
      phone: profile?.phone_number ?? null,
      isMember: profile?.is_member ?? null,
      isBanned: profile?.is_banned ?? null,
      referralCode: profile?.referral_code ?? null,
      createdAt: profile?.created_at ?? null,
      hasPin: profile?.has_pin ?? null,
      hasSeenExplainer: profile?.has_seen_explainer ?? null,
    });

    // First-time-seen-as-guest conversion marker: helps build a funnel of
    // "signed up → still not activated" in LogRocket.
    if (!guestEventFired.current && profile && profile.is_member === false) {
      trackLogRocketEvent(LREvents.VIEWED_DASHBOARD_AS_GUEST, {
        userId: user.id,
      });
      guestEventFired.current = true;
    }

    // Activation milestone: fire exactly once when is_member flips to true.
    if (profile?.is_member === true && lastMemberState.current !== true) {
      trackLogRocketEvent(LREvents.BECAME_MEMBER, { userId: user.id });
    }
    if (typeof profile?.is_member === 'boolean') {
      lastMemberState.current = profile.is_member;
    }
  }, [
    user?.id,
    user?.email,
    profile?.full_name,
    profile?.phone_number,
    profile?.is_member,
    profile?.is_banned,
    profile?.referral_code,
    profile?.created_at,
    profile?.has_pin,
    profile?.has_seen_explainer,
    profile,
  ]);

  return null;
}
