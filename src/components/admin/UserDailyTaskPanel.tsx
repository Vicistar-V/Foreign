import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Trophy, Wallet, Plus, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DailyTaskRow {
  task_date: string;
  batches_done: number;
  bonus_batches: number;
  metadata?: Record<string, unknown> | null;
}

interface DailyTaskData {
  today: DailyTaskRow | null;
  recent: DailyTaskRow[];
  pending_balance: number;
}

interface Props {
  userId: string;
  dailyTask?: DailyTaskData | null;
}

export function UserDailyTaskPanel({ userId, dailyTask }: Props) {
  const [bonus, setBonus] = useState<string>('5');
  const [busy, setBusy] = useState(false);

  const today = dailyTask?.today;
  const recent = dailyTask?.recent || [];
  const pending = Number(dailyTask?.pending_balance || 0);

  const grant = async () => {
    const n = Math.floor(Number(bonus));
    if (!Number.isFinite(n) || n <= 0 || n > 100) {
      toast.error('Enter a number between 1 and 100');
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-grant-bonus-batches', {
        body: { user_id: userId, bonus_batches: n },
      });
      if (error || !data?.success) {
        throw new Error(error?.message || data?.error || 'Failed');
      }
      toast.success(`Granted +${n} bonus batches`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to grant');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Top stats */}
      <div className="grid grid-cols-2 gap-2">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Trophy className="h-4 w-4 text-primary" />
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground">Today's batches</div>
                <div className="text-lg font-bold tabular-nums">
                  {today?.batches_done ?? 0}
                  {today?.bonus_batches ? (
                    <span className="text-xs text-muted-foreground"> +{today.bonus_batches} bonus</span>
                  ) : null}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-warning/10 flex items-center justify-center">
                <Wallet className="h-4 w-4 text-warning" />
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground">Pending balance</div>
                <div className="text-lg font-bold tabular-nums">
                  ₦{pending.toLocaleString()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grant bonus batches */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Grant bonus batches (today only)</CardTitle>
        </CardHeader>
        <CardContent className="flex items-end gap-2">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground">Amount</label>
            <Input
              type="number"
              min={1}
              max={100}
              value={bonus}
              onChange={(e) => setBonus(e.target.value)}
              inputMode="numeric"
            />
          </div>
          <Button onClick={grant} disabled={busy} className="h-10">
            <Plus className="h-4 w-4 mr-1" />
            {busy ? 'Granting…' : 'Grant'}
          </Button>
        </CardContent>
      </Card>

      {/* Recent 14 days */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Last 14 days</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recent.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No history yet</div>
          ) : (
            <div className="divide-y">
              {recent.map((r) => (
                <div key={r.task_date} className="flex items-center justify-between px-4 py-2.5">
                  <div className="text-sm">{r.task_date}</div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {r.batches_done} batches
                    </Badge>
                    {r.bonus_batches > 0 && (
                      <Badge className="bg-warning/10 text-warning border-warning/30 text-[10px]">
                        +{r.bonus_batches} bonus
                      </Badge>
                    )}
                    {r.batches_done >= 10 && (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
