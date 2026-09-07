import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Zap, TrendingUp, X } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { AvatarPreviewDrawer } from '@/components/results/AvatarPreviewDrawer';
import { motion } from 'framer-motion';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';

interface ProfileShowcasePreviewProps {
  previewUrl: string | null;
  onRemove?: () => void;
}

export const ProfileShowcasePreview = ({ previewUrl, onRemove }: ProfileShowcasePreviewProps) => {
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const { data: config } = usePlatformConfig();
  const userName = profile?.full_name || 'Your Name';
  const [showPreview, setShowPreview] = useState(false);
  const profitAmount = config?.drop_profit_amount ?? 900;

  const initials = userName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="space-y-3">
      <div className="text-center space-y-1">
        <p className="text-sm font-semibold text-foreground">How you'll appear on Viketa</p>
        <p className="text-xs text-muted-foreground">This is what others see when you earn</p>
      </div>

      <motion.div
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      >
        <Card 
          className="relative overflow-hidden p-4 border-amber-500/30 bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent cursor-pointer"
          onClick={() => setShowPreview(true)}
          role="button"
          aria-label="Tap to see full preview"
        >
          {/* Subtle animated glow */}
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-400/10 to-amber-500/0 animate-pulse" />
          
          <div className="relative flex items-center gap-3">
            <div className="relative">
              <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-amber-500/40 to-amber-400/20 blur-sm" />
              <Avatar className="relative h-14 w-14 text-lg ring-2 ring-amber-500/50">
                {previewUrl && (
                  <AvatarImage 
                    src={previewUrl} 
                    alt={userName}
                    className="object-cover"
                  />
                )}
                <AvatarFallback className="bg-amber-500 text-white font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-base text-foreground truncate">
                {userName}
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  Yield Collector
                </span>
              </div>
            </div>
            
            <div className="text-right">
              <p className="text-xs text-muted-foreground mb-0.5">Sample Yield</p>
              <div className="flex items-center gap-1 justify-end">
                <TrendingUp className="w-3.5 h-3.5 text-success" />
                <p className="text-lg font-bold text-success tabular-nums">+₦{profitAmount.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Remove button - only show when there's a preview image */}
          {previewUrl && onRemove && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-destructive/10 hover:bg-destructive/20 transition-colors"
              aria-label="Remove picture"
            >
              <X className="w-3.5 h-3.5 text-destructive" />
            </button>
          )}
        </Card>
      </motion.div>

      <p className="text-xs text-center text-muted-foreground opacity-70">Tap to see full preview</p>

      <AvatarPreviewDrawer
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        name={userName}
        avatarUrl={previewUrl || profile?.avatar_url}
        role="yield_collector"
      />
    </div>
  );
};
