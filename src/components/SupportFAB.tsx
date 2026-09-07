import { useNavigate, useLocation } from 'react-router-dom';
import { LifeBuoy } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';

// Routes where the FAB must not appear — full-screen flows, the support
// page itself, and any admin surface.
const HIDDEN_PATHS = [
  '/support',
  '/task',
  '/create-pin',
  '/change-pin',
  '/change-password',
  '/set-profile-picture',
  '/watch-first',
];

/**
 * Floating "Support" pill anchored above the mobile nav.
 * Members only — non-members never see it (keeps activation focus).
 */
export const SupportFAB = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);

  if (!user || !profile?.is_member) return null;

  const path = location.pathname;
  if (HIDDEN_PATHS.some((p) => path === p || path.startsWith(p + '/'))) return null;
  if (path.startsWith('/admin')) return null;

  const handleClick = () => {
    haptics.light();
    navigate('/support');
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Get support"
      className={cn(
        'fixed z-40 right-3 md:right-5',
        // Sit above the mobile bottom nav on phones, lower on desktop.
        'bottom-[92px] md:bottom-6',
        'inline-flex items-center gap-1.5 rounded-full',
        'pl-3 pr-3.5 py-2 min-h-[40px]',
        'bg-primary/85 text-primary-foreground',
        'border border-primary/40',
        'shadow-lg shadow-primary/20',
        'text-xs font-semibold tracking-wide',
        'active:scale-95 transition-transform',
      )}
    >
      <LifeBuoy className="h-4 w-4" />
      Support
    </button>
  );
};
