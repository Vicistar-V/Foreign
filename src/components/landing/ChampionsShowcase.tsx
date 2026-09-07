import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import { Crown, Trophy, ArrowRight, Users, PartyPopper, Gift } from 'lucide-react';

interface EarnerCardProps {
  name: string;
  invites: number;
  earnings: number;
  delay: number;
  inView: boolean;
  isTop?: boolean;
}

const EarnerCard = ({ name, invites, earnings, delay, inView, isTop }: EarnerCardProps) => {
  const initials = name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <motion.div
      className={`relative flex items-center gap-3 p-3 lg:p-4 bg-card rounded-xl border border-border/50 shadow-sm ${isTop ? 'shadow-lg shadow-caution/20' : ''}`}
      initial={{ opacity: 0, x: -20 }}
      animate={inView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.5, delay }}
    >
      {isTop && inView && (
        <motion.div
          className="absolute -top-1 -right-1 text-caution"
          initial={{ scale: 0 }}
          animate={{ scale: [0, 1.2, 1] }}
          transition={{ delay: delay + 0.3, duration: 0.5 }}
        >
          <PartyPopper className="h-5 w-5" />
        </motion.div>
      )}
      <div className="relative">
        <Avatar className={`h-12 w-12 lg:h-14 lg:w-14 border-2 ${isTop ? 'border-caution/50' : 'border-background'}`}>
          <AvatarFallback className="bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
        </Avatar>
        <div className={`absolute -bottom-1 -right-1 p-1 rounded-full border-2 border-background ${isTop ? 'bg-caution/20' : 'bg-success/20'}`}>
          {isTop ? <Crown className="h-3 w-3 text-caution" /> : <Trophy className="h-3 w-3 text-success" />}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm lg:text-base truncate">{name}</p>
        <Badge variant="secondary" className={`text-xs mt-0.5 ${isTop ? 'bg-caution/10 text-caution' : ''}`}>
          {invites} friends joined
        </Badge>
      </div>
      <div className="text-right">
        <p className={`font-bold tabular-nums ${isTop ? 'text-lg lg:text-xl text-caution' : 'text-primary lg:text-lg'}`}>
          ₦{earnings.toLocaleString()}
        </p>
        <p className="text-xs text-muted-foreground">bonuses</p>
      </div>
    </motion.div>
  );
};

export const ChampionsShowcase = () => {
  const [ref, inView] = useInView({ threshold: 0.2, triggerOnce: true });
  const { data: config } = usePlatformConfig();
  const bonus = Number(config?.referral_cash_bonus ?? 1000);

  const topEarners = [
    { name: 'Top Inviter', invites: 25 },
    { name: 'Growing Fast', invites: 15 },
    { name: 'Active Member', invites: 9 },
    { name: 'Just Started', invites: 4 },
    { name: 'First Timer', invites: 1 },
  ];

  return (
    <section ref={ref} className="py-12 lg:py-20 px-4 bg-muted/30 overflow-hidden">
      <div className="max-w-lg md:max-w-4xl lg:max-w-5xl mx-auto">
        <motion.div
          className="text-center mb-6 lg:mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-caution/10 text-caution rounded-full text-sm font-medium mb-3 border border-caution/20">
            <Trophy className="h-4 w-4" />
            Invite bonuses
          </div>
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2">₦{bonus.toLocaleString()} for every friend who joins</h2>
          <p className="text-muted-foreground lg:text-lg">Paid instantly the moment they activate. No waiting, no math.</p>
        </motion.div>

        <div className="lg:grid lg:grid-cols-2 lg:gap-8">
          <div className="space-y-3 mb-6 lg:mb-0">
            {topEarners.map((e, i) => (
              <EarnerCard
                key={i}
                name={e.name}
                invites={e.invites}
                earnings={e.invites * bonus}
                delay={0.2 + i * 0.1}
                inView={inView}
                isTop={i === 0}
              />
            ))}
          </div>

          <div className="space-y-4">
            <motion.div
              className="p-4 lg:p-6 bg-card rounded-xl border border-border/50"
              initial={{ opacity: 0, y: 10 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.5 }}
            >
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                How it works
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <span className="text-primary font-bold">1.</span>
                  <span className="text-muted-foreground">Share your invite link with a friend.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-primary font-bold">2.</span>
                  <span className="text-muted-foreground">Your friend joins and pays ₦{Number(config?.membership_fee ?? 5000).toLocaleString()}.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-success font-bold">3.</span>
                  <span className="text-foreground font-medium">₦{bonus.toLocaleString()} lands in your wallet — same second.</span>
                </div>
              </div>
            </motion.div>

            <motion.div
              className="grid grid-cols-2 gap-3"
              initial={{ opacity: 0, y: 10 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.6 }}
            >
              <div className="p-4 bg-card rounded-xl border border-border/50 text-center">
                <p className="text-2xl lg:text-3xl font-bold text-primary tabular-nums">₦{bonus.toLocaleString()}</p>
                <p className="text-xs lg:text-sm text-muted-foreground">per friend</p>
              </div>
              <div className="p-4 bg-card rounded-xl border border-border/50 text-center">
                <p className="text-2xl lg:text-3xl font-bold text-success">Instant</p>
                <p className="text-xs lg:text-sm text-muted-foreground">no waiting</p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.7 }}
              className="p-4 lg:p-5 bg-gradient-to-r from-primary/5 to-success/5 rounded-xl border border-primary/10"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Gift className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground text-sm lg:text-base">10 friends = ₦{(10 * bonus).toLocaleString()}</p>
                  <p className="text-xs lg:text-sm text-muted-foreground">Enough to activate 3 more ad shares + still have change.</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.8 }}
            >
              <Button asChild variant="outline" className="w-full" size="lg">
                <Link to="/signup">
                  Start inviting <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};
