import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useDailyTask } from '@/hooks/useDailyTask';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import {
  fetchComparisonBatch,
  fetchSingleReplacementPair,
  useSubmitBatch,
  useReportBrokenImage,
  type ComparisonBatchPair,
  type ComparisonChoice,
} from '@/hooks/useComparison';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { startMembershipPayment, useMembershipPaymentLoading } from '@/lib/startMembershipPayment';
import {
  ArrowLeft, CheckCircle2, Wallet, AlertTriangle, Copy, UserPlus,
  HelpCircle, Loader2, ShieldCheck, Coins, Send, Check, Lock, Zap, ArrowRight, X,
  Trophy, Users, Share2, Clock, TrendingUp, TimerReset, MessageCircle,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { triggerHaptic } from '@/lib/haptics';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { cn } from '@/lib/utils';
import { useShareMessage } from '@/hooks/useShareMessage';
import { generateReferralLink, copyToClipboard } from '@/lib/shareUtils';
import { buildInviteUrl } from '@/lib/inviteKey';
import { useTour } from '@/context/TourContext';
import { useRetirementStatus } from '@/hooks/useRetirementStatus';
import { openRestoreCapacityDrawer } from '@/lib/restoreCapacityStore';


// NOTE: Task system is fully batch-based.
// Every visit to this page pulls a fresh batch of 10 pairs.
// The platform does NOT track which side the user picked — only that
// they completed a batch. The "winner" is purely a local UI affordance.
const PROMPTS = [
  'Which would you rather?',
  'Which is more attractive?',
  'Which catches your eye?',
];

const TRANSITION_MS = 1500;        // minimal between-pick overlay
const BATCH_FINISH_MS = 4000;      // after 10 picks, before redirect (short, honest)
const TRIAL_FINISH_MS = 1800;      // shorter for non-member trial (no server call)

// Local-only "trial batch done" flag for non-members.
// Cleared the moment the user becomes a paid member.
const trialKey = (uid?: string) => `viketa:trial_batch_done:${uid || 'anon'}`;
const getTrialDone = (uid?: string) => {
  try { return localStorage.getItem(trialKey(uid)) === '1'; } catch { return false; }
};
const setTrialDone = (uid?: string) => {
  try { localStorage.setItem(trialKey(uid), '1'); } catch {}
};
const clearTrialDone = (uid?: string) => {
  try { localStorage.removeItem(trialKey(uid)); } catch {}
};

// Prefetch all images so the next pair is instant
function prefetchImages(urls: string[]) {
  urls.forEach((u) => {
    const img = new Image();
    img.src = u;
  });
}


// Time remaining until next reset (UTC midnight) — backend rolls over by UTC date.
// We don't show "UTC" to the user; we just show the live countdown to that moment
// from their local clock, so it always lines up with when batches actually refresh.
function useTimeUntilReset() {
  const [text, setText] = useState('');
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const nextReset = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
        0, 0, 0, 0,
      ));
      const diffMs = nextReset.getTime() - now.getTime();
      const h = Math.max(0, Math.floor(diffMs / 3_600_000));
      const m = Math.max(0, Math.floor((diffMs % 3_600_000) / 60_000));
      const s = Math.max(0, Math.floor((diffMs % 60_000) / 1000));
      setText(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return text;
}

export default function DailyTask() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const { data: platformConfig } = usePlatformConfig();
  const { playSound } = useSoundEffects();
  const { step: tourStep, setStep: setTourStep, recordPick: tourRecordPick, recordSubmit: tourRecordSubmit } = useTour();


  const { data: taskState, refetch: refetchTask } = useDailyTask(user?.id);

  const submitBatch = useSubmitBatch();
  const reportBroken = useReportBrokenImage();

  const [pairs, setPairs] = useState<ComparisonBatchPair[] | null>(null);
  const [pairIdx, setPairIdx] = useState(0);
  const [loadingBatch, setLoadingBatch] = useState(false);
  const [transition, setTransition] = useState(false);   // 1.5s overlay between picks
  const [finishing, setFinishing] = useState(false);     // end-of-batch progressive screen
  const [addedAmount, setAddedAmount] = useState<number>(0);
  const [lastPickAmount, setLastPickAmount] = useState<number>(0);
  const [shownAt, setShownAt] = useState<number>(Date.now());
  const [selected, setSelected] = useState<'a' | 'b' | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const autoFlaggedRef = useRef<Record<string, boolean>>({});
  const swappingRef = useRef(false);
  const [showAtRisk, setShowAtRisk] = useState(false);
  const [batchSaved, setBatchSaved] = useState(false);
  const [extensionLoading, setExtensionLoading] = useState(false);
  
  const promptIdx = useRef(0);
  const batchSubmitStartedRef = useRef(false);

  // Picks count + per-pair choice ledger collected locally; sent in one
  // batch to the server on submit so it can be saved for ML training.
  const pickCountRef = useRef(0);
  const choicesRef = useRef<ComparisonChoice[]>([]);

  const isMember = !!profile?.is_member;

  // Non-member trial: 1 free batch, fully local (no server credit).
  const [trialDone, setTrialDoneState] = useState<boolean>(() => !isMember && getTrialDone(user?.id));

  // The moment the user becomes a paid member, wipe the trial flag.
  useEffect(() => {
    if (isMember) {
      clearTrialDone(user?.id);
      setTrialDoneState(false);
    } else {
      // Re-sync from storage if user id changed
      setTrialDoneState(getTrialDone(user?.id));
    }
  }, [isMember, user?.id]);

  const batchesDone = taskState?.batches_done ?? 0;
  const totalToday = taskState?.total_batches_today ?? 0;
  const isUnlimited = !!taskState?.unlimited;
  const naira = taskState?.naira_per_batch_for_user ?? 0;
  const spotCount = taskState?.spot_count ?? 1;
  const pending = Number(taskState?.pending_balance ?? 0);
  const pendingCap = Number(taskState?.pending_cap ?? 0);
  const capacityFull = !!taskState?.capacity_full;
  const extensionSpotPrice = Number(taskState?.extension_spot_price ?? 5000);
  const payoutPerSpot = Number(taskState?.payout_per_spot ?? 10000);
  // In unlimited mode, the ONLY reason to stop tapping is capacity full.
  // In legacy limited mode, hitting the daily batch count still stops you.
  const isDone = isMember && (isUnlimited ? capacityFull : batchesDone >= totalToday);
  const allowed = !!taskState?.task_enabled && (isMember ? !!taskState?.can_do_more : !trialDone);

  // Retirement gate — when every spot has retired, tasks are meaningless
  // (₦0/batch, no capacity). Block the whole page with a clear Restore CTA
  // instead of letting people burn through batches for nothing.
  const { data: retirement } = useRetirementStatus();
  const isRetired = !!retirement?.is_retired;


  const currentPair = pairs && pairIdx < pairs.length ? pairs[pairIdx] : null;
  const prompt = PROMPTS[promptIdx.current % PROMPTS.length];

  // Per-pick & batch-earned (front-end visual)
  const perPick = (naira || 0) / 10;
  const batchEarned = perPick * Math.min(pairIdx, 10);

  // Always pull a FRESH batch of 10 pairs (no caching, no resume)
  const loadBatch = async () => {
    setLoadingBatch(true);
    try {
      const { pairs: newPairs } = await fetchComparisonBatch();
      prefetchImages(newPairs.flatMap((p) => [p.image_a.url, p.image_b.url]));
      pickCountRef.current = 0;
      choicesRef.current = [];
      batchSubmitStartedRef.current = false;
      setPairs(newPairs);
      setPairIdx(0);
      setShownAt(Date.now());
      setSelected(null);
    } catch (e: any) {
      toast.error(e?.message?.replace(/_/g, ' ') || 'Could not load tasks');
    } finally {
      setLoadingBatch(false);
    }
  };

  // First load — ALWAYS fetch a fresh batch on every visit
  useEffect(() => {
    if (pairs || !allowed || isDone || finishing) return;
    if (!taskState) return;
    loadBatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, isDone, taskState]);

  // Reset shownAt on each new pair shown
  useEffect(() => {
    if (currentPair && !transition && !finishing) {
      setShownAt(Date.now());
      setSelected(null);
      setReportOpen(false);
    }
  }, [currentPair, transition, finishing]);

  // ===== Tour driver =====
  // 1) When the user lands on /task with the dashboard-CTA step still active,
  //    advance to the "pick an image" step.
  // 2) Keep pick ↔ submit in sync with the selection state so the spotlight
  //    follows what the user can actually do right now.
  useEffect(() => {
    if (tourStep === 'cta') setTourStep('pick');
  }, [tourStep, setTourStep]);

  useEffect(() => {
    if (tourStep === 'pick' && selected) tourRecordPick();
    else if (tourStep === 'submit' && !selected) setTourStep('pick');
  }, [selected, tourStep, tourRecordPick, setTourStep]);

  // Live capacity awareness: a referral bump, admin adjust, or auto-payout
  // could tip the user over capacity between our 15s task refetches. Listen
  // for any transaction row on this user and re-pull daily-task state fast
  // so the "SHARE FULL" gate is honest.
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`daily-task-live-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['daily-task', user.id] });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'drops', filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['daily-task', user.id] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);





  const handleSelect = (side: 'a' | 'b') => {
    if (!currentPair || transition || finishing || submitBatch.isPending) return;
    triggerHaptic('light');
    // Tap again on the same side to deselect
    setSelected((prev) => (prev === side ? null : side));
  };

  const handleSubmit = () => {
    if (!currentPair || transition || finishing || !selected || batchSubmitStartedRef.current) return;
    triggerHaptic('medium');
    // Advance the tour past this submit (counts toward the 3-pick onboarding cap).
    tourRecordSubmit();


    // Record this pick in the local ledger (sent to server on batch submit)
    const chosenImage = selected === 'a' ? currentPair.image_a : currentPair.image_b;
    choicesRef.current.push({
      category_slug: currentPair.category_slug,
      image_a_id: currentPair.image_a.id,
      image_b_id: currentPair.image_b.id,
      chosen_image_id: chosenImage.id,
    });
    pickCountRef.current += 1;

    setLastPickAmount(perPick);
    playSound('win'); // premium pleasant chime per pick
    promptIdx.current += 1;

    const isLastPick = pairIdx + 1 >= (pairs?.length ?? 10);

    if (!isLastPick) {
      // Show the brief overlay, then advance to next pair
      setTransition(true);
      window.setTimeout(() => {
        setPairIdx((i) => i + 1);
        setSelected(null);
        setTransition(false);
      }, TRANSITION_MS);
      return;
    }

    // ===== Last pick of the batch =====
    triggerHaptic('success');
    playSound('bigWin');
    batchSubmitStartedRef.current = true;
    const finishStartedAt = Date.now();
    setAddedAmount(naira);

    // ----- NON-MEMBER trial: NEVER call the credit RPC. Pure local flow. -----
    // Skip the multi-stage "verifying / adding money" theater — nothing is
    // actually being credited, so faking a 4s progress bar reads as a scam.
    // Show a short celebration toast and drop straight into the pitch.
    if (!isMember) {
      setTrialDone(user?.id);
      setTrialDoneState(true);
      toast.success(`+₦${Number(naira || 0).toLocaleString()} sample locked!`);
      window.setTimeout(() => {
        pickCountRef.current = 0;
        choicesRef.current = [];
        setShowAtRisk(true);
      }, 600);
      return;
    }

    // Only members see the multi-stage finishing screen (real credit happening).
    setFinishing(true);

    // ----- MEMBER: tell the server one batch is done -----
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        submitBatch
          .mutateAsync(choicesRef.current)
          .then(async (res) => {
            const added = Number(res.batch?.naira_added || 0);
            setAddedAmount(added);
            pickCountRef.current = 0;
            choicesRef.current = [];
            await refetchTask();
            const remainingFinishMs = Math.max(0, BATCH_FINISH_MS - (Date.now() - finishStartedAt));
            setTimeout(() => {
              toast.success(`+₦${added.toLocaleString()} added to Pending`);
              setFinishing(false);
              setBatchSaved(true);
            }, remainingFinishMs);
          })
          .catch((e: any) => {
            batchSubmitStartedRef.current = false;
            const msg = (e?.message || 'Network hiccup').replace(/_/g, ' ');
            // Reassure — the picks are still in memory. Roll the UI back to
            // the last pick so the user can just tap "Submit pick" again.
            toast.error(`${msg} — your picks are safe, tap Submit again`);
            setFinishing(false);
            const totalPicks = pairs?.length ?? 10;
            setPairIdx(Math.max(0, totalPicks - 1));
            // Keep `selected` sticky if we still have it — user just re-submits.
          });
      });
    });
  };


  // Replace current pair with a fresh one from backend (does NOT advance progress).
  // This keeps the batch length intact when an image is bad.
  const replaceCurrentPair = async () => {
    if (!pairs) return;
    const replacement = await fetchSingleReplacementPair();
    if (!replacement) {
      toast.error('Could not load a replacement, try again');
      return;
    }
    prefetchImages([replacement.image_a.url, replacement.image_b.url]);
    setPairs((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[pairIdx] = replacement;
      return next;
    });
    setSelected(null);
    setShownAt(Date.now());
  };

  const reportSide = async (side: 'a' | 'b' | 'both') => {
    if (!currentPair) return;
    setReportOpen(false);
    try {
      if (side === 'a' || side === 'both') {
        await reportBroken.mutateAsync(currentPair.image_a.id);
      }
      if (side === 'b' || side === 'both') {
        await reportBroken.mutateAsync(currentPair.image_b.id);
      }
      toast.success('Swapping in a fresh pair…');
      await replaceCurrentPair();
    } catch {
      toast.error('Could not report');
    }
  };

  // Auto-flag broken images when they fail to load (404, network error, etc.)
  // Uses refs (not state) so repeated/back-to-back errors are always caught.
  const handleImageError = async (imageId: string) => {
    if (autoFlaggedRef.current[imageId]) return;
    autoFlaggedRef.current[imageId] = true;
    // Fire-and-forget the report so we never miss the next bad image
    reportBroken.mutateAsync(imageId).catch(() => {});
    if (swappingRef.current) return; // already swapping; the swap will replace this image too
    swappingRef.current = true;
    try {
      // If the user had already tapped a side, their pick just got reset by the
      // swap — tell them honestly instead of a generic "bad image" line.
      if (selected) {
        toast.message('One image was broken — your pick was reset, tap again');
      } else {
        toast.message('One image was broken — showing a fresh pair');
      }
      await replaceCurrentPair();
    } finally {
      swappingRef.current = false;
    }
  };

  // ===== Loading task state =====
  if (!taskState) {
    return (
      <div className="min-h-[100dvh] bg-background p-4 flex flex-col gap-4">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  // ===== All spots retired — user must Restore before tasks make sense =====
  if (isMember && isRetired && !finishing && !showAtRisk && !batchSaved) {
    const previousCap = retirement?.previous_capacity ?? spotCount ?? 1;
    return (
      <div className="min-h-[100dvh] bg-gradient-to-b from-background to-card/40 flex flex-col">
        <div className="sticky top-0 z-20 bg-background/95 border-b border-border/30">
          <div className="max-w-md mx-auto p-3 flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-1" />Back
            </Button>
            <div className="text-xs font-semibold tracking-wider text-emerald-500">JUST CASHED OUT</div>
            <div className="w-[60px]" />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-sm w-full space-y-6 text-center">
            <div className="mx-auto h-20 w-20 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <TimerReset className="h-10 w-10 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">🎉 Campaign finished — ₦{Number(payoutPerSpot * previousCap).toLocaleString()} paid!</h1>
              <p className="text-sm text-muted-foreground mt-2">
                Your{previousCap > 1 ? ` ${previousCap} ad shares` : ' ad share'} finished — ₦{Number(payoutPerSpot * previousCap).toLocaleString()} paid to your wallet.
                Send{previousCap > 1 ? ' them' : ' it'} back to work to start another campaign worth ₦{Number(payoutPerSpot * previousCap).toLocaleString()}.
              </p>
            </div>
            <Button
              onClick={() => openRestoreCapacityDrawer()}
              className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl"
            >
              Send my {previousCap > 1 ? 'ad shares' : 'ad share'} back to work
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>

      </div>
    );
  }

  // ===== Maximum Spot Capacity Reached — pending balance is capped =====
  if (isMember && capacityFull && !finishing && !showAtRisk && !batchSaved) {
    const nextCap = pendingCap + payoutPerSpot;
    return (
      <div className="min-h-[100dvh] bg-gradient-to-b from-background to-card/40 flex flex-col">
        <div className="sticky top-0 z-20 bg-background/95 border-b border-border/30">
          <div className="max-w-md mx-auto p-3 flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-1" />Back
            </Button>
            <div className="text-xs font-semibold tracking-wider text-muted-foreground">SHARE FULL</div>
            <div className="w-[60px]" />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-sm w-full space-y-6 text-center">
            <div className="mx-auto h-20 w-20 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <Wallet className="h-10 w-10 text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Your pending balance is full 🧺</h1>
              <p className="text-sm text-muted-foreground mt-2">
                You've saved up ₦{pending.toLocaleString()} out of ₦{pendingCap.toLocaleString()} from your
                {' '}{spotCount} {spotCount === 1 ? 'ad share' : 'ad shares'}. Sit tight — your campaign is still filling up.
                The moment it reaches 100%, this money drops into your real wallet automatically. We'll ping you.
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-4 text-left space-y-2">
              <div className="text-[11px] uppercase tracking-wider text-emerald-400 font-semibold">
                Want to keep earning right now?
              </div>
              <div className="text-sm text-foreground leading-snug">
                Activate another ad share for <span className="font-bold">₦{extensionSpotPrice.toLocaleString()}</span> — your
                pending balance grows to <span className="font-bold">₦{nextCap.toLocaleString()}</span> and you can keep tapping.
              </div>
              <div className="text-[11px] text-muted-foreground leading-snug pt-1 border-t border-emerald-500/15 mt-2">
                Same one price for every ad share — your first one and every one after. Whatever you put in, that
                share pays it back double when its campaign reaches 100%.
              </div>
            </div>
            <Button
              onClick={async () => {
                if (extensionLoading) return;
                setExtensionLoading(true);
                try {
                  const { startExtensionPayment } = await import('@/lib/startExtensionPayment');
                  await startExtensionPayment(extensionSpotPrice);
                } finally {
                  // Leave a short guard so a re-render from the payment drawer
                  // doesn't allow an immediate double-fire.
                  setTimeout(() => setExtensionLoading(false), 1200);
                }
              }}
              disabled={extensionLoading}
              className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl disabled:opacity-80"
            >
              {extensionLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Starting payment…
                </>
              ) : (
                <>
                  Activate extra ad share — ₦{extensionSpotPrice.toLocaleString()}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              Your money isn't going anywhere — it's safe and waiting for your campaign to reach 100%.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ===== Non-member who already used their trial batch — show activation message =====
  if (!isMember && trialDone && !finishing && !showAtRisk) {
    const fee = Number(platformConfig?.membership_fee ?? 5000);
    const firstName = profile?.full_name?.trim().split(' ')[0] || 'there';
    return (
      <MoneyAtRiskScreen
        firstName={firstName}
        pendingTotal={pending}
        earnedSample={Number(naira || 0)}
        membershipFee={fee}
        onActivate={() => startMembershipPayment(fee)}
        onClose={() => navigate('/dashboard')}
      />
    );
  }

  // ===== Full-screen "batch finishing" — progressive, psychological =====
  if (finishing && !showAtRisk) {
    return <BatchFinishingScreen totalMs={BATCH_FINISH_MS} addedAmount={addedAmount} />;
  }


  // ===== After save: explicit completion screen with clear CTAs =====
  if (batchSaved && !showAtRisk) {
    const moreLeft = !!taskState?.can_do_more && !isDone;
    return (
      <BatchSavedScreen
        addedAmount={addedAmount}
        pendingTotal={pending}
        pendingCap={pendingCap}
        batchesDone={batchesDone}
        totalToday={totalToday}
        unlimited={isUnlimited}
        referralPendingBonus={Number(taskState?.referral_pending_bonus ?? 3000)}
        canDoMore={moreLeft}
        onDoAnother={() => {
          setBatchSaved(false);
          setPairs(null);
          setPairIdx(0);
          setSelected(null);
          batchSubmitStartedRef.current = false;
          loadBatch();
        }}
        onDashboard={() => navigate('/dashboard')}
      />
    );
  }

  // ===== Non-member "money at risk" screen — shown after batch upload =====
  if (showAtRisk) {
    const fee = Number(platformConfig?.membership_fee ?? 5000);
    const firstName = profile?.full_name?.trim().split(' ')[0] || 'there';
    return (
      <MoneyAtRiskScreen
        firstName={firstName}
        pendingTotal={pending}
        earnedSample={Number(addedAmount || naira || 0)}
        membershipFee={fee}
        onActivate={() => startMembershipPayment(fee)}
        onClose={() => navigate('/dashboard')}
      />
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-background to-card/40 flex flex-col">
      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-background/95 border-b border-border/30">
        <div className="max-w-md mx-auto p-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-4 w-4 mr-1" />Back
          </Button>
          <div className="text-xs font-semibold tracking-wider text-muted-foreground">EARNING SESSION</div>
          <div className="w-[60px]" />
        </div>
      </div>

      <div className="max-w-md mx-auto w-full p-4 space-y-3">
        {/* Minimalist total pending balance */}
        <div className="flex items-center justify-between px-1">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total pending</div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <div className="text-lg font-medium tabular-nums text-foreground">
                ₦{pending.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              {batchEarned > 0 && (
                <div
                  key={pairIdx}
                  className="font-bold tabular-nums text-emerald-400 transition-all duration-300 ease-out animate-scale-in leading-none"
                  style={{ fontSize: `${0.8 + Math.min(pairIdx, 10) * 0.09}rem` }}
                >
                  +₦{batchEarned.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 min-w-[120px]">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className={cn('h-1 flex-1 rounded-full', i < Math.min(pairIdx, 10) ? 'bg-emerald-400' : 'bg-muted')} />
            ))}
          </div>
        </div>

        {/* Invite shortcut — the ONE psychology lever: fill your pending
            balance faster by inviting a friend. No decision fatigue. */}
        {isMember && pendingCap > 0 && !isDone && (() => {
          const pct = Math.min(100, Math.max(0, (pending / pendingCap) * 100));
          const bump = Number(taskState?.referral_pending_bonus ?? 3000);
          const urgent = pct >= 85;
          return (
            <button
              type="button"
              onClick={() => { triggerHaptic(urgent ? 'medium' : 'light'); navigate('/invite'); }}
              className={
                'w-full rounded-xl border px-3 py-2.5 flex items-center gap-3 active:scale-[0.99] transition ' +
                (urgent
                  ? 'border-rose-500/40 bg-gradient-to-r from-rose-500/15 via-rose-500/10 to-transparent animate-pulse'
                  : 'border-amber-500/25 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent')
              }
              aria-label="Invite a friend to fill your pending balance faster"
            >
              <div className="flex-1 min-w-0 text-left">
                <div className="h-1.5 w-full rounded-full bg-muted/40 overflow-hidden mb-1.5">
                  <div
                    className={
                      'h-full rounded-full transition-all ' +
                      (urgent
                        ? 'bg-gradient-to-r from-rose-400 to-amber-400'
                        : 'bg-gradient-to-r from-amber-400 to-emerald-400')
                    }
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="text-[12px] text-foreground leading-snug">
                  Invite <span className="font-bold text-emerald-400">1 friend</span> = <span className="tabular-nums font-bold text-emerald-400">+₦{bump.toLocaleString()}</span> straight into your pending balance.
                </div>
              </div>
              <ArrowRight className={'h-4 w-4 shrink-0 ' + (urgent ? 'text-rose-400' : 'text-amber-400')} />
            </button>
          );
        })()}



        {isDone ? (
          <DailyDoneScreen
            firstName={profile?.full_name?.trim().split(' ')[0] || 'there'}
            referralCode={profile?.referral_code}
            bonusBatches={taskState.referral_bonus_batches}
            isMember={!!profile?.is_member}
            membershipFee={Number(platformConfig?.membership_fee ?? 5000)}
            referralCashBonus={Number(platformConfig?.referral_cash_bonus ?? 500)}
            referralPendingBonus={Number(taskState?.referral_pending_bonus ?? 3000)}
            unlimited={isUnlimited}
            capacityFull={capacityFull}
            pendingTotal={pending}
            pendingCap={pendingCap}
            onActivate={() => startMembershipPayment(Number(platformConfig?.membership_fee ?? 5000))}
            onShareFallback={() => navigate('/invite')}
          />
        ) : (
          <>
            {/* Counter + category */}
            <div className="flex items-center justify-between text-xs">
              <div className="text-muted-foreground">
                Pick <span className="font-semibold text-foreground tabular-nums">{Math.min(pairIdx + 1, 10)} of 10</span> today
              </div>
              {currentPair?.category_name && !transition && (
                <span className="rounded-full bg-muted px-3 py-1 font-semibold text-foreground">
                  {currentPair.category_name}
                </span>
              )}
            </div>

            <div className="text-center text-sm font-semibold text-foreground flex items-center justify-center gap-1.5">
              <HelpCircle className="h-3.5 w-3.5 text-primary" />
              {transition ? 'Loading next pick…' : prompt}
            </div>

            {/* Loading first batch */}
            {(loadingBatch || !pairs) ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Skeleton className="aspect-[9/16] rounded-2xl" />
                  <Skeleton className="aspect-[9/16] rounded-2xl" />
                </div>
                <div className="text-center text-[11px] text-muted-foreground">
                  Loading today's pictures…
                </div>
              </div>
            ) : currentPair ? (
              <>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${currentPair.image_a.id}-${currentPair.image_b.id}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="grid grid-cols-2 gap-3"
                    data-tour="task-images"

                  >
                    {(['a', 'b'] as const).map((side) => {
                      const img = side === 'a' ? currentPair.image_a : currentPair.image_b;
                      const isSelected = selected === side;
                      const isDimmed = selected !== null && !isSelected;
                      return (
                        <button
                          key={side}
                          disabled={!allowed || submitBatch.isPending || transition}
                          onClick={() => handleSelect(side)}
                          className={cn(
                            'relative aspect-[9/16] overflow-hidden rounded-2xl border-2 bg-muted transition-all active:scale-[0.98]',
                            isSelected ? 'border-emerald-400 ring-4 ring-emerald-400/40 scale-[1.02]' : 'border-border',
                            isDimmed && 'opacity-50',
                            !allowed && 'opacity-50',
                          )}
                        >
                          <img
                            src={img.url}
                            alt={`Option ${side.toUpperCase()}`}
                            className="h-full w-full object-cover"
                            loading="eager"
                            onError={() => handleImageError(img.id)}
                          />
                          <div className="absolute top-2 left-2 rounded-md bg-black/70 px-2 py-0.5 text-[11px] font-bold text-white tracking-wider">
                            {side.toUpperCase()}
                          </div>
                          {isSelected ? (
                            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-3 py-1 text-[10px] font-bold text-white whitespace-nowrap flex items-center gap-1">
                              <Check className="h-3 w-3" /> SELECTED
                            </div>
                          ) : (
                            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-white/95 px-3 py-1 text-[10px] font-bold text-black whitespace-nowrap">
                              TAP TO PICK
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </motion.div>
                </AnimatePresence>

                {/* Submit button — must confirm before next pair */}
                <Button
                  data-tour="submit-pick"
                  size="lg"
                  onClick={handleSubmit}

                  disabled={!selected || transition || submitBatch.isPending}
                  className={cn(
                    "w-full h-12 text-base font-bold transition-all",
                    selected
                      ? "bg-white text-black hover:bg-white/90"
                      : "bg-muted text-muted-foreground disabled:opacity-100 disabled:bg-muted disabled:text-muted-foreground"
                  )}
                >
                  {selected ? (
                    <>Submit pick <Check className="h-4 w-4 ml-1.5" /></>
                  ) : (
                    <>Tap an image first <Lock className="h-4 w-4 ml-1.5" /></>
                  )}
                </Button>
              </>
            ) : null}

            {!transition && currentPair && (
              <div className="flex flex-col items-center gap-2">
                {!reportOpen ? (
                  <button
                    onClick={() => { triggerHaptic('light'); setReportOpen(true); }}
                    className="mx-auto flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    <AlertTriangle className="h-3 w-3" />Report bad image
                  </button>
                ) : (
                  <div className="w-full rounded-2xl border border-border bg-card p-3 space-y-2">
                    <div className="text-[11px] font-semibold text-center text-foreground">
                      Which image is broken?
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Button size="sm" variant="outline" onClick={() => reportSide('a')} disabled={reportBroken.isPending}>
                        Image A
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => reportSide('b')} disabled={reportBroken.isPending}>
                        Image B
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => reportSide('both')} disabled={reportBroken.isPending}>
                        Both
                      </Button>
                    </div>
                    <button
                      onClick={() => setReportOpen(false)}
                      className="w-full text-center text-[10px] text-muted-foreground py-1"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}

            {!taskState.task_enabled && (
              <Card className="border-warning/30 bg-warning/5">
                <CardContent className="p-3 text-center text-xs">Earning is paused right now. Try again later.</CardContent>
              </Card>
            )}
            {!profile?.is_member && (
              <Card className="border-primary/30">
                <CardContent className="p-3 text-center text-xs text-muted-foreground">
                  You can earn now — money sits in <b>Pending</b> and moves to your withdrawable wallet once you activate.
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Between-pick overlay — pick reward + clear batch context so users
          never confuse a per-pick credit with their full batch total. */}
      <AnimatePresence>
        {transition && (
          <PickOverlay
            addedAmount={lastPickAmount}
            batchTotal={naira}
            pickNumber={Math.min(pairIdx + 1, 10)}
            totalPicks={10}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
// Between-pick overlay — pick reward + clear batch context
// ============================================================
function PickOverlay({
  addedAmount,
  batchTotal,
  pickNumber,
  totalPicks,
}: {
  addedAmount: number;
  batchTotal: number;
  pickNumber: number;
  totalPicks: number;
}) {
  const fmt = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 bg-background/95 flex items-center justify-center px-6 pointer-events-none"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 6 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: -6 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="text-center space-y-2 max-w-[280px]"
      >
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Pick {pickNumber} of {totalPicks} saved
        </div>
        <div className="text-4xl font-bold tabular-nums text-emerald-400 leading-none">
          +₦{fmt(addedAmount)}
        </div>
        {batchTotal > 0 && (
          <div className="text-xs text-muted-foreground leading-snug">
            Finish all {totalPicks} picks to earn{' '}
            <span className="text-foreground font-semibold tabular-nums">
              ₦{batchTotal.toLocaleString()}
            </span>{' '}
            for this batch
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ============================================================
// Batch Finishing Screen — progressive multi-stage psychology
// ============================================================
const FINISH_STAGES = [
  { key: 'lock',   label: 'Saving your 10 picks',           Icon: ShieldCheck,  durationFrac: 0.45 },
  { key: 'add',    label: 'Adding money to your Pending',   Icon: Coins,        durationFrac: 0.40 },
  { key: 'send',   label: 'All done — sending you back',    Icon: Send,         durationFrac: 0.15 },
];

function BatchFinishingScreen({ totalMs, addedAmount }: { totalMs: number; addedAmount: number }) {
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(Date.now());
  const lastStageRef = useRef<number>(-1);
  const { playSound } = useSoundEffects();

  useEffect(() => {
    const id = window.setInterval(() => {
      setElapsed(Date.now() - startedAt.current);
    }, 80);
    return () => window.clearInterval(id);
  }, []);

  const pct = Math.min(100, (elapsed / totalMs) * 100);

  // Determine current stage based on cumulative fraction
  let cumulative = 0;
  let activeIdx = 0;
  for (let i = 0; i < FINISH_STAGES.length; i++) {
    cumulative += FINISH_STAGES[i].durationFrac;
    if (pct / 100 <= cumulative) { activeIdx = i; break; }
    activeIdx = i + 1;
  }

  // Replay the calm sound on every stage transition
  useEffect(() => {
    if (activeIdx !== lastStageRef.current) {
      lastStageRef.current = activeIdx;
      // Skip the very first call (sound already played when finishing started)
      if (activeIdx > 0) playSound('refund'); // soft, calm "ding"
    }
  }, [activeIdx, playSound]);

  // Auto-scroll the newest revealed stage into view
  const bottomRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [activeIdx]);

  const visibleCount = Math.min(FINISH_STAGES.length, activeIdx + 1);
  const allDone = activeIdx >= FINISH_STAGES.length;

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col px-6 py-10 overflow-y-auto">
      <div className="max-w-md w-full mx-auto flex-1 flex flex-col">
        {/* Heading — matches Saved screen aesthetic */}
        <div className="mt-8 mb-10">
          <div className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground mb-3">
            SAVING YOUR PICKS
          </div>
          <h1 className="text-[28px] leading-tight font-semibold text-foreground">
            Locking in your campaign progress.
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Keep this screen open — about {Math.max(0, Math.ceil((totalMs - elapsed) / 1000))}s left.
          </p>
        </div>

        {/* Thin progress line */}
        <div className="mb-10">
          <div className="h-px w-full bg-border/60 overflow-hidden">
            <div
              className="h-full bg-foreground transition-[width] duration-100 ease-linear"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground tabular-nums">
            <span>{Math.floor(pct)}%</span>
            <span>{visibleCount} of {FINISH_STAGES.length}</span>
          </div>
        </div>

        {/* Progressive stages — appear one by one */}
        <div className="space-y-5">
          {FINISH_STAGES.slice(0, visibleCount).map((s, i) => {
            const done = i < activeIdx;
            const active = i === activeIdx && !allDone;
            return (
              <motion.div
                key={s.key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="flex items-start justify-between gap-4 py-3 border-b border-border/40"
              >
                <div className="flex-1">
                  <div className={cn(
                    'text-sm font-medium',
                    done ? 'text-foreground' : active ? 'text-foreground' : 'text-muted-foreground',
                  )}>
                    {s.label}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {done ? 'Done' : active ? 'In progress…' : 'Queued'}
                  </div>
                </div>
                <div className="shrink-0 pt-0.5">
                  {done ? (
                    <Check className="h-4 w-4 text-foreground" />
                  ) : active ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : null}
                </div>
              </motion.div>
            );
          })}

          {/* Amount reveal — only after stages have all been revealed */}
          {allDone && addedAmount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="pt-6"
            >
              <div className="text-[11px] text-muted-foreground mb-1">Added to pending</div>
              <div className="text-3xl font-semibold tabular-nums text-foreground">
                +₦{addedAmount.toLocaleString()}
              </div>
            </motion.div>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="mt-auto pt-10 text-center">
          <div className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <ShieldCheck className="h-3 w-3" />
            Encrypted &amp; saved to your account
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Batch Saved — shown to members after their earnings are locked in.
// Gives a clear CTA instead of teleporting them back to the dashboard.
// ============================================================
function BatchSavedScreen({
  addedAmount,
  pendingTotal,
  pendingCap,
  batchesDone,
  totalToday,
  unlimited,
  referralPendingBonus,
  canDoMore,
  onDoAnother,
  onDashboard,
}: {
  addedAmount: number;
  pendingTotal: number;
  pendingCap: number;
  batchesDone: number;
  totalToday: number;
  unlimited: boolean;
  referralPendingBonus: number;
  canDoMore: boolean;
  onDoAnother: () => void;
  onDashboard: () => void;
}) {
  const basketPct =
    pendingCap > 0 ? Math.min(100, (pendingTotal / pendingCap) * 100) : 0;

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col px-6 py-10">
      <div className="max-w-md w-full mx-auto flex-1 flex flex-col">
        {/* Heading */}
        <div className="mt-8 mb-10">
          <div className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground mb-3">
            {unlimited
              ? `₦${pendingTotal.toLocaleString()} OF ₦${pendingCap.toLocaleString()} IN PENDING BALANCE`
              : `ROUND ${batchesDone} OF ${totalToday}`}
          </div>
          <h1 className="text-[28px] leading-tight font-semibold text-foreground">
            Saved.
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            +₦{addedAmount.toLocaleString()} added to your pending balance.
          </p>
          {unlimited && pendingCap > 0 && (
            <>
              <div className="mt-4 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-emerald-400 transition-all"
                  style={{ width: `${basketPct}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-3">
                Want to skip ahead?{' '}
                <span className="text-emerald-400 font-semibold">
                  Invite 1 friend
                </span>{' '}
                — an instant{' '}
                <span className="text-emerald-400 font-semibold tabular-nums">
                  ₦{referralPendingBonus.toLocaleString()}
                </span>{' '}
                pops straight into your pending balance.
              </p>
            </>
          )}
        </div>

        {/* Quiet stat */}
        <div className="space-y-3 mb-10">
          <div className="flex items-center justify-between py-2 border-b border-border/40">
            <span className="text-xs text-muted-foreground">Pending balance</span>
            <span className="text-sm font-medium tabular-nums text-foreground">
              ₦{pendingTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* CTAs — always offer "Do another", let the task page handle the "no more" reveal */}
        <div className="space-y-3 mt-auto">
          <Button
            onClick={onDoAnother}
            size="lg"
            className="w-full h-12 text-sm font-semibold bg-white text-black hover:bg-white/90"
          >
            Do another round
          </Button>
          <button
            onClick={onDashboard}
            className="w-full h-12 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// "Money at risk" screen — shown to non-members after a batch upload.
// Replicates the dashboard TimeBasedGreeting non-member aesthetic:
// pure text, "Get full access + 1 free spot" CTA, "Ending soon" badge.
// Vertically centered for maximum focus.
// ============================================================
function MoneyAtRiskScreen({
  firstName,
  pendingTotal,
  earnedSample,
  membershipFee,
  onActivate,
  onClose,
}: {
  firstName: string;
  pendingTotal: number;
  /** ₦ per batch the user would earn as a member — shown as "what your money looks like." */
  earnedSample: number;
  membershipFee: number;
  onActivate: () => void;
  onClose: () => void;
}) {
  const paying = useMembershipPaymentLoading();
  const sample = Math.max(0, Number(earnedSample || 0));
  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-background flex items-center justify-center px-5 py-8">
      {/* Subtle ambient background — almost-invisible drifting particles */}
      <AmbientParticles />

      {/* Dark-red close X — top-right */}
      <button
        type="button"
        aria-label="Close and go to dashboard"
        onClick={() => {
          triggerHaptic('light');
          onClose();
        }}
        className="absolute top-4 right-4 z-20 h-9 w-9 rounded-full flex items-center justify-center bg-red-950/60 border border-red-900/70 text-red-300 hover:bg-red-900/70 hover:text-red-200 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="relative z-10 max-w-md w-full mx-auto">
        {/* CELEBRATE the trial first — this is the peak moment. */}
        {sample > 0 && (
          <div className="mb-6 text-center">
            <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-emerald-400 mb-2">
              Your free sample
            </div>
            <div className="text-5xl font-bold tabular-nums text-emerald-400 leading-none animate-scale-in">
              +₦{sample.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              That's what one round pays. Members do this unlimited — all day, every day.
            </p>
          </div>
        )}

        <div className="px-1">
          <h1 className="text-lg sm:text-xl font-semibold text-foreground leading-snug text-center">
            {firstName}, unlock unlimited earning for{' '}
            <span className="text-emerald-400 font-bold">
              ₦{membershipFee.toLocaleString()}
            </span>
            .
          </h1>
          <p className="text-sm text-muted-foreground text-center mt-2 leading-relaxed">
            One-time fee activates your first ad share and starts your campaign, worth ₦10,000 when it hits 100%. Keep going and each extra share pays ₦10,000 too.
          </p>

          <div className="mt-5 flex flex-col items-center gap-2">
            <Button
              onClick={() => {
                triggerHaptic('medium');
                onActivate();
              }}
              disabled={paying}
              className="w-full max-w-xs h-12 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm group disabled:opacity-80 rounded-xl"
            >
              {paying ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Starting payment…
                </>
              ) : (
                <>
                  Unlock earning — ₦{membershipFee.toLocaleString()}
                  <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              Includes your 1st ad share · Pays ₦10,000 at 100%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Visible drifting particles — adds clear life to the background.
// Pure CSS, no deps, GPU-friendly.
function AmbientParticles() {
  const dots = Array.from({ length: 32 });
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {dots.map((_, i) => {
        const left = (i * 37) % 100;
        const size = 4 + ((i * 7) % 6);
        const duration = 10 + ((i * 3) % 12);
        const delay = (i * 1.3) % 10;
        const drift = ((i * 13) % 60) - 30;
        const isGold = i % 4 === 0;
        return (
          <span
            key={i}
            className={`absolute rounded-full ${isGold ? 'bg-amber-300' : 'bg-emerald-400'}`}
            style={{
              left: `${left}%`,
              bottom: `-10px`,
              width: `${size}px`,
              height: `${size}px`,
              boxShadow: isGold
                ? '0 0 12px 2px rgba(252, 211, 77, 0.8), 0 0 24px 4px rgba(252, 211, 77, 0.4)'
                : '0 0 10px 2px rgba(52, 211, 153, 0.7), 0 0 20px 4px rgba(52, 211, 153, 0.35)',
              animation: `mar-float ${duration}s linear ${delay}s infinite`,
              ['--mar-drift' as any]: `${drift}px`,
            }}
          />
        );
      })}
      <style>{`
        @keyframes mar-float {
          0%   { transform: translate3d(0, 0, 0); opacity: 0; }
          8%   { opacity: 0.95; }
          50%  { opacity: 0.8; }
          92%  { opacity: 0.6; }
          100% { transform: translate3d(var(--mar-drift), -110vh, 0); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ============================================================
// Daily Done Screen — psychologically-tuned end-of-day moment.
// Inspired by the "Daily Limit Reached" hero in our Velocity
// project: celebrate the win, surface the cost of stopping,
// then make sharing the obvious next move.
// ============================================================
function DailyDoneScreen({
  firstName,
  referralCode,
  bonusBatches,
  isMember,
  membershipFee,
  referralCashBonus,
  referralPendingBonus,
  unlimited,
  capacityFull,
  pendingTotal,
  pendingCap,
  onActivate,
  onShareFallback,
}: {
  firstName: string;
  referralCode?: string | null;
  bonusBatches: number;
  isMember: boolean;
  membershipFee: number;
  referralCashBonus: number;
  referralPendingBonus: number;
  unlimited: boolean;
  capacityFull: boolean;
  pendingTotal: number;
  pendingCap: number;
  onActivate: () => void;
  onShareFallback: () => void;
}) {
  const resetText = useTimeUntilReset();
  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const shareMsg = useShareMessage();
  const paying = useMembershipPaymentLoading();

  // Always include the cloak access key (?k=…) so recipients bypass the
  // cloaked landing. generateReferralLink / buildInviteUrl attach it.
  const link = referralCode
    ? generateReferralLink(referralCode)
    : buildInviteUrl('/signup');

  const shareMessage = shareMsg.build(link);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      triggerHaptic('success');
      toast.success('Link copied — paste it anywhere');
      setTimeout(() => setCopied(false), 2200);
    } catch {
      onShareFallback();
    }
  };

  const handleNativeShare = async () => {
    triggerHaptic('light');
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try {
        await (navigator as any).share({
          title: 'Join me on Viketa',
          text: shareMessage,
          url: link,
        });
        return;
      } catch {
        // user cancelled
      }
    }
    handleCopy();
  };

  const handleWhatsApp = () => {
    triggerHaptic('light');
    const url = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // ====== NON-MEMBER: replicate the MoneyAtRisk pitch ======
  if (!isMember) {
    return (
      <div className="space-y-4 pt-2">
        <div className="px-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Lock className="h-3.5 w-3.5" />
            <span className="tracking-wide uppercase">That was your free sample</span>
          </div>

          <h1 className="text-lg sm:text-xl font-semibold text-foreground leading-snug">
            {firstName}, you just made real money in under a minute.{' '}
            <span className="text-emerald-400 font-bold">
              Members do this unlimited
            </span>{' '}
            — every round adds to your campaign, all day, straight into your pending balance. Unlock it for{' '}
            <span className="text-emerald-400 font-bold">
              ₦{membershipFee.toLocaleString()}
            </span>{' '}
            and your first ₦10,000 cash-out target is live.
          </h1>

          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <Button
              onClick={() => {
                triggerHaptic('medium');
                onActivate();
              }}
              size="sm"
              disabled={paying}
              className="h-10 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-medium text-sm group disabled:opacity-80"
            >
              {paying ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Starting payment…
                </>
              ) : (
                <>
                  Become a member + 1 free ad share
                  <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </Button>

            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-[11px] font-semibold text-rose-400 uppercase tracking-wide">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500" />
              </span>
              Free ad share ending soon
            </span>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full bg-muted/30 border border-border/40 px-3 py-1.5">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground">New pictures in</span>
          <span className="text-xs font-bold tabular-nums text-foreground">{resetText || '--:--:--'}</span>
        </div>
      </div>
    );
  }

  // ====== MEMBER: out-of-batches / pending balance-full → invite for the shortcut ======
  // In unlimited mode this branch fires when the pending balance is full
  // (pending ≥ ₦10k × spots). The referral gives a ₦3k instant pending jump
  // that helps them finish filling BEFORE their turn arrives.
  return (
    <div className="space-y-4 pt-2">
      <div className="px-1">
        {unlimited && capacityFull && (
          <div className="mb-3 inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
              Pending Balance full
            </span>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              ₦{pendingTotal.toLocaleString()} of ₦{pendingCap.toLocaleString()}
            </span>
          </div>
        )}

        {/* Task-style instruction — the shortcut is the hero now */}
        <p className="text-[15px] sm:text-base text-foreground leading-snug font-semibold">
          Skip the grind. Invite{' '}
          <span className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
            1 friend
          </span>
          {' '}to activate and instantly get{' '}
          <span className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded tabular-nums">
            ₦{referralPendingBonus.toLocaleString()}
          </span>
          {' '}jumped straight into your pending balance.
        </p>

        {/* Reward sentence — cash on top of the pending jump */}
        {(() => {
          const canWithdrawNow = referralCashBonus >= shareMsg.minWithdrawal;
          return (
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
              You also get an instant{' '}
              <span className="text-emerald-400 font-bold tabular-nums bg-emerald-500/10 px-1.5 py-0.5 rounded">
                ₦{referralCashBonus.toLocaleString()}
              </span>{' '}
              {canWithdrawNow ? (
                <>
                  cash you can withdraw straight into your bank in{' '}
                  <span className="font-semibold text-foreground">5 seconds</span>
                  {' '}— use it to prove to that friend the platform really pays.
                </>
              ) : (
                <>
                  cash in your withdrawal wallet. Once it reaches{' '}
                  <span className="font-semibold text-foreground tabular-nums">
                    ₦{shareMsg.minWithdrawal.toLocaleString()}
                  </span>
                  , withdraw it into your bank in{' '}
                  <span className="font-semibold text-foreground">5 seconds</span>.
                </>
              )}
            </p>
          );
        })()}
      </div>


      <Button
        onClick={() => {
          triggerHaptic('medium');
          setShareOpen(true);
        }}
        className="w-full h-11 text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-white group"
      >
        <TimerReset className="h-4 w-4 mr-2" />
        Invite a friend now
        <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </Button>

      {referralCode && (
        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            copyToClipboard(referralCode);
          }}
          className="mx-auto mt-1 flex items-center justify-center gap-2 px-4 py-2 rounded-full border border-border/40 bg-muted/20 active:scale-95 transition"
        >
          <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">
            Code
          </span>
          <span className="text-sm font-mono font-bold tracking-[0.25em] text-foreground">
            {referralCode}
          </span>
          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      )}

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Fill your pending balance faster</DialogTitle>
            <DialogDescription>
              Share your link. Each friend who activates instantly gives you{' '}
              <span className="font-semibold text-emerald-500 tabular-nums">₦{referralPendingBonus.toLocaleString()}</span>
              {' '}in your pending balance +{' '}
              <span className="font-semibold text-emerald-500 tabular-nums">₦{referralCashBonus.toLocaleString()}</span>
              {' '}cash in your earnings.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 pt-1">
            <Button
              onClick={handleWhatsApp}
              className="w-full h-11 bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Send on WhatsApp
            </Button>

            <Button
              onClick={handleNativeShare}
              variant="secondary"
              className="w-full h-11"
            >
              <Share2 className="h-4 w-4 mr-2" />
              Send another way
            </Button>

            <button
              onClick={handleCopy}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-muted/40 hover:bg-muted/60 border border-border/40 transition-colors"
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-400" />
              ) : (
                <Copy className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-sm font-medium text-foreground">
                {copied ? 'Copied — paste it anywhere' : 'Copy link'}
              </span>
            </button>

            <div className="pt-2 px-3 py-2 rounded-lg bg-muted/30 border border-border/40">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Your link</p>
              <p className="text-xs font-mono text-foreground break-all">{link}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
