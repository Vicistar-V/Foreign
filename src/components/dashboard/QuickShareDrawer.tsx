import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
  DrawerFooter,
} from '@/components/ui/drawer';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useDailyTask } from '@/hooks/useDailyTask';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import {
  generateReferralLink,
  copyToClipboard,
  shareViaWhatsApp,
  shareViaSMS,
  shareViaNativeAPI,
} from '@/lib/shareUtils';
import { useShareMessage } from '@/hooks/useShareMessage';
import { toast } from 'sonner';
import { triggerHaptic } from '@/lib/haptics';
import { FaWhatsapp } from 'react-icons/fa';
import {
  MessageSquare,
  Copy,
  Share2,
  CheckCircle2,
  TimerReset,
  Gift,
  Rocket,
  ArrowRight,
  Users,
  Repeat,
} from 'lucide-react';

interface QuickShareDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contextMessage?: string;
}

export function QuickShareDrawer({ open, onOpenChange }: QuickShareDrawerProps) {
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const { data: taskState } = useDailyTask(user?.id);
  const { data: platformConfig } = usePlatformConfig();
  const [copied, setCopied] = useState(false);

  const firstName = (profile?.full_name || '').split(' ')[0] || 'Friend';
  const referralCode = profile?.referral_code || '';
  const referralLink = referralCode ? generateReferralLink(referralCode) : '';
  const shareMsg = useShareMessage();

  // Dynamic values pulled from the same source as the Task page
  const bonusBatches = Number(
    taskState?.referral_bonus_batches ?? platformConfig?.task_referral_bonus_batches ?? 5,
  );
  const referralCashBonus = Number(
    taskState?.referral_cash_bonus ?? platformConfig?.referral_cash_bonus ?? 1000,
  );
  const referralPendingBonus = Number(
    taskState?.referral_pending_bonus ?? platformConfig?.referral_pending_bonus ?? 3000,
  );
  const nairaPerBatch = Number(taskState?.naira_per_batch_for_user ?? 0);
  const isUnlimited = !!taskState?.unlimited;
  const showBatchTile = !isUnlimited && bonusBatches > 0;
  const extraEarnings = bonusBatches * nairaPerBatch;

  const guard = (fn: () => void) => () => {
    if (!referralLink) {
      toast.error('Loading your referral link...');
      return;
    }
    fn();
  };

  const handleCopy = guard(async () => {
    const success = await copyToClipboard(referralLink);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  });

  const handleWhatsApp = guard(() => {
    shareViaWhatsApp(referralLink, shareMsg.build(referralLink));
    onOpenChange(false);
  });

  const handleSMS = guard(() => {
    shareViaSMS(referralLink, shareMsg.build(referralLink));
    onOpenChange(false);
  });

  const handleNativeShare = guard(async () => {
    const success = await shareViaNativeAPI(referralLink, shareMsg.headlineAndBody);
    if (success) onOpenChange(false);
  });

  const hasNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92vh] rounded-t-[2rem] border-primary/20 flex flex-col">
        <DrawerHeader className="px-5 pb-2 pt-5 text-left shrink-0">
          <div className="mb-3 inline-flex items-center gap-2 self-start rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1">
            <Users className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-400">
              Build your network
            </span>
          </div>
          <DrawerTitle className="text-xl font-bold tracking-tight text-foreground leading-snug">
            {firstName}, build your earning network
          </DrawerTitle>
          <DrawerDescription className="sr-only">
            Invite friends to unlock more batches, instant cash, and recurring profit.
          </DrawerDescription>
        </DrawerHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4">
          {/* Pitch — hero benefit is the ₦3k pending jump */}
          <div className="px-1">
            <p className="text-[15px] text-foreground leading-snug">
              Every friend who activates drops{' '}
              <span className="text-amber-400 font-bold tabular-nums bg-amber-500/10 px-1.5 py-0.5 rounded">
                ₦{referralPendingBonus.toLocaleString()}
              </span>{' '}
              straight into your pending balance and{' '}
              <span className="text-emerald-400 font-bold tabular-nums bg-emerald-500/10 px-1.5 py-0.5 rounded">
                ₦{referralCashBonus.toLocaleString()}
              </span>{' '}
              cash to your withdrawal wallet — instantly.
            </p>
            <p className="text-[13px] text-muted-foreground leading-snug mt-2">
              Skip the grind. One friend gets you closer to payout the moment they join.
            </p>
          </div>

          {/* HERO tile — pending jump */}
          <div className="rounded-2xl border-2 border-amber-400/30 bg-gradient-to-br from-amber-500/[0.12] to-emerald-500/[0.08] p-4 relative overflow-hidden">
            <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-amber-400/10 pointer-events-none" />
            <div className="relative">
              <div className="flex items-center gap-1.5 mb-1">
                <Rocket className="h-3.5 w-3.5 text-amber-400" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                  Pending jump — instant
                </p>
              </div>
              <p className="text-2xl font-bold tabular-nums text-foreground leading-tight">
                ₦{referralPendingBonus.toLocaleString()}
              </p>
              <p className="text-[12px] text-muted-foreground leading-snug mt-1">
                Lands in your pending balance the second your friend activates.
              </p>
            </div>
          </div>

          {/* Secondary tiles */}
          <div className={showBatchTile ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-1 gap-2'}>
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.08] p-3">
              <div className="flex items-center gap-1 mb-1">
                <Gift className="h-3 w-3 text-emerald-400" />
                <p className="text-[9px] font-semibold uppercase tracking-wider text-emerald-400">
                  Instant cash
                </p>
              </div>
              <p className="text-lg font-bold tabular-nums text-foreground leading-tight">
                ₦{referralCashBonus.toLocaleString()}
              </p>
              <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                To your withdrawable wallet
              </p>
            </div>
            {showBatchTile && (
              <div className="rounded-2xl border border-primary/25 bg-primary/[0.08] p-3">
                <div className="flex items-center gap-1 mb-1">
                  <TimerReset className="h-3 w-3 text-primary" />
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-primary">
                    Today
                  </p>
                </div>
                <p className="text-lg font-bold tabular-nums text-foreground leading-tight">
                  +{bonusBatches}
                </p>
                <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                  {bonusBatches === 1 ? 'extra batch' : 'extra batches'}
                </p>
              </div>
            )}
          </div>

          {showBatchTile && nairaPerBatch > 0 && (
            <div className="rounded-2xl border border-border/40 bg-muted/20 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Bonus: more daily room
              </p>
              <p className="text-sm text-foreground leading-snug">
                Each extra batch pays{' '}
                <span className="font-bold tabular-nums text-emerald-400">
                  ₦{nairaPerBatch.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                {extraEarnings > 0 && (
                  <>
                    , so {bonusBatches} extra {bonusBatches === 1 ? 'batch' : 'batches'} from one friend ≈{' '}
                    <span className="font-bold tabular-nums text-foreground">
                      ₦{extraEarnings.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>{' '}
                    more today
                  </>
                )}
                .
              </p>
            </div>
          )}

          {/* Share buttons */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Share your link
            </p>
            <div className="grid grid-cols-1 gap-2">
              <Button
                onClick={handleWhatsApp}
                className="h-12 w-full rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold"
                haptic="medium"
              >
                <FaWhatsapp className="h-5 w-5 mr-2" />
                Send on WhatsApp
              </Button>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={handleSMS}
                  variant="outline"
                  className="h-12 rounded-2xl"
                  haptic="light"
                >
                  <MessageSquare className="h-4 w-4 mr-1.5" />
                  Text
                </Button>

                <Button
                  onClick={handleCopy}
                  variant="outline"
                  className="h-12 rounded-2xl"
                  haptic="light"
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-1.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1.5" />
                      Copy link
                    </>
                  )}
                </Button>
              </div>

              {hasNativeShare && (
                <Button
                  onClick={handleNativeShare}
                  variant="ghost"
                  className="h-11 w-full rounded-2xl text-muted-foreground"
                  haptic="light"
                >
                  <Share2 className="h-4 w-4 mr-1.5" />
                  More apps
                </Button>
              )}
            </div>
          </div>

          {/* Link + code */}
          <div className="rounded-2xl border border-border/40 bg-muted/20 p-3 space-y-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Your link
              </p>
              <p className="text-xs font-mono text-foreground break-all leading-snug">
                {referralLink || 'Loading…'}
              </p>
            </div>
            {referralCode && (
              <button
                type="button"
                onClick={async () => {
                  triggerHaptic('light');
                  await copyToClipboard(referralCode);
                }}
                className="w-full pt-2 border-t border-border/40 text-left active:opacity-70 transition"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                      Or share your code (tap to copy)
                    </p>
                    <p className="text-base font-mono font-bold tracking-[0.2em] text-foreground">
                      {referralCode}
                    </p>
                  </div>
                  <Copy className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              </button>
            )}
          </div>

          <p className="rounded-xl bg-muted/30 px-3 py-2 text-center text-[11px] leading-relaxed text-muted-foreground">
            Tip: send it with a short note like "Tap this and join Viketa with me."
          </p>
        </div>

        <DrawerFooter className="pt-2 pb-3 shrink-0 border-t border-border/40">
          <DrawerClose asChild>
            <Button variant="ghost" size="sm" className="rounded-2xl">
              Close
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
