import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, Trophy, UserPlus, LayoutDashboard, Menu, HelpCircle, CircleHelp, FileText, Shield, BookOpen, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { FEATURE_FLAGS } from "@/config/featureFlags";

export const PublicMobileNav = () => {
  const location = useLocation();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const mainNavItems = [
    { to: "/", label: "Home", icon: Home },
    // Hidden via feature flag - uncomment or set SHOW_WINNERS_NAV to true to show
    ...(FEATURE_FLAGS.SHOW_WINNERS_NAV ? [{ to: "/winners", label: "Winners", icon: Trophy }] : []),
    { to: "/blog", label: "Blog", icon: BookOpen },
  ];

  const moreMenuItems = [
    { to: "/how-it-works", label: "How It Works", icon: HelpCircle },
    { to: "/faq", label: "FAQ", icon: CircleHelp },
    { to: "/terms", label: "Terms", icon: FileText },
    { to: "/privacy", label: "Privacy", icon: Shield },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-background pb-[env(safe-area-inset-bottom)] rounded-t-[28px]">
      <div className="flex items-center justify-around px-2 py-2">
        {/* Main nav items: Home, Winners */}
        {mainNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.to;
          
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => haptics.light()}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg transition-colors min-w-[70px]",
                isActive 
                  ? "text-primary bg-primary/10" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}

        {/* More Menu Sheet */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <button
              onClick={() => haptics.light()}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg transition-colors min-w-[70px]",
                moreMenuItems.some(item => location.pathname === item.to)
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Menu className="h-5 w-5" />
              <span className="text-xs font-medium">More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-[28px] pb-[env(safe-area-inset-bottom)]">
            <SheetHeader className="pb-4">
              <SheetTitle className="text-left">More Pages</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-2 gap-3 pb-4">
              {moreMenuItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.to;
                
                return (
                  <SheetClose asChild key={item.to}>
                    <Link
                      to={item.to}
                      onClick={() => haptics.light()}
                      className={cn(
                        "flex items-center gap-3 p-4 rounded-xl border transition-colors",
                        isActive 
                          ? "bg-primary/10 border-primary/30 text-primary" 
                          : "bg-muted/50 border-border hover:bg-muted"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="font-medium text-sm">{item.label}</span>
                    </Link>
                  </SheetClose>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
        
        {/* CTA Button — on the signup page itself, drop the vibrant "Join Now"
            (it competes with the actual signup form the user is filling) and
            offer a subtle Log in link instead for returning users. */}
        {user ? (
          <Link to="/dashboard">
            <Button 
              size="sm" 
              className="gradient-primary h-10 px-4 gap-1.5 shadow-sm"
              haptic="medium"
            >
              <LayoutDashboard className="h-4 w-4" />
              <span className="text-xs font-medium">Dashboard</span>
            </Button>
          </Link>
        ) : location.pathname === "/signup" ? (
          <Link to="/login">
            <Button
              size="sm"
              variant="ghost"
              className="h-10 px-3 gap-1.5 text-muted-foreground"
              haptic="light"
            >
              <LogIn className="h-4 w-4" />
              <span className="text-xs font-medium">Log in</span>
            </Button>
          </Link>
        ) : (
          <Link to="/signup">
            <Button 
              size="sm" 
              className="gradient-primary h-10 px-4 gap-1.5 shadow-sm"
              haptic="heavy"
            >
              <UserPlus className="h-4 w-4" />
              <span className="text-xs font-medium">Join Now</span>
            </Button>
          </Link>
        )}
      </div>
    </nav>
  );
};
