import {
  Shield, DollarSign, ArrowLeft, LayoutDashboard, Users, ArrowDownLeft, ArrowUpRight,
  LifeBuoy, CreditCard, Banknote, FileText, Network, Megaphone, Settings, ImageIcon,
  FlaskConical,
} from 'lucide-react';

import { NavLink } from '@/components/NavLink';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from '@/components/ui/sidebar';
import { useAdminBadgeCounts } from '@/hooks/useAdminBadgeCounts';

type NavItem = {
  icon: typeof LayoutDashboard;
  label: string;
  to: string;
  badgeKey?: 'deposits' | 'withdrawals' | 'support';
};

const sections: { label: string; items: NavItem[] }[] = [
  {
    label: 'Action Queues',
    items: [
      { icon: ArrowDownLeft, label: 'Deposits',        to: '/admin/deposits',    badgeKey: 'deposits' },
      { icon: ArrowUpRight,  label: 'Payouts',         to: '/admin/withdrawals', badgeKey: 'withdrawals' },
      { icon: LifeBuoy,      label: 'Support Tickets', to: '/admin/support',     badgeKey: 'support' },
      
    ],
  },
  {
    label: 'People',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', to: '/admin' },
      { icon: Users,           label: 'Users',     to: '/admin/users' },
      { icon: Network,         label: 'Referrals', to: '/admin/referrals' },
    ],
  },
  {
    label: 'Payments',
    items: [
      { icon: CreditCard, label: 'Payments',      to: '/admin/payments' },
      { icon: Banknote,   label: 'Deposit Method', to: '/admin/deposit-method' },
    ],
  },
  {
    label: 'Tools',
    items: [
      { icon: Megaphone,  label: 'Announcements',     to: '/admin/notifications' },
      { icon: FileText,   label: 'System Logs',       to: '/admin/logs' },
      { icon: DollarSign, label: 'Money Settings',    to: '/admin/economy' },
      { icon: Settings,   label: 'Platform Controls', to: '/admin/controls' },
      { icon: ImageIcon,    label: 'Gallery',           to: '/admin/gallery' },
      { icon: FlaskConical, label: 'Sandbox',           to: '/admin/sandbox' },

    ],
  },
];

export const AdminSidebar = () => {
  const navigate = useNavigate();
  const { state, setOpenMobile, isMobile } = useSidebar();
  const counts = useAdminBadgeCounts();
  const badgeMap = {
    deposits: counts.depositsCount,
    withdrawals: counts.withdrawalsCount,
    support: counts.supportCount,
  } as const;

  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false);
  };
  const handleBackToApp = () => {
    if (isMobile) setOpenMobile(false);
    navigate('/dashboard');
  };
  const isCollapsed = state === 'collapsed';

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <h2 className="font-bold text-base text-foreground leading-tight">Admin Panel</h2>
              <p className="text-xs text-muted-foreground">Back-office controls</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        {sections.map((section) => (
          <div key={section.label} className="mb-3">
            {!isCollapsed && (
              <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                {section.label}
              </p>
            )}
            <SidebarMenu className="space-y-0.5">
              {section.items.map((item) => {
                const badge = item.badgeKey ? badgeMap[item.badgeKey] : 0;
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild tooltip={item.label}>
                      <NavLink
                        to={item.to}
                        end={item.to === '/admin'}
                        className="relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                        activeClassName="text-sidebar-primary bg-sidebar-accent font-semibold"
                        onClick={handleNavClick}
                      >
                        <div className="relative shrink-0">
                          <item.icon className="h-5 w-5" strokeWidth={1.75} />
                          {isCollapsed && badge > 0 && (
                            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive" />
                          )}
                        </div>
                        {!isCollapsed && (
                          <>
                            <span className="text-sm font-medium flex-1 truncate">{item.label}</span>
                            {badge > 0 && (
                              <span className="min-w-[20px] h-5 px-1.5 text-[10px] font-bold tabular-nums leading-5 bg-destructive text-destructive-foreground rounded-full text-center">
                                {badge > 99 ? '99+' : badge}
                              </span>
                            )}
                          </>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </div>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-3">
        <Button
          variant="ghost"
          size={isCollapsed ? 'icon' : 'default'}
          className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          onClick={handleBackToApp}
        >
          <ArrowLeft className={isCollapsed ? 'h-5 w-5' : 'mr-2 h-4 w-4'} />
          {!isCollapsed && <span className="text-sm font-medium">Back to App</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
};
