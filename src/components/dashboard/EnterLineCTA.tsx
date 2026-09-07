import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  ShieldCheck, 
  Lock, 
  Zap, 
  CheckCircle2, 
  ArrowRight, 
  AlertTriangle, 
  Clock, 
  UserCheck, 
  Sparkles,
  ChevronUp,
  X,
  Building2,
  BellRing,
  Flame,
  Check
} from 'lucide-react';
import { startMembershipPayment, useMembershipPaymentLoading } from '@/lib/startMembershipPayment';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import { triggerHaptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { FillingQueueCarousel } from './FillingQueueCarousel';
import { trackClarityEvent, ClarityEvents } from '@/lib/clarityTracking';
import { logUserActivity } from '@/lib/userActivityLogger';

const POPULAR_BANKS = [
  { id: 'opay', name: 'OPay' },
  { id: 'palmpay', name: 'PalmPay' },
  { id: 'kuda', name: 'Kuda' },
  { id: 'moniepoint', name: 'Moniepoint' },
  { id: 'gtb', name: 'GTBank' },
  { id: 'access', name: 'Access' },
  { id: 'zenith', name: 'Zenith' },
];

export function EnterLineCTA() {
  const navigate = useNavigate();
  const location = useLocation();
  const paying = useMembershipPaymentLoading();
  const { data: config } = usePlatformConfig();

  // Config parameters
  const membershipFee = config?.membership_fee || 3000;
  const expectedPayout = config?.drop_profit_amount || config?.profit_amount || 6000;

  // Visual/Animation states
  const [shaking, setShaking] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Sunk Cost States
  const [spotNumber, setSpotNumber] = useState<number>(4820);
  const [countdown, setCountdown] = useState<number>(348); // 05:48
  const [escrowPool, setEscrowPool] = useState<number>(3150);
  const [selectedBank, setSelectedBank] = useState<string>('opay');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [accountResolved, setAccountResolved] = useState<boolean>(false);
  const [pin, setPin] = useState<string>('');
  const [whatsappAlerts, setWhatsappAlerts] = useState<boolean>(true);
  const [rivalWarning, setRivalWarning] = useState<string | null>(null);

  // Initialize randomized spot & persistent storage check
  useEffect(() => {
    const savedSpot = sessionStorage.getItem('viketa_assigned_spot');
    if (savedSpot) {
      setSpotNumber(parseInt(savedSpot, 10));
    } else {
      const generated = Math.floor(4800 + Math.random() * 150);
      sessionStorage.setItem('viketa_assigned_spot', generated.toString());
      setSpotNumber(generated);
    }
  }, []);

  // Reservation Countdown Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Endowment Ticker: Escrow bucket gathers pending funds from incoming cycles
  useEffect(() => {
    const escrowInterval = setInterval(() => {
      setEscrowPool((prev) => {
        if (prev >= 4850) return 4850;
        return prev + Math.floor(Math.random() * 250 + 100);
      });
    }, 4000);
    return () => clearInterval(escrowInterval);
  }, []);

  // Periodic Line Displacement / Rival Alerts
  useEffect(() => {
    const alerts = [
      'Tunde A. (Ibadan) is waiting for an open slot...',
      'Chioma E. (Enugu) queued behind your spot...',
      'Ibrahim S. (Kano) cycle deposit standing by...',
      'Blessing O. (Ikeja) is eyeing Spot #' + spotNumber,
    ];
    let idx = 0;
    const interval = setInterval(() => {
      if (isSheetOpen) {
        setRivalWarning(alerts[idx % alerts.length]);
        idx++;
        setTimeout(() => setRivalWarning(null), 4000);
      }
    }, 9000);

    return () => clearInterval(interval);
  }, [isSheetOpen, spotNumber]);

  // Handle shake state from URL navigation
  useEffect(() => {
    const state = location.state as { shakeCTA?: boolean; ts?: number } | null;
    if (state?.shakeCTA) {
      navigate(location.pathname, { replace: true, state: null });
      setTimeout(() => {
        wrapperRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        triggerHaptic('medium');
        setShaking(true);
        setTimeout(() => setShaking(false), 900);
      }, 150);
    }
  }, [location.state, location.pathname, navigate]);

  // Pulse animation loop
  useEffect(() => {
    const id = setInterval(() => {
      setPulse(true);
      setTimeout(() => setPulse(false), 700);
    }, 3200);
    return () => clearInterval(id);
  }, []);

  // Handle Account input & auto-resolve feedback
  const handleAccountChange = (val: string) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 10);
    setAccountNumber(cleaned);
    if (cleaned.length === 10) {
      triggerHaptic('selection');
      setAccountResolved(true);
    } else {
      setAccountResolved(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Open Sunk-Cost Bottom Sheet
  const handleOpenSheet = () => {
    triggerHaptic('medium');
    trackClarityEvent(ClarityEvents.ACTIVATION_CARD_CLICKED);
    logUserActivity('open_spot_deed_sheet', 'drawer_open', {
      spot: spotNumber,
      accumulatedEscrow: escrowPool,
    });
    setIsSheetOpen(true);
  };

  // Final Action: Direct to Payment Gateway
  const handleFinalActivation = () => {
    triggerHaptic('success');
    logUserActivity('activate_spot_submitted', 'payment_start', {
      spot: spotNumber,
      bank: selectedBank,
      accountProvided: accountNumber.length === 10,
      pinSet: pin.length === 4,
      amount: membershipFee,
      expectedPayout,
    });

    startMembershipPayment(membershipFee, {
      autoBuySpots: 0,
      expectedPayout: expectedPayout,
    });
  };

  return (
    <>
      <style>{`
        @keyframes line-glow {
          0%, 100% { box-shadow: 0 0 15px rgba(16, 185, 129, 0.2), inset 0 0 15px rgba(16, 185, 129, 0.1); }
          50% { box-shadow: 0 0 25px rgba(16, 185, 129, 0.45), inset 0 0 20px rgba(16, 185, 129, 0.2); }
        }
        .line-glow-active {
          animation: line-glow 2.5s infinite ease-in-out;
        }
        @keyframes enter-line-wiggle {
          0%, 100% { transform: translateX(0) rotate(0); }
          20% { transform: translateX(-3px) rotate(-1deg); }
          40% { transform: translateX(3px) rotate(1deg); }
          60% { transform: translateX(-2px) rotate(-0.5deg); }
          80% { transform: translateX(2px) rotate(0.5deg); }
        }
        .enter-line-wiggle {
          animation: enter-line-wiggle 0.6s ease-in-out;
        }
      `}</style>

      {/* Main Container */}
      <div ref={wrapperRef} className="w-full pb-28">
        {/* The Live Carousel Feed */}
        <div className="w-full mb-4">
          <FillingQueueCarousel />
        </div>

        {/* In-Page Social Proof Ledger Callout */}
        <div className="mx-4 p-3.5 bg-gradient-to-r from-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <span className="flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                Cycle #104 Live Allocation
              </div>
              <div className="text-xs text-zinc-300 font-medium">
                Spot <span className="text-white font-black font-mono">#{spotNumber}</span> reserved for your device
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-zinc-500 block uppercase font-mono">Hold Expiry</span>
            <span className="text-xs font-mono font-bold text-amber-400">{formatTimer(countdown)}</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* FLOATING CTA BAR (Fixed to mobile bottom with Safe-Area padding)          */}
      {/* ========================================================================= */}
      <div className="fixed bottom-0 left-0 right-0 z-40 p-3 bg-gradient-to-t from-black via-zinc-950/95 to-transparent backdrop-blur-md pb-[calc(env(safe-area-inset-bottom)+0.75rem)] border-t border-zinc-800/80">
        <div className="max-w-md mx-auto flex items-center gap-2.5">
          {/* Micro Sunk-Cost Anchor Display */}
          <div 
            onClick={handleOpenSheet}
            className="flex-1 bg-zinc-900/90 border border-zinc-800 rounded-2xl px-3 py-2 cursor-pointer active:scale-95 transition-transform"
          >
            <div className="flex items-center justify-between text-[10px] font-mono leading-tight">
              <span className="text-emerald-400 font-bold uppercase">Spot #{spotNumber}</span>
              <span className="text-amber-400 font-semibold">{formatTimer(countdown)}</span>
            </div>
            <div className="text-xs font-black text-white mt-0.5 tracking-tight flex items-center gap-1">
              <span>Pool: ₦{escrowPool.toLocaleString()}</span>
              <span className="text-[9px] text-zinc-400 font-normal">in escrow</span>
            </div>
          </div>

          {/* Primary Action Button */}
          <Button
            onClick={handleOpenSheet}
            className={cn(
              'h-14 px-5 rounded-2xl bg-white hover:bg-zinc-100 text-black font-black text-sm shadow-xl shadow-white/10 active:scale-[0.97] transition-all flex items-center justify-center gap-1.5 shrink-0',
              pulse && !shaking && 'enter-line-wiggle',
              shaking && 'animate-shake'
            )}
          >
            <span>Lock Spot (₦{membershipFee.toLocaleString()})</span>
            <ChevronUp className="w-4 h-4 text-zinc-700" />
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* NATIVE MOBILE BOTTOM SHEET: THE LINE DEED & SUNK COST TRAP               */}
      {/* ========================================================================= */}
      {isSheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          {/* Backdrop dismiss */}
          <div className="absolute inset-0" onClick={() => setIsSheetOpen(false)} />

          {/* Sheet Modal Body */}
          <div className="relative w-full max-w-md bg-gradient-to-b from-zinc-900 via-zinc-950 to-black border-t-2 border-emerald-500/70 rounded-t-[28px] p-5 shadow-2xl z-10 max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
            
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 bg-zinc-700 rounded-full mx-auto mb-3 opacity-60" />

            {/* Line Displacement Warning Toast inside Sheet */}
            {rivalWarning && (
              <div className="mb-3.5 bg-amber-950/80 border border-amber-500/60 text-amber-200 text-xs px-3 py-2 rounded-xl flex items-center gap-2 animate-in fade-in slide-in-from-top duration-200">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 animate-bounce" />
                <span className="font-semibold text-[11px] leading-tight">{rivalWarning}</span>
              </div>
            )}

            {/* Header / Stamped Deed Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">
                    Official Spot Reservation Deed
                  </h3>
                  <span className="text-[10px] text-zinc-400">Viketa Cycle Distribution Protocol</span>
                </div>
              </div>

              <button
                onClick={() => setIsSheetOpen(false)}
                className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* WEAPON 1 & 3: The Spot & Escrow Ledger (Pre-allocated Endowment) */}
            <div className="my-3.5 p-4 rounded-2xl bg-zinc-950 border border-emerald-500/40 line-glow-active relative overflow-hidden">
              <div className="flex justify-between items-center mb-2 text-xs">
                <span className="text-zinc-400 font-mono">YOUR RESERVED SLOT:</span>
                <span className="font-mono font-black text-emerald-400 text-sm bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                  SPOT #{spotNumber}
                </span>
              </div>

              <div className="text-center py-2 border-y border-zinc-800/80 my-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-0.5">
                  Accumulated In Your Spot Escrow
                </span>
                <div className="text-3xl font-black text-white font-mono tracking-tight flex items-center justify-center gap-1.5">
                  <span className="text-emerald-400">₦{escrowPool.toLocaleString()}</span>
                  <span className="text-xs text-zinc-500 font-normal">/ ₦{expectedPayout.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-emerald-400/90 font-medium mt-1">
                  <Flame className="w-3.5 h-3.5 fill-current text-amber-400 animate-pulse" />
                  <span>Cycle funds are distributing directly behind you</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-400" /> Hold Expires:
                </span>
                <span className="font-mono font-bold text-amber-400">{formatTimer(countdown)}</span>
              </div>
            </div>

            {/* WEAPON 2: Bank Payout Anchor (Maximum Skin in the Game) */}
            <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-3.5 mb-3.5">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-black uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Where Should Your ₦{expectedPayout.toLocaleString()} Drop?</span>
                </label>
                {accountResolved && (
                  <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-0.5">
                    <Check className="w-3 h-3" /> Account Linked
                  </span>
                )}
              </div>

              {/* Fast Bank Chips */}
              <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none">
                {POPULAR_BANKS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      setSelectedBank(b.id);
                      triggerHaptic('selection');
                    }}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all border',
                      selectedBank === b.id
                        ? 'bg-emerald-500 text-black border-emerald-400 shadow-md shadow-emerald-500/20'
                        : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white'
                    )}
                  >
                    {b.name}
                  </button>
                ))}
              </div>

              {/* Account Number Input (NUBAN) */}
              <div className="mt-2 relative">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={10}
                  placeholder="Enter 10-digit account number"
                  value={accountNumber}
                  onChange={(e) => handleAccountChange(e.target.value)}
                  className="w-full h-11 bg-zinc-950 border border-zinc-700/80 rounded-xl px-3.5 text-base font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <p className="text-[10px] text-zinc-500 mt-1.5">
                Funds are wired to this Nigerian account automatically as your cycle matures.
              </p>
            </div>

            {/* WEAPON 2.5: The 4-Digit Security PIN (Mental Ownership Lock) */}
            <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-3.5 mb-3.5">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-black uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Set 4-Digit Payout Authorization PIN</span>
                </label>
                {pin.length === 4 && (
                  <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-0.5">
                    <ShieldCheck className="w-3 h-3" /> Sealed
                  </span>
                )}
              </div>

              <div className="relative">
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  placeholder="Create 4-digit withdrawal PIN (e.g. 7492)"
                  value={pin}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setPin(cleaned);
                    if (cleaned.length === 4) triggerHaptic('selection');
                  }}
                  className="w-full h-11 bg-zinc-950 border border-zinc-700/80 rounded-xl px-3.5 text-base tracking-widest font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              <p className="text-[10px] text-zinc-500 mt-1.5">
                Protects Spot #{spotNumber}. No one can divert your ₦{expectedPayout.toLocaleString()} payout without this PIN.
              </p>
            </div>

            {/* WhatsApp Alert Micro-Toggle */}
            <div 
              onClick={() => {
                setWhatsappAlerts(!whatsappAlerts);
                triggerHaptic('selection');
              }}
              className="flex items-center justify-between p-3 bg-zinc-950/60 border border-zinc-800 rounded-xl mb-3.5 cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <BellRing className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-zinc-300 font-medium">Send WhatsApp credit alert on payout</span>
              </div>
              <div className={cn(
                'w-5 h-5 rounded-md border flex items-center justify-center transition-colors',
                whatsappAlerts ? 'bg-emerald-500 border-emerald-400 text-black' : 'border-zinc-700 bg-zinc-900'
              )}>
                {whatsappAlerts && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </div>
            </div>

            {/* The Reality Reframe (From Ad Copy: MTN Data vs Viketa Spot) */}
            <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-3 mb-4 text-[11px] space-y-1">
              <div className="flex justify-between text-zinc-400">
                <span>Normal Daily Expense (MTN/Airtel Data):</span>
                <span className="text-red-400 font-bold line-through">₦3,000 = ₦0 (Gone)</span>
              </div>
              <div className="flex justify-between text-emerald-400 font-bold">
                <span>Hold Spot #{spotNumber} in Line Cycle:</span>
                <span>₦3,000 = ₦{expectedPayout.toLocaleString()} Target Drop</span>
              </div>
            </div>

            {/* CLIMAX CTA BUTTON */}
            <Button
              onClick={handleFinalActivation}
              disabled={paying}
              className="w-full h-15 rounded-2xl bg-gradient-to-r from-emerald-400 via-emerald-500 to-green-500 hover:from-emerald-300 hover:to-green-400 text-black font-black text-base shadow-xl shadow-emerald-950/80 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              {paying ? (
                <>Connecting to Payment Rails…</>
              ) : (
                <>
                  <span>SEAL SPOT #{spotNumber} & RELEASE ESCROW (₦{membershipFee.toLocaleString()})</span>
                  <ArrowRight className="w-5 h-5 stroke-[2.5]" />
                </>
              )}
            </Button>

            <p className="text-[10px] text-center text-zinc-500 mt-2.5 font-mono">
              ⚠️ If timer expires ({formatTimer(countdown)}), Spot #{spotNumber} and its accumulated ₦{escrowPool.toLocaleString()} pool are transferred to the next queueing user.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
