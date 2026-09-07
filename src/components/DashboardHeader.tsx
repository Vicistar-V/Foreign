import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { useAdminRole } from '@/hooks/useAdminRole';
import { useScrollDirection } from '@/hooks/useScrollDirection';
import { Skeleton } from '@/components/ui/skeleton';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown';
import { ThemeToggle } from '@/components/ThemeToggle';
import { HeaderInstallButton } from '@/components/HeaderInstallButton';
import logo from '@/assets/logo.png';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User, Shield, LogOut, ChevronDown, Home, HelpCircle } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { useMembershipDrawer } from '@/context/MembershipDrawerContext';
import { triggerHaptic } from '@/lib/haptics';

export const DashboardHeader = () => {
  const { user, signOut } = useAuth();
  const { data: profile, isLoading } = useProfile(user?.id);
  const { data: adminRole } = useAdminRole();
  const { isVisible } = useScrollDirection({ threshold: 15 });
  const navigate = useNavigate();
  const location = useLocation();
  const isInAdminArea = location.pathname.startsWith('/admin');
  const isMember = !!profile?.is_member;
  const { openMembershipDrawer } = useMembershipDrawer();

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
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

  const handleLogoClick = () => {
    navigate('/dashboard');
  };

  if (isLoading) {
    return (
      <div className={`sticky top-0 z-40 transition-all duration-300 ease-out ${
        isVisible ? 'h-auto' : 'h-0'
      }`}>
        <header className={`bg-card border-b border-border shadow-soft transition-transform duration-300 ease-out ${
          isVisible ? 'translate-y-0' : '-translate-y-full'
        }`}>
          <div className="flex items-center justify-between p-4 md:px-6">
            <Skeleton className="h-8 w-8 rounded-md" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-md" />
              <Skeleton className="h-8 w-8 rounded-md" />
              <Skeleton className="h-10 w-10 rounded-full" />
            </div>
          </div>
        </header>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div
      className={`sticky top-0 z-40 transition-all duration-300 ease-out overflow-hidden ${
        isVisible ? 'max-h-24' : 'max-h-0'
      }`}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <header className={`bg-card border-b border-border shadow-soft transition-transform duration-300 ease-out ${
        isVisible ? 'translate-y-0' : '-translate-y-full'
      }`}>
        <div className="flex items-center justify-between p-3 md:px-6 md:py-4">
        {/* Left: Sidebar Trigger + Logo */}
        <div className="flex items-center gap-3">
          <SidebarTrigger className="h-10 w-10 hover:bg-muted transition-colors rounded-md" />
          <button 
            onClick={handleLogoClick}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 rounded-md px-2 py-1"
          >
            <img src={logo} alt="Logo" className="h-8 w-8" />
            <span className="text-lg font-bold">Viketa</span>
          </button>
        </div>

        {/* Right: Theme + Notifications + Profile Dropdown */}
        <div className="flex items-center gap-2">
          <HeaderInstallButton />
          <ThemeToggle />
          <NotificationDropdown />
          
          
          {/* Profile Avatar Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1.5 hover:bg-muted/50 transition-all rounded-full p-1 focus:outline-none focus:ring-2 focus:ring-primary/20">
              <Avatar className="h-9 w-9 ring-1 ring-border">
                {profile.avatar_url && (
                  <AvatarImage 
                    src={profile.avatar_url} 
                    alt={profile.full_name}
                    className="object-cover"
                    loading="eager"
                  />
                )}
                <AvatarFallback className="bg-gradient-primary text-primary-foreground font-semibold text-sm">
                  {getInitials(profile.full_name)}
                </AvatarFallback>
              </Avatar>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground mr-0.5" />
            </DropdownMenuTrigger>
            
            <DropdownMenuContent align="end" className="w-64 p-2 bg-popover border-border shadow-lg">
              {/* User Info Section */}
              <div className="px-3 py-3 mb-1">
                <p className="text-sm font-semibold text-foreground leading-tight mb-1">
                  {profile.full_name}
                </p>
                <div className="flex items-center gap-1.5">
                  {profile.is_banned ? (
                    <>
                      <div className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
                      <p className="text-xs font-medium text-destructive">Account Suspended</p>
                    </>
                  ) : (
                    <>
                      <div className="h-1.5 w-1.5 rounded-full bg-success" />
                      <p className="text-xs text-muted-foreground">Active</p>
                    </>
                  )}
                </div>
              </div>
              
              <DropdownMenuSeparator className="my-1" />
              
              {isMember ? (
                <>
                  {/* Navigation Items */}
                  <DropdownMenuItem
                    onClick={() => navigate('/profile')}
                    className="cursor-pointer rounded-md px-3 py-2.5 focus:bg-muted/80 transition-colors"
                  >
                    <User className="mr-3 h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">My Profile</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => navigate('/support')}
                    className="cursor-pointer rounded-md px-3 py-2.5 focus:bg-muted/80 transition-colors"
                  >
                    <HelpCircle className="mr-3 h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Get Help</span>
                  </DropdownMenuItem>
                </>
              ) : (
                <div className="px-2 py-2">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('medium');
                      openMembershipDrawer();
                    }}
                    className="w-full h-11 rounded-full bg-white text-black font-extrabold text-sm shadow-md active:scale-[0.98] transition-transform"
                  >
                    Join Now
                  </button>
                </div>
              )}

              {adminRole?.isAdmin && (
                <DropdownMenuItem
                  onClick={() => navigate(isInAdminArea ? '/dashboard' : '/admin')}
                  className="cursor-pointer rounded-md px-3 py-2.5 focus:bg-muted/80 transition-colors"
                >
                  {isInAdminArea ? (
                    <>
                      <Home className="mr-3 h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Back to App</span>
                    </>
                  ) : (
                    <>
                      <Shield className="mr-3 h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Admin Dashboard</span>
                    </>
                  )}
                </DropdownMenuItem>
              )}
              
              <DropdownMenuSeparator className="my-1" />
              
              {/* Logout Item */}
              <DropdownMenuItem 
                onClick={handleLogout} 
                className="cursor-pointer rounded-md px-3 py-2.5 text-destructive focus:text-destructive focus:bg-destructive/10 transition-colors"
              >
                <LogOut className="mr-3 h-4 w-4" />
                <span className="text-sm font-medium">Sign Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        </div>
      </header>
    </div>
  );
};
