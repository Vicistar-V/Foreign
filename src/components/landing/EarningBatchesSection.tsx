import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Badge } from '@/components/ui/badge';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import { Hand, Hourglass, Banknote, PackagePlus, ArrowRight, Layers } from 'lucide-react';

/**
 * Pick a picture → campaign moves toward 100% → payout → share finishes → activate another.
 */
export const EarningBatchesSection = () => {
  const [ref, inView] = useInView({ threshold: 0.15, triggerOnce: true });
  const { data: config } = usePlatformConfig();
  const payout = Number(config?.drop_target_amount ?? 10000);
  const nairaPerBatch = Number(config?.task_naira_per_batch ?? 180);
  const batchesPerDay = Number(config?.task_batches_per_day ?? 0);
  const isUnlimited = batchesPerDay === 0;
  const dailyPerSpot = isUnlimited ? payout : nairaPerBatch * batchesPerDay;
  const extraSpot = Number(config?.drop_entry_fee ?? 5000);

  const steps = [
    {
      Icon: Hand,
      title: 'Pick a picture each day',
      body: `Open the app and choose which advert picture — A or B — you think people prefer. About 15 minutes a day, anyone can do it.`,
      tone: 'text-sky-500',
      ring: 'border-sky-500/25 bg-sky-500/5',
    },
    {
      Icon: Hourglass,
      title: 'Your campaign fills up',
      body: `Every picture you pick moves your campaign closer to 100%. You can also invite 1 friend to jump your campaign forward instantly.`,
      tone: 'text-amber-500',
      ring: 'border-amber-500/25 bg-amber-500/5',
    },
    {
      Icon: Banknote,
      title: `Collect ₦${payout.toLocaleString()} when you hit 100%`,
      body: `Campaigns usually reach 100% in about 3–5 days. Once yours does, ₦${payout.toLocaleString()} is unlocked as real cash you can withdraw to your bank.`,
      tone: 'text-emerald-500',
      ring: 'border-emerald-500/25 bg-emerald-500/5',
    },
    {
      Icon: PackagePlus,
      title: 'Share finished — activate another to keep earning',
      body: `That share's job is done. Activate a new one for ₦${extraSpot.toLocaleString()} to start the next ₦${payout.toLocaleString()} payout.`,
      tone: 'text-primary',
      ring: 'border-primary/25 bg-primary/5',
    },
  ];

  return (
    <section ref={ref} className="py-12 lg:py-20 px-4">
      <div className="max-w-lg md:max-w-4xl lg:max-w-5xl mx-auto">
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
        >
          <Badge variant="outline" className="mb-3 px-3 py-1 text-xs">
            <Layers className="h-3.5 w-3.5 mr-1.5" />
            Daily picture rating → real cash
          </Badge>
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2">
            How picking a picture turns into ₦{payout.toLocaleString()}
          </h2>
          <p className="text-muted-foreground lg:text-lg max-w-xl mx-auto">
            Companies pay Viketa to know which advert picture people like better. Your daily picks fill a campaign that pays out at 100%.
          </p>
        </motion.div>

        <motion.div
          className="rounded-2xl border border-border/60 bg-card p-4 mb-6 max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Campaign progress</p>
              <p className="text-xl md:text-2xl font-bold tabular-nums text-foreground leading-tight">
                Grows as you pick pictures
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">usually 3–5 days to 100%</p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="text-right min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">At 100% you get</p>
              <p className="text-xl md:text-2xl font-bold tabular-nums text-emerald-500 leading-tight">
                ₦{payout.toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">then share is finished</p>
            </div>
          </div>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-3 lg:gap-4">
          {steps.map((s, i) => (
            <motion.div
              key={i}
              className={`relative rounded-2xl border p-4 ${s.ring}`}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.45, delay: 0.15 + i * 0.08 }}
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-background/60 border border-border/60 flex items-center justify-center shrink-0">
                  <s.Icon className={`h-5 w-5 ${s.tone}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Step {i + 1}
                  </p>
                  <h3 className="text-base font-semibold text-foreground leading-tight">{s.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1.5 leading-snug">{s.body}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          className="mt-6 rounded-2xl border border-border/60 bg-muted/30 p-4 text-center max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <p className="text-sm text-foreground leading-relaxed">
            <span className="font-semibold">In plain English:</span> picking a picture daily grows your campaign. When it hits 100%, the ₦{payout.toLocaleString()} unlocks. Own more shares to earn more, more often.
          </p>
        </motion.div>
      </div>
    </section>
  );
};
