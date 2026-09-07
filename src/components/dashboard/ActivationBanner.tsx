import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { CountUp } from '@/components/ui/count-up';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import { AudioExplainerPlayer } from '@/components/AudioExplainerPlayer';
import { 
  Zap, 
  ChevronDown, 
  Wallet, 
  TrendingUp,
  ShieldCheck,
  Crown,
  ArrowRight,
  HelpCircle,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMembershipPaymentLoading } from '@/lib/startMembershipPayment';

interface ActivationBannerProps {
  onActivate: () => void;
  membershipFee: number;
  isLegacyMember?: boolean;
}

// FAQ builder function to use dynamic config values
const buildFaqs = (profitAmount: number) => [
  {
    question: "How much can I really make?",
    answer: `Every campaign your share finishes pays you ₦${profitAmount.toLocaleString()}. And here's the magic — you can activate another share right after, so you keep earning ₦${profitAmount.toLocaleString()} again and again. One payment, lifetime earnings.`
  },
  {
    question: "Is this a Ponzi scheme?",
    answer: "No way! Companies pay Viketa to find out which advert picture people like better. You pick a picture each day, your campaign fills up, and your share pays when it reaches 100%. Nothing hidden, nothing shady."
  },
  {
    question: "How long does a campaign take?",
    answer: "Most campaigns reach 100% in about 3-5 days. Tell a friend about Viketa to help your campaign move faster — plus you earn a bonus when they activate!"
  }
];

export function ActivationBanner({ onActivate, membershipFee, isLegacyMember = false }: ActivationBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { data: config } = usePlatformConfig();
  const paying = useMembershipPaymentLoading();

  // Get dynamic values from config
  const profitAmount = config?.drop_profit_amount || 900;
  const faqs = buildFaqs(profitAmount);

  return (
    <div className="space-y-3">
      {/* Main Activation Button - Always Visible */}
      <Card className="overflow-hidden border-primary/30 bg-gradient-to-r from-primary/5 via-background to-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            {/* Icon */}
            <div className="shrink-0 p-2.5 rounded-xl bg-primary/10">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            
            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground text-sm">
                {isLegacyMember ? 'Activate Your Share' : 'Start Earning Money'}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                Pay ₦{membershipFee.toLocaleString()} once • Earn forever
              </p>
            </div>
            
            {/* Button with pulse animation */}
            <motion.div
              animate={{ 
                scale: [1, 1.05, 1],
                boxShadow: [
                  '0 0 0 0 hsl(var(--primary) / 0)',
                  '0 0 0 8px hsl(var(--primary) / 0.15)',
                  '0 0 0 0 hsl(var(--primary) / 0)'
                ]
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="shrink-0 rounded-md"
            >
              <Button 
                onClick={onActivate}
                size="sm"
                disabled={paying}
                className="gap-1.5 font-semibold"
              >
                {paying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Starting…</span>
                  </>
                ) : (
                  <>
                    <span>Activate</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </motion.div>
          </div>
        </CardContent>
      </Card>

      {/* Expandable "How It Works" Section */}
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <HelpCircle className="h-4 w-4" />
            <span>{isExpanded ? 'Hide' : 'How does this work?'}</span>
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="h-4 w-4" />
            </motion.div>
          </button>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="overflow-hidden border-border/50 bg-gradient-to-br from-background via-background to-muted/20 mt-2">
                  <CardContent className="p-0">
                    {/* Header */}
                    <div className="p-4 pb-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="p-1.5 rounded-lg bg-primary/10">
                          <Zap className="h-4 w-4 text-primary" />
                        </div>
                        <h2 className="font-semibold text-base">How Viketa Works</h2>
                      </div>
                      <p className="text-xs text-muted-foreground ml-8">Ad share campaigns • Real companies • Real money</p>
                    </div>

                    {/* Audio Explainer */}
                    <div className="px-4 pt-4">
                      <AudioExplainerPlayer 
                        variant="default"
                        title="Listen to Explanation"
                        subtitle="Tap to hear how Viketa works"
                        trackingSource="how_it_works_collapsible"
                      />
                    </div>

                    {/* How It Works - Styled Sentence with Staggered Animation */}
                    <div className="px-4 py-5">
                      <div className="text-center space-y-3">
                        <motion.p 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4, delay: 0.1 }}
                          className="text-base leading-relaxed text-foreground"
                        >
                          <span className="font-medium">Pay </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                            <Wallet className="h-3.5 w-3.5" />
                            ₦{membershipFee.toLocaleString()}
                          </span>
                          <span className="font-medium"> once.</span>
                        </motion.p>
                        
                        <motion.p 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4, delay: 0.3 }}
                          className="text-base leading-relaxed text-foreground"
                        >
                          <span className="text-muted-foreground">As </span>
                          <span className="font-semibold text-emerald-500">your campaign moves towards 100%</span>
                          <span className="text-muted-foreground">, your share fills up.</span>
                        </motion.p>
                        
                        <motion.p 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4, delay: 0.5 }}
                          className="text-base leading-relaxed text-foreground"
                        >
                          <span className="text-muted-foreground">You collect </span>
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30">
                            <span className="text-lg font-bold text-amber-500">₦{profitAmount.toLocaleString()}</span>
                            <span className="text-xs text-amber-600/80">profit</span>
                          </span>
                        </motion.p>
                        
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4, delay: 0.7 }}
                          className="pt-2"
                        >
                          <p className="text-sm text-muted-foreground italic">
                            ↻ Activate another share and join a new campaign — <span className="font-medium text-foreground">as many times as you like.</span>
                          </p>
                        </motion.div>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="h-px bg-border/50 mx-4" />

                    {/* Legacy Member VIP Price (ONLY for legacy members) */}
                    {isLegacyMember && (
                      <div className="p-4">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-success/10 to-success/5 border border-success/30">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="p-1.5 rounded-full bg-success/20">
                              <Crown className="h-4 w-4 text-success" />
                            </div>
                            <p className="text-sm font-bold text-success">Early Supporter Bonus</p>
                          </div>
                          
                          <div className="bg-background/60 rounded-lg p-3">
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span className="text-muted-foreground">New users pay:</span>
                              <span className="line-through text-muted-foreground">₦{(membershipFee * 2).toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">You pay today:</span>
                              <span className="text-lg font-bold text-success">₦{membershipFee.toLocaleString()}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                              You already paid your membership. No need to pay again!
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* What This Could Mean For You */}
                    <div className="p-4 pt-0">
                      <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20">
                        <div className="flex items-center gap-2 mb-3">
                          <TrendingUp className="h-4 w-4 text-amber-500" />
                          <p className="text-xs font-semibold text-foreground">What This Means For Your Pocket:</p>
                        </div>
                        
                        {/* Earnings projections */}
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <div className="text-center p-2 rounded-lg bg-background/60 border border-border/50">
                            <p className="text-[10px] text-muted-foreground">5 campaigns</p>
                            <p className="text-sm font-bold text-amber-500">
                              <CountUp end={profitAmount * 5} prefix="₦" duration={1200} />
                            </p>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-background/60 border border-border/50">
                            <p className="text-[10px] text-muted-foreground">10 campaigns</p>
                            <p className="text-sm font-bold text-amber-500">
                              <CountUp end={profitAmount * 10} prefix="₦" duration={1400} />
                            </p>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-background/60 border border-border/50">
                            <p className="text-[10px] text-muted-foreground">25 campaigns</p>
                            <p className="text-sm font-bold text-amber-500">
                              <CountUp end={profitAmount * 25} prefix="₦" duration={1600} />
                            </p>
                          </div>
                        </div>
                        
                        {/* Aspirational statement */}
                        <div className="bg-amber-500/10 rounded-lg p-3 border border-amber-500/20 text-center">
                          <p className="text-sm font-medium text-foreground">
                            Imagine ₦{(profitAmount * 12).toLocaleString()}+ hitting your wallet daily...
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            That's the power of Ad Share Campaigns
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="h-px bg-border/50 mx-4" />

                    {/* FAQs Section */}
                    <div className="p-4">
                      <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Quick Questions
                      </p>
                      
                      <Accordion type="single" collapsible className="space-y-2">
                        {faqs.map((faq, index) => (
                          <AccordionItem 
                            key={index} 
                            value={`faq-${index}`}
                            className="border border-border/50 rounded-xl px-3 data-[state=open]:bg-muted/30"
                          >
                            <AccordionTrigger className="text-sm font-medium py-3 hover:no-underline">
                              {faq.question}
                            </AccordionTrigger>
                            <AccordionContent className="text-sm text-muted-foreground pb-3">
                              {faq.answer}
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </div>

                    {/* Bottom CTA */}
                    <div className="p-4 pt-0">
                      <Button
                        onClick={onActivate}
                        disabled={paying}
                        className="w-full h-12 text-base font-semibold relative overflow-hidden group"
                      >
                        {/* Shimmer effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                        
                        <div className="relative flex items-center justify-center gap-2">
                          {paying ? (
                            <>
                              <Loader2 className="h-5 w-5 animate-spin" />
                              <span>Starting payment…</span>
                            </>
                          ) : (
                            <>
                              <Zap className="h-5 w-5" />
                              <span>{isLegacyMember ? 'Activate My Share' : 'Activate Membership'}</span>
                              <ArrowRight className="h-4 w-4" />
                            </>
                          )}
                        </div>
                      </Button>
                      
                      <div className="flex items-center justify-center gap-2 mt-2 text-xs text-muted-foreground">
                        <span>₦{membershipFee.toLocaleString()} one-time</span>
                        <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
                        <span>{isLegacyMember ? 'Start earning now' : 'Lifetime access'}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
