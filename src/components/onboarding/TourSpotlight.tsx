import { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { useTour, type TourStep } from '@/context/TourContext';

/**
 * Per-step config. Each step targets one element by data-tour attribute,
 * lives on specific routes, and explains itself with a single short tip.
 */
type StepConfig = {
  selector: string;
  title: string;
  // Body can be static text or a function that reads data-* attributes off
  // the highlighted element (e.g. data-min-withdrawal) for live values.
  body: string | ((el: HTMLElement) => string);
  tooltipPosition: 'above' | 'below';
  routes: string[];
  scrollIntoView?: boolean;
  // Where to anchor the target after scrollIntoView.
  //   'start'  → target sits near the top of the viewport (room below for tooltip)
  //   'center' → target sits in the middle (default)
  //   'end'    → target sits near the bottom of the viewport (room above for tooltip)
  scrollAnchor?: 'start' | 'center' | 'end';
  // When true, lock the tooltip to tooltipPosition even if the auto-fit
  // logic would normally flip it (used when we deliberately scrolled the
  // target to a specific anchor so the chosen side is guaranteed to fit).
  lockTooltipSide?: boolean;
  showNext?: boolean; // when true, tooltip shows a "Next" button to advance
};

const fmtNaira = (n: number) => `₦${n.toLocaleString('en-NG')}`;

const CONFIG: Partial<Record<TourStep, StepConfig>> = {
  'wallet-withdrawable': {
    selector: '[data-tour="wallet-withdrawable"]',
    title: 'This is your Withdrawable wallet',
    body: (el) => {
      const min = Number(el.dataset.minWithdrawal || 1000);
      return `Every naira you earn lands here. Once you have at least ${fmtNaira(
        min,
      )}, you can send it to your bank right away.`;
    },
    tooltipPosition: 'below',
    routes: ['/dashboard'],
    scrollIntoView: true,
    showNext: true,
  },
  'wallet-entry': {
    selector: '[data-tour="wallet-entry"]',
    title: 'This is your Entry wallet',
    body: 'This money is for activating more ad shares. The more shares you hold, the more each campaign pays you.',
    tooltipPosition: 'below',
    routes: ['/dashboard'],
    scrollIntoView: true,
    showNext: true,
  },
  'wallet-pending': {
    selector: '[data-tour="wallet-pending"]',
    title: 'This is your Pending balance',
    body: 'Every time you finish your daily work, money lands here first. Try to grow it as big as you can — it slowly moves into your Withdrawable wallet.',
    tooltipPosition: 'above',
    routes: ['/dashboard'],
    scrollIntoView: true,
    showNext: true,
  },
  queue: {
    selector: '[data-tour="queue-carousel"]',
    title: 'These are live campaigns',
    body: 'Each card is a campaign filling up towards 100%. When a campaign reaches 100%, the money sitting in that person’s Pending balance becomes real cash they can withdraw. The more picture picking you do every day, the more Pending you build up, ready to turn into cash the moment your campaign hits 100%.',
    tooltipPosition: 'below',
    routes: ['/dashboard'],
    scrollIntoView: true,
    scrollAnchor: 'start',
    lockTooltipSide: true,
    showNext: true,
  },
  cta: {
    selector: '[data-tour="start-working"]',
    title: 'Now let’s see how the work happens',
    body: 'Tap this green button to start your daily picture rating. It only takes a few minutes — and it’s what pushes your campaign towards 100%.',
    tooltipPosition: 'above',
    routes: ['/dashboard'],
    scrollIntoView: true,
  },
  pick: {
    selector: '[data-tour="task-images"]',
    title: 'Pick the one you like',
    body: 'This is the work — just tap whichever image you prefer. Tap the same one again to undo.',
    tooltipPosition: 'below',
    routes: ['/task'],
  },
  submit: {
    selector: '[data-tour="submit-pick"]',
    title: 'Confirm your pick',
    body: 'Tap Submit to lock it in and move to the next pair. Each one you finish grows your Pending balance.',
    tooltipPosition: 'above',
    routes: ['/task'],
    scrollIntoView: true,
  },
};


/**
 * Spotlight overlay: dims everything except a rectangular cutout around the
 * target element, draws a glowing ring on the target, and floats a tooltip
 * above or below. The target stays fully clickable — only the dimmed area
 * blocks taps, so the user can only do the next correct thing.
 */
export const TourSpotlight = () => {
  const { step, dismiss, next } = useTour();
  const location = useLocation();

  const isWelcome = step === 'welcome' && location.pathname === '/dashboard';
  const cfg = CONFIG[step];
  const active = !isWelcome && !!cfg && cfg.routes.includes(location.pathname);

  const [rect, setRect] = useState<DOMRect | null>(null);
  const [viewport, setViewport] = useState({
    w: typeof window !== 'undefined' ? window.innerWidth : 0,
    h: typeof window !== 'undefined' ? window.innerHeight : 0,
  });

  // Track viewport resize / orientation change
  useEffect(() => {
    const onResize = () =>
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // If a linear informational step's target never mounts within a short
  // window (e.g. queue carousel is empty), auto-advance so the tour never
  // gets stuck on an invisible element.
  useEffect(() => {
    if (!active || !cfg || !cfg.showNext) return;
    const start = Date.now();
    const id = window.setInterval(() => {
      const el = document.querySelector(cfg.selector);
      if (el) {
        window.clearInterval(id);
        return;
      }
      if (Date.now() - start > 1800) {
        window.clearInterval(id);
        next();
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [active, cfg, next]);

  // On the queue step, nudge the carousel horizontally a bit so the user
  // sees it moves, then settle back at scrollLeft 0 to emphasise the person
  // at the very front — the one next in line to get paid.
  useEffect(() => {
    if (step !== 'queue' || location.pathname !== '/dashboard') return;
    let cancelled = false;
    const wait = window.setTimeout(() => {
      if (cancelled) return;
      const root = document.querySelector('[data-tour="queue-carousel"]');
      const scroller = root?.querySelector(
        '.overflow-x-auto',
      ) as HTMLElement | null;
      if (!scroller) return;
      try {
        scroller.scrollTo({ left: 140, behavior: 'smooth' });
        window.setTimeout(() => {
          if (!cancelled) scroller.scrollTo({ left: 0, behavior: 'smooth' });
        }, 900);
      } catch {
        scroller.scrollLeft = 0;
      }
    }, 700);
    return () => {
      cancelled = true;
      window.clearTimeout(wait);
    };
  }, [step, location.pathname]);

  // Continuously locate + re-measure the target so the spotlight follows
  // layout changes, scroll, transitions, and dynamic content mounting.
  //
  // Reliability rules:
  //   • Keep the LAST known rect when the target briefly unmounts (e.g. a
  //     skeleton swap or a route transition). Only blank after the element
  //     has been missing for ~600ms.
  //   • Re-scroll into view whenever the target drifts off the viewport,
  //     not just on first mount — so the user always sees what's
  //     highlighted, even if they scrolled the page.
  useLayoutEffect(() => {
    if (!active || !cfg) {
      setRect(null);
      return;
    }

    let raf = 0;
    let cancelled = false;
    let missingSince = 0;
    let lastScrollAt = 0;

    const tick = () => {
      if (cancelled) return;
      const now = performance.now();
      const el = document.querySelector(cfg.selector) as HTMLElement | null;

      if (!el) {
        // Target gone — but don't blank immediately. Hold last rect briefly.
        if (!missingSince) missingSince = now;
        if (now - missingSince > 600) setRect(null);
      } else {
        missingSince = 0;
        const r = el.getBoundingClientRect();
        const vh = window.innerHeight;
        const vw = window.innerWidth;

        // Re-scroll if the element is meaningfully outside the viewport,
        // throttled to once every 800ms so we don't fight smooth scrolling.
        const fullyAbove = r.bottom < 80;
        const fullyBelow = r.top > vh - 80;
        const tooBig = r.height > vh - 200;
        const needsScroll = fullyAbove || fullyBelow;
        if (
          (needsScroll || (cfg.scrollIntoView && lastScrollAt === 0)) &&
          now - lastScrollAt > 800
        ) {
          lastScrollAt = now;
          try {
            el.scrollIntoView({
              behavior: 'smooth',
              block: tooBig
                ? 'start'
                : (cfg.scrollAnchor ?? 'center'),
            });
          } catch {
            el.scrollIntoView();
          }
        }

        setRect((prev) => {
          if (
            prev &&
            Math.abs(prev.top - r.top) < 0.5 &&
            Math.abs(prev.left - r.left) < 0.5 &&
            Math.abs(prev.width - r.width) < 0.5 &&
            Math.abs(prev.height - r.height) < 0.5
          ) {
            return prev;
          }
          return r;
        });
        // touch vw to satisfy linters / keep ref
        void vw;
      }
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [active, cfg]);

  if (isWelcome) {
    return createPortal(
      <div className="fixed inset-0 z-[80] bg-black/80 flex items-end sm:items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-3xl bg-card border border-border shadow-2xl p-6 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-400 font-bold mb-2">
            Welcome
          </div>
          <h2 className="text-2xl font-bold text-foreground leading-tight">
            Welcome to Viketa 👋
          </h2>
          <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
            We’re so glad you’re here. This is where everyday Nigerians turn
            small daily work into real money in their bank — and we’re going to
            help you do the same.
          </p>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Stay with me for the next minute — I’ll walk you slowly through
            every single thing so you know exactly what each part does and how
            you earn. No rush, no confusion.
          </p>
          <div className="mt-5">
            <button
              onClick={next}
              className="w-full h-11 rounded-xl text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              Show me around
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  if (!active || !cfg || !rect) return null;

  const PAD = 8;
  const SAFE_TOP = 12;
  const SAFE_BOTTOM = 12;
  const TIP_EST_H = 220; // worst-case tooltip height including buttons
  const GAP = 14;

  const top = Math.max(0, rect.top - PAD);
  const left = Math.max(0, rect.left - PAD);
  const width = Math.min(viewport.w - left, rect.width + PAD * 2);
  const height = Math.min(viewport.h - top, rect.height + PAD * 2);
  const right = left + width;
  const bottom = top + height;

  // Pick whichever side has more room — that's where the tooltip goes.
  // This makes it impossible for the card to render off-screen even when
  // the highlighted element is tall, near the top, or near the bottom.
  const roomBelow = viewport.h - bottom - SAFE_BOTTOM;
  const roomAbove = top - SAFE_TOP;
  const prefersBelow = cfg.tooltipPosition === 'below';
  let tipBelow: boolean;
  if (cfg.lockTooltipSide) {
    // Step deliberately anchored its target so the chosen side fits.
    tipBelow = prefersBelow;
  } else if (roomBelow >= TIP_EST_H && roomAbove >= TIP_EST_H) {
    tipBelow = prefersBelow;
  } else {
    tipBelow = roomBelow >= roomAbove;
  }

  const tipStyle: React.CSSProperties = tipBelow
    ? {
        top: Math.max(
          SAFE_TOP,
          Math.min(bottom + GAP, viewport.h - SAFE_BOTTOM - TIP_EST_H),
        ),
        left: 12,
        right: 12,
      }
    : {
        bottom: Math.max(
          SAFE_BOTTOM,
          Math.min(viewport.h - top + GAP, viewport.h - SAFE_TOP - TIP_EST_H),
        ),
        left: 12,
        right: 12,
      };

  return createPortal(
    <div className="fixed inset-0 z-[80] pointer-events-none" aria-hidden="false">
      {/* Four dimming panels around the cutout — these block taps. */}
      <div
        className="absolute bg-black/75 pointer-events-auto"
        style={{ top: 0, left: 0, right: 0, height: top }}
      />
      <div
        className="absolute bg-black/75 pointer-events-auto"
        style={{ top: bottom, left: 0, right: 0, height: Math.max(0, viewport.h - bottom) }}
      />
      <div
        className="absolute bg-black/75 pointer-events-auto"
        style={{ top, left: 0, width: left, height }}
      />
      <div
        className="absolute bg-black/75 pointer-events-auto"
        style={{ top, left: right, width: Math.max(0, viewport.w - right), height }}
      />

      {/* Glowing pulsing ring around the target */}
      <div
        className="absolute rounded-2xl ring-4 ring-emerald-400 animate-pulse pointer-events-none"
        style={{
          top,
          left,
          width,
          height,
          boxShadow: '0 0 0 9999px transparent, 0 0 30px 4px rgba(52, 211, 153, 0.55)',
        }}
      />

      {/* Tooltip card */}
      <div className="absolute pointer-events-auto" style={tipStyle}>
        <div className="mx-auto max-w-sm rounded-2xl bg-card border border-border shadow-2xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-400 font-bold mb-1">
                Quick tour
              </div>
              <div className="text-base font-semibold text-foreground leading-tight">
                {cfg.title}
              </div>
              <div className="text-sm text-muted-foreground mt-1 leading-snug">
                {typeof cfg.body === 'function'
                  ? (() => {
                      const el = document.querySelector(cfg.selector) as HTMLElement | null;
                      return el ? cfg.body(el) : '';
                    })()
                  : cfg.body}
              </div>
            </div>
            <button
              onClick={dismiss}
              aria-label="Skip tour"
              className="shrink-0 h-7 w-7 rounded-full bg-muted/60 text-muted-foreground hover:text-foreground flex items-center justify-center"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {cfg.showNext ? (
            <div className="mt-3">
              <button
                onClick={next}
                className="w-full h-10 rounded-xl text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                Got it, next
              </button>
            </div>
          ) : null}

        </div>
      </div>
    </div>,
    document.body,
  );
};
