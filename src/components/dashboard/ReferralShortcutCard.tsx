import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useDropStatus } from '@/hooks/useDropStatus';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import { triggerHaptic } from '@/lib/haptics';
import { UserPlus, ArrowRight } from 'lucide-react';

/**
 * Full-width "Skip the tasks — invite a friend" nudge for the dashboard.
 * Promoted out of WalletCard so it competes with buy-spot for attention as
 * a first-class revenue lever. Members with active spots only.
 */
export function ReferralShortcutCard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const { data: dropStatus } = useDropStatus();
  const { data: config } = usePlatformConfig();

  const isMember = profile?.is_member ?? false;
  const hasSpots = (dropStatus?.user?.total_spots_count ?? dropStatus?.user?.spots?.length ?? 0) > 0;

  if (!isMember || !hasSpots) return null;

  const pendingBump = Number(config?.referral_pending_bonus ?? 3000);
  const cashBonus = Number(config?.referral_cash_bonus ?? 1000);

  return (
    <button
      type="button"
      onClick={() => { triggerHaptic('light'); navigate('/invite'); }}
      className="w-full rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent hover:bg-emerald-500/10 transition-colors p-4 text-left active:scale-[0.99]"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 h-11 w-11 rounded-full bg-emerald-500/15 flex items-center justify-center">
          <UserPlus className="h-5 w-5 text-emerald-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold tracking-wider uppercase text-emerald-500">
            Skip the tasks
          </p>
          <p className="text-base font-bold text-foreground mt-0.5 leading-snug">
            Invite 1 friend → get{' '}
            <span className="tabular-nums">₦{cashBonus.toLocaleString()}</span> cash in your pocket
          </p>
          <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
            Plus <span className="font-semibold text-emerald-500 tabular-nums">₦{pendingBump.toLocaleString()}</span> straight into your pending balance. No batches to tap.
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-500">
            Invite a friend now <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </div>
      </div>
    </button>
  );
}
