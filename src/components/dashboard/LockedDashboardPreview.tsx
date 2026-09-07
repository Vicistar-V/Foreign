import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';

/**
 * Shown only to people who don't have a spot yet.
 * One simple message — no list, no button (the floating
 * "I Want A Spot" CTA is the only call to action on this screen).
 */
export function LockedDashboardPreview() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.9 }}
      className="rounded-3xl border border-border bg-card px-5 py-6 text-center"
      aria-label="This page unlocks when you activate a share"
    >
      <div className="mx-auto h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Lock className="h-5 w-5 text-primary" />
      </div>
      <h2 className="mt-3 text-base font-bold text-foreground">
        Activate a share and this page turns on
      </h2>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground max-w-[19rem] mx-auto">
        Everything below is locked for now. The moment you activate a share, it all opens.
      </p>
    </motion.section>
  );
}
