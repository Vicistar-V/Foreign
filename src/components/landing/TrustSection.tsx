import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import { Lock, Users, Scale, Wallet, Shield, CheckCircle, ShieldCheck, CreditCard, Eye, Banknote } from 'lucide-react';

interface TrustCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  features: string[];
  delay: number;
  inView: boolean;
}

const TrustCard = ({ icon, title, description, features, delay, inView }: TrustCardProps) => (
  <motion.div
    className="p-5 lg:p-6 bg-card rounded-xl border border-border shadow-sm h-full"
    initial={{ opacity: 0, y: 20 }}
    animate={inView ? { opacity: 1, y: 0 } : {}}
    transition={{ duration: 0.4, delay }}
  >
    <div className="p-3 rounded-xl bg-primary/10 w-fit mb-4">{icon}</div>
    <h3 className="font-semibold text-lg lg:text-xl mb-2">{title}</h3>
    <p className="text-sm lg:text-base text-muted-foreground mb-3">{description}</p>
    <ul className="space-y-1.5">
      {features.map((feature, index) => (
        <li key={index} className="flex items-center gap-2 text-xs lg:text-sm text-muted-foreground">
          <CheckCircle className="h-3 w-3 lg:h-4 lg:w-4 text-primary" />
          {feature}
        </li>
      ))}
    </ul>
  </motion.div>
);

export const TrustSection = () => {
  const [ref, inView] = useInView({ threshold: 0.2, triggerOnce: true });
  const { data: config } = usePlatformConfig();
  const payout = Number(config?.drop_target_amount ?? 10000);
  const minWithdrawal = Number(config?.minimum_withdrawal ?? 500);

  const trustItems = [
    {
      icon: <Lock className="h-6 w-6 text-primary" />,
      title: 'Secure payments',
      description: 'Your money is safe with us',
      features: ['Powered by Flutterwave & Moniepoint', 'Bank-level security', 'Card details never stored'],
    },
    {
      icon: <Users className="h-6 w-6 text-primary" />,
      title: 'Real community',
      description: 'Nigerians earning together',
      features: ['Verified members', 'Active every day', 'Real bank withdrawals'],
    },
    {
      icon: <Scale className="h-6 w-6 text-primary" />,
      title: 'Real ad campaigns',
      description: 'Companies pay to know which picture people like better',
      features: [`Guaranteed ₦${payout.toLocaleString()} per share`, 'Transparent campaign progress', 'Watch it live on your dashboard'],
    },
    {
      icon: <Wallet className="h-6 w-6 text-primary" />,
      title: 'Easy withdrawals',
      description: 'Get your money quickly',
      features: ['Cash out to any Nigerian bank', `Minimum ₦${minWithdrawal.toLocaleString()}`, 'Fast processing'],
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
          <div className="inline-flex items-center justify-center w-16 h-16 lg:w-20 lg:h-20 rounded-full bg-gradient-to-br from-primary/20 to-success/20 mb-4">
            <ShieldCheck className="h-8 w-8 lg:h-10 lg:w-10 text-primary" />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full text-primary text-sm font-medium mb-3">
            <Shield className="h-4 w-4" />
            Trust & safety
          </div>
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2">Your money is safe</h2>
          <p className="text-muted-foreground lg:text-lg">Built with security and fairness in mind</p>
        </motion.div>

        <motion.div
          className="flex flex-wrap justify-center gap-3 mb-6 lg:mb-10"
          initial={{ opacity: 0, y: 10 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full text-xs lg:text-sm">
            <Banknote className="h-3 w-3 lg:h-4 lg:w-4 text-success" />
            <span>Guaranteed ₦{payout.toLocaleString()} payout</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full text-xs lg:text-sm">
            <Eye className="h-3 w-3 lg:h-4 lg:w-4 text-primary" />
            <span>Transparent campaign progress</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full text-xs lg:text-sm">
            <CreditCard className="h-3 w-3 lg:h-4 lg:w-4 text-primary" />
            <span>Flutterwave / Moniepoint</span>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 lg:mb-10">
          {trustItems.map((item, i) => (
            <TrustCard key={i} {...item} delay={0.3 + i * 0.1} inView={inView} />
          ))}
        </div>

        <motion.div
          className="p-4 lg:p-6 bg-gradient-to-r from-primary/5 to-success/5 rounded-xl border border-primary/10 max-w-2xl mx-auto text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.7 }}
        >
          <p className="font-medium text-foreground">Trusted Nigerian platform</p>
          <p className="text-sm text-muted-foreground mt-1">Thousands of Nigerians already collecting ₦{payout.toLocaleString()} payouts</p>
        </motion.div>
      </div>
    </section>
  );
};
