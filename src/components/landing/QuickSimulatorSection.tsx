import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Button } from '@/components/ui/button';
import { Play, RotateCcw, Hand, Banknote, PackagePlus, Loader2, CheckCircle2 } from 'lucide-react';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';

type Phase = 'idle' | 'tapping' | 'paid' | 'retired' | 'rebought';

export const QuickSimulatorSection = () => {
  const [ref, inView] = useInView({ threshold: 0.2, triggerOnce: true });
  const { data: config } = usePlatformConfig();
  const [phase, setPhase] = useState<Phase>('idle');
  const [pending, setPending] = useState(0);
  const [running, setRunning] = useState(false);

  const payout = Number(config?.drop_target_amount ?? 10000);
  const extraSpot = Number(config?.drop_entry_fee ?? 5000);

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const run = async () => {
    if (running) return;
    setRunning(true);
    setPhase('tapping');
    setPending(0);
    const steps = 20;
    for (let i = 1; i <= steps; i++) {
      await sleep(60);
      setPending(Math.round((payout * i) / steps));
    }
    setPhase('paid');
    await sleep(900);
    setPhase('retired');
    await sleep(800);
    setPhase('rebought');
    setPending(0);
    setRunning(false);
  };

  const reset = () => {
    setPhase('idle');
    setPending(0);
  };

  const fillPct = Math.min(100, (pending / payout) * 100);

  return (
    <section ref={ref} className="py-12 lg:py-20 px-4 bg-muted/30">
      <div className="max-w-lg md:max-w-3xl lg:max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-3">See one campaign in action</h2>
          <p className="text-muted-foreground lg:text-lg">
            Watch a campaign fill up → collect ₦{payout.toLocaleString()} → finish → activate another
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="bg-card rounded-2xl border border-border p-5 lg:p-8 max-w-xl mx-auto"
        >
          {/* Campaign progress */}
          <div className="mb-5">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span className="inline-flex items-center gap-1"><Hand className="h-3.5 w-3.5" /> Picking pictures fills the campaign</span>
              <span className="tabular-nums">₦{pending.toLocaleString()} / ₦{payout.toLocaleString()}</span>
            </div>
            <div className="relative h-24 rounded-2xl border border-border bg-background overflow-hidden">
              <motion.div
                className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-primary/80 to-primary/40"
                animate={{ height: `${fillPct}%` }}
                transition={{ duration: 0.15, ease: 'linear' }}
              />
              <div className="relative z-10 flex items-center justify-center h-full">
                <AnimatePresence mode="wait">
                  {phase === 'paid' && (
                    <motion.div
                      key="paid"
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-2 text-success font-bold text-lg"
                    >
                      <Banknote className="h-6 w-6" /> Paid ₦{payout.toLocaleString()}!
                    </motion.div>
                  )}
                  {phase === 'retired' && (
                    <motion.div
                      key="retired"
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-2 text-muted-foreground font-semibold"
                    >
                      <CheckCircle2 className="h-5 w-5" /> Share finished — job done
                    </motion.div>
                  )}
                  {phase === 'rebought' && (
                    <motion.div
                      key="rebought"
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-2 text-primary font-semibold"
                    >
                      <PackagePlus className="h-5 w-5" /> Activated a new share for ₦{extraSpot.toLocaleString()}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="grid grid-cols-4 gap-2 text-[10px] font-medium text-center mb-5">
            {[
              { label: 'Pick', active: phase === 'tapping' || phase === 'paid' || phase === 'retired' || phase === 'rebought' },
              { label: 'Payout', active: phase === 'paid' || phase === 'retired' || phase === 'rebought' },
              { label: 'Finish', active: phase === 'retired' || phase === 'rebought' },
              { label: 'Activate', active: phase === 'rebought' },
            ].map((t) => (
              <div
                key={t.label}
                className={`rounded-lg py-1.5 border ${
                  t.active ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-muted/40 border-border text-muted-foreground'
                }`}
              >
                {t.label}
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button onClick={run} disabled={running} className="flex-1" size="lg">
              {running ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Running…</>
              ) : (
                <><Play className="h-4 w-4 mr-2" /> Watch a campaign pay out</>
              )}
            </Button>
            {phase !== 'idle' && !running && (
              <Button onClick={reset} variant="outline" size="lg">
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
          </div>
        </motion.div>

        <AnimatePresence>
          {phase === 'rebought' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 p-4 lg:p-5 bg-success/10 border border-success/20 rounded-2xl text-center max-w-xl mx-auto"
            >
              <p className="font-bold text-foreground text-base lg:text-lg mb-1">
                That's ₦{payout.toLocaleString()} in your wallet — one share done.
              </p>
              <p className="text-sm text-muted-foreground">
                Own 3 shares and you can chase 3 payouts at once. Own 10 and you're chasing ₦{(payout * 10).toLocaleString()}.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
};
