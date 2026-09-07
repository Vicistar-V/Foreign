import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import { ArrowRight, Coins, Gift, Banknote, PackagePlus } from 'lucide-react';

export const FinalCTASection = () => {
  const { user } = useAuth();
  const { data: config } = usePlatformConfig();
  const membershipFee = Number(config?.membership_fee ?? 5000);
  const payout = Number(config?.drop_target_amount ?? 10000);
  const bonus = Number(config?.referral_cash_bonus ?? 1000);

  const [ref, inView] = useInView({ threshold: 0.3, triggerOnce: true });

  return (
    <section ref={ref} className="py-16 lg:py-24 px-4 bg-gradient-to-b from-muted/30 to-primary/5 relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <motion.div
          className="absolute top-0 left-1/4 w-64 h-64 lg:w-96 lg:h-96 bg-primary/5 rounded-full blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 5, repeat: Infinity }}
        />
        <motion.div
          className="absolute bottom-0 right-1/4 w-64 h-64 lg:w-96 lg:h-96 bg-success/5 rounded-full blur-3xl"
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 5, repeat: Infinity, delay: 2.5 }}
        />
      </div>

      <div className="max-w-lg md:max-w-2xl lg:max-w-3xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="space-y-6 lg:space-y-8"
        >
          <div className="space-y-3 lg:space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full">
              <Coins className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">Activate your ad share</span>
            </div>

            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight">
              Ready to collect your{' '}
              <span className="text-success">₦{payout.toLocaleString()}</span>?
            </h2>

            <p className="text-muted-foreground lg:text-lg max-w-md mx-auto">
              Pay ₦{membershipFee.toLocaleString()} once. Pick a picture each day. Collect ₦{payout.toLocaleString()} straight to your bank when your campaign hits 100%. Simple as that.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-3 lg:gap-4">
            <div className="flex items-center gap-1.5 text-xs lg:text-sm text-muted-foreground">
              <Banknote className="h-3.5 w-3.5 lg:h-4 lg:w-4 text-primary" />
              <span>₦{membershipFee.toLocaleString()} to activate</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs lg:text-sm text-muted-foreground">
              <PackagePlus className="h-3.5 w-3.5 lg:h-4 lg:w-4 text-success" />
              <span>₦{payout.toLocaleString()} per share</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs lg:text-sm text-muted-foreground">
              <Gift className="h-3.5 w-3.5 lg:h-4 lg:w-4 text-caution" />
              <span>₦{bonus.toLocaleString()} per friend</span>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            {user ? (
              <motion.div whileTap={{ scale: 0.98 }}>
                <Button asChild size="lg" className="w-full max-w-xs lg:max-w-sm text-lg h-14 lg:h-16 rounded-2xl shadow-lg shadow-primary/25">
                  <Link to="/dashboard">
                    Open my dashboard <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </motion.div>
            ) : (
              <>
                <motion.div whileTap={{ scale: 0.98 }}>
                  <Button asChild size="lg" className="w-full max-w-xs lg:max-w-sm text-lg h-14 lg:h-16 rounded-2xl shadow-lg shadow-primary/25">
                    <Link to="/signup">
                      I Want A Share <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                </motion.div>
                <p className="text-sm lg:text-base text-muted-foreground">
                  Already a member?{' '}
                  <Link to="/login" className="text-primary font-medium hover:underline">
                    Log in
                  </Link>
                </p>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
};
