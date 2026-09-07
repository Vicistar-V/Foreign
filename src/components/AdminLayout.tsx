import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { AdminMobileNav } from '@/components/AdminMobileNav';
import { AnimatedOutlet } from '@/components/AnimatedOutlet';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { preloadImage } from '@/lib/imagePreloader';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/logo.png';

export const AdminLayout = () => {
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const queryClient = useQueryClient();
  
  // Preload critical images when layout mounts
  useEffect(() => {
    preloadImage(logo);
    
    if (profile?.avatar_url) {
      preloadImage(profile.avatar_url);
    }
  }, [profile?.avatar_url]);

  // Prefetch admin data
  useEffect(() => {
    if (!user?.id) return;

    const prefetchTimer = setTimeout(() => {
      // Prefetch admin stats
      queryClient.prefetchQuery({
        queryKey: ['admin-stats'],
        queryFn: async () => {
          const { data, error } = await supabase.functions.invoke('get-admin-stats');
          if (error) throw error;
          if (data?.success === false) {
            throw new Error(data.error || 'Failed to fetch admin stats');
          }
          return data;
        },
        staleTime: 15 * 1000,
      });

      // Prefetch platform config via RPC (matches usePlatformConfig)
      queryClient.prefetchQuery({
        queryKey: ['platform-config'],
        queryFn: async () => {
          const { data, error } = await supabase.rpc('get_platform_config');
          if (error) throw error;
          return data;
        },
        staleTime: 5 * 60 * 1000,
      });
    }, 1000);

    return () => clearTimeout(prefetchTimer);
  }, [user?.id, queryClient]);
  
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden">
        <AdminSidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <DashboardHeader />
          <main
            className="flex-1 overflow-y-auto bg-background md:pb-8"
            style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
          >
            <AnimatedOutlet />
          </main>
          <AdminMobileNav />
        </div>
      </div>
    </SidebarProvider>
  );
};
