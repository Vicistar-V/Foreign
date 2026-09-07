import {
  LayoutDashboard, Users, ArrowDownLeft, ArrowUpRight,
  LifeBuoy, MoreHorizontal, FileText, Network,
  Megaphone, DollarSign, ImageIcon, CreditCard,
  Banknote, Settings,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAdminBadgeCounts } from '@/hooks/useAdminBadgeCounts';

export const AdminMobileNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const { depositsCount, withdrawalsCount, supportCount } = useAdminBadgeCounts();

  const primaryItems = [
    { icon: LayoutDashboard, label: 'Home',     to: '/admin',              badge: 0 },
    { icon: Users,           label: 'Users',    to: '/admin/users',        badge: 0 },
    { icon: ArrowDownLeft,   label: 'Deposits', to: '/admin/deposits',     badge: depositsCount },
    { icon: ArrowUpRight,    label: 'Payouts',  to: '/admin/withdrawals',  badge: withdrawalsCount },
    { icon: LifeBuoy,        label: 'Support',  to: '/admin/support',      badge: supportCount },
  ];

  const moreItems = [
    { icon: CreditCard,  label: 'Payments',            to: '/admin/payments' },
    { icon: Banknote,    label: 'Deposit Method',      to: '/admin/deposit-method' },
    { icon: FileText,    label: 'System Logs',         to: '/admin/logs' },
    { icon: Network,     label: 'Referral Network',    to: '/admin/referrals' },
    { icon: Megaphone,   label: 'Announcements',       to: '/admin/notifications' },
    { icon: DollarSign,  label: 'Money Settings',      to: '/admin/economy' },
    { icon: Settings,    label: 'Platform Controls',   to: '/admin/controls' },
    { icon: ImageIcon,   label: 'Gallery',             to: '/admin/gallery' },
  ];

  const isMoreActive = moreItems.some(i => location.pathname.startsWith(i.to));

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 md:hidden">
      <nav
        className="flex items-center justify-around bg-card border-t border-border px-1 pt-2"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        {primaryItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/admin'}
            className="relative flex flex-col items-center gap-0.5 min-w-[56px] px-2 py-2.5 rounded-xl text-muted-foreground transition-colors"
            activeClassName="text-primary bg-primary/10"
          >
            <div className="relative">
              <item.icon className="h-5 w-5" strokeWidth={1.75} />
              {item.badge > 0 && (
                <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 text-[10px] font-bold tabular-nums leading-[18px] bg-destructive text-destructive-foreground rounded-full text-center">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium leading-tight">{item.label}</span>
          </NavLink>
        ))}

        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <button
              className={`relative flex flex-col items-center gap-0.5 min-w-[56px] px-2 py-2.5 rounded-xl transition-colors ${
                isMoreActive ? 'text-primary bg-primary/10' : 'text-muted-foreground'
              }`}
            >
              <MoreHorizontal className="h-5 w-5" strokeWidth={1.75} />
              <span className="text-[10px] font-medium leading-tight">More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl max-h-[75dvh] overflow-y-auto">
            {/* Sheet grab handle */}
            <div className="mx-auto w-10 h-1 rounded-full bg-muted-foreground/30 mb-3 -mt-1" />
            <SheetHeader className="pb-3">
              <SheetTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                More tools
              </SheetTitle>
            </SheetHeader>
            {(() => {
              const groups = [
                { label: 'Payments', items: moreItems.filter(i => ['Payments', 'Deposit Method'].includes(i.label)) },
                { label: 'System', items: moreItems.filter(i => ['System Logs', 'Platform Controls', 'Money Settings'].includes(i.label)) },
                { label: 'Growth', items: moreItems.filter(i => ['Referral Network', 'Announcements', 'Gallery'].includes(i.label)) },
              ];
              return (
                <div className="space-y-4 pb-6">
                  {groups.map((group) => (
                    <div key={group.label}>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 px-1">
                        {group.label}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {group.items.map((item) => {
                          const active = location.pathname.startsWith(item.to);
                          return (
                            <button
                              key={item.to}
                              onClick={() => {
                                setMoreOpen(false);
                                navigate(item.to);
                              }}
                              className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                                active
                                  ? 'border-primary/40 bg-primary/10 text-primary'
                                  : 'border-border bg-card text-foreground hover:bg-muted'
                              }`}
                            >
                              <item.icon className="h-5 w-5 shrink-0" />
                              <span className="text-sm font-medium leading-tight truncate">{item.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </SheetContent>
        </Sheet>
      </nav>
    </div>
  );
};
