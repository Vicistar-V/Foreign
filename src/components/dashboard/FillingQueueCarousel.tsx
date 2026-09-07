import { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { AnimatedProgress } from '@/components/ui/animated-progress';
import { useDropStatus, type FillingDrop } from '@/hooks/useDropStatus';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion, AnimatePresence, LayoutGroup, useReducedMotion } from 'framer-motion';
import { AvatarPreviewDrawer } from '@/components/results/AvatarPreviewDrawer';
import { triggerHaptic } from '@/lib/haptics';
import { toast } from '@/hooks/use-toast';
import {
  ChevronLeft,
  ChevronRight,
  Zap,
  TrendingUp,
  Gift,
  Plus,
} from 'lucide-react';
import { requestBuySpot } from '@/lib/buySpotDrawerStore';

import mockPerson01 from '@/assets/queue-mocks/person-01.jpg';
import mockPerson02 from '@/assets/queue-mocks/person-02.jpg';
import mockPerson03 from '@/assets/queue-mocks/person-03.jpg';
import mockPerson04 from '@/assets/queue-mocks/person-04.jpg';
import mockPerson05 from '@/assets/queue-mocks/person-05.jpg';
import mockPerson06 from '@/assets/queue-mocks/person-06.jpg';
import mockPerson07 from '@/assets/queue-mocks/person-07.jpg';
import mockPerson08 from '@/assets/queue-mocks/person-08.jpg';
import mockPerson09 from '@/assets/queue-mocks/person-09.jpg';
import mockPerson10 from '@/assets/queue-mocks/person-10.jpg';

const CARD_WIDTH = 260;
const CARD_GAP = 12;
const STEP = CARD_WIDTH + CARD_GAP;

const getInitials = (name: string): string => name.charAt(0).toUpperCase();
const getFirstName = (fullName: string): string => fullName.split(' ')[0];

interface QueueItemProps {
  drop: FillingDrop;
  index: number;
  isMine: boolean;
  isJustUpdated: boolean;
  extraGlow?: boolean;
  /** Minimum visual fill so a brand-new spot never shows "0%" (bad UX).
   *  Sourced from platform_config.entry_fee — one seeded batch worth. */
  seedAmount?: number;
  onTap: () => void;
}

function QueueItem({ drop, index, isMine, isJustUpdated, extraGlow, seedAmount = 0, onTap }: QueueItemProps) {
  const isActive = index === 0;
  // Only the front spot uses the phantom seed. Everyone else shows real data
  // (which for a waiting spot is ₦0) but we hide the progress bar entirely.
  const displayFill = isActive
    ? Math.max(drop.fill_amount, Math.min(seedAmount, drop.target_amount))
    : drop.fill_amount;
  const fillPercent = Math.min(100, Math.round((displayFill / Math.max(1, drop.target_amount)) * 100));

  // The "front of line" attention pulse — two strong blinks of golden light.
  const glowKeyframes = extraGlow
    ? [
        '0 0 0 0 hsl(45 100% 60% / 0)',
        '0 0 0 14px hsl(45 100% 60% / 0.55)',
        '0 0 0 0 hsl(45 100% 60% / 0)',
        '0 0 0 14px hsl(45 100% 60% / 0.55)',
        '0 0 0 0 hsl(45 100% 60% / 0)',
      ]
    : isJustUpdated
    ? [
        '0 0 0 hsl(var(--primary) / 0)',
        '0 0 22px hsl(var(--primary) / 0.45)',
        '0 0 0 hsl(var(--primary) / 0)',
      ]
    : '0 0 0 hsl(var(--primary) / 0)';

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, x: 60, scale: 0.94 }}
      animate={{
        opacity: 1,
        x: 0,
        scale: 1,
        boxShadow: glowKeyframes,
      }}
      exit={{
        opacity: 0,
        x: -100,
        scale: 0.9,
        transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] },
      }}
      transition={{
        layout: { type: 'spring', stiffness: 320, damping: 32 },
        opacity: { duration: 0.3 },
        x: { type: 'spring', stiffness: 280, damping: 28 },
        scale: { type: 'spring', stiffness: 320, damping: 26 },
        boxShadow: extraGlow
          ? { duration: 1.4, ease: 'easeInOut' }
          : { duration: 1.1, ease: 'easeOut' },
      }}
      style={{ width: CARD_WIDTH, willChange: 'transform, opacity' }}
      className="px-1.5 pt-3 pb-1"
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onTap}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onTap();
          }
        }}
        aria-label={`See ${drop.user_name}'s profile picture`}
        className={`
          relative h-full w-full text-left rounded-2xl p-4 transition-colors duration-300 overflow-visible cursor-pointer active:scale-[0.99]
          ${
            isMine
              ? 'bg-gradient-to-br from-primary/15 via-primary/5 to-amber-500/5 border-2 border-primary/40'
              : isActive
              ? 'bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/30'
              : 'bg-card/80 border border-border/50'
          }
          ${!isActive && !isMine ? 'opacity-90' : ''}
        `}
      >
        <div className="absolute top-3 right-3 z-10">
          {isMine ? (
            <div className="px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold shadow-lg">
              YOU
            </div>
          ) : isActive ? (
            <div className="px-2.5 py-1 rounded-full bg-amber-500 text-white text-[10px] font-bold shadow-lg flex items-center gap-1">
              <motion.span
                className="w-1.5 h-1.5 rounded-full bg-white"
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
              FILLING
            </div>
          ) : (
            <div className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-medium tabular-nums">
              #{index + 1}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 mb-3">
          <Avatar
            className={`h-10 w-10 ring-2 ${
              isMine
                ? 'ring-primary/50'
                : isActive
                ? 'ring-amber-500/50'
                : 'ring-border'
            }`}
          >
            <AvatarImage src={drop.avatar_url || undefined} alt={drop.user_name} className="object-cover" />
            <AvatarFallback className="bg-muted text-sm font-semibold">
              {getInitials(drop.user_name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">
              {isMine ? 'You' : getFirstName(drop.user_name)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {(drop.spots_count ?? 1) === 1 ? '1 share' : `${drop.spots_count} shares`}
            </p>
          </div>
        </div>

        {drop.has_referrer && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 mb-3 rounded-lg bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20">
            <Gift className="h-3.5 w-3.5 text-purple-500" />
            <span className="text-[10px] font-medium text-purple-600 dark:text-purple-400">
              Invited by a friend
            </span>
          </div>
        )}

        {isActive ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Progress</span>
              <motion.span
                key={fillPercent}
                initial={{ y: -6, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.25 }}
                className={`text-sm font-bold tabular-nums ${
                  isMine ? 'text-primary' : 'text-amber-600'
                }`}
              >
                {fillPercent}%
              </motion.span>
            </div>

            <AnimatedProgress
              value={fillPercent}
              variant={isMine ? 'primary' : 'active'}
              showShimmer={true}
            />

            <div className="flex items-center justify-between text-[10px] text-muted-foreground tabular-nums">
              <span>₦{displayFill.toLocaleString()}</span>
              <span>of ₦{drop.target_amount.toLocaleString()}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Will receive</span>
              <span className={`text-base font-bold tabular-nums ${
                isMine ? 'text-primary' : 'text-foreground'
              }`}>
                ₦{drop.target_amount.toLocaleString()}
              </span>
            </div>
            {isMine ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  triggerHaptic('medium');
                  requestBuySpot();
                }}
                className="w-full rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white px-2.5 py-2 text-[11px] font-semibold flex items-center justify-center gap-1 shadow-sm active:scale-[0.98] transition-transform"
              >
                <Plus className="h-3 w-3" />
                Increase your payout
              </button>
            ) : (
              <div className="rounded-lg bg-muted/40 border border-border/40 px-2.5 py-2 text-center">
                <span className="text-[10px] font-medium text-muted-foreground">
                  Campaign still filling…
                </span>
              </div>
            )}
          </div>
        )}

        <div
          className={`
            mt-3 w-full py-1.5 px-2.5 rounded-lg text-center text-[10px] font-medium
            ${
              isActive
                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                : 'bg-muted/50 text-muted-foreground'
            }
          `}
        >
          {isActive ? (
            <span className="flex items-center justify-center gap-1">
              <Zap className="h-3 w-3" />
              Campaign filling up
            </span>
          ) : (
            `Campaign still filling up`
          )}
        </div>
      </div>
    </motion.div>
  );
}

interface FillingQueueCarouselProps {
  isMember?: boolean;
  cardCTA?: React.ReactNode;
  /** Play the entrance + sweep + blink choreography on first mount. */
  playIntro?: boolean;
  /** Fires when the intro sequence finishes (so a follow-up CTA can appear). */
  onIntroComplete?: () => void;
}

export function FillingQueueCarousel({
  isMember = true,
  cardCTA,
  playIntro = true,
  onIntroComplete,
}: FillingQueueCarouselProps) {
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const { data, isLoading, refetch } = useDropStatus();
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scrollMetrics, setScrollMetrics] = useState({ scrollLeft: 0, clientWidth: 0 });
  const [recentlyUpdated, setRecentlyUpdated] = useState<Set<string>>(new Set());
  const [previewDrop, setPreviewDrop] = useState<FillingDrop | null>(null);
  const [blinkFront, setBlinkFront] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const realFillingDrops: FillingDrop[] = data?.currently_filling || [];

  // ── Mock fallback ─────────────────────────────────────────────────────────
  const fillingDrops: FillingDrop[] = useMemo(() => {
    const MIN_VISIBLE = 10;
    if (realFillingDrops.length >= MIN_VISIBLE) return realFillingDrops;

    const MOCK_PEOPLE: Array<{ name: string; avatar: string; spots: number; fillPct: number }> = [
      { name: 'Chinedu Okafor',    avatar: mockPerson01, spots: 6,  fillPct: 72 },
      { name: 'Aisha Bello',       avatar: mockPerson02, spots: 16, fillPct: 55 },
      { name: 'Emeka Nwosu',       avatar: mockPerson03, spots: 25, fillPct: 41 },
      { name: 'Blessing Adeyemi',  avatar: mockPerson04, spots: 3,  fillPct: 34 },
      { name: 'Tunde Adebayo',     avatar: mockPerson05, spots: 8,  fillPct: 28 },
      { name: 'Ngozi Eze',         avatar: mockPerson06, spots: 12, fillPct: 22 },
      { name: 'Ifeanyi Obi',       avatar: mockPerson07, spots: 4,  fillPct: 18 },
      { name: 'Amaka Nnamdi',      avatar: mockPerson08, spots: 20, fillPct: 14 },
      { name: 'Segun Ojo',         avatar: mockPerson09, spots: 2,  fillPct: 9  },
      { name: 'Halima Yusuf',      avatar: mockPerson10, spots: 10, fillPct: 5  },
    ];

    const needed = MIN_VISIBLE - realFillingDrops.length;
    const startPos = realFillingDrops.length + 1;
    const mocks: FillingDrop[] = MOCK_PEOPLE.slice(0, needed).map((p, i) => {
      const target = p.spots * 10_000;
      return {
        id: `mock:${i}`,
        position: startPos + i,
        fill_amount: Math.round((target * p.fillPct) / 100),
        target_amount: target,
        fill_percent: p.fillPct,
        status: realFillingDrops.length + i === 0 ? 'filling' : 'waiting',
        user_id: null,
        user_name: p.name,
        avatar_url: p.avatar,
        spot_name: 'Ad share',
        spots_count: p.spots,
        has_referrer: false,
      };
    });
    return [...realFillingDrops, ...mocks];
  }, [realFillingDrops, data?.config?.target_amount]);

  // Detect fill_amount changes for the "money landed" pulse
  const previousFillRef = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    const updated = new Set<string>();
    const next = new Map<string, number>();
    for (const d of fillingDrops) {
      const prev = previousFillRef.current.get(d.id);
      if (prev !== undefined && prev !== d.fill_amount) updated.add(d.id);
      next.set(d.id, d.fill_amount);
    }
    previousFillRef.current = next;
    if (updated.size > 0) {
      setRecentlyUpdated(updated);
      const t = setTimeout(() => setRecentlyUpdated(new Set()), 1300);
      return () => clearTimeout(t);
    }
  }, [fillingDrops]);

  // Virtualizer — only renders ~6 cards at a time, recycles the rest
  const virtualizer = useVirtualizer({
    count: fillingDrops.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => STEP,
    horizontal: true,
    overscan: 3,
    getItemKey: (i) => fillingDrops[i]?.id ?? i,
  });

  // Track scroll position for dot indicators + peek visibility
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const newIndex = Math.round(container.scrollLeft / STEP);
      setCurrentIndex(
        Math.max(0, Math.min(newIndex, Math.max(0, fillingDrops.length - 1)))
      );
      setScrollMetrics({ scrollLeft: container.scrollLeft, clientWidth: container.clientWidth });
    };
    // prime initial metrics
    setScrollMetrics({ scrollLeft: container.scrollLeft, clientWidth: container.clientWidth });
    container.addEventListener('scroll', handleScroll, { passive: true });
    const ro = new ResizeObserver(handleScroll);
    ro.observe(container);
    return () => {
      container.removeEventListener('scroll', handleScroll);
      ro.disconnect();
    };
  }, [fillingDrops.length]);

  const snapRestoreRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollToIndex = (index: number) => {
    const el = containerRef.current;
    if (!el) return;
    el.style.scrollSnapType = 'none';
    const target = Math.max(0, Math.min(index * STEP, el.scrollWidth - el.clientWidth));
    el.scrollTo({ left: target, behavior: 'smooth' });
    if (snapRestoreRef.current) clearTimeout(snapRestoreRef.current);
    snapRestoreRef.current = setTimeout(() => {
      if (containerRef.current) {
        containerRef.current.style.scrollSnapType = 'x mandatory';
      }
    }, 700);
  };

  const canScrollPrev = currentIndex > 0;
  const canScrollNext = currentIndex < fillingDrops.length - 1;

  // ── "You" sticky peek logic ────────────────────────────────────────────────
  const myCarouselIndex = useMemo(
    () => (user ? fillingDrops.findIndex((d) => d.user_id === user.id) : -1),
    [fillingDrops, user?.id]
  );
  const myCarouselDrop = myCarouselIndex >= 0 ? fillingDrops[myCarouselIndex] : null;

  const myFallbackDrop = useMemo(() => {
    if (myCarouselDrop) return null;
    const spots = data?.user?.spots || [];
    const inQueue = spots
      .map((s) => s.current_drop)
      .filter((d): d is NonNullable<typeof d> =>
        !!d && (d.status === 'waiting' || d.status === 'filling')
      )
      .sort((a, b) => a.position - b.position);
    return inQueue[0] || null;
  }, [data?.user?.spots, myCarouselDrop]);

  const peekPosition = myCarouselDrop?.position ?? myFallbackDrop?.position ?? null;
  const peekPercent = myCarouselDrop
    ? Math.min(100, Math.round(myCarouselDrop.fill_percent))
    : myFallbackDrop
      ? Math.min(100, Math.round((myFallbackDrop.fill_amount / myFallbackDrop.target_amount) * 100))
      : 0;

  // Is the user's card actually inside the visible viewport of the carousel?
  const isMyCardInView = useMemo(() => {
    if (myCarouselIndex < 0) return false;
    if (scrollMetrics.clientWidth === 0) return false;
    const left = myCarouselIndex * STEP;
    const right = left + CARD_WIDTH;
    return (
      left >= scrollMetrics.scrollLeft - 24 &&
      right <= scrollMetrics.scrollLeft + scrollMetrics.clientWidth + 24
    );
  }, [myCarouselIndex, scrollMetrics]);

  const showPeek =
    peekPosition !== null && !isMyCardInView && !blinkFront && !isLoading;

  const handlePeekTap = () => {
    triggerHaptic('light');
    if (myCarouselIndex >= 0) {
      scrollToIndex(myCarouselIndex);
      return;
    }
    if (myFallbackDrop) {
      toast({
        title: `Your campaign is filling up`,
        description: `Your campaign is ${peekPercent}% done. We'll notify you when it reaches 100%.`,
      });
    }
  };

  // Realtime — coalesce bursts so animations get room to play
  useEffect(() => {
    let pending: ReturnType<typeof setTimeout> | null = null;
    const schedule = (ms: number) => {
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => {
        pending = null;
        refetch();
      }, ms);
    };

    const channel = supabase
      .channel('public:queue-live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_update_signals',
          filter: 'signal_type=eq.queue_changed',
        },
        () => schedule(450)
      )
      .subscribe();

    return () => {
      if (pending) clearTimeout(pending);
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  // ── Premium intro choreography (Patched) ──────────────────────────────────
  const introRan = useRef(false);
  useEffect(() => {
    if (introRan.current) return;
    if (isLoading || fillingDrops.length === 0) return;
    introRan.current = true;

    if (prefersReducedMotion || !playIntro) {
      onIntroComplete?.();
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    const el = containerRef.current;
    if (!el) return;

    // Temporarily turn off scroll snapping so smooth scroll won't be trapped
    el.style.scrollSnapType = 'none';

    const sweepRight = () => {
      const targetEl = containerRef.current;
      if (!targetEl) return;
      const maxScroll = targetEl.scrollWidth - targetEl.clientWidth;
      if (maxScroll <= 0) return;
      const target = Math.min(maxScroll, STEP * 2);
      targetEl.scrollTo({ left: target, behavior: 'smooth' });
    };

    const sweepBack = () => {
      const targetEl = containerRef.current;
      if (!targetEl) return;
      targetEl.scrollTo({ left: 0, behavior: 'smooth' });
    };

    const finishIntro = () => {
      const targetEl = containerRef.current;
      if (!targetEl) return;
      targetEl.scrollTo({ left: 0, behavior: 'auto' });
      targetEl.style.scrollSnapType = 'x mandatory';
      setCurrentIndex(0);
      setBlinkFront(false);
      onIntroComplete?.();
    };

    // t=250ms  -> Smoothly sweep right
    timers.push(setTimeout(sweepRight, 250));
    // t=1250ms -> Smoothly sweep back to index 0
    timers.push(setTimeout(sweepBack, 1250));
    // t=2100ms -> Golden attention pulse on 1st card
    timers.push(setTimeout(() => setBlinkFront(true), 2100));
    // t=3500ms -> Re-enable snap & mark intro complete
    timers.push(setTimeout(finishIntro, 3500));

    return () => {
      timers.forEach(clearTimeout);
      if (containerRef.current) {
        containerRef.current.style.scrollSnapType = 'x mandatory';
      }
    };
  }, [isLoading, fillingDrops.length, playIntro, prefersReducedMotion, onIntroComplete]);

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-14 w-full rounded-2xl" />
        <div className="flex gap-3 overflow-hidden">
          <Skeleton className="h-56 w-64 rounded-2xl shrink-0" />
          <Skeleton className="h-56 w-64 rounded-2xl shrink-0" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-tour="queue-carousel">
      {fillingDrops.length > 0 && (
        <motion.div
          className="relative"
          initial={playIntro && !prefersReducedMotion ? { opacity: 0, y: 28, scale: 0.97 } : false}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <div
            ref={containerRef}
            className="overflow-x-auto scrollbar-hide"
            style={{
              scrollSnapType: 'x mandatory',
              WebkitOverflowScrolling: 'touch',
              contain: 'strict',
              height: 260,
            }}
          >
            <div
              style={{
                width: totalSize,
                height: '100%',
                position: 'relative',
              }}
            >
              <LayoutGroup>
                <AnimatePresence mode="popLayout" initial={false}>
                  {virtualItems.map((vi) => {
                    const drop = fillingDrops[vi.index];
                    if (!drop) return null;
                    return (
                      <div
                        key={drop.id}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          transform: `translateX(${vi.start}px)`,
                          width: STEP,
                          height: '100%',
                          scrollSnapAlign: 'start',
                        }}
                      >
                        <QueueItem
                          drop={drop}
                          index={vi.index}
                          isMine={drop.user_id === user?.id}
                          isJustUpdated={recentlyUpdated.has(drop.id)}
                          extraGlow={vi.index === 0 && blinkFront}
                          seedAmount={data?.config?.queue_contribution ?? 2000}
                          onTap={() => {
                            triggerHaptic('light');
                            setPreviewDrop(drop);
                          }}
                        />
                      </div>
                    );
                  })}
                </AnimatePresence>
              </LayoutGroup>
            </div>
          </div>

          {cardCTA && (
            <motion.div
              className="px-1.5"
              initial={{ opacity: 0, y: 16, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22 }}
            >
              {cardCTA}
            </motion.div>
          )}

          {fillingDrops.length > 1 && (
            <div className="flex items-center justify-center gap-1.5 pt-3">
              {fillingDrops.slice(0, 5).map((_, index) => (
                <button
                  key={index}
                  onClick={() => scrollToIndex(index)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    currentIndex === index
                      ? 'w-5 bg-primary'
                      : 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50'
                  }`}
                />
              ))}
              {fillingDrops.length > 5 && (
                <span className="text-[10px] text-muted-foreground ml-1.5">
                  +{fillingDrops.length - 5} more
                </span>
              )}
            </div>
          )}

          {canScrollPrev && (
            <button
              onClick={() => scrollToIndex(currentIndex - 1)}
              className="absolute left-0 top-[120px] -translate-y-1/2 -translate-x-2 w-8 h-8 rounded-full bg-background border shadow-md items-center justify-center hover:bg-muted transition-colors hidden md:flex z-10"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          {canScrollNext && (
            <button
              onClick={() => scrollToIndex(currentIndex + 1)}
              className="absolute right-0 top-[120px] -translate-y-1/2 translate-x-2 w-8 h-8 rounded-full bg-background border shadow-md items-center justify-center hover:bg-muted transition-colors hidden md:flex z-10"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}

          <AnimatePresence>
            {showPeek && (
              <motion.button
                type="button"
                onClick={handlePeekTap}
                initial={{ opacity: 0, x: 24, scale: 0.85 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24, scale: 0.85 }}
                transition={{ type: 'spring', stiffness: 360, damping: 26 }}
                aria-label={`Jump to your campaign, ${peekPercent}% done`}
                className="absolute right-0 top-[120px] -translate-y-1/2 translate-x-1 z-20 flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-l-2xl rounded-r-md bg-gradient-to-l from-primary/95 to-primary/80 text-primary-foreground shadow-[0_8px_24px_-6px_hsl(var(--primary)/0.55)] border-l-2 border-y-2 border-primary-foreground/30 active:scale-[0.97]"
              >
                <span className="relative inline-flex">
                  <Avatar className="h-9 w-9 ring-2 ring-primary-foreground/70">
                    <AvatarImage src={profile?.avatar_url || undefined} alt="You" className="object-cover" />
                    <AvatarFallback className="bg-primary-foreground/20 text-primary-foreground text-xs font-bold">
                      {getInitials(profile?.full_name || 'You')}
                    </AvatarFallback>
                  </Avatar>
                  <motion.span
                    className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-amber-400 border border-primary"
                    animate={{ scale: [1, 1.25, 1] }}
                    transition={{ duration: 1.4, repeat: Infinity }}
                  />
                </span>
                <span className="flex flex-col items-start leading-tight">
                  <span className="text-[9px] uppercase tracking-wider opacity-80">You</span>
                  <span className="text-sm font-bold tabular-nums">
                    {peekPercent}%
                  </span>
                  <span className="text-[9px] tabular-nums opacity-90">campaign done</span>
                </span>
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {fillingDrops.length === 0 && !isLoading && (
        <div className="text-center py-8 px-4 bg-muted/30 rounded-2xl border border-dashed border-muted-foreground/20">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-amber-500/10 flex items-center justify-center">
            <TrendingUp className="h-6 w-6 text-amber-500/60" />
          </div>
          <h3 className="font-semibold text-sm mb-1">No Campaigns Filling Yet</h3>
          <p className="text-xs text-muted-foreground">Be the first to start a campaign!</p>
        </div>
      )}

      <AvatarPreviewDrawer
        isOpen={!!previewDrop}
        onClose={() => setPreviewDrop(null)}
        name={previewDrop?.user_id === user?.id ? 'You' : (previewDrop?.user_name || '')}
        avatarUrl={previewDrop?.avatar_url}
        role="yield_collector"
      />
    </div>
  );
}
