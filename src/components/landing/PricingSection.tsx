import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Trophy, PackagePlus, Banknote, Gift, ArrowDownToLine } from 'lucide-react';

export const PricingSection = () => {
  const [ref, inView] = useInView({ threshold: 0.3, triggerOnce: true });
  const { data: config } = usePlatformConfig();

  const membershipFee = Number(config?.membership_fee ?? 5000);
  const extraSpot = Number(config?.drop_entry_fee ?? 5000);
  const payout = Number(config?.drop_target_amount ?? 10000);
  const bonus = Number(config?.referral_cash_bonus ?? 1000);
  const minWithdrawal = Number(config?.minimum_withdrawal ?? 500);

  const rows = [
    {
      name: 'One ad share',
      price: `₦${membershipFee.toLocaleString()}`,
      note: 'Same price for your 1st share and every share after it.',
      icon: <Trophy className="h-4 w-4 text-primary" />,
      style: 'bg-primary/5 border-primary/30',
      badge: <Badge variant="secondary" className="text-xs">Start here</Badge>,
    },
    {
      name: 'More shares',
      price: `₦${extraSpot.toLocaleString()} each`,
      note: `3 shares = ₦${(extraSpot * 3).toLocaleString()}. 5 shares = ₦${(extraSpot * 5).toLocaleString()}. No discounts, no confusion.`,
      icon: <PackagePlus className="h-4 w-4 text-primary" />,
      style: 'bg-card border-border',
    },
    {
      name: 'Share payout',
      price: `₦${payout.toLocaleString()}`,
      note: 'Paid when your campaign reaches 100%. Share then finishes.',
      icon: <Banknote className="h-4 w-4 text-success" />,
      style: 'bg-success/5 border-success/30',
      earn: true,
    },
    {
      name: 'Invite bonus',
      price: `₦${bonus.toLocaleString()}`,
      note: 'For every share your friend activates. Paid instantly.',
      icon: <Gift className="h-4 w-4 text-caution" />,
      style: 'bg-caution/5 border-caution/30',
      earn: true,
    },
    {
      name: 'Withdrawal minimum',
      price: `₦${minWithdrawal.toLocaleString()}`,
      note: 'Cash out to any Nigerian bank.',
      icon: <ArrowDownToLine className="h-4 w-4 text-muted-foreground" />,
      style: 'bg-card border-border',
    },
  ];

  return (
    <section ref={ref} className="py-12 md:py-16 lg:py-20 px-4 bg-muted/30">
      <div className="max-w-lg md:max-w-3xl lg:max-w-4xl mx-auto">
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-2xl md:text-3xl font-bold mb-2">What you pay, what you get</h2>
          <p className="text-muted-foreground">No hidden fees. No moving numbers.</p>
        </motion.div>

        <div className="space-y-3 mb-6">
          {rows.map((r, i) => (
            <motion.div
              key={r.name}
              className={`flex items-center justify-between p-4 rounded-2xl border ${r.style}`}
              initial={{ opacity: 0, x: -20 }}
              animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ delay: 0.15 + i * 0.08 }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {r.icon}
                  <h3 className="font-medium">{r.name}</h3>
                  {r.badge}
                  {r.earn && (
                    <Badge className="text-xs bg-success/20 text-success border-success/30">You earn</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{r.note}</p>
              </div>
              <div className="text-right shrink-0 ml-3">
                <p className={`text-xl font-bold tabular-nums ${r.earn ? 'text-success' : 'text-primary'}`}>
                  {r.earn ? '+' : ''}{r.price}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.5 }}
        >
          <Card className="p-5 md:p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 lg:max-w-2xl lg:mx-auto">
            <h3 className="font-semibold mb-3 flex items-center gap-2 md:text-lg">
              <Trophy className="h-4 w-4 text-primary" />
              The whole thing in short
            </h3>
            <ul className="space-y-2">
              <li className="flex items-start gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-success mt-0.5" />
                <span>Pay <strong>₦{membershipFee.toLocaleString()}</strong> → pick a picture daily → collect <strong className="text-success">₦{payout.toLocaleString()}</strong>.</span>
              </li>
              <li className="flex items-start gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-success mt-0.5" />
                <span>Every share is the same price: <strong>₦{extraSpot.toLocaleString()}</strong> in, <strong className="text-success">₦{payout.toLocaleString()}</strong> out. Double, every time.</span>
              </li>
              <li className="flex items-start gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-success mt-0.5" />
                <span>Invite a friend → <strong>₦{bonus.toLocaleString()}</strong> lands instantly.</span>
              </li>
            </ul>
          </Card>
        </motion.div>
      </div>
    </section>
  );
};
