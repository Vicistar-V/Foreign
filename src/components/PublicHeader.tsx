import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PublicMobileNav } from "@/components/PublicMobileNav";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import logo from "@/assets/logo.png";
import { Loader2, Home, Trophy, HelpCircle, CircleHelp, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { FEATURE_FLAGS } from "@/config/featureFlags";

export const PublicHeader = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { data: profile } = useProfile(user?.id);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const navLinks = [
    { to: "/", label: "Home", icon: Home },
    { to: "/how-it-works", label: "How It Works", icon: HelpCircle },
    // Hidden via feature flag - set SHOW_WINNERS_NAV to true to show
    ...(FEATURE_FLAGS.SHOW_WINNERS_NAV ? [{ to: "/winners", label: "Winners", icon: Trophy }] : []),
    { to: "/blog", label: "Blog", icon: BookOpen },
    { to: "/faq", label: "FAQ", icon: CircleHelp },
  ];

  return (
    <>
      <header className="sticky top-0 z-50 w-full bg-background">
        <div className="container grid grid-cols-2 md:grid-cols-3 h-16 items-center px-4 md:px-6">
          {/* Left - Logo */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <img src={logo} alt="Viketa" className="h-8 w-8" />
              <span className="text-xl font-bold">Viketa</span>
            </Link>
          </div>
          
          {/* Center - Nav Links */}
          <nav className="hidden md:flex items-center justify-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.to;
              return (
                <Link key={link.to} to={link.to}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "gap-2",
                      isActive && "bg-muted font-medium"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {link.label}
                  </Button>
                </Link>
              );
            })}
          </nav>
          
          {/* Right - Theme Toggle + Auth */}
          <div className="flex items-center justify-end gap-2 md:gap-3">
            <ThemeToggle />
            
            {authLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : user && profile ? (
              <div className="flex items-center gap-2 md:gap-3">
                <Avatar className="h-8 w-8">
                  {profile.avatar_url && (
                    <AvatarImage 
                      src={profile.avatar_url} 
                      alt={profile.full_name}
                      className="object-cover"
                      loading="eager"
                    />
                  )}
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {getInitials(profile.full_name)}
                  </AvatarFallback>
                </Avatar>
                <Button 
                  size="sm" 
                  onClick={() => navigate('/dashboard')}
                  className="gradient-primary hidden md:flex"
                >
                  Dashboard
                </Button>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-2">
                <Link to="/login">
                  <Button variant="ghost" size="sm">Log In</Button>
                </Link>
                <Link to="/signup">
                  <Button size="sm" className="gradient-primary">Sign Up</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>
      
      <PublicMobileNav />
    </>
  );
};
