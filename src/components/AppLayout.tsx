import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { MobileNav } from '@/components/MobileNav';
import { AnimatedOutlet } from '@/components/AnimatedOutlet';
import { LiveUpdatesManager } from '@/components/LiveUpdatesManager';
import { SupportFAB } from '@/components/SupportFAB';

import { LogRocketIdentifier } from '@/components/LogRocketIdentifier';
import { WithdrawalShareDrawer } from '@/components/WithdrawalShareDrawer';
import { WhatsAppGroupDrawer } from '@/components/WhatsAppGroupDrawer';
import { QuickShareDrawer } from '@/components/dashboard/QuickShareDrawer';
import { MembershipDrawerProvider } from '@/context/MembershipDrawerContext';


import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { usePayoutNotification } from '@/hooks/usePayoutNotification';
import { preloadImage } from '@/lib/imagePreloader';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/logo.png';

export const AppLayout = () => {
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const queryClient = useQueryClient();
  
  // Quick share drawer state - triggered by payout notification
  const [shareDrawerOpen, setShareDrawerOpen] = useState(false);

  // NOTE: useHeartbeat + useJourneyTracker are mounted in ProtectedRoute so they
  // also cover full-screen pages like /task that live outside AppLayout.

  // Listen for payout notifications and show celebratory toast with referral hook
  usePayoutNotification({
    onInviteClick: () => setShareDrawerOpen(true),
  });

  // Preload critical images when layout mounts
  useEffect(() => {
    preloadImage(logo);
    
    if (profile?.avatar_url) {
      preloadImage(profile.avatar_url);
    }
  }, [profile?.avatar_url]);

  // Prefetch sidebar data after 2 seconds for instant loading
  useEffect(() => {
    if (!user?.id) return;

    const prefetchTimer = setTimeout(() => {
      // Prefetch balance data for sidebar
      queryClient.prefetchQuery({
        queryKey: ['balances', user.id],
        queryFn: async () => {
          const { data, error } = await supabase.rpc('get_my_balances');
          if (error) throw error;
          const payload = data as { success?: boolean; error?: string } | null;
          if (payload && payload.success === false) {
            throw new Error(payload.error || 'Failed to fetch balances');
          }
          return data;
        },
        staleTime: 2 * 60 * 1000,
      });

      // Prefetch admin role for sidebar
      queryClient.prefetchQuery({
        queryKey: ['admin-role', user.id],
        queryFn: async () => {
          const { data, error } = await supabase.rpc('has_role', {
            _user_id: user.id,
            _role: 'admin'
          });
          if (error) throw error;
          return { isAdmin: !!data };
        },
        staleTime: 5 * 60 * 1000,
      });

      // Prefetch dashboard data for instant dashboard loading
      const today = new Date().toISOString().split('T')[0];
      queryClient.prefetchQuery({
        queryKey: ['dashboard-data', user.id, today],
        queryFn: async () => {
          const { data, error } = await supabase.functions.invoke('get-dashboard-data');
          if (error) throw error;
          if (data?.success === false) {
            throw new Error(data.error || 'Failed to fetch dashboard data');
          }
          return data;
        },
        staleTime: 5 * 60 * 1000,
      });
    }, 2000);

    return () => clearTimeout(prefetchTimer);
  }, [user?.id, queryClient]);
  
  return (
    <LiveUpdatesManager>
      <MembershipDrawerProvider>
        <SidebarProvider>
          <div className="flex h-screen w-full overflow-hidden">
            <AppSidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
              <DashboardHeader />
              <main className="flex-1 overflow-y-auto bg-background pb-24 md:pb-8">
                <AnimatedOutlet />
              </main>
              <MobileNav />
            </div>
          </div>
          <SupportFAB />
          
          <LogRocketIdentifier />
          <WithdrawalShareDrawer />
          <WhatsAppGroupDrawer />
        </SidebarProvider>
        {/* Quick Share Drawer - triggered by payout toast */}
        <QuickShareDrawer
          open={shareDrawerOpen}
          onOpenChange={setShareDrawerOpen}
          contextMessage="Your ad share just paid you! Tell a friend so they can activate one too."
        />
      </MembershipDrawerProvider>
    </LiveUpdatesManager>
  );
};
