import { motion } from 'framer-motion';
import { Wallet, ShieldAlert, ArrowDown } from 'lucide-react';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';

export function NonMemberVaultCard() {
  const { data: config } = usePlatformConfig();
  const membershipFee = config?.membership_fee || 3000;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-xl"
    >
      {/* Background Ambience Glow */}
      <div className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 h-32 w-60 rounded-full bg-primary/10 blur-3xl" />

      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <Wallet className="h-3.5 w-3.5" />
          </div>
          <span className="text-[11px] font-bold tracking-[0.18em] uppercase text-muted-foreground">
            Vault Balance
          </span>
        </div>

        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide bg-amber-500/10 text-amber-500 border border-amber-500/20">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
          </span>
          0 Active Shares
        </span>
      </div>

      {/* Spacious Arc Gauge Section */}
      <div className="relative mt-4 flex flex-col items-center justify-center">
        <div className="relative w-full max-w-[280px] aspect-[260/145] flex items-center justify-center">
          <svg viewBox="0 0 260 145" className="w-full h-full">
            {/* Outer Base Track */}
            <path
              d="M 30 135 A 100 100 0 0 1 230 135"
              fill="none"
              stroke="currentColor"
              className="text-muted/40"
              strokeWidth="12"
              strokeLinecap="round"
            />

            {/* Inner Dashed Meter Track */}
            <path
              d="M 30 135 A 100 100 0 0 1 230 135"
              fill="none"
              stroke="currentColor"
              className="text-muted-foreground/50"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray="6 8"
            />

            {/* Zero point start indicator */}
            <circle
              cx="30"
              cy="135"
              r="7"
              className="fill-amber-500"
            />
            <circle
              cx="30"
              cy="135"
              r="2.5"
              className="fill-background"
            />
          </svg>

          {/* Centered Balance Content with Plenty of Clearance */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pt-5 text-center">
            <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground font-mono leading-none">
              ₦0<span className="text-xl sm:text-2xl text-muted-foreground font-normal">.00</span>
            </span>
            
            <div className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-500">
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>Yield Engine Inactive (0%)</span>
            </div>
          </div>
        </div>

        {/* Callout Action Box */}
        <div className="mt-3 w-full rounded-2xl border border-primary/20 bg-primary/5 p-4 text-center">
          <p className="text-sm sm:text-base font-medium leading-relaxed text-foreground">
            Click on <strong className="text-primary font-bold underline decoration-primary/40 underline-offset-4">&quot;I want a share&quot;</strong> below to claim a spot and activate your payouts with <strong className="text-primary font-bold underline decoration-primary/40 underline-offset-4">&quot;₦{membershipFee.toLocaleString()}&quot;</strong>
          </p>

          <div className="mt-2.5 flex items-center justify-center text-primary">
            <ArrowDown className="h-4 w-4 animate-bounce" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}