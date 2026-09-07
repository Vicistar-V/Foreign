import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import { User, Coins, PackagePlus, Info, Image } from 'lucide-react';
import { CountUp } from '@/components/ui/count-up';

export const MoneyProtectionExplainer = () => {
  const [ref, inView] = useInView({
    threshold: 0.3,
    triggerOnce: true,
  });

  const { data: config } = usePlatformConfig();
  const extraShareFee = config?.drop_entry_fee || 5000;
  const membershipFee = config?.membership_fee || 5000;
  const payout = config?.drop_target_amount || 10000;

  return (
    <section ref={ref} className="py-12 px-4">
      <div className="max-w-lg mx-auto">
        {/* Section header */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-2xl md:text-3xl font-bold mb-2">Your campaign, visualized</h2>
          <p className="text-muted-foreground">See how picking pictures fills your campaign</p>
        </motion.div>

        {/* Visual demonstration */}
        <motion.div
          className="bg-card rounded-2xl border border-border p-5 mb-6"
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.2 }}
        >
          <p className="text-center text-sm text-muted-foreground mb-4">
            You activate → you pick pictures daily → campaign hits 100% → you're paid
          </p>
          
          {/* Visualization */}
          <div className="flex justify-center items-center gap-3 mb-6">
            {/* You */}
            <motion.div
              className="flex flex-col items-center"
              initial={{ opacity: 0, y: 10 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.3 }}
            >
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
                <User className="h-6 w-6" />
              </div>
              <span className="text-xs font-medium mt-1">You</span>
            </motion.div>

            <motion.div 
              className="text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 0.5 }}
            >
              →
            </motion.div>

            {/* Picture pick 1 */}
            <motion.div
              className="flex flex-col items-center"
              initial={{ opacity: 0, x: 20 }}
              animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ delay: 0.6 }}
            >
              <div className="w-10 h-10 rounded-full bg-success/20 text-success flex items-center justify-center">
                <Image className="h-5 w-5" />
              </div>
              <span className="text-xs text-muted-foreground mt-1">Day 1</span>
            </motion.div>

            {/* Picture pick 2 */}
            <motion.div
              className="flex flex-col items-center"
              initial={{ opacity: 0, x: 20 }}
              animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ delay: 0.8 }}
            >
              <div className="w-10 h-10 rounded-full bg-success/20 text-success flex items-center justify-center">
                <Image className="h-5 w-5" />
              </div>
              <span className="text-xs text-muted-foreground mt-1">Day 2</span>
            </motion.div>

            <motion.div 
              className="text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 1.0 }}
            >
              =
            </motion.div>

            {/* Payout */}
            <motion.div
              className="flex flex-col items-center"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={inView ? { opacity: 1, scale: 1 } : {}}
              transition={{ delay: 1.2, type: "spring" }}
            >
              <div className="w-12 h-12 rounded-full bg-success text-success-foreground flex items-center justify-center shadow-lg">
                <Coins className="h-6 w-6" />
              </div>
              <span className="text-xs font-bold text-success mt-1">₦{Number(payout).toLocaleString()}</span>
            </motion.div>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Your campaign fills up</span>
              <span>100%</span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-primary to-success rounded-full"
                initial={{ width: 0 }}
                animate={inView ? { width: '100%' } : {}}
                transition={{ delay: 0.5, duration: 1.5 }}
              />
            </div>
          </div>
        </motion.div>

        {/* What happens */}
        <div className="space-y-3">
          <motion.div
            className="flex items-start gap-3 p-4 bg-success/10 rounded-xl border border-success/20"
            initial={{ opacity: 0, x: -20 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 1.4 }}
          >
            <Coins className="h-5 w-5 text-success mt-0.5" />
            <div>
              <p className="font-medium text-success">₦{Number(payout).toLocaleString()} goes to your wallet</p>
              <p className="text-sm text-muted-foreground">Withdraw anytime to your bank</p>
            </div>
          </motion.div>

          <motion.div
            className="flex items-start gap-3 p-4 bg-primary/10 rounded-xl border border-primary/20"
            initial={{ opacity: 0, x: -20 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 1.6 }}
          >
            <PackagePlus className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-primary">Your share is now finished</p>
              <p className="text-sm text-muted-foreground">Activate another for ₦{Number(extraShareFee).toLocaleString()} to keep earning</p>
            </div>
          </motion.div>
        </div>

        {/* Earnings example */}
        <motion.div
          className="mt-6 p-4 bg-gradient-to-r from-primary/5 to-success/5 rounded-xl border border-primary/20"
          initial={{ opacity: 0, y: 10 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 2.0 }}
        >
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">After 5 finished shares, you've earned:</p>
          <p className="text-3xl font-bold text-success">
            ₦<CountUp end={Number(payout) * 5} duration={1500} />
          </p>
            <p className="text-xs text-muted-foreground mt-1">Starting from just one ₦{Number(membershipFee).toLocaleString()} activation</p>
          </div>
        </motion.div>

        {/* Tip */}
        <motion.div
          className="mt-4 flex items-start gap-2 p-3 bg-muted/50 rounded-lg"
          initial={{ opacity: 0, y: 10 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 2.2 }}
        >
          <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
          <p className="text-sm text-muted-foreground">
            Companies pay to know which picture people like better. Simple math, real money.
          </p>
        </motion.div>
      </div>
    </section>
  );
};
