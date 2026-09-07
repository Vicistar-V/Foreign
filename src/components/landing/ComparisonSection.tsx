import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Check, X, ArrowRight } from 'lucide-react';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';

interface ComparisonItemProps { text: string; isPositive: boolean; }
const ComparisonItem = ({ text, isPositive }: ComparisonItemProps) => (
  <div className="flex items-start gap-3 py-2">
    <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 ${
      isPositive ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'
    }`}>
      {isPositive ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
    </div>
    <span className={`text-sm ${isPositive ? 'text-foreground' : 'text-muted-foreground'}`}>{text}</span>
  </div>
);

export const ComparisonSection = () => {
  const [ref, inView] = useInView({ threshold: 0.2, triggerOnce: true });
  const { data: config } = usePlatformConfig();
  const payout = Number(config?.drop_target_amount ?? 10000);
  const bonus = Number(config?.referral_cash_bonus ?? 1000);

  const traditionalIssues = [
    'Hidden rules that change without notice',
    'Manual tracking — easy to cheat',
    'Trust issues with organizers',
    'Long delays before you see your money',
    'No way to check if things are fair',
    'You send money and pray',
  ];

  const viketaBenefits = [
    'Clear campaign progress — watch it live, 0 to 100%',
    'Everything tracked automatically',
    `Guaranteed ₦${payout.toLocaleString()} payout per share`,
    'Cash lands in your bank the moment your campaign hits 100%',
    'Activate more shares any time — no waiting on luck',
    `Flat ₦${bonus.toLocaleString()} per friend invited, paid instantly`,
  ];

  return (
    <section ref={ref} className="py-12 px-4">
      <div className="max-w-lg mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <h2 className="text-2xl md:text-3xl font-bold mb-3">Why people choose Viketa</h2>
          <p className="text-muted-foreground">The old way vs. The Viketa way</p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-card rounded-2xl border border-border p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center">
                <X className="h-4 w-4 text-destructive" />
              </div>
              <h3 className="font-semibold text-foreground">The old way</h3>
            </div>
            <div className="space-y-1">
              {traditionalIssues.map((issue, i) => <ComparisonItem key={i} text={issue} isPositive={false} />)}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl border-2 border-primary/20 p-5 relative overflow-hidden"
          >
            <div className="absolute top-3 right-3">
              <span className="text-xs font-semibold bg-primary text-primary-foreground px-2 py-1 rounded-full">
                The Viketa way
              </span>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <Check className="h-4 w-4 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">Ad shares & campaigns</h3>
            </div>
            <div className="space-y-1">
              {viketaBenefits.map((b, i) => <ComparisonItem key={i} text={b} isPositive={true} />)}
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="text-center mt-8"
        >
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
            Activate your ad share today <ArrowRight className="h-4 w-4 text-primary" />
          </p>
        </motion.div>
      </div>
    </section>
  );
};
