import { useMemo, useState, useEffect } from 'react';
import {
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  useUserGrowthTrend,
  type GrowthRange,
  type GrowthGranularity,
} from '@/hooks/useUserGrowthTrend';

const STORAGE_KEY = 'admin-user-growth-range';

const RANGE_OPTIONS: { value: GrowthRange; label: string }[] = [
  { value: '1d', label: 'Today' },
  { value: '2d', label: '2d' },
  { value: '7d', label: '7d' },
  { value: '14d', label: '14d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: 'all', label: 'All' },
];

// Format a bucket ISO based on granularity, in Lagos local clock.
// Buckets were emitted as the Lagos local moment encoded as UTC ISO,
// so to read them back we use getUTC* (no extra offset).
function formatBucketShort(iso: string, gran: GrowthGranularity): string {
  const d = new Date(iso);
  if (gran === 'hour') {
    const h = d.getUTCHours();
    const suffix = h >= 12 ? 'pm' : 'am';
    const hr = h % 12 === 0 ? 12 : h % 12;
    return `${hr}${suffix}`;
  }
  const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  const day = d.getUTCDate();
  return `${month} ${day}`;
}

function formatBucketFull(iso: string, gran: GrowthGranularity): string {
  const d = new Date(iso);
  const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  const day = d.getUTCDate();
  if (gran === 'hour') {
    const h = d.getUTCHours();
    const suffix = h >= 12 ? 'PM' : 'AM';
    const hr = h % 12 === 0 ? 12 : h % 12;
    const next = (h + 1) % 24;
    const nextSuffix = next >= 12 ? 'PM' : 'AM';
    const nextHr = next % 12 === 0 ? 12 : next % 12;
    return `${month} ${day} · ${hr}${suffix}–${nextHr}${nextSuffix}`;
  }
  if (gran === 'week') {
    const end = new Date(d);
    end.setUTCDate(end.getUTCDate() + 6);
    const endMonth = end.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
    return `${month} ${day} – ${endMonth} ${end.getUTCDate()}`;
  }
  const weekday = d.toLocaleString('en-US', { weekday: 'short', timeZone: 'UTC' });
  return `${weekday}, ${month} ${day}`;
}


function CustomTooltip({
  active,
  payload,
  granularity,
}: {
  active?: boolean;
  payload?: any[];
  granularity: GrowthGranularity;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as { bucket: string; signups: number; activations: number };
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
      <div className="text-xs font-medium text-foreground mb-1.5">
        {formatBucketFull(p.bucket, granularity)}
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="h-2 w-2 rounded-full bg-primary" />
        <span className="text-muted-foreground">Signups</span>
        <span className="ml-auto font-semibold tabular-nums">{p.signups}</span>
      </div>
      <div className="flex items-center gap-2 text-xs mt-1">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'hsl(var(--accent-orange))' }} />
        <span className="text-muted-foreground">Activations</span>
        <span className="ml-auto font-semibold tabular-nums">{p.activations}</span>
      </div>
    </div>
  );
}

export function UserGrowthChart() {
  const [range, setRange] = useState<GrowthRange>(() => {
    const saved = (typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY)) as GrowthRange | null;
    if (saved && RANGE_OPTIONS.some((o) => o.value === saved)) return saved;
    return '2d';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, range);
  }, [range]);

  const { data, isLoading, isFetching, refetch } = useUserGrowthTrend(range);

  const granularity: GrowthGranularity = data?.granularity ?? (range === '1d' || range === '2d' ? 'hour' : range === 'all' ? 'week' : 'day');

  const chartData = useMemo(() => {
    const buckets = data?.buckets ?? [];
    return buckets.map((b) => ({
      ...b,
      label: formatBucketShort(b.bucket, granularity),
    }));
  }, [data?.buckets, granularity]);

  // Pick an x-axis tick density that doesn't crowd on mobile
  const tickInterval = useMemo(() => {
    const n = chartData.length;
    if (n <= 8) return 0;
    if (n <= 16) return 1;
    if (n <= 32) return Math.floor(n / 6);
    return Math.floor(n / 5);
  }, [chartData.length]);

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            User Growth
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            className="h-7 w-7 p-0"
            disabled={isFetching}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
          </Button>
        </div>

        {/* Independent range chips — scrollable on mobile */}
        <div className="-mx-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="flex gap-1 px-1 min-w-max">
            {RANGE_OPTIONS.map((opt) => {
              const active = range === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setRange(opt.value)}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap',
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Totals row */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary" />
            <span className="text-muted-foreground">Signups</span>
            <span className="font-semibold tabular-nums">
              {isLoading ? '—' : (data?.totalSignups ?? 0).toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'hsl(var(--accent-orange))' }} />
            <span className="text-muted-foreground">Activations</span>
            <span className="font-semibold tabular-nums">
              {isLoading ? '—' : (data?.totalActivations ?? 0).toLocaleString()}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-4">
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 8, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" vertical={false} />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  interval={tickInterval}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  width={30}
                  allowDecimals={false}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip
                  cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
                  content={(props) => <CustomTooltip {...props} granularity={granularity} />}
                />
                <Line
                  type="monotone"
                  dataKey="signups"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: 'hsl(var(--primary))', stroke: 'hsl(var(--background))', strokeWidth: 2 }}
                  name="Signups"
                />
                <Line
                  type="monotone"
                  dataKey="activations"
                  stroke="hsl(var(--accent-orange))"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, fill: 'hsl(var(--accent-orange))', stroke: 'hsl(var(--background))', strokeWidth: 2 }}
                  name="Activations"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
