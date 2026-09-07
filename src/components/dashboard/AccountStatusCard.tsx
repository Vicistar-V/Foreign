import { useEffect, useRef, useState } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import { useWhatsAppGroupLink } from '@/hooks/useWhatsAppGroupLink';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

import { 
  CheckCircle2, 
  Clock, 
  CreditCard,
  HelpCircle,
  Shield,
  RefreshCw,
  Target,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Users,
  Loader2
} from 'lucide-react';
import { startMembershipPayment, useMembershipPaymentLoading } from '@/lib/startMembershipPayment';
import { AudioExplainerPlayer } from '@/components/AudioExplainerPlayer';
import { WhatsAppGroupPromo } from '@/components/WhatsAppGroupPromo';
import { trackClarityEvent, ClarityEvents } from '@/lib/clarityTracking';

// Retirement Economy guide (grandma-friendly).
// FLAT PRICING: every ad share costs the same. All money numbers come from
// platform settings — never hardcode a price here.
const buildGuideItems = (opts: {
  sharePrice: number;
  payout: number;
  inviteBonus: number;
}) => {
  const price = `₦${opts.sharePrice.toLocaleString()}`;
  const payout = `₦${opts.payout.toLocaleString()}`;
  const bonus = `₦${opts.inviteBonus.toLocaleString()}`;

  return [
    {
      id: 'how-it-works',
      icon: HelpCircle,
      title: 'How Does This Work?',
      content: `Companies pay Viketa to find out which advert picture people like better.

You pay ${price} once to activate an ad share and join a campaign. Every day you pick the picture you like better. When your campaign reaches 100%, that share pays you a full ${payout} in one lump sum.

After it pays, that share is finished. To keep earning, activate another share — same ${price} price as the first one.`,
    },
    {
      id: 'guaranteed-payout',
      icon: Shield,
      title: 'Is My Payout Guaranteed?',
      content: `Yes! This is simple math, not luck.

When your campaign reaches 100% = your share pays ${payout}. Period.

You can see exactly how far your campaign has filled. No surprises, no odds, no gambling.`,
    },
    {
      id: 'one-time-membership',
      icon: CreditCard,
      title: `One Price For Every Share: ${price}`,
      content: `Your first ad share costs ${price}. Every extra share costs the same ${price}.

No discounts, no packages, no small print. Whatever you put in, that share doubles it.

1 share = ${price} in, ${payout} out. 3 shares = ₦${(opts.sharePrice * 3).toLocaleString()} in, ₦${(opts.payout * 3).toLocaleString()} out.`,
    },
    {
      id: 'smart-strategy',
      icon: RefreshCw,
      title: 'How Do I Earn More?',
      content: `Here's the smart strategy:

1. Join with ${price} → 1 ad share → ${payout} payout target
2. Do the daily picture rating to fill your pending balance
3. When your campaign hits 100%, ${payout} lands in your wallet
4. Activate another share for ${price} to keep earning

Tell a friend = your campaign fills faster + you earn ${bonus} the moment they activate a share.`,
    },
    {
      id: 'what-you-earn',
      icon: Target,
      title: 'What Can I Earn?',
      content: `Each ad share pays you ${payout} when its campaign reaches 100%.

• 1 share = ${payout} payout
• 2 shares = ₦${(opts.payout * 2).toLocaleString()} payout
• 5 shares = ₦${(opts.payout * 5).toLocaleString()} payout

The more shares you own, the bigger your total payout.`,
    },
    {
      id: 'summary',
      icon: AlertCircle,
      title: 'Quick Summary',
      content: `• Every ad share: ${price} (first one and every one after)
• Payout per share: ${payout} lump sum
• Invite bonus: ${bonus} for every share your friend activates
• Withdrawals: Instant — take your money anytime`,
    },
  ];
};

export const AccountStatusCard = () => {
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const { data: config } = usePlatformConfig();
  const whatsappGroup = useWhatsAppGroupLink();
  
  const [hasTrackedView, setHasTrackedView] = useState(false);
  const [showAllGuide, setShowAllGuide] = useState(false);
  const [hasTrackedGuideExpand, setHasTrackedGuideExpand] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Track card view when it becomes visible
  useEffect(() => {
    if (!hasTrackedView && profile && !profile.is_member && cardRef.current) {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            trackClarityEvent(ClarityEvents.ACTIVATION_CARD_VIEWED);
            trackClarityEvent(ClarityEvents.ACTIVATION_SOCIAL_PROOF_VIEWED);
            setHasTrackedView(true);
          }
        },
        { threshold: 0.5 }
      );
      observer.observe(cardRef.current);
      return () => observer.disconnect();
    }
  }, [hasTrackedView, profile]);

  if (!profile) return null;

  const isMember = profile.is_member;
  const membershipFee = config?.membership_fee || 5000;

  const handleActivateClick = () => {
    trackClarityEvent(ClarityEvents.ACTIVATION_CARD_CLICKED);
    startMembershipPayment(membershipFee);
  };

  const handleShowMoreGuide = () => {
    if (!hasTrackedGuideExpand) {
      trackClarityEvent(ClarityEvents.ACTIVATION_GUIDE_EXPANDED);
      setHasTrackedGuideExpand(true);
    }
    setShowAllGuide(true);
  };

  const handleGuideItemClick = () => {
    trackClarityEvent(ClarityEvents.ACTIVATION_GUIDE_ITEM_CLICKED);
  };

  // Show first 2 items by default, all when expanded
  const guideItems = buildGuideItems({
    sharePrice: membershipFee,
    payout: config?.drop_target_amount || 10000,
    inviteBonus: config?.referral_bonus || 1000,
  });
  const visibleGuideItems = showAllGuide ? guideItems : guideItems.slice(0, 2);

  // MEMBER VIEW - Simple success state
  if (isMember) {
    return (
      <Card className="border-l-4 border-l-success bg-success/5">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <div className="h-10 w-10 rounded-full bg-success/20 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-semibold text-foreground">Account Activated</h3>
                <span className="text-xs bg-success/20 text-success px-2 py-0.5 rounded-full font-medium">
                  Active Member
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Your ad share is active — start rating pictures and earning!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // NON-MEMBER VIEW - V4 The Viketa Line messaging
  return (
    <>
      <div ref={cardRef}>
        <Card className="overflow-hidden border border-border/50 shadow-sm bg-card">
          <CardContent className="p-0">

            {/* Main Content */}
            <div className="p-4 space-y-4">
              {/* V4: The Viketa Line value prop */}
              <div className="bg-primary/10 rounded-xl p-4 border border-primary/20 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Users className="h-5 w-5 text-primary" />
                  <p className="text-lg font-bold text-primary">Ad Share Campaigns</p>
                </div>
                <p className="text-sm text-foreground font-medium">
                  Pay ₦{membershipFee.toLocaleString()} → Get ₦{(config?.drop_target_amount || 10000).toLocaleString()} when your campaign reaches 100%
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Guaranteed lump-sum payout. No luck needed.
                </p>
              </div>

              {/* Audio Explainer Player */}
              <AudioExplainerPlayer 
                title="Listen: How It Works"
                subtitle="Tap play to hear the explanation"
                trackingSource="account_status_card"
              />

              {/* How This Platform Works - Inline Guide */}
              <div className="bg-muted/30 rounded-xl border border-border/30 overflow-hidden">
                <div className="px-3 py-2.5 border-b border-border/30 flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-primary" />
                  <p className="text-sm font-medium text-foreground">How Ad Share Campaigns Work</p>
                </div>
                
                <Accordion type="single" collapsible className="w-full">
                  {visibleGuideItems.map((item) => (
                    <AccordionItem key={item.id} value={item.id} className="border-border/30 last:border-b-0">
                      <AccordionTrigger 
                        className="text-sm py-2.5 px-3 hover:no-underline"
                        onClick={handleGuideItemClick}
                      >
                        <div className="flex items-center gap-2 text-left">
                          <item.icon className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="text-xs">{item.title}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed pb-3 px-3 pl-8">
                        {item.content}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>

                {/* Show More Button */}
                {!showAllGuide && (
                  <button
                    onClick={handleShowMoreGuide}
                    className="w-full py-2 px-3 text-xs text-primary font-medium flex items-center justify-center gap-1 border-t border-border/30 hover:bg-muted/50 transition-colors"
                  >
                    Show More Information
                    <ChevronDown className="h-3 w-3" />
                  </button>
                )}
                
                {showAllGuide && (
                  <button
                    onClick={() => setShowAllGuide(false)}
                    className="w-full py-2 px-3 text-xs text-muted-foreground font-medium flex items-center justify-center gap-1 border-t border-border/30 hover:bg-muted/50 transition-colors"
                  >
                    Show Less
                    <ChevronUp className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Trust Badges Row - Subtle */}
              <div className="flex items-center justify-center gap-4 py-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Secure</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Transparent</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Guaranteed</span>
                </div>
              </div>

              {/* WhatsApp Group Promo - admin-toggleable */}
              {whatsappGroup.showPromo && (
                <WhatsAppGroupPromo 
                  link={whatsappGroup.link!} 
                />
              )}

              {/* CTA Button - Simple and clean */}
              <ActivateCTA
                onClick={handleActivateClick}
                disabled={!!config?.maintenance_mode}
                fee={membershipFee}
                maintenance={!!config?.maintenance_mode}
              />

              {/* Trust Line - Short */}
              <p className="text-center text-xs text-muted-foreground">
                One-time only. No subscription.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>


    </>
  );
};

function ActivateCTA({
  onClick,
  disabled,
  fee,
  maintenance,
}: {
  onClick: () => void;
  disabled: boolean;
  fee: number;
  maintenance: boolean;
}) {
  const paying = useMembershipPaymentLoading();
  return (
    <Button
      onClick={onClick}
      className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg"
      disabled={disabled || paying}
      haptic="heavy"
    >
      {paying ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Starting payment…
        </span>
      ) : maintenance ? (
        'Under Maintenance'
      ) : (
        `Activate - ₦${fee.toLocaleString()}`
      )}
    </Button>
  );
}