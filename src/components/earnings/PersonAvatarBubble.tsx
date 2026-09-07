import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UniqueEarner } from '@/hooks/useEarningsTimeline';
import { cn } from '@/lib/utils';

interface PersonAvatarBubbleProps {
  earner: UniqueEarner;
  isCurrentUser?: boolean;
  index?: number;
  onTap?: () => void;
}

export const PersonAvatarBubble = ({ earner, isCurrentUser, index = 0, onTap }: PersonAvatarBubbleProps) => {
  const initials = earner.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <motion.button
      className="flex flex-col items-center gap-1 min-w-[56px] cursor-pointer"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05, duration: 0.2 }}
      onClick={onTap}
      whileTap={{ scale: 0.95 }}
    >
      <div className="relative">
        <Avatar
          className={cn(
            "w-12 h-12 border-2 transition-transform",
            isCurrentUser
              ? "border-primary ring-2 ring-primary/30"
              : "border-border/50"
          )}
        >
          <AvatarImage src={earner.avatar_url || undefined} alt={earner.full_name} />
          <AvatarFallback className="bg-muted text-muted-foreground text-xs font-medium">
            {initials}
          </AvatarFallback>
        </Avatar>
        
        {/* Earnings badge */}
        <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 bg-emerald-500/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap">
          +₦{earner.total_earned_today.toLocaleString()}
        </div>
        
        {/* Current user indicator */}
        {isCurrentUser && (
          <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[8px] font-bold px-1 rounded-full">
            YOU
          </div>
        )}
      </div>
      
      <span className="text-[10px] text-muted-foreground truncate max-w-[52px] text-center">
        {earner.full_name.split(' ')[0]}
      </span>
    </motion.button>
  );
};
