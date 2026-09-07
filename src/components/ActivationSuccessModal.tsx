import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { CheckCircle2, TrendingUp, Minus, Plus, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import { startExtensionPayment } from '@/lib/startExtensionPayment';
import { onboardingSkip } from '@/lib/onboardingSkip';
import { triggerHaptic } from '@/lib/haptics';
import { trackClarityEvent, ClarityEvents } from '@/lib/clarityTracking';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useBalances } from '@/hooks/useBalances';

interface ActivationSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** When true, CTA doesn't run real mutations — for admin sandbox preview. */
  mockMode?: boolean;
}

const ACTIVATION_SUCCESS_SEEN_KEY = 'viketa_activation_success_seen';

export const hasSeenActivationSuccess = (): boolean =>
  localStorage.getItem(ACTIVATION_SUCCESS_SEEN_KEY) === 'true';
export const markActivationSuccessSeen = (): void => {
  localStorage.setItem(ACTIVATION_SUCCESS_SEEN_KEY, 'true');
};
// Legacy
export const hasSeenWelcomeBonus = (): boolean =>
  localStorage.getItem('viketa_welcome_bonus_seen') === 'true' || hasSeenActivationSuccess();

const fireConfetti = () => {
  const end = Date.now() + 900;
  const colors = ['#10b981', '#f59e0b', '#ffffff', '#fb923c'];
  (function frame() {
    confetti({ particleCount: 4, angle: 60, spread: 60, origin: { x: 0, y: 0.3 }, colors, disableForReducedMotion: true });
    confetti({ particleCount: 4, angle: 120, spread: 60, origin: { x: 1, y: 0.3 }, colors, disableForReducedMotion: true });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
};

export const ActivationSuccessModal = ({ isOpen, onClose, mockMode = false }: ActivationSuccessModalProps) => {
  const navigate = useNavigate();
  const hasMarked = useRef(false);
  const { data: config } = usePlatformConfig();

  const payoutPerSpot = config?.drop_target_amount ?? 10000;
  const entryFee = config?.drop_entry_fee ?? 5000;
  const { user } = useAuth();
  const { data: balances } = useBalances(user?.id);
  const currentSpots = mockMode ? 1 : Math.max(1, balances?.active_spots_count ?? 1);
  const currentPayout = payoutPerSpot * currentSpots;

  // Default +3 spots. Persist so if user goes to the bank-transfer flow
  // and hits browser back, their selection is preserved.
  const QTY_KEY = 'viketa_activation_modal_qty';
  const [quantity, setQuantity] = useState<number>(() => {
    if (mockMode) return 3;
    const saved = Number(sessionStorage.getItem(QTY_KEY));
    return Number.isFinite(saved) && saved >= 1 ? Math.min(saved, 20) : 3;
  });
  const isPending = false;

  useEffect(() => {
    if (!mockMode) sessionStorage.setItem(QTY_KEY, String(quantity));
  }, [quantity, mockMode]);

  useEffect(() => {
    if (isOpen) {
      onboardingSkip.skipPin();
      onboardingSkip.skipAvatar();
      triggerHaptic('success');
      trackClarityEvent(ClarityEvents.WELCOME_MODAL_SHOWN);
      setTimeout(fireConfetti, 250);
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      // Push a dedicated history entry so the browser back button lands the
      // user right back on this screen (with saved qty) after they open the
      // payment drawer or any downstream page.
      if (!mockMode) {
        try {
          window.history.pushState({ activationSuccessModal: true }, '');
        } catch {}
      }

      return () => { document.body.style.overflow = prev; };
    }
  }, [isOpen, mockMode]);

  const markSeen = () => {
    if (!hasMarked.current) {
      markActivationSuccessSeen();
      hasMarked.current = true;
    }
  };

  const addedPayout = payoutPerSpot * quantity;
  const newTarget = currentPayout + addedPayout;
  const totalCost = entryFee * quantity;

  const MAX_QTY = 20;
  const dec = () => { triggerHaptic('light'); setQuantity(q => Math.max(1, q - 1)); };
  const inc = () => { triggerHaptic('light'); setQuantity(q => Math.min(MAX_QTY, q + 1)); };

  const clearSavedQty = () => {
    try { sessionStorage.removeItem(QTY_KEY); } catch {}
  };

  const finishAndGoToPin = () => {
    onboardingSkip.reset();
    clearSavedQty();
    onClose();
    navigate('/create-pin');
  };

  const handleConfirm = async () => {
    triggerHaptic('heavy');
    trackClarityEvent(ClarityEvents.WELCOME_CTA_CLICKED);

    if (mockMode) {
      toast({ title: 'Preview only', description: `Would add ${quantity} share${quantity>1?'s':''} · ₦${totalCost.toLocaleString()}` });
      markSeen();
      onClose();
      return;
    }

    // Route through start-payment so the backend decides the provider
    // (Moniepoint, Flutterwave, Paystack, etc.). No hardcoded drawer.
    await startExtensionPayment(totalCost, {
      quantity,
      onMoniepointSuccess: () => {
        markSeen();
        triggerHaptic('success');
        fireConfetti();
        toast({ title: 'Share activated', description: `You now have ${currentSpots + quantity} shares in this campaign` });
        setTimeout(finishAndGoToPin, 900);
      },
    });
  };

  const handleSkip = () => {
    markSeen();
    triggerHaptic('light');
    clearSavedQty();
    onboardingSkip.reset();
    onClose();
    setTimeout(() => navigate('/create-pin'), 100);
  };

  if (!isOpen) return null;

  const modal = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-background overflow-hidden"
      role="dialog"
      aria-modal="true"
    >
      {/* Ambient */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-success/15 blur-3xl" />
        <div className="absolute bottom-0 -left-24 w-64 h-64 rounded-full bg-amber-500/15 blur-3xl" />
      </div>

      <div className="relative h-full w-full flex flex-col px-5 pt-[max(env(safe-area-inset-top),0.75rem)] pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        {/* Success ribbon */}
        <div className="mx-auto flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1">
          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-success">
            Your share is active — you've joined a campaign
          </span>
        </div>

        {/* Current payout — the anchor */}
        <div className="mt-2.5 text-center">
          <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-muted-foreground">
            You have {currentSpots} {currentSpots === 1 ? 'share' : 'shares'}. What this pays
          </p>
          <p className="mt-0.5 text-[32px] leading-none font-black tabular-nums text-foreground">
            ₦{currentPayout.toLocaleString()}
          </p>
        </div>

        {/* Pitch */}
        <div className="mt-2.5 rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-transparent p-2.5">
          <div className="flex items-center gap-2 mb-0.5">
            <div className="h-6 w-6 rounded-lg bg-amber-500/25 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="h-3.5 w-3.5 text-amber-400" />
            </div>
            <p className="text-[13px] font-bold text-foreground">Add another share</p>
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug">
            Add another share for ₦{entryFee.toLocaleString()} — each one pays{' '}
            <span className="font-bold text-amber-400">₦{payoutPerSpot.toLocaleString()}</span> when
            your campaign finishes.
          </p>
        </div>

        {/* New payout — the outcome */}
        <div className="mt-2.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Your new payout
          </p>
          <div className="mt-0.5 flex items-baseline gap-2 flex-wrap">
            <span className="text-[38px] leading-none font-black tabular-nums text-success">
              ₦{newTarget.toLocaleString()}
            </span>
            <span className="text-xs font-bold tabular-nums text-success/80">
              +₦{addedPayout.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Stepper */}
        <div className="mt-2.5 flex items-center justify-between rounded-2xl bg-card/60 border border-border p-1.5">
          <button
            type="button"
            onClick={dec}
            disabled={quantity <= 1}
            aria-label="Fewer shares"
            className="h-11 w-11 rounded-xl bg-muted/40 text-foreground flex items-center justify-center disabled:opacity-30 active:scale-95 transition"
          >
            <Minus className="h-5 w-5" strokeWidth={2.5} />
          </button>
          <div className="text-center px-2">
            <p className="text-[32px] leading-none font-black tabular-nums text-foreground">
              +{quantity}
            </p>
            <p className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground mt-1">
              extra {quantity === 1 ? 'share' : 'shares'}
            </p>
          </div>
          <button
            type="button"
            onClick={inc}
            disabled={quantity >= MAX_QTY}
            aria-label="More shares"
            className="h-11 w-11 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center disabled:opacity-30 active:scale-95 transition"
          >
            <Plus className="h-5 w-5" strokeWidth={2.5} />
          </button>
        </div>

        {/* Presets */}
        <div className="mt-2 grid grid-cols-4 gap-2">
          {[1, 3, 5, 10].map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => { triggerHaptic('light'); setQuantity(q); }}
              className={`rounded-lg border py-1.5 text-xs font-bold tabular-nums transition-all active:scale-95 ${
                quantity === q
                  ? 'border-amber-500 bg-amber-500/15 text-amber-400'
                  : 'border-border bg-card/40 text-muted-foreground'
              }`}
            >
              +{q}
            </button>
          ))}
        </div>

        {/* Pay line */}
        <div className="mt-2.5 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">You pay</span>
          <span className="text-base font-bold tabular-nums text-foreground">
            ₦{totalCost.toLocaleString()}
          </span>
        </div>

        {/* CTA — always straight to bank payment */}
        <motion.button
          type="button"
          onClick={handleConfirm}
          disabled={isPending}
          whileTap={{ scale: 0.98 }}
          className="mt-2 w-full h-[58px] rounded-2xl font-black text-base bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30 disabled:opacity-60 flex items-center justify-center gap-2 relative overflow-hidden"
        >
          <motion.div
            className="absolute inset-0 bg-white/10"
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
          />
          {isPending ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="relative">Opening payment…</span>
            </>
          ) : (
            <span className="relative flex flex-col items-center leading-tight">
              <span>Add a share</span>
              <span className="text-[11px] font-semibold opacity-90 tabular-nums">
                Pay ₦{totalCost.toLocaleString()}
              </span>
            </span>
          )}
        </motion.button>

        {/* Skip */}
        <button
          onClick={handleSkip}
          className="mt-1.5 mx-auto text-[12px] text-muted-foreground/80 hover:text-foreground transition-colors underline underline-offset-4 py-1"
        >
          {currentSpots === 1 ? 'Stay at 1 share for now' : `Stay at ${currentSpots} shares for now`}
        </button>
      </div>
    </motion.div>
  );

  return createPortal(modal, document.body);
};

