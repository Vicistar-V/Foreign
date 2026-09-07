import { ActivationBanner } from '@/components/dashboard/ActivationBanner';
import { useMembershipDrawer } from '@/context/MembershipDrawerContext';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import { Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface LockedFeatureScreenProps {
  /** Friendly title for the feature being locked, e.g. "Earning Batches". */
  featureName: string;
  /** Short, outcome-focused subtitle. */
  subtitle?: string;
}

/**
 * Full-page screen shown to non-members when they hit a member-only route.
 * Mirrors the Dashboard activation aesthetic so the upgrade prompt feels
 * native instead of like a hard wall.
 */
export const LockedFeatureScreen = ({ featureName, subtitle }: LockedFeatureScreenProps) => {
  const navigate = useNavigate();
  const { openMembershipDrawer } = useMembershipDrawer();
  const { data: config } = usePlatformConfig();
  const membershipFee = config?.membership_fee || 5000;
  const payoutPerSpot = config?.drop_target_amount || 10000;

  return (
    <div className="min-h-full px-4 py-6 max-w-2xl mx-auto space-y-4">
      {/* Top headline — same vibe as the dashboard "you're not earning yet" copy */}
      <div className="text-center space-y-2 pt-2">
        <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Lock className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-xl font-bold text-foreground">
          {featureName} is locked
        </h1>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          {subtitle ?? `Activate an ad share to unlock ${featureName.toLowerCase()} — your first share pays a full ₦${payoutPerSpot.toLocaleString()} when your campaign finishes.`}
        </p>
      </div>

      {/* The exact same activation banner used on the dashboard top */}
      <ActivationBanner
        onActivate={openMembershipDrawer}
        membershipFee={membershipFee}
      />

      {/* Gentle escape hatch */}
      <div className="pt-2 text-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/dashboard')}
          className="text-muted-foreground"
        >
          Back to Home
        </Button>
      </div>
    </div>
  );
};
