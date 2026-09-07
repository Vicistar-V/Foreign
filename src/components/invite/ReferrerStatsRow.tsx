import { Users, Clock, Wallet, TrendingUp } from 'lucide-react';

interface ReferrerStatsRowProps {
  activeFriends: number;
  pendingFriends: number;
  totalEarned: number;
  /** Total ₦ jumped into this user's pending balance via friend activations. */
  pendingJumped?: number;
  isLoading?: boolean;
}

const StatCard = ({
  icon: Icon,
  label,
  value,
  isLoading,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  isLoading?: boolean;
}) => (
  <div className="rounded-2xl border border-border/50 bg-card p-3">
    <div className="flex items-center gap-1.5 mb-1.5">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-none">
        {label}
      </p>
    </div>
    {isLoading ? (
      <div className="h-6 w-16 bg-muted/40 rounded animate-pulse" />
    ) : (
      <p className="text-lg font-bold tabular-nums text-foreground leading-tight">{value}</p>
    )}
  </div>
);

export const ReferrerStatsRow = ({
  activeFriends,
  pendingFriends,
  totalEarned,
  pendingJumped = 0,
  isLoading,
}: ReferrerStatsRowProps) => {
  return (
    <div className="grid grid-cols-2 gap-2">
      <StatCard icon={Users} label="Active friends" value={Number(activeFriends ?? 0).toString()} isLoading={isLoading} />
      <StatCard icon={Clock} label="Waiting to activate" value={Number(pendingFriends ?? 0).toString()} isLoading={isLoading} />
      <StatCard icon={Wallet} label="Cash you've earned" value={`₦${Number(totalEarned ?? 0).toLocaleString()}`} isLoading={isLoading} />
      <StatCard icon={TrendingUp} label="Jumped into your pending balance" value={`₦${Number(pendingJumped ?? 0).toLocaleString()}`} isLoading={isLoading} />
    </div>
  );
};

