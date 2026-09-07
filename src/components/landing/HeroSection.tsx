import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import { ArrowRight, ShieldCheck, Banknote, Clock } from 'lucide-react';

/**
 * HERO — Ad share + campaign model.
 * Promise: Activate an ad share for ₦5,000. Get ₦10,000 back. Simple.
 * Grandma-first. Mobile-first. No jargon.
 */
export const HeroSection = () => {
  const { user } = useAuth();
  const { data: config } = usePlatformConfig();

  const membershipFee = Number(config?.membership_fee ?? 5000);
  const payout = Number(config?.drop_target_amount ?? 10000);
  const nairaPerBatch = Number(config?.task_naira_per_batch ?? 180);
  const batchesPerDay = Number(config?.task_batches_per_day ?? 0);
  const isUnlimited = batchesPerDay === 0;
  const dailyPerSpot = isUnlimited ? payout : nairaPerBatch * batchesPerDay;
  const profit = payout - membershipFee;

  const container = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
  };
  const item = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
  };

  return (
    <section className="relative overflow-hidden px-4 pt-10 pb-14 md:pt-16 md:pb-20">
      {/* Soft glow background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(60% 50% at 50% 0%, hsl(var(--primary) / 0.18) 0%, transparent 70%), radial-gradient(40% 40% at 80% 30%, hsl(var(--success) / 0.10) 0%, transparent 70%)',
        }}
      />

      <motion.div
        variants={container}
        initial="hidden"
        animate="visible"
        className="mx-auto w-full max-w-md md:max-w-3xl text-center"
      >
        {/* Trust chip */}
        <motion.div variants={item} className="flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 py-1.5 text-xs font-medium text-success">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            Real ad campaigns are running right now
          </div>
        </motion.div>

        {/* Headline — the promise */}
        <motion.h1
          variants={item}
          className="mt-5 text-[2.15rem] leading-[1.05] font-extrabold tracking-tight md:text-6xl"
        >
          Activate a share for <span className="text-primary">₦{membershipFee.toLocaleString()}</span>.
          <br />
          Get <span className="text-success">₦{payout.toLocaleString()}</span> back.
        </motion.h1>

        <motion.p
          variants={item}
          className="mt-4 px-2 text-base leading-relaxed text-muted-foreground md:text-lg"
        >
          Companies pay Viketa to know which advert picture people like better. Pick a picture
          each day, and when your campaign reaches 100% we send{' '}
          <span className="font-semibold text-foreground">₦{payout.toLocaleString()}</span> straight to your bank.
          No selling. No confusion. No hidden charges.
        </motion.p>

        {/* The math — impossible to misread */}
        <motion.div
          variants={item}
          className="mt-7 rounded-2xl border border-border bg-card p-4 shadow-sm md:p-6"
        >
          <div className="grid grid-cols-3 items-center gap-2 text-center">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">You pay</div>
              <div className="mt-1 text-xl font-bold text-foreground md:text-3xl">
                ₦{membershipFee.toLocaleString()}
              </div>
            </div>
            <div className="text-2xl text-muted-foreground md:text-3xl">→</div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">You get</div>
              <div className="mt-1 text-xl font-bold text-success md:text-3xl">
                ₦{payout.toLocaleString()}
              </div>
            </div>
          </div>
          <div className="mt-3 border-t border-border pt-3 text-center text-sm text-foreground">
            That's <span className="font-bold text-success">₦{profit.toLocaleString()} pure profit</span>
            {isUnlimited ? (
              <>
                {' '}· pick your picture once a day — <span className="font-semibold">about 15 minutes</span>
              </>
            ) : dailyPerSpot > 0 ? (
              <>
                {' '}· your campaign usually reaches 100% in <span className="font-semibold">3–5 days</span>
              </>
            ) : null}
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div variants={item} className="mt-7 space-y-3">
          {user ? (
            <Button asChild size="lg" className="h-14 w-full rounded-2xl text-base font-semibold shadow-lg shadow-primary/25">
              <Link to="/dashboard">
                Open my dashboard <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          ) : (
            <>
              <motion.div whileTap={{ scale: 0.98 }}>
                <Button
                  asChild
                  size="lg"
                  className="h-14 w-full rounded-2xl text-base font-semibold shadow-lg shadow-primary/30"
                >
                  <Link to="/signup">
                    Activate my ad share — ₦{membershipFee.toLocaleString()}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </motion.div>
              <p className="text-sm text-muted-foreground">
                Already joined?{' '}
                <Link to="/login" className="font-semibold text-primary hover:underline">
                  Log in
                </Link>
              </p>
            </>
          )}
        </motion.div>

        {/* Reassurance strip */}
        <motion.div
          variants={item}
          className="mt-6 grid grid-cols-3 gap-2 text-[11px] md:text-xs"
        >
          <div className="flex flex-col items-center gap-1 rounded-xl border border-border/70 bg-card/60 p-3">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground">Bank-verified</span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-xl border border-border/70 bg-card/60 p-3">
            <Banknote className="h-4 w-4 text-success" />
            <span className="font-medium text-foreground">Cash to your bank</span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-xl border border-border/70 bg-card/60 p-3">
            <Clock className="h-4 w-4 text-caution" />
            <span className="font-medium text-foreground">Campaign moves fast</span>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
};
