import { useEffect, useRef } from 'react';
import { PublicHeader } from '@/components/PublicHeader';
import { PageSEO } from '@/components/PageSEO';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import {
  HeroSection,
  SocialProofBanner,
  LiveStatsTicker,
  HowItWorksSection,
  EarningBatchesSection,
  QuickSimulatorSection,
  RiskFreeSection,
  ChampionsShowcase,
  ComparisonSection,
  ReferralCalculator,
  TrustSection,
  VideoExplainerSection,
  PricingSection,
  FAQSection,
  FinalCTASection,
  LandingFooter,
  LandingStructuredData,
} from '@/components/landing';
import { trackClarityEvent, ClarityEvents, recordFunnelTiming, FunnelTimingKeys } from '@/lib/clarityTracking';

const Index = () => {
  const { data: config } = usePlatformConfig();
  const hasTrackedScroll50 = useRef(false);
  const hasTrackedScrollBottom = useRef(false);
  const hasTrackedTime30s = useRef(false);

  // Track page view and record funnel timing
  useEffect(() => {
    trackClarityEvent(ClarityEvents.PAGE_VIEW_LANDING);
    recordFunnelTiming(FunnelTimingKeys.FIRST_LANDING_TIME);
  }, []);

  // Scroll tracking for landing page
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollPercent = ((scrollTop + windowHeight) / documentHeight) * 100;
      
      if (scrollPercent > 50 && !hasTrackedScroll50.current) {
        trackClarityEvent(ClarityEvents.LANDING_SCROLL_50);
        hasTrackedScroll50.current = true;
      }
      if (scrollPercent > 90 && !hasTrackedScrollBottom.current) {
        trackClarityEvent(ClarityEvents.LANDING_SCROLL_BOTTOM);
        hasTrackedScrollBottom.current = true;
      }
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Time on page tracking
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hasTrackedTime30s.current) {
        trackClarityEvent(ClarityEvents.LANDING_TIME_30S);
        hasTrackedTime30s.current = true;
      }
    }, 30000);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className="min-h-screen bg-background">
      <PageSEO
        title="Viketa — Pay ₦5,000, Collect ₦10,000 | Ad Shares"
        description="Activate an ad share for ₦5,000, pick a picture daily, collect ₦10,000 when your campaign hits 100%. Real Nigerian earnings, real bank withdrawals."
        path="/"
        keywords="earn money Nigeria, make money online Nigeria, Viketa ad share, Viketa, rate adverts, pick a picture to earn"
      />
      <LandingStructuredData config={config} />
      <PublicHeader />

      {/* Hero — the promise */}
      <HeroSection />

      {/* Real-number ticker */}
      <SocialProofBanner />

      {/* Concrete stats */}
      <LiveStatsTicker />

      {/* 4-step retirement flow */}
      <HowItWorksSection />

      {/* Explainer video */}
      <VideoExplainerSection />

      {/* Tap → pending → payout → retire */}
      <EarningBatchesSection />

      {/* Interactive: one spot pays out */}
      <QuickSimulatorSection />

      {/* Own more spots math */}
      <RiskFreeSection />

      {/* Invite bonus leaderboard */}
      <ChampionsShowcase />

      {/* Invite calculator */}
      <ReferralCalculator />

      {/* Old way vs Viketa */}
      <ComparisonSection />

      {/* Trust & safety */}
      <TrustSection />

      {/* Pricing */}
      <PricingSection />

      {/* FAQ */}
      <FAQSection />

      {/* Final CTA */}
      <FinalCTASection />

      {/* Footer */}
      <LandingFooter />
    </div>
  );
};

export default Index;
