import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card } from '@/components/ui/card';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import { useAuth } from '@/hooks/useAuth';
import { Users, Gift, ArrowRight, Banknote } from 'lucide-react';

export const ReferralCalculator = () => {
  const [friendCount, setFriendCount] = useState([5]);
  const { data: config } = usePlatformConfig();
  const { user } = useAuth();
  const [ref, inView] = useInView({ threshold: 0.3, triggerOnce: true });

  const cashBonus = Number(config?.referral_cash_bonus ?? 1000);
  const pendingBump = Number(config?.referral_pending_bonus ?? 3000);
  const perFriend = cashBonus + pendingBump;
  const totalCash = friendCount[0] * cashBonus;
  const totalPending = friendCount[0] * pendingBump;
  const total = friendCount[0] * perFriend;

  return (
    <section ref={ref} className="py-12 md:py-16 lg:py-20 px-4 bg-muted/30">
      <div className="max-w-lg md:max-w-3xl lg:max-w-4xl mx-auto">
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full text-primary text-sm font-medium mb-3">
            <Gift className="h-4 w-4" />
            Invite math
          </div>
          <h2 className="text-2xl md:text-3xl font-bold mb-2">
            How much can you make inviting friends?
          </h2>
          <p className="text-muted-foreground">
            Every friend = <span className="font-semibold text-foreground">₦{cashBonus.toLocaleString()} cash</span> + <span className="font-semibold text-foreground">₦{pendingBump.toLocaleString()} jumped straight into your pending balance</span>.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.2 }}
          className="lg:max-w-2xl lg:mx-auto"
        >
          <Card className="p-6 md:p-8">
            <div className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm text-muted-foreground">How many friends will you invite?</span>
                <span className="text-3xl font-bold text-primary tabular-nums">{friendCount[0]}</span>
              </div>
              <Slider
                value={friendCount}
                onValueChange={setFriendCount}
                max={50}
                min={1}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                <span>1</span>
                <span>50</span>
              </div>
            </div>

            <motion.div
              key={total}
              initial={{ scale: 0.96, opacity: 0.6 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="p-5 md:p-6 bg-success/10 rounded-2xl border border-success/20 text-center"
            >
              <p className="text-sm text-muted-foreground">Total value in your pocket</p>
              <p className="text-4xl md:text-5xl font-bold text-success tabular-nums mt-1">
                ₦{total.toLocaleString()}
              </p>
              <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
                <div className="rounded-lg bg-background/60 p-2">
                  <p className="text-muted-foreground">Cash to wallet</p>
                  <p className="font-bold text-foreground tabular-nums text-base">₦{totalCash.toLocaleString()}</p>
                </div>
                <div className="rounded-lg bg-background/60 p-2">
                  <p className="text-muted-foreground">Jumped into pending balance</p>
                  <p className="font-bold text-foreground tabular-nums text-base">₦{totalPending.toLocaleString()}</p>
                </div>
              </div>
            </motion.div>

            <div className="mt-5 flex items-start gap-2 text-xs text-muted-foreground">
              <Banknote className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                Both drop the second your friend activates. The ₦{cashBonus.toLocaleString()} lands in your withdrawable wallet, and the ₦{pendingBump.toLocaleString()} skips ahead in your pending balance toward cash-out.
              </span>
            </div>

            <div className="mt-6">
              <Button asChild className="w-full" size="lg">
                <Link to={user ? '/invite' : '/signup'}>
                  {user ? `Get my invite link — earn ₦${total.toLocaleString()}` : `Join & start earning ₦${total.toLocaleString()}`}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </Card>
        </motion.div>

        <motion.div
          className="mt-6 flex items-center justify-center gap-2"
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.5 }}
        >
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Every friend is worth ₦{perFriend.toLocaleString()} to you.
          </span>
        </motion.div>
      </div>
    </section>
  );
};
