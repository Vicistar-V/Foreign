import { ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminRole } from '@/hooks/useAdminRole';
import { useAuth } from '@/hooks/useAuth';
import { useHeartbeat } from '@/hooks/useHeartbeat';
import { useJourneyTracker } from '@/hooks/useJourneyTracker';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface ProtectedAdminRouteProps {
  children: ReactNode;
}

export const ProtectedAdminRoute = ({ children }: ProtectedAdminRouteProps) => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { data, isLoading } = useAdminRole();

  // Track admin presence + journey just like regular users
  useHeartbeat(60);
  useJourneyTracker();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
      return;
    }

    if (!isLoading && data && !data.isAdmin) {
      toast.error('Access Denied', {
        description: 'You do not have permission to access this page',
      });
      navigate('/dashboard');
    }
  }, [user, authLoading, data, isLoading, navigate]);

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  if (!data?.isAdmin) {
    return null;
  }

  return <>{children}</>;
};
