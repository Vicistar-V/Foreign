import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import { useCountUp } from '@/hooks/useCountUp';
import { Banknote, Gift, Wallet, ArrowDownToLine } from 'lucide-react';

interface StatCardProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  prefix?: string;
  delay?: number;
  inView: boolean;
  accent?: 'primary' | 'success' | 'caution';
}

const StatCard = ({ icon, value, label, prefix = '', delay = 0, inView, accent = 'primary' }: StatCardProps) => {
  const count = useCountUp({ end: inView ? value : 0, duration: 1500, delay });
  const accentClass =
    accent === 'success' ? 'text-success bg-success/10' :
    accent === 'caution' ? 'text-caution bg-caution/10' :
    'text-primary bg-primary/10';

  return (
    <motion.div
      className="flex flex-col items-center p-4 lg:p-6 bg-card rounded-2xl border border-border/60 shadow-sm"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={inView ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 0.4, delay: delay / 1000 }}
    >
      <div className={`p-2 lg:p-3 rounded-xl mb-2 ${accentClass}`}>{icon}</div>
      <div className="text-xl md:text-2xl lg:text-3xl font-bold text-foreground tabular-nums">
        {prefix}{count.toLocaleString()}
      </div>
      <div className="text-[11px] lg:text-sm text-muted-foreground text-center mt-1 leading-tight">
        {label}
      </div>
    </motion.div>
  );
};

export const LiveStatsTicker = () => {
  const { data: config } = usePlatformConfig();
  const [ref, inView] = useInView({ threshold: 0.3, triggerOnce: true });

  const membershipFee = Number(config?.membership_fee ?? 5000);
  const payout = Number(config?.drop_target_amount ?? 10000);
  const referralBonus = Number(config?.referral_cash_bonus ?? 1000);
  const minWithdrawal = Number(config?.minimum_withdrawal ?? 500);

  return (
    <section ref={ref} className="py-8 lg:py-12 px-4 bg-muted/30">
      <div className="max-w-lg md:max-w-3xl lg:max-w-4xl mx-auto">
        <motion.p
          className="text-center text-sm lg:text-base text-muted-foreground mb-4 lg:mb-6"
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
        >
          The real numbers — no small print
        </motion.p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4">
          <StatCard
            icon={<Banknote className="h-5 w-5 lg:h-6 lg:w-6" />}
            value={membershipFee}
            label="Activate once (first share)"
            prefix="₦"
            delay={0}
            inView={inView}
            accent="primary"
          />
          <StatCard
            icon={<Wallet className="h-5 w-5 lg:h-6 lg:w-6" />}
            value={payout}
            label="Per share payout"
            prefix="₦"
            delay={150}
            inView={inView}
            accent="success"
          />
          <StatCard
            icon={<Gift className="h-5 w-5 lg:h-6 lg:w-6" />}
            value={referralBonus}
            label="Per friend you invite"
            prefix="₦"
            delay={300}
            inView={inView}
            accent="caution"
          />
          <StatCard
            icon={<ArrowDownToLine className="h-5 w-5 lg:h-6 lg:w-6" />}
            value={minWithdrawal}
            label="Cash out from"
            prefix="₦"
            delay={450}
            inView={inView}
            accent="primary"
          />
        </div>
      </div>
    </section>
  );
};
