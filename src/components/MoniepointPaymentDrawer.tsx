import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { toast as sonnerToast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Loader2, Copy, Check, CheckCircle2, ArrowRight,
  ShieldCheck, Lock, X, ArrowLeft, BadgeCheck, Radio,
} from 'lucide-react';
import { BankCommandSelect } from './BankCommandSelect';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { setPayUrlParam, clearPayUrlParam } from '@/lib/payUrlSync';
import { triggerHaptic } from '@/lib/haptics';
import { useDropStatus } from '@/hooks/useDropStatus';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
// NOTE: Facebook Purchase tracking is centralized in useFBPurchaseSync.

interface MoniepointPaymentDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: number;
  purpose?: 'deposit' | 'membership';
  autoBuySpots?: number;
  expectedPayout?: number;
  /** When set, drawer rehydrates an existing pending attempt (URL-restore). */
  resumeAttemptId?: string;
  onSuccess?: () => void;
}

interface InitiatedPayment {
  attempt_id: string;
  tx_ref: string;
  base_amount: number;
  unique_amount: number;
  purpose?: 'deposit' | 'membership';
  business_account: {
    account_number: string;
    account_name: string;
    bank_name: string;
  };
  auto_buy_spots?: number;
  expected_payout?: number;
}


const REVEAL_PAID_BUTTON_AFTER_MS = 20_000;
// After this long with no admin confirmation we soften the wording so users
// know they can close the page — payment will be confirmed in the background.
const SOFTEN_WAITING_AFTER_MS = 60_000;

type Phase = 'initializing' | 'pay' | 'confirm' | 'success' | 'error';

/* ---------------- helpers ---------------- */

// Friendly labels for the confirmation toast (Grandma-simple)
const COPY_LABELS: Record<string, string> = {
  acct: 'Account number',
  amount: 'Amount',
  bank: 'Bank name',
  name: 'Account name',
};

async function writeToClipboard(value: string): Promise<boolean> {
  // Modern API
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch { /* fall through to legacy */ }
  // Legacy fallback for older mobile browsers / in-app webviews
  try {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '0';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, value.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function useCopy() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copy = async (key: string, value: string) => {
    const ok = await writeToClipboard(value);
    if (!ok) {
      triggerHaptic('error');
      sonnerToast.error('Could not copy', {
        description: 'Tap and hold the number to copy it manually.',
        position: 'top-center',
        duration: 4000,
      });
      return;
    }
    triggerHaptic('success');
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1800);
    const label = COPY_LABELS[key] || 'Copied';
    sonnerToast.success(`${label} copied`, {
      description: value,
      position: 'top-center',
      duration: 2500,
      className: 'text-base font-semibold',
    });
  };
  return { copiedKey, copy };
}

function ReceiptRow({
  label,
  value,
  sub,
  mono,
  copyKey,
  onCopy,
  copied,
  emphasize,
  copyValue,
}: {
  label: string;
  value: string;
  sub?: string;
  mono?: boolean;
  copyKey: string;
  onCopy: (k: string, v: string) => void;
  copied: boolean;
  emphasize?: boolean;
  /** Value that actually gets written to clipboard (defaults to `value`). */
  copyValue?: string;
}) {
  const handleCopy = () => onCopy(copyKey, copyValue ?? value);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleCopy}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCopy(); } }}
      className={cn(
        'flex items-center justify-between gap-3 py-3.5 px-4 cursor-pointer select-none',
        'transition-colors active:bg-primary/10 hover:bg-muted/50',
        emphasize && 'bg-primary/5',
      )}
      aria-label={`Tap to copy ${label}`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-medium">
          {label} <span className="normal-case tracking-normal text-primary/70 font-semibold">· tap to copy</span>
        </p>
        <p className={cn(
          'text-foreground font-bold truncate',
          mono && 'tabular-nums',
          emphasize ? 'text-2xl mt-0.5' : 'text-base mt-0.5',
        )}>
          {value}
        </p>
        {sub && (
          <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-success/10 border border-success/20 px-2 py-0.5">
            <BadgeCheck className="h-3 w-3 text-success" />
            <span className="text-[10px] font-semibold text-success">{sub}</span>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); handleCopy(); }}
        className={cn(
          'shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 h-9 text-xs font-bold transition-colors active:scale-95',
          copied
            ? 'bg-success/15 text-success border border-success/30'
            : 'bg-primary text-primary-foreground',
        )}
        aria-label={`Copy ${label}`}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

/* ---------------- main ---------------- */

export const MoniepointPaymentDrawer = ({
  open,
  onOpenChange,
  amount,
  purpose = 'deposit',
  autoBuySpots = 0,
  expectedPayout,
  resumeAttemptId,
  onSuccess,
}: MoniepointPaymentDrawerProps) => {
  const queryClient = useQueryClient();
  const { copiedKey, copy } = useCopy();
  const { data: dropStatus } = useDropStatus();
  const { data: platformConfig } = usePlatformConfig();

  // Server may override purpose/amount when resuming an existing attempt.
  const [resolvedPurpose, setResolvedPurpose] = useState<'deposit' | 'membership'>(purpose);
  const [resolvedAmount, setResolvedAmount] = useState<number>(amount);
  const [resolvedAutoBuySpots, setResolvedAutoBuySpots] = useState<number>(autoBuySpots);
  const [resolvedExpectedPayout, setResolvedExpectedPayout] = useState<number | undefined>(expectedPayout);


  const [phase, setPhase] = useState<Phase>('initializing');
  const [payment, setPayment] = useState<InitiatedPayment | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showPaidButton, setShowPaidButton] = useState(false);
  const [softenWaiting, setSoftenWaiting] = useState(false);

  const [senderBankCode, setSenderBankCode] = useState('');
  const [senderBankName, setSenderBankName] = useState('');
  const [senderAccount, setSenderAccount] = useState('');
  const [confirming, setConfirming] = useState(false);

  const initiatedRef = useRef(false);

  const { data: banks = [] } = useQuery({
    queryKey: ['banks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('banks')
        .select('id, code, name, country')
        .eq('country', 'NG')
        .order('name');
      if (error) throw error;
      return data || [];
    },
    staleTime: 24 * 60 * 60 * 1000,
  });

  // Reset on close (and clear the URL param) — but ONLY on a real
  // open→closed transition, never on initial mount, otherwise we would
  // wipe the ?pay=<id> param the Host is about to read on a fresh reload.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      return;
    }
    if (!wasOpenRef.current) return; // first-mount no-op
    wasOpenRef.current = false;
    clearPayUrlParam();
    setTimeout(() => {
      setPhase('initializing');
      setPayment(null);
      setErrorMsg(null);
      setShowPaidButton(false);
      setSoftenWaiting(false);
      setSenderBankCode('');
      setSenderBankName('');
      setSenderAccount('');
      setConfirming(false);
      setResolvedPurpose(purpose);
      setResolvedAmount(amount);
      setResolvedAutoBuySpots(autoBuySpots);
      setResolvedExpectedPayout(expectedPayout);
      initiatedRef.current = false;
    }, 250);
  }, [open, purpose, amount, autoBuySpots, expectedPayout]);



  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Auto-initiate (or resume from URL when resumeAttemptId is provided)
  useEffect(() => {
    if (!open || initiatedRef.current) return;
    initiatedRef.current = true;

    // Abort-guard: if the user closes the drawer (open→false) before the
    // network response lands, we must NOT setPayUrlParam or setPhase — the
    // drawer is meant to be gone. Without this the URL gets re-written to
    // ?pay=<id> after close and the drawer pops back open on next reload.
    let cancelled = false;

    (async () => {
      try {
        const requestBody = resumeAttemptId
          ? { resume_attempt_id: resumeAttemptId }
          : {
              amount,
              purpose,
              auto_buy_spots: autoBuySpots,
              expected_payout: expectedPayout,
            };

        const { data, error } = await supabase.functions.invoke('initiate-moniepoint-payment', {
          body: requestBody,
        });
        if (cancelled) return;
        if (error || data?.error) {
          // If the resumed attempt no longer exists (or isn't ours), just close
          // silently — the URL param is stale.
          if (resumeAttemptId && data?.not_found) {
            clearPayUrlParam();
            onOpenChange(false);
            return;
          }
          setErrorMsg(data?.error || error?.message || 'Could not start payment');
          setPhase('error');
          return;
        }
        setPayment(data as InitiatedPayment);
        if (data?.purpose) setResolvedPurpose(data.purpose);
        if (typeof data?.base_amount === 'number') setResolvedAmount(data.base_amount);
        setResolvedAutoBuySpots(Math.max(0, Number(data?.auto_buy_spots ?? autoBuySpots) || 0));
        setResolvedExpectedPayout(
          Number(data?.expected_payout ?? expectedPayout) > 0
            ? Number(data?.expected_payout ?? expectedPayout)
            : undefined,
        );

        // Persist the attempt id in the URL so reload restores this screen.
        if (data?.attempt_id) setPayUrlParam(data.attempt_id);

        // If resuming and it's already verified, jump straight to success.
        if (data?.status === 'verified') {
          setPhase('success');
        } else {
          setPhase('pay');
        }
      } catch (e: any) {
        if (cancelled) return;
        setErrorMsg(e?.message || 'Network error');
        setPhase('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, amount, purpose, autoBuySpots, expectedPayout, resumeAttemptId, onOpenChange]);


  // Reveal "I have paid" button + soften waiting copy after a longer wait
  useEffect(() => {
    if (phase !== 'pay') return;
    const t1 = setTimeout(() => setShowPaidButton(true), REVEAL_PAID_BUTTON_AFTER_MS);
    const t2 = setTimeout(() => setSoftenWaiting(true), SOFTEN_WAITING_AFTER_MS);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [phase]);

  // Poll via SECURITY DEFINER RPC so we never expose the payment_attempts
  // table shape to the client. The RPC checks auth.uid() ownership server-side.
  useEffect(() => {
    if (!payment?.attempt_id || phase === 'success' || phase === 'initializing' || phase === 'error') return;

    let cancelled = false;

    const onVerified = () => {
      if (cancelled) return;
      setPhase('success');
      queryClient.invalidateQueries({ queryKey: ['balances'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
      onSuccess?.();
    };

    const checkStatus = async () => {
      const { data, error } = await supabase.rpc('get_payment_attempt_status', {
        _attempt_id: payment.attempt_id,
      });
      if (!cancelled && !error && data === 'verified') onVerified();
    };

    // Check once immediately, then every 8s
    checkStatus();
    const poll = setInterval(checkStatus, 8000);

    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [payment?.attempt_id, phase, queryClient, onSuccess]);

  const handleSubmitSender = async () => {
    if (!/^\d{10}$/.test(senderAccount)) {
      toast({ title: 'Check account number', description: 'Enter your 10-digit account number', variant: 'destructive' });
      return;
    }
    if (!senderBankName) {
      toast({ title: 'Pick a bank', description: 'Select the bank you sent from', variant: 'destructive' });
      return;
    }
    if (!payment?.attempt_id) return;
    setConfirming(true);
    try {
      const { data, error } = await supabase.functions.invoke('confirm-moniepoint-sender', {
        body: {
          attempt_id: payment.attempt_id,
          sender_bank_code: senderBankCode,
          sender_bank_name: senderBankName,
          sender_account_number: senderAccount,
        },
      });
      if (error || data?.error) {
        toast({
          title: 'Could not save',
          description: data?.error || error?.message || 'Try again',
          variant: 'destructive',
        });
        return;
      }
      if (data?.already_verified) {
        setPhase('success');
        return;
      }
      toast({
        title: 'Got it — checking now',
        description: 'We saved your details and will match your transfer the moment it lands.',
      });
      setPhase('pay');
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Try again', variant: 'destructive' });
    } finally {
      setConfirming(false);
    }
  };

  if (!open) return null;

  /* ---------------- Header ---------------- */
  const headerTitle =
    phase === 'confirm' ? 'Confirm your transfer'
    : phase === 'success' ? 'Payment received'
    : 'Secure Bank Transfer';

  const headerStep =
    phase === 'confirm' ? 'Step 2 of 2 — Tell us who sent it'
    : phase === 'pay' ? 'Step 2 of 2 — Complete your transfer'
    : phase === 'success' ? 'Done'
    : 'Setting up';
  const isMembershipFlow = resolvedPurpose === 'membership';
  const spotsForOutcome = Math.max(
    0,
    Number(payment?.auto_buy_spots ?? resolvedAutoBuySpots ?? autoBuySpots) || 0,
  );
  const shouldShowPayoutPromise = resolvedPurpose === 'deposit' && spotsForOutcome > 0;
  const currentTarget = Number(dropStatus?.user?.shared_drop?.target_amount ?? 0) || 0;
  const payoutPerSpot = Number(platformConfig?.drop_target_amount ?? 10000) || 10000;
  const promisedPayout = resolvedExpectedPayout || currentTarget + spotsForOutcome * payoutPerSpot;

  const onBack = () => {
    if (phase === 'confirm') setPhase('pay');
    else onOpenChange(false);
  };

  const Header = (
    <div className="sticky top-0 z-10 bg-background border-b border-border">
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
      >
        <button
          type="button"
          onClick={onBack}
          className="h-9 w-9 -ml-1 inline-flex items-center justify-center rounded-full hover:bg-muted active:scale-95 transition"
          aria-label={isMembershipFlow ? 'Back to join the campaign' : 'Close'}
        >
          {phase === 'confirm' || isMembershipFlow ? <ArrowLeft className="h-5 w-5" /> : <X className="h-5 w-5" />}
        </button>
        <div className="flex-1 min-w-0 text-center">
          <div className="inline-flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-success" />
            <h1 className="text-sm font-bold text-foreground truncate">{headerTitle}</h1>
          </div>
          <p className="text-[11px] text-muted-foreground truncate">{headerStep}</p>
        </div>
        <div className="h-9 w-9" />
      </div>
    </div>
  );

  /* ---------------- Steps ---------------- */

  const InitializingStep = (
    <div className="flex-1 flex items-center justify-center px-6">
      <div className="text-center space-y-3">
        <Loader2 className="h-10 w-10 text-primary animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground">Setting up your secure account…</p>
      </div>
    </div>
  );

  const ErrorStep = (
    <div className="flex-1 flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-center space-y-4">
        <div className="mx-auto h-14 w-14 rounded-full bg-destructive/15 flex items-center justify-center">
          <X className="h-7 w-7 text-destructive" />
        </div>
        <p className="text-base font-bold text-foreground">Something went wrong</p>
        <p className="text-sm text-muted-foreground">{errorMsg || 'Please try again.'}</p>
        <Button onClick={() => onOpenChange(false)} variant="outline" className="w-full h-12 rounded-xl">
          Close
        </Button>
      </div>
    </div>
  );

  const PayStep = payment && (
    <div className="px-4 py-4 space-y-4 pb-32">
      {shouldShowPayoutPromise && (
        <div className="flex items-center justify-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground">
              After this, your payout becomes
            </span>
            <span className="text-[13px] font-black tabular-nums text-foreground">
              ₦{promisedPayout.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* Trust info card */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground">
              {shouldShowPayoutPromise ? 'Send the exact amount to grow your payout' : 'Send the exact amount to this account'}
            </p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {shouldShowPayoutPromise
                ? 'Once your transfer lands, your new ad shares will be activated automatically.'
                : 'Once your transfer lands, your wallet will be credited shortly — usually within a few minutes.'}
            </p>
          </div>
        </div>
      </div>

      {/* Unified receipt card */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {/* Header strip */}
        <div className="px-4 py-2.5 bg-muted/40 border-b border-border flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground font-bold">
            Transfer Details
          </p>
          <div className="inline-flex items-center gap-1 text-[10px] font-semibold text-success">
            <ShieldCheck className="h-3 w-3" /> Verified
          </div>
        </div>

        {/* Account number is the MOST important thing to copy */}
        <ReceiptRow
          label="Account number"
          value={payment.business_account.account_number}
          mono
          emphasize
          copyKey="acct"
          onCopy={copy}
          copied={copiedKey === 'acct'}
        />
        <div className="h-px bg-border" />
        <ReceiptRow
          label="Amount to send"
          value={`₦${payment.unique_amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          mono
          copyKey="amount"
          copyValue={String(Math.round(payment.unique_amount))}
          onCopy={copy}
          copied={copiedKey === 'amount'}
        />
        <div className="h-px bg-border" />
        <ReceiptRow
          label="Bank"
          value={payment.business_account.bank_name}
          copyKey="bank"
          onCopy={copy}
          copied={copiedKey === 'bank'}
        />
        <div className="h-px bg-border" />
        <ReceiptRow
          label="Account name"
          value={payment.business_account.account_name || 'Viketa'}
          sub="Verified Platform Merchant"
          copyKey="name"
          onCopy={copy}
          copied={copiedKey === 'name'}
        />
      </div>

      {/* Active monitoring */}
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 text-center overflow-hidden relative">
        <div className="relative mx-auto h-14 w-14 mb-3">
          {/* radar pulse */}
          <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
          <span className="absolute inset-2 rounded-full bg-primary/30 animate-pulse" />
          <span className="absolute inset-0 rounded-full flex items-center justify-center">
            <Radio className="h-6 w-6 text-primary" />
          </span>
        </div>
        <p className="text-sm font-bold text-foreground">
          {softenWaiting ? 'Still processing your transfer…' : 'Waiting for your transfer…'}
        </p>
        <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed max-w-[280px] mx-auto">
          {softenWaiting
            ? 'Your payment is being confirmed in the background. This can take up to 10 minutes. If nothing happens after that, tap "I have sent the money" below and give us your transfer details — we will credit you manually within the hour.'
            : "We're confirming your transfer. Please don't close this page until you've completed the payment in your banking app."}
        </p>
      </div>

      <AnimatePresence>
        {showPaidButton && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Button
              variant="outline"
              onClick={() => setPhase('confirm')}
              className="w-full h-12 rounded-xl border-primary/40"
              haptic="light"
            >
              I have sent the money
            </Button>
            <p className="text-[11px] text-center text-muted-foreground mt-2">
              Only tap this after completing the transfer in your banking app.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  const ConfirmStep = (
    <div className="px-4 py-4 space-y-4 pb-32">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground">Two quick details</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              These act as a backup so we can find your transfer instantly if anything
              delays the auto-match.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
        <div>
          <label className="text-xs font-bold text-foreground mb-2 block">
            Bank you sent from
          </label>
          <BankCommandSelect
            banks={banks as any}
            value={senderBankCode}
            onValueChange={(code, name) => {
              setSenderBankCode(code);
              setSenderBankName(name);
            }}
            placeholder="Pick your bank"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-foreground mb-2 block">
            Account number you sent from
          </label>
          <Input
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={10}
            placeholder="0123456789"
            value={senderAccount}
            onChange={(e) => setSenderAccount(e.target.value.replace(/\D/g, '').slice(0, 10))}
            className="h-12 text-lg tabular-nums tracking-widest text-center"
          />
          <p className="text-[11px] text-muted-foreground mt-1.5 text-center">
            The same account you used to send the ₦{Math.round(payment?.unique_amount ?? 0).toLocaleString()} transfer.
          </p>
        </div>
      </div>
    </div>
  );

  const SuccessStep = (
    <div className="flex-1 flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-center space-y-5">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="mx-auto h-24 w-24 rounded-full bg-success/20 flex items-center justify-center"
        >
          <CheckCircle2 className="h-14 w-14 text-success" />
        </motion.div>
        <div>
          <h3 className="text-2xl font-bold text-foreground">Payment received</h3>
          <p className="text-sm text-muted-foreground mt-2">
            {resolvedPurpose === 'membership'
              ? 'Your account is now active. Welcome aboard!'
              : shouldShowPayoutPromise
                ? `Your transfer is in. Your payout will update to ₦${promisedPayout.toLocaleString()} shortly.`
                : `₦${resolvedAmount.toLocaleString()} has been added to your wallet.`}

          </p>
        </div>
        <Button
          onClick={() => onOpenChange(false)}
          className="w-full h-12 rounded-xl"
          haptic="success"
        >
          Continue
        </Button>
      </div>
    </div>
  );

  /* ---------------- Sticky footer (only confirm step needs a primary CTA) ---------------- */

  const Footer = phase === 'confirm' ? (
    <div
      className="sticky bottom-0 left-0 right-0 bg-background border-t border-border px-4 pt-3 space-y-2"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
    >
      <Button
        onClick={handleSubmitSender}
        disabled={confirming || senderAccount.length !== 10 || !senderBankName}
        className="w-full h-14 text-base font-bold rounded-xl"
        haptic="medium"
      >
        {confirming ? (
          <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Saving…</>
        ) : (
          <>Submit details <ArrowRight className="h-5 w-5 ml-2" /></>
        )}
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => setPhase('pay')}
        disabled={confirming}
        className="w-full h-12 rounded-xl border-border text-foreground"
        haptic="light"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        I haven't sent the money yet — go back
      </Button>
      <p className="text-[11px] text-center text-muted-foreground pt-1 flex items-center justify-center gap-1">
        <Lock className="h-3 w-3" /> Encrypted & used only to match your transfer
      </p>
    </div>
  ) : null;

  return (
    <div className="fixed inset-0 z-[100] h-[100dvh] bg-background flex flex-col overflow-hidden pointer-events-auto">

      {Header}
      <div className="min-h-0 flex-1 overflow-y-auto touch-pan-y overscroll-contain flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={phase}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="flex-1 flex flex-col"
          >
            {phase === 'initializing' && InitializingStep}
            {phase === 'pay' && PayStep}
            {phase === 'confirm' && ConfirmStep}
            {phase === 'success' && SuccessStep}
            {phase === 'error' && ErrorStep}
          </motion.div>
        </AnimatePresence>
      </div>
      {Footer}
    </div>
  );
};
