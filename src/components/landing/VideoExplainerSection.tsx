import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { CheckCircle, Wallet, Users, ArrowRight, TrendingUp } from 'lucide-react';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import { ExplainerVideo } from '@/components/ExplainerVideo';

export const VideoExplainerSection = () => {
  const [ref, inView] = useInView({
    threshold: 0.2,
    triggerOnce: true,
  });

  const { data: config } = usePlatformConfig();
  const membershipFee = Number(config?.membership_fee ?? 5000);
  const payout = Number(config?.drop_target_amount ?? 10000);

  const steps = [
    { icon: <Wallet className="h-5 w-5" />, text: `Pay ₦${membershipFee.toLocaleString()}` },
    { icon: <Users className="h-5 w-5" />, text: 'Activate your share' },
    { icon: <ArrowRight className="h-5 w-5" />, text: 'Pick daily' },
    { icon: <TrendingUp className="h-5 w-5" />, text: `Collect ₦${payout.toLocaleString()}` },
  ];

  return (
    <section ref={ref} className="py-12 md:py-16 lg:py-20 px-4 bg-muted/30">
      <div className="max-w-md md:max-w-3xl lg:max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-6"
        >
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            Watch how money lands in your hands
          </h2>
          <p className="text-muted-foreground">
            2-minute story — streams instantly, no download needed
          </p>
        </motion.div>

        {/* Streaming HLS video */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mx-auto max-w-md"
        >
          <ExplainerVideo aspectClassName="aspect-[4/5]" />
        </motion.div>

        {/* Quick summary steps */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4"
        >
          {steps.map((step, index) => (
            <div
              key={index}
              className="flex items-center gap-2 p-3 bg-card rounded-xl border border-border"
            >
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                {index + 1}
              </div>
              <span className="text-sm font-medium text-foreground">{step.text}</span>
            </div>
          ))}
        </motion.div>

        {/* Simple explanation */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-6 p-4 bg-primary/5 rounded-xl border border-primary/20"
        >
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground text-sm">
                It's really that simple.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Activate once, pick a picture daily, and the money lands when your campaign hits 100%.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
