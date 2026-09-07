import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Trophy, Users, Star, Zap } from 'lucide-react';

/**
 * "Two roads to the same payout" — the honest math of the ad share system.
 * Every scenario ends at the SAME ₦10,000 pending balance cash-out; the only difference
 * is how you filled the pending balance. No recurring royalties, no "forever" promises.
 */
export const SuccessStoriesSection = () => {
  const [ref, inView] = useInView({ threshold: 0.2, triggerOnce: true });

  const { data: config } = usePlatformConfig();
  const payoutPerSpot = Number(config?.drop_target_amount ?? 10000);
  const nairaPerBatch = Number(config?.task_naira_per_batch ?? 50);
  const cashBonus = Number(config?.referral_cash_bonus ?? 1000);
  const pendingBump = Number(config?.referral_pending_bonus ?? 3000);
  // Default to "The Inviter" — highest-conversion story, best referral upside.
  // Auto-advance every 6s so first-time visitors see all three roads.
  const [currentIndex, setCurrentIndex] = useState(1);
  const [autoRotate, setAutoRotate] = useState(true);

  const batchesToFill = Math.max(1, Math.ceil(payoutPerSpot / Math.max(nairaPerBatch, 1)));
  const friendsToFill = Math.max(1, Math.ceil(payoutPerSpot / Math.max(pendingBump, 1)));
  const cashFromFriends = friendsToFill * cashBonus;

  const scenarios = [
    {
      name: 'The Grinder',
      description: `Pick ${batchesToFill.toLocaleString()} pictures. No friends needed.`,
      icon: Zap,
      type: 'grind' as const,
      basketTotal: payoutPerSpot,
      cashTotal: payoutPerSpot,
      breakdown: `${batchesToFill.toLocaleString()} picture picks × ₦${nairaPerBatch} = ₦${payoutPerSpot.toLocaleString()}`,
    },
    {
      name: 'The Inviter',
      description: `Invite ${friendsToFill} friends. Skip the daily picks.`,
      icon: Users,
      type: 'invite' as const,
      basketTotal: payoutPerSpot,
      cashTotal: payoutPerSpot + cashFromFriends,
      breakdown: `${friendsToFill} friends × ₦${pendingBump.toLocaleString()} pending balance-jump + ₦${cashBonus.toLocaleString()} cash each`,
    },
    {
      name: 'The Mix',
      description: `Invite 2 friends, pick pictures for the rest.`,
      icon: Trophy,
      type: 'mix' as const,
      basketTotal: payoutPerSpot,
      cashTotal: payoutPerSpot + (2 * cashBonus),
      breakdown: `2 friends fill ₦${(2 * pendingBump).toLocaleString()} + ${Math.max(0, Math.ceil((payoutPerSpot - 2 * pendingBump) / Math.max(nairaPerBatch, 1))).toLocaleString()} picture picks for the rest`,
    },
  ];

  const currentScenario = scenarios[currentIndex];

  // Auto-rotate scenarios every 6s until the user manually navigates —
  // makes sure new visitors see all three roads without needing to swipe.
  useEffect(() => {
    if (!autoRotate) return;
    const id = window.setInterval(() => {
      setCurrentIndex((i) => (i + 1) % scenarios.length);
    }, 6000);
    return () => window.clearInterval(id);
  }, [autoRotate, scenarios.length]);

  const stopAutoAnd = (fn: () => void) => () => {
    setAutoRotate(false);
    fn();
  };

  return (
    <section ref={ref} className="py-12 px-4">
      <div className="max-w-lg mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <div className="flex items-center justify-center gap-2 mb-3">
            <Star className="h-5 w-5 text-caution fill-caution" />
            <h2 className="text-2xl md:text-3xl font-bold">Two roads to ₦{payoutPerSpot.toLocaleString()}</h2>
            <Star className="h-5 w-5 text-caution fill-caution" />
          </div>
          <p className="text-muted-foreground text-sm">
            Same pending balance. Same cash-out. You pick how you fill it.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="relative"
        >
          <div className="bg-gradient-to-br from-card via-card to-primary/5 rounded-2xl border border-border p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-success/5 rounded-full translate-y-1/2 -translate-x-1/2" />

            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="relative z-10"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className={`h-16 w-16 rounded-full flex items-center justify-center ${
                    currentScenario.type === 'mix' ? 'bg-caution/10' :
                    currentScenario.type === 'invite' ? 'bg-highlight/10' : 'bg-success/10'
                  }`}>
                    <currentScenario.icon className={`h-8 w-8 ${
                      currentScenario.type === 'mix' ? 'text-caution' :
                      currentScenario.type === 'invite' ? 'text-highlight' : 'text-success'
                    }`} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-foreground">{currentScenario.name}</h3>
                    <p className="text-sm text-muted-foreground">{currentScenario.description}</p>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-success/10 to-success/5 rounded-xl p-4 mb-3">
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground mb-1">You cash out</div>
                    <div className="text-3xl font-bold text-success tabular-nums">
                      ₦{currentScenario.cashTotal.toLocaleString()}
                    </div>
                    {currentScenario.cashTotal > currentScenario.basketTotal && (
                      <div className="text-[11px] text-muted-foreground mt-1">
                        (₦{currentScenario.basketTotal.toLocaleString()} pending balance + ₦{(currentScenario.cashTotal - currentScenario.basketTotal).toLocaleString()} friend cash bonuses)
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-xs text-muted-foreground text-center">
                  {currentScenario.breakdown}
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="flex items-center justify-between mt-6">
              <Button variant="ghost" size="sm" onClick={stopAutoAnd(() => setCurrentIndex((i) => (i - 1 + scenarios.length) % scenarios.length))} className="h-8 w-8 p-0">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex gap-1">
                {scenarios.map((_, index) => (
                  <button
                    key={index}
                    onClick={stopAutoAnd(() => setCurrentIndex(index))}
                    className={`w-2 h-2 rounded-full transition-colors ${index === currentIndex ? 'bg-primary' : 'bg-muted'}`}
                    aria-label={`Show scenario ${index + 1}`}
                  />
                ))}
              </div>
              <Button variant="ghost" size="sm" onClick={stopAutoAnd(() => setCurrentIndex((i) => (i + 1) % scenarios.length))} className="h-8 w-8 p-0">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="mt-4 text-center"
          >
            <p className="text-sm text-muted-foreground">
              One pending balance, one cash-out. When you're paid, activate another share to keep earning.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};
