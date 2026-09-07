import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Compass, CheckCircle2, CircleDashed, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { fmtDateTime, fmtDateTimeLong } from '@/lib/formatLagos';

interface Props {
  userId: string;
}

interface TourRow {
  user_id: string;
  current_step: string;
  picks_guided: number;
  is_completed: boolean;
  started_at: string | null;
  completed_at: string | null;
  last_step_at: string;
  history: Array<{ step: string; at: string }> | null;
}

const STEP_LABELS: Record<string, string> = {
  idle: 'Not started',
  welcome: 'Saw welcome',
  'wallet-withdrawable': 'Wallet — Withdrawable',
  'wallet-entry': 'Wallet — Entry',
  'wallet-pending': 'Wallet — Pending',
  queue: 'Live queue',
  cta: 'Start Working CTA',
  pick: 'Picking task',
  submit: 'Submitting task',
  done: 'Finished tour',
};

export function UserTourProgressCard({ userId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['user-tour-progress', userId],
    queryFn: async (): Promise<TourRow | null> => {
      const { data, error } = await supabase
        .from('user_tour_progress')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as TourRow) ?? null;
    },
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Compass className="h-4 w-4" />
          Welcome tour progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : !data ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CircleDashed className="h-4 w-4" />
            User has never opened the tour.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {data.is_completed ? (
                  <Badge className="bg-success/10 text-success border-success/20">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Finished tour
                  </Badge>
                ) : (
                  <Badge className="bg-warning/10 text-warning border-warning/20">
                    <Clock className="h-3 w-3 mr-1" />
                    In progress
                  </Badge>
                )}
                <span className="text-sm font-medium">
                  {STEP_LABELS[data.current_step] || data.current_step}
                </span>
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">
                {data.picks_guided} guided picks
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
              <div>
                <div className="font-medium text-foreground">Started</div>
                <div>{data.started_at ? fmtDateTime(data.started_at) : '—'}</div>
              </div>
              <div>
                <div className="font-medium text-foreground">Last step</div>
                <div>{fmtDateTime(data.last_step_at)}</div>
              </div>
              <div>
                <div className="font-medium text-foreground">Finished</div>
                <div>{data.completed_at ? fmtDateTime(data.completed_at) : '—'}</div>
              </div>
            </div>

            {data.history && data.history.length > 0 && (
              <div className="border-t border-border pt-2">
                <div className="text-[11px] font-medium text-muted-foreground mb-1.5">
                  History ({data.history.length})
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {data.history.slice(-15).reverse().map((h, i) => (
                    <div key={i} className="flex items-center justify-between text-[11px]">
                      <span className="font-medium">{STEP_LABELS[h.step] || h.step}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {fmtDateTimeLong(h.at)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
