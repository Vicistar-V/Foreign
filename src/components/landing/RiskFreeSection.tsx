import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { PackagePlus, Banknote, TrendingUp, Info } from 'lucide-react';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import { CountUp } from '@/components/ui/count-up';

/**
 * Own more ad shares = collect more ₦10,000 payouts.
 * No fake infinite-cycle projections. Real, honest math.
 */
export const RiskFreeSection = () => {
  const [ref, inView] = useInView({ threshold: 0.2, triggerOnce: true });
  const { data: config } = usePlatformConfig();

  const membershipFee = Number(config?.membership_fee ?? 5000);
  const extraSpot = Number(config?.drop_entry_fee ?? 5000);
  const payout = Number(config?.drop_target_amount ?? 10000);

  const scenarios = [
    { spots: 1, cost: membershipFee, label: 'Just activate', tone: 'text-primary' },
    { spots: 3, cost: membershipFee + extraSpot * 2, label: 'Small stack', tone: 'text-success' },
    { spots: 10, cost: membershipFee + extraSpot * 9, label: 'Full stack', tone: 'text-caution' },
  ];

  return (
    <section ref={ref} className="py-12 lg:py-20 px-4">
      <div className="max-w-lg md:max-w-3xl lg:max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-8 lg:mb-12"
        >
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-3">More shares, more payouts</h2>
          <p className="text-muted-foreground lg:text-lg">Each ad share = one ₦{payout.toLocaleString()} payout. Stack them.</p>
        </motion.div>

        {/* Simple equation */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="bg-card rounded-2xl border border-border p-5 lg:p-6 mb-6 max-w-xl mx-auto"
        >
          <p className="text-sm text-muted-foreground text-center mb-4">The honest math</p>
          <div className="flex items-center justify-center gap-2 md:gap-3 flex-wrap">
            <div className="px-3 py-2 bg-primary/10 rounded-xl text-center">
              <p className="text-base md:text-lg font-bold text-primary">1 share</p>
              <p className="text-[10px] text-muted-foreground">= ₦{payout.toLocaleString()} payout</p>
            </div>
            <span className="text-xl text-muted-foreground">×</span>
            <div className="px-3 py-2 bg-caution/10 rounded-xl text-center">
              <p className="text-base md:text-lg font-bold text-caution">shares you own</p>
              <p className="text-[10px] text-muted-foreground">stack as many as you want</p>
            </div>
            <span className="text-xl text-muted-foreground">=</span>
            <div className="px-3 py-2 bg-success/10 rounded-xl text-center">
              <p className="text-base md:text-lg font-bold text-success">your total</p>
              <p className="text-[10px] text-muted-foreground">real cash</p>
            </div>
          </div>
        </motion.div>

        {/* Scenarios */}
        <div className="grid grid-cols-3 gap-3 lg:gap-4 max-w-xl mx-auto mb-6">
          {scenarios.map((s, i) => (
            <motion.div
              key={s.spots}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: 0.3 + i * 0.1 }}
              className="p-4 bg-card rounded-2xl border border-border text-center"
            >
              <p className="text-[11px] text-muted-foreground">{s.label}</p>
              <p className={`text-2xl md:text-3xl font-bold ${s.tone}`}>{s.spots}</p>
              <p className="text-[10px] text-muted-foreground">share{s.spots > 1 ? 's' : ''}</p>
              <div className="border-t border-border/60 my-2" />
              <p className="text-[10px] text-muted-foreground">Costs</p>
              <p className="text-sm font-semibold text-foreground">₦{s.cost.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Pays out</p>
              <p className="text-lg font-bold text-success tabular-nums">
                ₦<CountUp end={payout * s.spots} duration={1200 + i * 200} />
              </p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="p-4 lg:p-6 bg-gradient-to-r from-primary/5 to-success/5 border border-primary/20 rounded-2xl max-w-xl mx-auto"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <PackagePlus className="h-5 w-5 lg:h-6 lg:w-6 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground text-sm lg:text-base">
                Own 10 shares → chase ₦{(payout * 10).toLocaleString()} in payouts
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Start with ₦{membershipFee.toLocaleString()} today. Activate more shares for ₦{extraSpot.toLocaleString()} each — no rush.
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.9 }}
          className="mt-4 flex items-start gap-2 text-xs lg:text-sm text-muted-foreground max-w-xl mx-auto"
        >
          <Info className="h-3 w-3 lg:h-4 lg:w-4 mt-0.5 flex-shrink-0" />
          <p>Your campaign usually reaches 100% in about 3–5 days. Each share pays once, then finishes — activate another to keep going.</p>
        </motion.div>
      </div>
    </section>
  );
};
