import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Link } from 'react-router-dom';
import { trackClarityEvent, ClarityEvents } from '@/lib/clarityTracking';
import { PublicHeader } from '@/components/PublicHeader';
import { PageSEO } from '@/components/PageSEO';
import HowItWorksStructuredData from '@/components/HowItWorksStructuredData';
import { LandingFooter, FAQSection, EarningBatchesSection } from '@/components/landing';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/useAuth';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import {
  Users,
  CheckCircle,
  ArrowRight,
  TrendingUp,
  Wallet,
  UserPlus,
  Zap,
  HelpCircle,
  CircleDollarSign,
  RefreshCw,
  Coins,
  Gift,
  Share2,
} from 'lucide-react';
import { ExplainerVideo } from '@/components/ExplainerVideo';

// Hero Section
const HeroSection = () => {
  const [ref, inView] = useInView({ threshold: 0.1, triggerOnce: true });
  const { data: config } = usePlatformConfig();
  const profitPerCycle = config?.drop_profit_amount || 900;
  const referralPerCycle = config?.drop_referral_per_cycle || 20;

  return (
    <section ref={ref} className="py-12 px-4 bg-gradient-to-b from-primary/5 to-background">
      <div className="max-w-lg mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
        >
          <Badge variant="outline" className="mb-4 px-4 py-1.5 text-sm">
            <HelpCircle className="h-3.5 w-3.5 mr-1.5" />
            Simple Guide
          </Badge>
          
          <h1 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
            How Viketa Ad Shares Work
          </h1>
          
          <p className="text-lg text-muted-foreground mb-6 max-w-md mx-auto">
            Activate a share, pick a picture daily, get paid
          </p>

          {/* Stats */}
          <div className="flex flex-wrap justify-center gap-3 mb-6">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-success/10 text-success rounded-full text-sm font-medium">
              <CircleDollarSign className="h-4 w-4" />
              <span>₦{profitPerCycle.toLocaleString()} per share</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium">
              <Users className="h-4 w-4" />
              <span>₦{referralPerCycle.toLocaleString()} per friend invited</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-secondary-foreground rounded-full text-sm font-medium">
              <RefreshCw className="h-4 w-4" />
              <span>Activate another anytime</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

// The Viketa Line Flow - 4 Steps
const ViketaLineFlowSection = () => {
  const [ref, inView] = useInView({ threshold: 0.1, triggerOnce: true });
  const { data: config } = usePlatformConfig();
  
  const entryFee = config?.drop_entry_fee || 5000;
  const activationFee = config?.membership_fee || 5000;
  const profitAmount = config?.drop_profit_amount || 900;

  const steps = [
    {
      step: 1,
      icon: Wallet,
      title: "Pay ₦" + activationFee.toLocaleString(),
      description: "One-time activation. ₦" + entryFee.toLocaleString() + " activates your ad share, the rest covers platform costs.",
      badge: "Entry",
      color: "primary",
    },
    {
      step: 2,
      icon: Users,
      title: "Pick A Picture Daily",
      description: "About 15 minutes a day — pick which advert picture you like better",
      badge: "Daily",
      color: "caution",
    },
    {
      step: 3,
      icon: TrendingUp,
      title: "Earn ₦" + profitAmount.toLocaleString(),
      description: "Payout goes straight to your earnings wallet when your campaign hits 100%",
      badge: "Payout",
      color: "success",
    },
    {
      step: 4,
      icon: RefreshCw,
      title: "Activate Another Share",
      description: "Your finished share is done — activate a new one to keep earning",
      badge: "Optional",
      color: "primary",
    },
  ];

  return (
    <section ref={ref} className="py-12 px-4">
      <div className="max-w-lg mx-auto">
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full text-primary text-sm font-medium mb-3">
            <Zap className="h-4 w-4" />
            Ad Shares
          </div>
          <h2 className="text-2xl font-bold mb-2">4 Simple Steps</h2>
          <p className="text-muted-foreground">This is how your ad share pays out</p>
        </motion.div>

        <div className="space-y-4">
          {steps.map((item, index) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, x: -20 }}
              animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ delay: index * 0.15 }}
            >
              <Card className="p-4 border-2 hover:border-primary/30 transition-colors">
                <div className="flex items-start gap-4">
                  <div className={`flex-shrink-0 w-12 h-12 rounded-xl bg-${item.color}/10 flex items-center justify-center`}>
                    <item.icon className={`h-6 w-6 text-${item.color}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-muted-foreground">STEP {item.step}</span>
                      <Badge variant="secondary" className="text-xs">
                        {item.badge}
                      </Badge>
                    </div>
                    <h3 className="font-semibold text-lg mb-1">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Arrow indicating cycle */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.7 }}
          className="flex justify-center mt-4"
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 text-primary" />
            <span>Activate as many shares as you want</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

// The Math Section
const TheMathSection = () => {
  const [ref, inView] = useInView({ threshold: 0.1, triggerOnce: true });
  const { data: config } = usePlatformConfig();

  const entryFee = config?.drop_entry_fee || 5000;
  const targetAmount = config?.drop_target_amount || 1500;
  const profitAmount = config?.drop_profit_amount || 900;
  const adminFee = config?.drop_admin_fee || 100;
  const reentryAmount = config?.drop_reentry_amount || 1000;

  return (
    <section ref={ref} className="py-12 px-4 bg-muted/30">
      <div className="max-w-lg mx-auto">
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-success/10 rounded-full text-success text-sm font-medium mb-3">
            <CircleDollarSign className="h-4 w-4" />
            The Math
          </div>
          <h2 className="text-2xl font-bold mb-2">Where Does The Money Go?</h2>
          <p className="text-muted-foreground">Transparent and simple</p>
        </motion.div>

        <Card className="p-5">
          <div className="space-y-4">
            {/* Input */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 0.1 }}
            >
              <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border border-primary/20">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">You Pay</span>
                </div>
                <span className="font-bold text-lg text-primary">₦{entryFee.toLocaleString()}</span>
              </div>
            </motion.div>

            <div className="flex justify-center">
              <ArrowRight className="h-5 w-5 text-muted-foreground rotate-90" />
            </div>

            {/* Queue fills */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center justify-between p-3 bg-caution/10 rounded-lg border border-caution/20">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-caution" />
                  <span className="text-sm font-medium">Your Campaign Reaches 100%</span>
                </div>
                <span className="font-bold text-lg text-caution">₦{(entryFee * 2).toLocaleString()}</span>
              </div>
            </motion.div>

            <div className="flex justify-center">
              <ArrowRight className="h-5 w-5 text-muted-foreground rotate-90" />
            </div>

            {/* Payout breakdown */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 0.3 }}
              className="space-y-2"
            >
              <div className="flex items-center justify-between p-3 bg-success/10 rounded-lg border border-success/20">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-success" />
                  <span className="text-sm font-medium">Your Profit</span>
                </div>
                <span className="font-bold text-lg text-success">₦{profitAmount.toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Reserved For Next Share</span>
                </div>
                <span className="font-medium">₦{reentryAmount.toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Platform Fee</span>
                </div>
                <span className="font-medium">₦{adminFee.toLocaleString()}</span>
              </div>
            </motion.div>

            <Separator />

            {/* Key insight */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 0.4 }}
              className="p-3 bg-gradient-to-r from-success/10 to-primary/10 rounded-lg"
            >
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-success">Your money keeps working</p>
                  <p className="text-sm text-muted-foreground">
                    When your campaign hits 100%, you earn ₦{profitAmount.toLocaleString()} and can activate a new share for ₦{reentryAmount.toLocaleString()} to keep earning
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </Card>
      </div>
    </section>
  );
};

// Example Earnings Section
const ExampleEarningsSection = () => {
  const [ref, inView] = useInView({ threshold: 0.1, triggerOnce: true });
  const { data: config } = usePlatformConfig();

  const profitAmount = config?.drop_profit_amount || 900;
  const referralPerCycle = config?.drop_referral_per_cycle || 20;

  const scenarios = [
    { cycles: 5, days: "~1 week", profit: profitAmount * 5 },
    { cycles: 15, days: "~2 weeks", profit: profitAmount * 15 },
    { cycles: 30, days: "~1 month", profit: profitAmount * 30 },
  ];

  return (
    <section ref={ref} className="py-12 px-4">
      <div className="max-w-lg mx-auto">
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-caution/10 rounded-full text-caution text-sm font-medium mb-3">
            <Gift className="h-4 w-4" />
            Example Earnings
          </div>
          <h2 className="text-2xl font-bold mb-2">What Could You Earn?</h2>
          <p className="text-muted-foreground">Based on ₦{profitAmount.toLocaleString()} per share</p>
        </motion.div>

        <div className="space-y-3">
          {scenarios.map((scenario, index) => (
            <motion.div
              key={scenario.cycles}
              initial={{ opacity: 0, y: 10 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{scenario.cycles} shares</p>
                    <p className="text-sm text-muted-foreground">{scenario.days}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-success">₦{scenario.profit.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">profit</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Referral bonus callout */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.4 }}
          className="mt-6 p-4 bg-primary/5 rounded-xl border border-primary/20"
        >
          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Plus Referral Royalties</p>
              <p className="text-sm text-muted-foreground">
                Earn ₦{referralPerCycle.toLocaleString()} every time a friend you invited completes their campaign.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

// Referral Section
const ReferralSection = () => {
  const [ref, inView] = useInView({ threshold: 0.1, triggerOnce: true });
  const { data: config } = usePlatformConfig();
  const referralPerCycle = config?.drop_referral_per_cycle || 20;

  return (
    <section ref={ref} className="py-12 px-4 bg-muted/30">
      <div className="max-w-lg mx-auto">
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-success/10 rounded-full text-success text-sm font-medium mb-3">
            <Share2 className="h-4 w-4" />
            Referral Royalties
          </div>
          <h2 className="text-2xl font-bold mb-2">Invite Friends, Earn More</h2>
          <p className="text-muted-foreground">No limit on how much you can earn</p>
        </motion.div>

        <Card className="p-5 border-2 border-success/20 bg-gradient-to-br from-success/5 to-transparent">
          <div className="text-center mb-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={inView ? { opacity: 1, scale: 1 } : {}}
              transition={{ delay: 0.1 }}
              className="p-4 bg-background rounded-xl inline-block"
            >
              <Coins className="h-8 w-8 text-success mx-auto mb-2" />
              <p className="text-3xl font-bold text-success">
                ₦{referralPerCycle.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">per friend's campaign</p>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ delay: 0.3 }}
          >
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-success" />
                <span>Friend activates an ad share with your link</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-success" />
                <span>Every time their campaign completes, you earn ₦{referralPerCycle.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-success" />
                <span>This applies to every friend you invite</span>
              </div>
            </div>

            <div className="p-3 bg-success/10 rounded-lg text-center">
              <p className="text-sm">
                <span className="font-semibold">Example:</span> 10 friends × 30 campaigns each = 
                <span className="text-success font-bold"> ₦{(referralPerCycle * 10 * 30).toLocaleString()}</span> extra income!
              </p>
            </div>
          </motion.div>
        </Card>
      </div>
    </section>
  );
};

// Final CTA Section
const FinalCTASection = () => {
  const [ref, inView] = useInView({ threshold: 0.1, triggerOnce: true });
  const { user } = useAuth();
  const { data: config } = usePlatformConfig();
  const profitAmount = config?.drop_profit_amount || 900;

  return (
    <section ref={ref} className="py-16 px-4">
      <div className="max-w-lg mx-auto">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary to-success flex items-center justify-center">
            <TrendingUp className="h-8 w-8 text-white" />
          </div>
          
          <h2 className="text-2xl font-bold mb-3">Ready to Start Earning?</h2>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
            Activate an ad share and earn ₦{profitAmount.toLocaleString()} when your campaign hits 100%
          </p>

          <div className="space-y-3">
            {user ? (
              <Button asChild size="lg" className="w-full gradient-primary h-12">
                <Link to="/dashboard">
                  Go to Dashboard
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild size="lg" className="w-full gradient-primary h-12">
                  <Link to="/signup">
                    I Want A Share
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <p className="text-sm text-muted-foreground">
                  Already have an account?{' '}
                  <Link to="/login" className="text-primary hover:underline font-medium">
                    Log in here
                  </Link>
                </p>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

// Main Page Component
const HowItWorks = () => {
  const { data: config } = usePlatformConfig();
  
  // Track page view
  useEffect(() => {
    trackClarityEvent(ClarityEvents.PAGE_VIEW_HOW_IT_WORKS);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <PageSEO
        title="How It Works - Viketa Ad Shares"
        description="Learn how Viketa ad shares work. Pay ₦5,000 once, pick a picture daily, earn ₦10,000 when your campaign hits 100%. Simple, fair, and transparent."
        path="/how-it-works"
        keywords="viketa, how it works, viketa ad share, earn money, extra income nigeria"
        image="/og-how-it-works.png"
      />
      <HowItWorksStructuredData 
        membershipFee={config?.membership_fee} 
        entryFee={config?.drop_entry_fee} 
      />
      <PublicHeader />
      
      <main className="pb-24 md:pb-8">
        <HeroSection />

        {/* 2-minute streaming explainer */}
        <section className="px-4 pt-2 pb-8">
          <div className="mx-auto max-w-[320px] sm:max-w-[360px]">
            <ExplainerVideo aspectClassName="aspect-[9/16]" />
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Watch the 2-minute story — it streams as it plays, no waiting.
            </p>
          </div>
        </section>

        {/* 4 Simple Steps section replaced by the explainer video above */}
        <EarningBatchesSection />
        <TheMathSection />
        <ExampleEarningsSection />
        <ReferralSection />
        <FAQSection />
        <FinalCTASection />
      </main>

      <LandingFooter />
    </div>
  );
};

export default HowItWorks;