import { Home, UserPlus, Receipt, User, LogOut, Shield, Bell, Trophy, HelpCircle } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/hooks/useAuth';
import { useAdminRole } from '@/hooks/useAdminRole';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { SidebarBalanceCard } from '@/components/SidebarBalanceCard';
import { StaggeredList, StaggeredItem } from '@/components/animations';
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { FEATURE_FLAGS } from '@/config/featureFlags';
import { useMembershipDrawer } from '@/context/MembershipDrawerContext';
import { triggerHaptic } from '@/lib/haptics';


export const AppSidebar = () => {
  const { user, signOut } = useAuth();
  const { data: adminRole } = useAdminRole();
  const { data: profile } = useProfile(user?.id);
  const navigate = useNavigate();
  const { state, setOpenMobile, isMobile } = useSidebar();

  const isMember = !!profile?.is_member;
  const { openMembershipDrawer } = useMembershipDrawer();


  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const handleLogout = async () => {
    const { error } = await signOut();
    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to log out',
        variant: 'destructive',
      });
    } else {
      navigate('/login');
    }
  };

  // memberOnly: locked for non-members until they activate.
  const mainNavItems = [
    { icon: Home, label: 'Home', to: '/dashboard', memberOnly: false },
    { icon: UserPlus, label: 'Referrer', to: '/invite', memberOnly: true },
    ...(FEATURE_FLAGS.SHOW_RESULTS_NAV ? [{ icon: Trophy, label: 'Results', to: '/results', memberOnly: true }] : []),
    { icon: Bell, label: 'Notifications', to: '/notifications', memberOnly: true },
    { icon: Receipt, label: 'Transactions', to: '/transactions', memberOnly: true },
    { icon: HelpCircle, label: 'Get Help', to: '/support', memberOnly: false },
  ];

  // For non-members: hide every locked route entirely — keep only Home + Get Help.
  const visibleNavItems = isMember
    ? mainNavItems
    : mainNavItems.filter((item) => !item.memberOnly);

  const isCollapsed = state === 'collapsed';

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarContent className="px-3 py-4">
        <StaggeredList staggerDelay={0.06}>
          {/* Balance Card */}
          <StaggeredItem>
            <SidebarBalanceCard />
          </StaggeredItem>

          <SidebarMenu className="space-y-2">
            {visibleNavItems.map((item) => (
              <StaggeredItem key={item.to}>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={item.label}>
                    <NavLink
                      to={item.to}
                      className="flex items-center gap-5 px-5 py-5 rounded-lg text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all duration-200 group"
                      activeClassName="text-sidebar-primary bg-sidebar-accent border-l-4 border-sidebar-primary font-medium"
                      onClick={handleNavClick}
                    >
                      <item.icon className="h-9 w-9 shrink-0" />
                      {!isCollapsed && <span className="text-lg font-medium">{item.label}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </StaggeredItem>
            ))}

            {/* Profile — members only. Non-members see the Join CTA below instead. */}
            {isMember && (
              <StaggeredItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Profile">
                    <NavLink
                      to="/profile"
                      className="flex items-center gap-5 px-5 py-5 rounded-lg text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all duration-200"
                      activeClassName="text-sidebar-primary bg-sidebar-accent border-l-4 border-sidebar-primary font-medium"
                      onClick={handleNavClick}
                    >
                      <User className="h-9 w-9 shrink-0" />
                      {!isCollapsed && <span className="text-lg font-medium">Profile</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </StaggeredItem>
            )}

            {/* Non-member: single big white Join button */}
            {!isMember && !isCollapsed && (
              <StaggeredItem>
                <div className="px-2 pt-4">
                  <p className="text-sm text-sidebar-foreground/70 mb-3 px-1">
                    Activate your share first to unlock everything.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('medium');
                      if (isMobile) setOpenMobile(false);
                      openMembershipDrawer();
                    }}
                    className="w-full h-12 rounded-full bg-white text-black font-extrabold text-base shadow-md active:scale-[0.98] transition-transform"
                  >
                    Get My Share
                  </button>
                </div>
              </StaggeredItem>
            )}

            {/* Admin Section - Only visible to admins */}
            {adminRole?.isAdmin && (
              <StaggeredItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Admin Panel">
                    <NavLink
                      to="/admin"
                      className="flex items-center gap-5 px-5 py-5 rounded-lg text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all duration-200"
                      activeClassName="text-sidebar-primary bg-sidebar-accent border-l-4 border-sidebar-primary font-medium"
                      onClick={handleNavClick}
                    >
                      <Shield className="h-9 w-9 shrink-0" />
                      {!isCollapsed && <span className="text-lg font-medium">Admin Panel</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </StaggeredItem>
            )}
          </SidebarMenu>
        </StaggeredList>
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-3">
        <Button
          variant="ghost"
          size={isCollapsed ? "icon" : "lg"}
          className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 transition-colors px-5 py-6"
          onClick={handleLogout}
        >
          <LogOut className={isCollapsed ? "h-9 w-9" : "mr-5 h-8 w-8"} />
          {!isCollapsed && <span className="text-lg font-medium">Log Out</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
};
