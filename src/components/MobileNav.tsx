import { UserPlus, Receipt, User, Trophy } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import logo from '@/assets/logo.png';
import { FEATURE_FLAGS } from '@/config/featureFlags';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useMembershipDrawer } from '@/context/MembershipDrawerContext';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import { useRetirementStatus } from '@/hooks/useRetirementStatus';
import { triggerHaptic } from '@/lib/haptics';


export const MobileNav = () => {
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const isMember = !!profile?.is_member;
  const { openMembershipDrawer } = useMembershipDrawer();
  const { data: cfg } = usePlatformConfig();
  const fee = cfg?.membership_fee ?? 5000;
  // P1-4: Persistent breadcrumb — a red dot on Home tells retired members
  // "action needed here" even if they dismissed the Restore drawer and
  // scrolled past the dashboard hero.
  const { data: retirement } = useRetirementStatus();
  const showRetiredDot = isMember && retirement?.is_retired === true;

  const sideItems = [
    { icon: Receipt, label: 'Transactions', to: '/transactions' },
    ...(FEATURE_FLAGS.SHOW_RESULTS_NAV ? [{ icon: Trophy, label: 'Results', to: '/results' }] : []),
    { icon: UserPlus, label: 'Referrer', to: '/invite' },
    { icon: User, label: 'Profile', to: '/profile' },
  ];

  // Hide bottom nav entirely for non-members — keeps focus on activation CTA
  if (!isMember) return null;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-strong z-50 rounded-t-[28px]">
      <nav className="flex justify-around items-center h-16 px-2">
        <NavLink
          to="/dashboard"
          className="flex flex-col items-center justify-center flex-1 h-full text-muted-foreground transition-all duration-200 rounded-lg"
          activeClassName="text-primary bg-primary/10 scale-105"
          haptic
        >
          <span className="relative">
            <img src={logo} alt="Logo" className="h-6 w-6 mb-1" />
            {showRetiredDot && (
              <span
                aria-label="Action needed — activate another share"
                className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card animate-pulse"
              />
            )}
          </span>
          <span className="text-xs font-medium">Home</span>
        </NavLink>

        {sideItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className="flex flex-col items-center justify-center flex-1 h-full text-muted-foreground transition-all duration-200 rounded-lg"
            activeClassName="text-primary bg-primary/10 scale-105"
            haptic
          >
            <item.icon className="h-5 w-5 mb-1 transition-transform" />
            <span className="text-xs font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
    </div>
  );
};
