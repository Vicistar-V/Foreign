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
  ExternalLink, AlertCircle, Ban, Sparkles
} from 'lucide-react';
import { BankCommandSelect } from './BankCommandSelect';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { setPayUrlParam, clearPayUrlParam } from '@/lib/payUrlSync';
import { triggerHaptic } from '@/lib/haptics';

interface MoniepointPaymentDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: number;
  purpose?: 'deposit' | 'membership';
  autoBuySpots?: number;
  expectedPayout?: number;
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
}

const REVEAL_PAID_BUTTON_AFTER_MS = 20_000;
const SOFTEN_WAITING_AFTER_MS = 60_000;

type Phase = 'initializing' | 'pay' | 'confirm' | 'success' | 'error';

const COPY_LABELS: Record<string, string> = {
  acct: 'Account number',
  amount: 'Amount',
  bank: 'Bank name',
  name: 'Account name',
};

async function writeToClipboard(value: string): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch { /* legacy */ }
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

export const MoniepointPaymentDrawer = ({
  open,
  onOpenChange,
  amount,
  purpose = 'membership',
  resumeAttemptId,
  onSuccess,
}: MoniepointPaymentDrawerProps) => {
  const queryClient = useQueryClient();
  const { copiedKey, copy } = useCopy();

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

  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      return;
    }
    if (!wasOpenRef.current) return;
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
      initiatedRef.current = false;
    }, 250);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Auto-initiate or resume
  useEffect(() => {
    if (!open || initiatedRef.current) return;
    initiatedRef.current = true;

    let cancelled = false;

    (async () => {
      try {
        const requestBody = resumeAttemptId
          ? { resume_attempt_id: resumeAttemptId }
          : { amount: 1000, purpose: 'membership' };

        const { data, error } = await supabase.functions.invoke('initiate-moniepoint-payment', {
          body: requestBody,
        });
        if (cancelled) return;
        if (error || data?.error) {
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
        if (data?.attempt_id) setPayUrlParam(data.attempt_id);

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
  }, [open, amount, purpose, resumeAttemptId, onOpenChange]);

  useEffect(() => {
    if (phase !== 'pay') return;
    const t1 = setTimeout(() => setShowPaidButton(true), REVEAL_PAID_BUTTON_AFTER_MS);
    const t2 = setTimeout(() => setSoftenWaiting(true), SOFTEN_WAITING_AFTER_MS);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [phase]);

  // Status polling every 8s
  useEffect(() => {
    if (!payment?.attempt_id || phase === 'success' || phase === 'initializing' || phase === 'error') return;

    let cancelled = false;

    const onVerified = () => {
      if (cancelled) return;
      setPhase('success');
      queryClient.invalidateQueries({ queryKey: ['balances'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      onSuccess?.();
    };

    const checkStatus = async () => {
      const { data, error } = await supabase.rpc('get_payment_attempt_status', {
        _attempt_id: payment.attempt_id,
      });
      if (!cancelled && !error && data === 'verified') onVerified();
    };

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
    : phase === 'success' ? 'Access Unlocked'
    : 'Secure Bank Transfer';

  const headerStep =
    phase === 'confirm' ? 'Step 2 of 2 — Tell us who sent it'
    : phase === 'pay' ? 'Step 2 of 2 — Complete your ₦1,000 transfer'
    : phase === 'success' ? 'Your 2 Verified Foreign Platforms'
    : 'Setting up';

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
          aria-label="Close"
        >
          {phase === 'confirm' ? <ArrowLeft className="h-5 w-5" /> : <X className="h-5 w-5" />}
        </button>
        <div className="flex-1 min-w-0 text-center">
          <div className="inline-flex items-center gap-1.5">
            {phase === 'success' ? (
              <Sparkles className="h-4 w-4 text-emerald-500" />
            ) : (
              <Lock className="h-3.5 w-3.5 text-success" />
            )}
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
        <p className="text-sm text-muted-foreground">Setting up your secure transfer details…</p>
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
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground">Send ₦1,000 to unlock instant access</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Make a transfer of exactly ₦1,000. Your platforms and cheat codes will be revealed right here on this screen immediately.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-2.5 bg-muted/40 border-b border-border flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground font-bold">
            Transfer Details
          </p>
          <div className="inline-flex items-center gap-1 text-[10px] font-semibold text-success">
            <ShieldCheck className="h-3 w-3" /> Verified
          </div>
        </div>

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
          value={`₦${payment.unique_amount.toLocaleString()}`}
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
          value={payment.business_account.account_name || 'Velocity'}
          sub="Verified Merchant"
          copyKey="name"
          onCopy={copy}
          copied={copiedKey === 'name'}
        />
      </div>

      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 text-center overflow-hidden relative">
        <div className="relative mx-auto h-14 w-14 mb-3">
          <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
          <span className="absolute inset-2 rounded-full bg-primary/30 animate-pulse" />
          <span className="absolute inset-0 rounded-full flex items-center justify-center">
            <Radio className="h-6 w-6 text-primary" />
          </span>
        </div>
        <p className="text-sm font-bold text-foreground">
          {softenWaiting ? 'Still confirming your payment…' : 'Waiting for your transfer…'}
        </p>
        <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed max-w-[280px] mx-auto">
          {softenWaiting
            ? 'Your payment is being confirmed in the background. If delayed, tap "I have sent the money" below.'
            : "We're monitoring for your ₦1,000 transfer. Do not close this page until you've sent it from your bank app."}
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
              Enter your sender bank details so we can match your ₦1,000 instantly.
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
        </div>
      </div>
    </div>
  );

  /* ---------------- SUCCESS STEP (REVEALS THE 2 PLATFORMS ON SCREEN) ---------------- */

  const SuccessStep = (
    <div className="px-4 py-5 space-y-4 pb-28">
      {/* Confirmed Alert Badge */}
      <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-3.5 flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
          <CheckCircle2 className="h-6 w-6 text-emerald-500" />
        </div>
        <div>
          <h2 className="text-sm font-black text-foreground">Payment Confirmed (₦1,000)</h2>
          <p className="text-[11px] text-muted-foreground">
            Follow the instructions below carefully to start your tasks today.
          </p>
        </div>
      </div>

      {/* PLATFORM 1: VELOCITY (OPEN & ACCEPTING WORKERS) */}
      <div className="rounded-2xl border-2 border-emerald-500 bg-card p-5 space-y-4 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-100 dark:bg-emerald-950/70 px-2.5 py-1 rounded-full border border-emerald-500/30">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            PLATFORM 1 — ACCEPTING WORKERS NOW
          </span>
          <span className="text-[11px] font-bold text-muted-foreground">No VPN</span>
        </div>

        <div>
          <h3 className="text-xl font-black text-foreground tracking-tight">Velocity Global Tasks</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Foreign micro-task system • <strong className="text-foreground font-bold">~$1.60 per completed task</strong>
          </p>
        </div>

        {/* Step-by-Step Cheat Code */}
        <div className="bg-muted/40 rounded-xl p-3.5 space-y-2 text-xs border border-border">
          <p className="font-bold text-foreground text-[11px] uppercase tracking-wider mb-1">
            Exact Instructions To Follow:
          </p>
          <div className="flex items-start gap-2 text-foreground/90">
            <span className="font-black text-emerald-600">1.</span>
            <span>Click the green button below and register with your regular username & password.</span>
          </div>
          <div className="flex items-start gap-2 text-foreground/90">
            <span className="font-black text-emerald-600">2.</span>
            <span>
              Complete the quick <strong>test task (tapping on the image)</strong> to prove you are human.
            </span>
          </div>
          <div className="flex items-start gap-2 text-foreground/90">
            <span className="font-black text-emerald-600">3.</span>
            <span>Go through the onboarding setup to seal your worker contract.</span>
          </div>
          <div className="flex items-start gap-2 text-foreground/90">
            <span className="font-black text-emerald-600">4.</span>
            <span>
              Start your micro-tasks. You make about <strong>$1.60 per task</strong>, and minimum withdrawal is around <strong>$24</strong> directly to your bank account or crypto.
            </span>
          </div>
        </div>

        {/* Direct Action Button */}
        <a
          href="https://velocityearn.xyz"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full inline-flex items-center justify-center gap-2 py-4 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-black text-base shadow-lg shadow-emerald-600/30 transition-all text-center"
        >
          <span>Access Velocity Now</span>
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>

      {/* PLATFORM 2: CLOSED / FULL (CREATES SCARCITY) */}
      <div className="rounded-2xl border border-destructive/30 bg-card/60 p-4 space-y-2 opacity-75">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-destructive bg-destructive/10 px-2 py-0.5 rounded-full border border-destructive/20">
            <Ban className="h-3 w-3 text-destructive" />
            PLATFORM 2 — APPLICATIONS CLOSED
          </span>
          <span className="text-[10px] font-semibold text-muted-foreground">Full Capacity</span>
        </div>

        <div>
          <h4 className="text-sm font-bold text-foreground">TaskForge International</h4>
          <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
            ⚠️ <strong>Worker intake temporarily paused:</strong> This platform has reached maximum Nigerian worker capacity for this batch. New registrations are disabled.
          </p>
        </div>

        <div className="rounded-lg bg-muted/50 p-2 text-[11px] text-muted-foreground border border-border flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
          <span>Please proceed with <strong>Platform 1 (Velocity)</strong> above while slots are still open.</span>
        </div>
      </div>
    </div>
  );

  /* ---------------- Footer (Confirm step only) ---------------- */
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
        Go back to bank details
      </Button>
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
