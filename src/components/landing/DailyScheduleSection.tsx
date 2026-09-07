import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import { Wallet, Users, Coins, PackagePlus, Eye } from 'lucide-react';

interface StepProps {
  icon: React.ReactNode;
  step: string;
  title: string;
  description: string;
  isActive?: boolean;
  delay: number;
  inView: boolean;
  isLast?: boolean;
}

const TimelineStep = ({ icon, step, title, description, isActive, delay, inView, isLast }: StepProps) => (
  <motion.div 
    initial={{ opacity: 0, x: -20 }} 
    animate={inView ? { opacity: 1, x: 0 } : {}} 
    transition={{ duration: 0.5, delay }} 
    className="relative flex gap-4"
  >
    {!isLast && <div className="absolute left-5 top-12 w-0.5 h-[calc(100%-12px)] bg-border md:hidden" />}
    <div className={`relative z-10 flex-shrink-0 w-10 h-10 lg:w-12 lg:h-12 rounded-full flex items-center justify-center ${
      isActive ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30' : 'bg-muted text-muted-foreground'
    }`}>
      {icon}
    </div>
    <div className="flex-1 pb-8 md:pb-0">
      <span className={`text-xs lg:text-sm font-mono ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>{step}</span>
      <h4 className={`font-semibold lg:text-lg ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>{title}</h4>
      <p className="text-sm lg:text-base text-muted-foreground mt-1">{description}</p>
    </div>
  </motion.div>
);

export const DailyScheduleSection = () => {
  const [ref, inView] = useInView({ threshold: 0.2, triggerOnce: true });
  const { data: config } = usePlatformConfig();
  
  const extraShareFee = config?.drop_entry_fee || 5000;
  const membershipFee = config?.membership_fee || 5000;
  const payout = config?.drop_target_amount || 10000;

  const steps = [
    { 
      icon: <Wallet className="h-5 w-5" />, 
      step: 'Step 1', 
      title: 'Activate an ad share', 
      description: `Pay ₦${membershipFee.toLocaleString()} once to start your first campaign.`, 
      isActive: true 
    },
    { 
      icon: <Users className="h-5 w-5" />, 
      step: 'Step 2', 
      title: 'Pick a picture every day', 
      description: 'About 15 minutes a day. Your campaign fills up as you go.', 
      isActive: false 
    },
    { 
      icon: <Coins className="h-5 w-5" />, 
      step: 'Step 3', 
      title: `Collect ₦${Number(payout).toLocaleString()}`, 
      description: 'Paid automatically once your campaign hits 100%.', 
      isActive: false 
    },
    { 
      icon: <PackagePlus className="h-5 w-5" />, 
      step: 'Step 4', 
      title: 'Activate another share', 
      description: `Want more payouts? Start a new ad share for ₦${Number(extraShareFee).toLocaleString()}.`, 
      isActive: false 
    },
  ];

  return (
    <section ref={ref} className="py-12 lg:py-20 px-4 bg-muted/30">
      <div className="max-w-lg md:max-w-4xl lg:max-w-5xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={inView ? { opacity: 1, y: 0 } : {}} 
          transition={{ duration: 0.5 }} 
          className="text-center mb-8 lg:mb-12"
        >
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-3">How ad shares work</h2>
          <p className="text-muted-foreground lg:text-lg">4 simple steps to start earning</p>
        </motion.div>

        <div className="relative space-y-0 md:grid md:grid-cols-4 md:gap-6 lg:gap-8">
          {steps.map((step, index) => (
            <TimelineStep 
              key={index} 
              {...step} 
              delay={0.1 * (index + 1)} 
              inView={inView} 
              isLast={index === steps.length - 1} 
            />
          ))}
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={inView ? { opacity: 1, y: 0 } : {}} 
          transition={{ duration: 0.5, delay: 0.6 }} 
          className="mt-6 lg:mt-10 p-4 lg:p-6 bg-primary/5 border border-primary/20 rounded-xl max-w-xl mx-auto"
        >
          <div className="flex items-start gap-3">
            <Eye className="h-5 w-5 lg:h-6 lg:w-6 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground text-sm lg:text-base">Watch your campaign live</p>
              <p className="text-xs lg:text-sm text-muted-foreground mt-1">
                See your campaign progress from 0 to 100% in real-time on your dashboard.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
