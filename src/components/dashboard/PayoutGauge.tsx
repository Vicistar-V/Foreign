import { motion } from 'framer-motion';
import { Layers } from 'lucide-react';
import { triggerHaptic } from '@/lib/haptics';

interface PayoutGaugeProps {
  target: number;
  fillAmount: number;
  fillPercent: number;
  peopleAhead: number;
  hasSpots: boolean;
  entryFee: number;
  spotsCount?: number;
  onTap?: () => void;
  flush?: boolean;
}



/**
 * Speedometer-style semi-circle gauge — this IS the wallet hero for members.
 * Self-contained card. Tap grows the payout (buy-spot / restore).
 */
export function PayoutGauge({
  target,
  fillAmount,
  fillPercent,
  peopleAhead,
  hasSpots,
  entryFee,
  spotsCount = 0,
  onTap,
  flush = false,
}: PayoutGaugeProps) {

  // Gauge geometry — larger, airier semicircle
  const W = 320;
  const H = 200;
  const CX = W / 2;
  const CY = H - 14;
  const R = 140;
  const STROKE = 16;


  const start = { x: CX - R, y: CY };
  const end = { x: CX + R, y: CY };
  const arcPath = `M ${start.x} ${start.y} A ${R} ${R} 0 0 1 ${end.x} ${end.y}`;

  const circumference = Math.PI * R;
  // Never show a fully empty gauge — floor at 1% so there's always a visible tick
  const safePct = Math.max(1, Math.min(100, fillPercent || 0));
  const dashOffset = circumference * (1 - safePct / 100);

  // Position of the progress tip (glowing knob at end of filled arc)
  const tipAngleDeg = 180 - (safePct / 100) * 180;
  const tipAngleRad = (tipAngleDeg * Math.PI) / 180;
  const tipX = CX + R * Math.cos(tipAngleRad);
  const tipY = CY - R * Math.sin(tipAngleRad);

  // Needle points from pivot to the tip
  const needleLen = R - 10;
  const needleX = CX + needleLen * Math.cos(tipAngleRad);
  const needleY = CY - needleLen * Math.sin(tipAngleRad);


  const statusLabel = !hasSpots
    ? `Pay ₦${entryFee.toLocaleString()} to activate a share`
    : (safePct >= 85 ? 'Your campaign is almost done' : 'Your campaign is still filling up');

  return (
    <button
      type="button"
      onClick={() => {
        triggerHaptic('light');
        onTap?.();
      }}
      className={
        flush
          ? "relative w-full text-left overflow-hidden active:scale-[0.995] transition-transform"
          : "relative w-full text-left rounded-3xl border border-border bg-card overflow-hidden active:scale-[0.995] transition-transform"
      }
    >
      {/* Top row: spots pill + progress % */}
      <div className="relative flex items-center justify-between px-5 pt-4 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {spotsCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-600/10 text-amber-400 border border-amber-500/30 shadow-[0_0_12px_hsl(45_100%_51%_/_0.15)] tabular-nums">
              <Layers className="h-3.5 w-3.5" />
              <span className="tracking-tight">{spotsCount}</span>
              <span className="text-amber-400/70 font-medium">
                {spotsCount === 1 ? 'share active' : 'shares active'}
              </span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-accent-orange/15 text-accent-orange border border-accent-orange/30 tracking-tight animate-pulse">
              <Layers className="h-3.5 w-3.5" />
              Add your first share
            </span>
          )}
        </div>

        {hasSpots && (
          <span className="text-[11px] font-semibold tabular-nums text-muted-foreground shrink-0">
            <span className="text-foreground">{Math.round(safePct)}%</span> filled
          </span>
        )}
      </div>

      {/* Gauge */}
      <div className="relative mx-auto px-4 pt-1" style={{ width: '100%', maxWidth: W + 32 }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto overflow-visible"
          aria-hidden
        >
          <defs>
            <linearGradient id="gauge-fill" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.55" />
              <stop offset="100%" stopColor="hsl(var(--primary))" />
            </linearGradient>
            <linearGradient id="gauge-shimmer" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0" />
              <stop offset="50%" stopColor="hsl(var(--primary-foreground, var(--background)))" stopOpacity="0.9" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
            </linearGradient>
            <filter id="gauge-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Track */}
          <path
            d={arcPath}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={STROKE}
            strokeLinecap="round"
            opacity={0.55}
          />

          {/* Progress arc */}
          <motion.path
            d={arcPath}
            fill="none"
            stroke="url(#gauge-fill)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
            filter="url(#gauge-glow)"
          />

          {/* Shimmer sweep — a bright band that glides along the whole arc */}
          {safePct > 0 && (
            <path
              d={arcPath}
              fill="none"
              stroke="url(#gauge-shimmer)"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={`${circumference * 0.22} ${circumference}`}
              opacity={0.9}
            >
              <animate
                attributeName="stroke-dashoffset"
                values={`${circumference * 0.22};${-circumference};${-circumference}`}
                keyTimes="0;0.35;1"
                dur="9s"
                begin="0s"
                repeatCount="indefinite"
              />
            </path>
          )}

          {/* Needle — static, points from pivot straight to the tip knob */}
          <line
            x1={CX}
            y1={CY}
            x2={needleX}
            y2={needleY}
            stroke="hsl(var(--foreground))"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
          <circle cx={CX} cy={CY} r={7} fill="hsl(var(--foreground))" />
          <circle cx={CX} cy={CY} r={3} fill="hsl(var(--background))" />

          {/* Progress tip — glowing knob with slow breathing pulse */}
          {safePct > 0 && (
            <g>
              {/* Outer breathing halo — bigger reach, slower cadence */}
              <circle cx={tipX} cy={tipY} r={10} fill="hsl(var(--primary))">
                <animate
                  attributeName="r"
                  values="10;28;10"
                  dur="3.6s"
                  repeatCount="indefinite"
                  calcMode="spline"
                  keyTimes="0;0.5;1"
                  keySplines="0.4 0 0.6 1;0.4 0 0.6 1"
                />
                <animate
                  attributeName="opacity"
                  values="0.4;0;0.4"
                  dur="3.6s"
                  repeatCount="indefinite"
                  calcMode="spline"
                  keyTimes="0;0.5;1"
                  keySplines="0.4 0 0.6 1;0.4 0 0.6 1"
                />
              </circle>
              {/* Steady inner glow */}
              <circle cx={tipX} cy={tipY} r={10} fill="hsl(var(--primary))" opacity={0.25} />
              {/* Core knob with subtle pulse */}
              <circle cx={tipX} cy={tipY} r={5.5} fill="hsl(var(--primary))">
                <animate
                  attributeName="r"
                  values="5.5;7;5.5"
                  dur="3.6s"
                  repeatCount="indefinite"
                />
              </circle>
              <circle cx={tipX} cy={tipY} r={2} fill="hsl(var(--background))" />
            </g>
          )}




        </svg>

        {/* Center readout — anchored at true midpoint between the arc's top
            and the needle pivot (along the vertical centerline) */}
        {(() => {
          const arcTopY = CY - R;           // topmost point of the semicircle
          const pivotTopY = CY - 8;         // top edge of pivot circle
          const midYPct = ((arcTopY + pivotTopY) / 2 / H) * 100;
          return (
            <div
              className="absolute left-0 right-0 flex flex-col items-center pointer-events-none px-6 text-center"
              style={{
                top: `${midYPct}%`,
                transform: 'translateY(-50%)',
              }}
            >
              <span className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                Upcoming payout
              </span>
              <span className="text-[30px] font-black tabular-nums leading-none text-foreground mt-1">
                ₦{target.toLocaleString()}
              </span>
              {hasSpots && (
                <span className="text-[11px] tabular-nums text-muted-foreground mt-1">
                  ₦{Math.round(fillAmount).toLocaleString()} received
                </span>
              )}
            </div>
          );
        })()}



      </div>

      {/* Bottom status strip */}
      <div className="relative px-5 pb-4 pt-2 text-center">
        <p className="text-[12px] text-muted-foreground">
          {statusLabel}
          {hasSpots && <span className="opacity-70"> · tap to increase it</span>}
        </p>
      </div>
    </button>
  );
}

