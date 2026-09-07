import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { Loader2 } from 'lucide-react';

interface MemberOnlyRouteProps {
  children: ReactNode;
  featureName: string;
  subtitle?: string;
}

/**
 * Route gate for activated paying members only.
 * Non-members are bounced back to the dashboard with a flag that makes
 * the "Enter The Line" CTA shake into view — better psychology than
 * dumping them on a generic locked screen.
 */
export const MemberOnlyRoute = ({ children }: MemberOnlyRouteProps) => {
  const { user } = useAuth();
  const { data: profile, isLoading } = useProfile(user?.id);

  if (isLoading || !profile) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile.is_member) {
    return <Navigate to="/dashboard" replace state={{ shakeCTA: true, ts: Date.now() }} />;
  }

  return <>{children}</>;
};
