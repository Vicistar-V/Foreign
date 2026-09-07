import { useState } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, X, Trophy, Star, Shield, Heart, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AvatarPreviewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  name: string;
  avatarUrl?: string | null;
  tier?: string;
  amount?: number;
  role?: 'winner' | 'protected' | 'contributor' | 'yield_collector';
}

const getColorFromName = (name: string): string => {
  const colors = [
    'bg-destructive',
    'bg-accent-orange',
    'bg-warning',
    'bg-success',
    'bg-highlight',
    'bg-community',
    'bg-primary',
    'bg-secondary',
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
};

const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const getRoleDisplay = (role?: string, tier?: string) => {
  // If winner with tier, use tier-specific display
  if (tier) {
    switch (tier) {
      case 'jackpot':
        return { icon: Trophy, label: 'Jackpot Winner', className: 'text-warning bg-warning/10' };
      case 'high':
        return { icon: Star, label: 'Big Winner', className: 'text-accent-orange bg-accent-orange/10' };
      default:
        return { icon: Trophy, label: 'Winner', className: 'text-success bg-success/10' };
    }
  }
  
  // For protected, contributors, and yield collectors (no tier data)
  switch (role) {
    case 'winner':
      return { icon: Trophy, label: 'Winner', className: 'text-success bg-success/10' };
    case 'protected':
      return { icon: Shield, label: 'Protected Member', className: 'text-highlight bg-highlight/10' };
    case 'contributor':
      return { icon: Heart, label: 'Community Pillar', className: 'text-community bg-community/10' };
    case 'yield_collector':
      return { icon: Zap, label: 'Top Earner', className: 'text-amber-500 bg-amber-500/10' };
    default:
      return null;
  }
};

export const AvatarPreviewDrawer = ({ 
  isOpen, 
  onClose, 
  name, 
  avatarUrl,
  tier,
  amount,
  role
}: AvatarPreviewDrawerProps) => {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const colorClass = getColorFromName(name);
  const initials = getInitials(name);
  const roleDisplay = getRoleDisplay(role, tier);

  const handleClose = () => {
    setIsFullScreen(false);
    onClose();
  };

  return (
    <>
      <Drawer open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="text-center pb-2">
            <DrawerTitle className="text-lg font-semibold text-foreground">
              Profile Picture
            </DrawerTitle>
          </DrawerHeader>
          
          <div className="flex flex-col items-center justify-center px-6 pb-8 pt-2">
            {/* Large Avatar Display - Clickable if has image */}
            <div 
              className={`relative mb-6 ${avatarUrl ? 'cursor-pointer' : ''}`}
              onClick={() => avatarUrl && setIsFullScreen(true)}
            >
              <Avatar className={`h-48 w-48 ring-4 ring-border shadow-xl ${avatarUrl ? 'hover:ring-primary/50 transition-all duration-200 hover:scale-105' : ''}`}>
                {avatarUrl ? (
                  <AvatarImage 
                    src={avatarUrl} 
                    alt={name}
                    className="object-cover"
                  />
                ) : null}
                <AvatarFallback 
                  className={`${colorClass} text-white text-5xl font-bold`}
                >
                  {initials || <User className="w-20 h-20" />}
                </AvatarFallback>
              </Avatar>
            </div>
            
            {/* User Name */}
            <h3 className="text-xl font-semibold text-foreground text-center">
              {name}
            </h3>
            
            {/* Role/Winner Info */}
            {roleDisplay && (
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full mt-3 ${roleDisplay.className}`}>
                <roleDisplay.icon className="w-4 h-4" />
                <span className="text-sm font-medium">{roleDisplay.label}</span>
              </div>
            )}
            
            {amount !== undefined && amount > 0 && (
              <p className="text-2xl font-bold text-success mt-2">
                ₦{amount.toLocaleString()}
              </p>
            )}
            
            {/* Hint text - different based on whether there's an image */}
            <p className="text-sm text-muted-foreground mt-3">
              {avatarUrl ? 'Tap picture to view full size' : 'Tap outside to close'}
            </p>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Full-Screen Overlay */}
      <AnimatePresence>
        {isFullScreen && avatarUrl && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center"
            onClick={() => setIsFullScreen(false)}
          >
            {/* Close button */}
            <button 
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              onClick={() => setIsFullScreen(false)}
            >
              <X className="w-6 h-6 text-white" />
            </button>
            
            {/* Full-size image */}
            <motion.img 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.2 }}
              src={avatarUrl} 
              alt={name}
              className="max-w-[90vw] max-h-[80vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            
            {/* Name at bottom */}
            <motion.p 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2, delay: 0.1 }}
              className="mt-6 text-white text-lg font-medium"
            >
              {name}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
