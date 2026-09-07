import { motion } from 'framer-motion';
import { Check, UserPlus2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NetworkMeterProps {
  filled: number;
  required: number;
  className?: string;
}

/**
 * Visual meter of friends activated. Lit slots = friends who paid ₦3k.
 * Empty slots pulse softly to invite a tap.
 */
export function NetworkMeter({ filled, required, className }: NetworkMeterProps) {
  const slots = Array.from({ length: required });
  const safeFilled = Math.min(Math.max(filled, 0), required);

  return (
    <div className={cn('flex items-center justify-center gap-3', className)}>
      {slots.map((_, i) => {
        const isFilled = i < safeFilled;
        return (
          <motion.div
            key={i}
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: i * 0.08, type: 'spring', stiffness: 240, damping: 18 }}
            className={cn(
              'relative flex flex-col items-center gap-1.5',
            )}
          >
            <div
              className={cn(
                'relative w-14 h-14 rounded-2xl flex items-center justify-center border-2 transition-colors',
                isFilled
                  ? 'bg-emerald-500/15 border-emerald-500 shadow-[0_0_24px_-4px] shadow-emerald-500/60'
                  : 'bg-card border-dashed border-muted-foreground/30'
              )}
            >
              {isFilled ? (
                <Check className="w-7 h-7 text-emerald-400" strokeWidth={3} />
              ) : (
                <UserPlus2 className="w-6 h-6 text-muted-foreground/60" />
              )}
              {!isFilled && (
                <span className="absolute inset-0 rounded-2xl border-2 border-primary/30 animate-ping opacity-40" />
              )}
            </div>
            <span
              className={cn(
                'text-[10px] font-semibold uppercase tracking-wider tabular-nums',
                isFilled ? 'text-emerald-400' : 'text-muted-foreground/70'
              )}
            >
              Friend {i + 1}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}
