import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Badge } from '@/components/ui/badge';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import { Wallet, Hand, Banknote, PackagePlus, CheckCircle2, Zap } from 'lucide-react';

/**
 * Ad share + campaign — 4 real steps.
 * Each share pays ONCE, then it's finished.
 */
export const HowItWorksSection = () => {
  const [ref, inView] = useInView({ threshold: 0.2, triggerOnce: true });
  const { data: config } = usePlatformConfig();

  const membershipFee = Number(config?.membership_fee ?? 5000);
  const payout = Number(config?.drop_target_amount ?? 10000);
  const extraSpot = Number(config?.drop_entry_fee ?? 5000);
  const nairaPerBatch = Number(config?.task_naira_per_batch ?? 180);
  const batchesPerDay = Number(config?.task_batches_per_day ?? 0);
  const isUnlimited = batchesPerDay === 0;
  const dailyPerSpot = isUnlimited ? payout : nairaPerBatch * batchesPerDay;

  const steps = [
    {
      icon: <Wallet className="h-6 w-6 text-primary" />,
      title: 'Activate a share for ₦' + membershipFee.toLocaleString(),
      body: 'One-time payment. Companies pay Viketa to know which advert picture people like better — you help find out.',
      chip: 'Takes 2 minutes',
    },
    {
      icon: <Hand className="h-6 w-6 text-caution" />,
      title: 'Pick a picture every day',
      body: `About 15 minutes a day. Choose which picture — A or B — you think people prefer. Every pick moves your campaign closer to 100%.`,
      chip: 'Easy — anyone can do it',
    },
    {
      icon: <Banknote className="h-6 w-6 text-success" />,
      title: `Collect ₦${payout.toLocaleString()} when you hit 100%`,
      body: `Campaigns usually reach 100% in about 3–5 days. Once yours does, ₦${payout.toLocaleString()} lands in your wallet and that share is finished.`,
      chip: 'Straight to your Nigerian bank',
    },
    {
      icon: <PackagePlus className="h-6 w-6 text-primary" />,
      title: `Activate another share — ₦${extraSpot.toLocaleString()}`,
      body: 'Want another payout? Activate a new ad share any time. More shares = more ₦10,000 payouts.',
      chip: 'Optional — activate as many as you want',
    },
  ];

  return (
    <section ref={ref} className="py-12 lg:py-20 px-4">
      <div className="max-w-lg md:max-w-4xl lg:max-w-5xl mx-auto">
        <motion.div
          className="text-center mb-8 lg:mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full text-primary text-sm font-medium mb-3">
            <Zap className="h-4 w-4" />
            How it works
          </div>
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2">4 simple steps</h2>
          <p className="text-muted-foreground lg:text-lg">Activate → Pick a picture → Collect → Activate another if you want more</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          {steps.map((s, i) => (
            <motion.div
              key={i}
              className="relative bg-card rounded-2xl border border-border p-5"
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.45, delay: 0.1 + i * 0.08 }}
            >
              <div className="absolute -top-3 left-4 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shadow">
                {i + 1}
              </div>
              <div className="flex items-start gap-3 pt-2">
                <div className="h-12 w-12 rounded-xl bg-background border border-border flex items-center justify-center shrink-0">
                  {s.icon}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base md:text-lg font-semibold text-foreground leading-tight">{s.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1.5 leading-snug">{s.body}</p>
                  <div className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3 w-3 text-primary" />
                    {s.chip}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* The honest note */}
        <motion.div
          className="mt-6 p-4 lg:p-5 bg-muted/40 border border-border/60 rounded-2xl text-center max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.5 }}
        >
          <p className="text-sm text-foreground leading-relaxed">
            <span className="font-semibold">Straight talk:</span> each ad share pays ONCE ({`₦${payout.toLocaleString()}`}) then it's finished. To earn again, activate another share for ₦{extraSpot.toLocaleString()}. No hidden loops, no funny math.
          </p>
        </motion.div>
      </div>
    </section>
  );
};
