import { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { useSoundEffects } from '@/hooks/useSoundEffects';


import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useDropStatus, Spot } from '@/hooks/useDropStatus';
import { useBalances } from '@/hooks/useBalances';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useRetirementStatus } from '@/hooks/useRetirementStatus';
import { CheckCircle, Plus, Layers, ChevronDown, RotateCw } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { SpotDetailDrawer } from './SpotDetailDrawer';
import { BuySpotDrawer } from './BuySpotDrawer';
import { SpotCircle } from './SpotCircle';
import { AutoBuySpotsToggle } from './AutoBuySpotsToggle';
import { DepositModal } from '@/components/DepositModal';
import { openRestoreCapacityDrawer } from '@/lib/restoreCapacityStore';
import { subscribeBuySpotRequests } from '@/lib/buySpotDrawerStore';
import { triggerHaptic } from '@/lib/haptics';

interface MachinesCardProps {
  onActivateMembership?: () => void;
}

export function MachinesCard({ onActivateMembership }: MachinesCardProps) {
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const { data, isLoading } = useDropStatus();
  const { data: balances } = useBalances(user?.id);
  const { data: retirement, isLoading: retirementLoading } = useRetirementStatus();
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [showBuyDrawer, setShowBuyDrawer] = useState(false);
  const [buyQuantity, setBuyQuantity] = useState<number>(1);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showRestoreDrawer, setShowRestoreDrawer] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [showGrowOptions, setShowGrowOptions] = useState(false);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [customQty, setCustomQty] = useState(2);
  const { playSound } = useSoundEffects();
  const celebratedRef = useRef(false);
  const handlePrimaryRef = useRef<() => void>(() => {});


  const isMember = profile?.is_member ?? false;

  // Retired state: member paid out and every spot has retired.
  const isRetired = !!retirement?.is_retired;

  // One-time celebration the first time the retirement hero renders in a
  // session — turn the cold "spots offline" screen into a moment that
  // matches the emotional weight of a big cash-out.
  // NOTE: MUST be declared before any early return to keep hook order stable
  // across renders (fixes React #300 "Rendered fewer hooks than expected").
  useEffect(() => {
    if (isRetired && !celebratedRef.current) {
      celebratedRef.current = true;
      playSound('bigWin');
      triggerHaptic('success');
      const fire = (x: number) => {
        confetti({
          particleCount: 45,
          spread: 60,
          startVelocity: 35,
          origin: { x, y: 0.35 },
          colors: ['#10b981', '#34d399', '#fbbf24', '#f59e0b'],
          disableForReducedMotion: true,
          scalar: 0.9,
        });
      };
      fire(0.5);
      setTimeout(() => fire(0.2), 120);
      setTimeout(() => fire(0.8), 240);
    }
  }, [isRetired, playSound]);

  useEffect(() => {
    return subscribeBuySpotRequests(() => handlePrimaryRef.current());
  }, []);



  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-12 w-full rounded-2xl" />
      </div>
    );
  }

  const spots: Spot[] = data?.user?.spots || [];
  const config = data?.config;
  const profitAmount = config?.profit_amount || 10000;
  const entryFee = config?.entry_fee || 5000;

  // Use real backend totals (covers ALL spots, not just first 6)
  const totalSpots = data?.user?.total_spots_count ?? spots.length;
  const totalEarned = data?.user?.total_earnings_all_spots ?? spots.reduce((s, x) => s + (x.total_earnings || 0), 0);
  const totalCycles = data?.user?.total_cycles_all_spots ?? spots.reduce((s, x) => s + (x.total_cycles || 0), 0);
  const hasSpots = totalSpots > 0;
  const hasMore = !!data?.user?.has_more_spots;

  // Empire mode: single shared ticket every spot points to.
  const sharedDrop = data?.user?.shared_drop ?? null;
  // The actual amount THIS user will collect when their line fills — grows by
  // ₦{drop_target_amount} for every spot they own. Falls back to the config
  // baseline for the "no active ticket yet" state.
  const lineTargetPayout = Number(sharedDrop?.target_amount ?? profitAmount) || profitAmount;
  const lineFillPercent = Math.min(100, Math.max(0, Number(sharedDrop?.fill_percentage ?? 0)));
  const lineFillAmount = Number(sharedDrop?.fill_amount ?? 0);


  const canBuyMore =
    !!balances &&
    ((balances.deposit_balance || 0) >= entryFee || (balances.earnings_balance || 0) >= entryFee);


  const handlePrimary = () => {
    triggerHaptic('medium');
    setBuyQuantity(1);
    // Only route to activation when we KNOW the user isn't a member yet
    // (profile loaded AND is_member=false). A stale/loading profile used to
    // slip through here and trigger a duplicate ₦5,000 membership charge
    // right after activation.
    if (profile && !isMember && !hasSpots && onActivateMembership) {
      onActivateMembership();
      return;
    }

    // If the user just cashed out and has 0 active spots, send them
    // to the 1-click Restore Capacity flow instead of the single-spot drawer.
    if (isRetired) {
      openRestoreCapacityDrawer();
      return;
    }
    // Single unified flow — the BuySpotDrawer itself handles the
    // insufficient-funds path (Continue to bank transfer → Moniepoint).
    setShowBuyDrawer(true);
  };

  const openGrowWith = (qty: number) => {
    triggerHaptic('medium');
    setBuyQuantity(qty);
    if (isRetired) { openRestoreCapacityDrawer(); return; }
    setShowBuyDrawer(true);
  };

  // Let external components (e.g. WalletCard "Add Spots") trigger the same
  // wallet-first flow instead of jumping straight to a bank payment.
  handlePrimaryRef.current = handlePrimary;


  const position = Number(sharedDrop?.position ?? 0);
  const peopleAhead = Math.max(0, position - 1);
  const growthAmount = profitAmount; // +₦10,000 per extra spot

  return (
    <>
      {/* ── Retirement hero (shown when every spot has retired) ── */}
      {isRetired && retirement && (
        <button
          type="button"
          onClick={() => { triggerHaptic('medium'); openRestoreCapacityDrawer(); }}
          className="w-full text-left rounded-2xl border border-primary/30 bg-primary/10 p-4 active:scale-[0.99] transition-transform"
        >
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <CheckCircle className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold tracking-wider text-primary uppercase">
                You just cashed out
              </p>
              <p className="text-sm font-bold text-foreground mt-0.5">
                This share is finished. Activate another share to join a new campaign.
              </p>
              <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                You pay ₦{(retirement.base_fee ?? 5000).toLocaleString()} to start a new campaign.
              </p>
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1">
                <RotateCw className="h-3 w-3 text-primary" />
                <span className="text-[10px] font-bold text-primary">Tap to activate another share</span>
              </div>
            </div>
          </div>
        </button>
      )}

      {/* "My upcoming payout" card removed — the curved payout gauge on
          WalletCard now owns that surface. We keep the drawers, retirement
          hero, and (optionally) the "See my spots" list mounted here so the
          existing wallet CTAs (requestBuySpot / Restore) still work. */}

      {!isRetired && hasSpots && (
        <section className="rounded-2xl border border-border bg-card overflow-hidden shadow-soft">
          <Collapsible open={isOpen} onOpenChange={(o) => { triggerHaptic('light'); setIsOpen(o); }}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-3 text-[11px] text-muted-foreground active:bg-muted/30 transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" />
                  See my shares ({totalSpots})
                </span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
              <div className="px-4 pb-4 pt-1">
                <div className="-mx-1 overflow-x-auto scrollbar-none">
                  <div className="flex items-start gap-3 px-1 py-1 snap-x snap-mandatory">
                    {spots.map((spot, index) => (
                      <SpotCircle
                        key={spot.spot_id}
                        spot={spot}
                        index={index}
                        onClick={() => { triggerHaptic('light'); setSelectedSpot(spot); }}
                      />
                    ))}
                    {hasMore && (
                      <div className="snap-start shrink-0 flex flex-col items-center gap-1.5 w-[68px]">
                        <div className="h-14 w-14 rounded-full bg-muted/30 flex items-center justify-center">
                          <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">
                            +{Math.max(0, totalSpots - spots.length)}
                          </span>
                        </div>
                        <span className="text-[10px] font-medium text-muted-foreground">more</span>
                      </div>
                    )}
                  </div>
                </div>
                {isMember && (
                  <div className="mt-3">
                    <AutoBuySpotsToggle enabled={profile?.auto_compound_enabled ?? false} />
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </section>
      )}

      {/* Non-member / no-spots fallback CTA — the wallet card's "Activate"
          button covers most of this, but we keep a small anchor here so
          brand-new visitors still see a clear entry point on the dashboard. */}
      {!isRetired && !hasSpots && !isMember && (
        <Button
          onClick={handlePrimary}
          className="w-full min-h-12 rounded-2xl gap-2 whitespace-normal text-sm font-bold bg-foreground text-background hover:bg-foreground/90"
        >
          <Plus className="h-4 w-4" />
          Activate a share — pays ₦{profitAmount.toLocaleString()}
        </Button>
      )}

      <SpotDetailDrawer

        spot={selectedSpot}
        open={!!selectedSpot}
        onOpenChange={(open) => !open && setSelectedSpot(null)}
        config={config}
      />

      <BuySpotDrawer
        open={showBuyDrawer}
        onOpenChange={(o) => { setShowBuyDrawer(o); if (!o) setShowGrowOptions(false); }}
        config={config}
        defaultQuantity={buyQuantity}
      />

      <DepositModal
        open={showDepositModal}
        onOpenChange={setShowDepositModal}
        autoBuySpots={buyQuantity}
      />

      {/* RestoreCapacityDrawer is mounted globally via RestoreCapacityHost */}
    </>
  );
}
