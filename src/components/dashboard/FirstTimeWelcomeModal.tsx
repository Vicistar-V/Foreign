import { useEffect, useRef } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { CountUp } from '@/components/ui/count-up';
import { ArrowRight, Crown, Loader2 } from 'lucide-react';
import { trackClarityEvent, ClarityEvents } from '@/lib/clarityTracking';
import { motion } from 'framer-motion';
import { AudioExplainerPlayer } from '@/components/AudioExplainerPlayer';
import { useMembershipPaymentLoading } from '@/lib/startMembershipPayment';

interface FirstTimeWelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onActivate: () => void;
  isLegacyMember?: boolean;
  config: {
    membership_fee: number;
    drop_entry_fee: number;
    drop_profit_amount: number;
  } | null;
}

// No localStorage - modal shows every session for non-members

// Subtle warm ambient background - no green
const AmbientBackground = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {/* Warm amber glow - top right */}
    <motion.div
      className="absolute w-72 h-72 rounded-full bg-gradient-to-br from-amber-500/15 to-orange-500/5 blur-3xl"
      animate={{
        x: [0, 30, 0],
        y: [0, -20, 0],
        scale: [1, 1.1, 1],
      }}
      transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      style={{ top: '-20%', right: '-20%' }}
    />
    {/* Warm orange glow - bottom left */}
    <motion.div
      className="absolute w-64 h-64 rounded-full bg-gradient-to-tr from-orange-500/10 to-amber-400/5 blur-3xl"
      animate={{
        x: [0, -30, 0],
        y: [0, 30, 0],
        scale: [1, 1.15, 1],
      }}
      transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      style={{ bottom: '-10%', left: '-15%' }}
    />
  </div>
);

// Animated money flow visualization - Compact and dynamic
const MoneyFlowVisual = () => {
  return (
    <div className="relative h-20 flex items-center justify-center overflow-hidden">
      {/* Animated gradient background layer */}
      <motion.div 
        className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-orange-500/10 to-amber-500/5 rounded-xl"
        animate={{ 
          opacity: [0.3, 0.6, 0.3],
          scale: [1, 1.02, 1],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />
      
      {/* The flowing line */}
      <div className="absolute w-full h-1 bg-gradient-to-r from-transparent via-amber-400/40 to-transparent rounded-full" />
      
      {/* Flowing particles - smaller */}
      {[0, 1, 2, 3].map((i) => (
        <motion.div
          key={i}
          className="absolute h-2 w-2 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg"
          style={{ boxShadow: '0 0 8px rgba(251, 191, 36, 0.5)' }}
          animate={{ 
            left: ['-5%', '105%'],
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            delay: i * 0.6,
            ease: 'linear',
          }}
        />
      ))}
      
      {/* Center icon - compact */}
      <div className="relative z-10">
        {/* Animated glow backdrop */}
        <motion.div
          className="absolute -inset-2 rounded-xl bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-yellow-500/20 blur-lg"
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        />
        
        {/* Main icon container */}
        <motion.div
          className="relative h-12 w-12 rounded-xl flex items-center justify-center overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 50%, #dc2626 100%)',
            boxShadow: '0 4px 20px rgba(245, 158, 11, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
          }}
          animate={{ scale: [1, 1.03, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          {/* Inner shine effect */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-transparent"
            animate={{ opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          />
          
          {/* Naira symbol */}
          <span className="relative z-10 text-xl font-black text-white drop-shadow-md">₦</span>
        </motion.div>
        
        {/* Single pulse ring */}
        <motion.div
          className="absolute inset-0 rounded-xl border border-amber-400/50"
          style={{ width: '48px', height: '48px' }}
          animate={{ scale: [1, 1.4], opacity: [0.5, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
};

// Compact stat card
const StatCard = ({ value, label }: { value: string; label: string }) => (
  <div className="flex-1 text-center p-2 rounded-lg bg-card/50 border border-border/50 backdrop-blur-sm">
    <div className="text-base font-bold text-foreground">{value}</div>
    <div className="text-[10px] text-muted-foreground">{label}</div>
  </div>
);

export const FirstTimeWelcomeModal = ({ 
  isOpen, 
  onClose, 
  onActivate,
  isLegacyMember = false,
  config 
}: FirstTimeWelcomeModalProps) => {
  const isMobile = useIsMobile();
  const hasTracked = useRef(false);
  const paying = useMembershipPaymentLoading();

  useEffect(() => {
    if (isOpen && !hasTracked.current) {
      trackClarityEvent(ClarityEvents.WELCOME_MODAL_SHOWN);
      hasTracked.current = true;
    }
  }, [isOpen]);

  const handleSkip = () => {
    trackClarityEvent(ClarityEvents.WELCOME_SKIPPED);
    onClose();
  };

  const handleActivate = () => {
    trackClarityEvent(ClarityEvents.WELCOME_CTA_CLICKED);
    trackClarityEvent(ClarityEvents.WELCOME_COMPLETED);
    onActivate();
  };

  // Scrollable content section (header + body)
  const scrollableContent = (
    <>
      {/* Audio Explainer - Visible at the top */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-4"
      >
        <AudioExplainerPlayer 
          variant="compact"
          title="Hear How Viketa Works"
          subtitle="Tap to listen (1 min)"
          trackingSource="welcome_modal"
        />
      </motion.div>

      {/* Header */}
      <motion.div 
        className="text-center mb-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <motion.div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-3"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <motion.div
            className="h-2 w-2 rounded-full bg-primary"
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
          <span className="text-xs font-medium text-primary">Campaigns are live now</span>
        </motion.div>
        
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">
          One Payment. <span className="text-primary">Earn Forever.</span>
        </h1>
        <p className="text-muted-foreground text-sm">
          A lifetime investment that keeps paying you
        </p>
      </motion.div>

      {/* Visual - compact */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="mb-3"
      >
        <MoneyFlowVisual />
      </motion.div>

      {/* Stats - compact */}
      <motion.div 
        className="flex gap-2 mb-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <StatCard value={`₦${(config?.drop_entry_fee ?? 1000).toLocaleString()}`} label="You Pay" />
        <StatCard value="Wait" label="Campaign Fills" />
        <StatCard value={`₦${(config?.drop_profit_amount ?? 900).toLocaleString()}`} label="You Earn" />
      </motion.div>

      {/* How it works - compact */}
      <motion.div
        className="space-y-2"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        {/* The forever explanation */}
        <div className="rounded-xl bg-card/60 border border-border/50 backdrop-blur-sm p-3">
          <div className="flex items-center gap-2">
            <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <motion.span
                className="text-sm"
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              >
                ♾️
              </motion.span>
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-foreground">
                Your money rejoins a new campaign automatically — forever and ever
              </p>
              <p className="text-[10px] text-muted-foreground">
                One-time ₦{(config?.drop_entry_fee ?? 1000).toLocaleString()}, earnings for life
              </p>
            </div>
          </div>
        </div>

        {/* Legacy Member Bonus - Only for existing members without spots */}
        {isLegacyMember && (
          <div className="rounded-xl bg-success/10 border border-success/30 p-3 mb-2">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-full bg-success/20">
                <Crown className="h-4 w-4 text-success" />
              </div>
              <p className="text-sm font-bold text-success">Early Supporter Bonus</p>
            </div>
            
            {/* Price Comparison */}
            <div className="bg-background/60 rounded-lg p-2.5">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-muted-foreground">New users pay:</span>
                <span className="line-through text-muted-foreground">₦{((config?.membership_fee ?? 5000) * 2).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">You pay today:</span>
                <span className="text-base font-bold text-success">₦{(config?.membership_fee ?? 5000).toLocaleString()}</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">
                You already paid your membership. No need to pay again!
              </p>
            </div>
          </div>
        )}

        {/* Earnings projections - reframed */}
        <div className="rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20 p-3">
          <p className="text-[10px] text-muted-foreground mb-2 text-center">See what your wallet could look like:</p>
          <div className="grid grid-cols-3 gap-1.5 text-center">
            <div className="p-1.5 rounded-lg bg-background/50">
              <p className="text-[10px] text-muted-foreground">5 campaigns</p>
              <p className="text-xs font-bold text-amber-500">
                <CountUp end={(config?.drop_profit_amount ?? 900) * 5} prefix="₦" duration={1200} />
              </p>
            </div>
            <div className="p-1.5 rounded-lg bg-background/50">
              <p className="text-[10px] text-muted-foreground">15 campaigns</p>
              <p className="text-xs font-bold text-amber-500">
                <CountUp end={(config?.drop_profit_amount ?? 900) * 15} prefix="₦" duration={1400} />
              </p>
            </div>
            <div className="p-1.5 rounded-lg bg-background/50">
              <p className="text-[10px] text-muted-foreground">30 campaigns</p>
              <p className="text-xs font-bold text-amber-500">
                <CountUp end={(config?.drop_profit_amount ?? 900) * 30} prefix="₦" duration={1600} />
              </p>
            </div>
          </div>
          {/* Aspirational */}
          <div className="mt-2 p-2 rounded-lg bg-amber-500/10 text-center">
            <p className="text-xs font-medium text-foreground">
              Picture ₦{((config?.drop_profit_amount ?? 900) * 10).toLocaleString()}+ landing in your account every single day 💸
            </p>
          </div>
        </div>
      </motion.div>
    </>
  );

  // Fixed footer with CTA buttons
  const footerContent = (
    <motion.div
      className="space-y-2"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
    >
      {/* Main CTA */}
      <Button
        onClick={handleActivate}
        disabled={paying}
        className="w-full h-12 text-sm font-semibold bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg shadow-primary/25 rounded-xl group disabled:opacity-80"
        haptic="heavy"
      >
        {paying ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            <span>Starting payment…</span>
          </>
        ) : (
          <>
            <span>Activate your share for ₦{(config?.membership_fee ?? 5000).toLocaleString()}</span>
            <motion.div
              className="ml-2"
              animate={{ x: [0, 4, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <ArrowRight className="h-4 w-4" />
            </motion.div>
          </>
        )}
      </Button>

      {/* Skip link */}
      <button
        onClick={handleSkip}
        className="w-full py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        Maybe later
      </button>

      {/* Trust indicator */}
      <p className="text-center text-[10px] text-muted-foreground/70">
        Lifetime investment • Earn forever and ever • Withdraw anytime
      </p>
    </motion.div>
  );

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && handleSkip()}>
        <DrawerContent className="h-[95dvh] max-h-[95dvh] bg-background border-t border-border/30 flex flex-col">
          {/* Subtle warm ambient background */}
          <AmbientBackground />
          
          {/* Scrollable content area - fills available space */}
          <div className="relative z-10 flex-1 min-h-0 overflow-y-auto px-5 pt-4 pb-2">
            {scrollableContent}
          </div>
          
          {/* Fixed footer with CTA */}
          <div className="relative z-10 flex-shrink-0 px-5 pb-6 pt-3 border-t border-border/30 bg-background">
            {footerContent}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleSkip()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-background border-border/30">
        <div className="relative flex flex-col">
          {/* Subtle warm ambient background */}
          <AmbientBackground />
          
          {/* Content */}
          <div className="relative z-10 px-5 py-6 sm:p-8">
            {scrollableContent}
            <div className="mt-4">
              {footerContent}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
