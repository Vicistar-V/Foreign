import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Megaphone, Eye, MailOpen, Users, ChevronRight, MousePointerClick } from 'lucide-react';
import { fmtTimeAgo } from '@/lib/formatLagos';

interface Broadcast {
  id: string;
  title: string;
  message: string;
  sent_at: string;
  audience: string | null;
  show_as_modal: boolean;
  recipients: number;
  read_count: number;
  modal_seen_count: number;
  cta_clickers: number;
  cta_total_clicks: number;
  read_rate: number;
  seen_rate: number;
  click_rate: number;
  cta_button_text?: string;
}

const audienceLabel = (a: string | null) => {
  switch (a) {
    case 'all': return 'Everyone';
    case 'members': return 'Activated only';
    case 'non_members': return 'Not activated';
    case 'manual': return 'Hand-picked';
    default: return '—';
  }
};

export const PastBroadcastsList = () => {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-broadcasts'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('admin-broadcasts', {
        body: { action: 'list' },
      });
      if (error) throw error;
      return data as { success: boolean; broadcasts: Broadcast[] };
    },
    staleTime: 30_000,
  });

  const broadcasts = data?.broadcasts || [];

  return (
    <Card>
      <CardContent className="p-3 md:p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Past Broadcasts</h2>
          {!isLoading && (
            <Badge variant="secondary" className="ml-auto tabular-nums">
              {broadcasts.length}
            </Badge>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
          </div>
        ) : broadcasts.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No broadcasts sent yet
          </div>
        ) : (
          <div className="space-y-2">
            {broadcasts.map(b => (
              <button
                key={b.id}
                onClick={() => navigate(`/admin/notifications/${encodeURIComponent(b.id)}`)}
                className="w-full text-left p-3 rounded-lg border bg-card hover:bg-muted/40 active:scale-[0.99] transition-all"
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold truncate">{b.title}</p>
                      {b.show_as_modal && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5">Popup</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{b.message}</p>
                    <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground">
                      <span>{fmtTimeAgo(b.sent_at)}</span>
                      <span>·</span>
                      <span>{audienceLabel(b.audience)}</span>
                    </div>

                    {/* Compact mini-stats */}
                    <div className="grid grid-cols-4 gap-1.5 mt-2.5">
                      <Mini icon={Users} value={b.recipients} label="Sent" tone="text-foreground" />
                      <Mini icon={MailOpen} value={b.read_count} label={`${b.read_rate}%`} tone="text-info" />
                      <Mini icon={Eye} value={b.show_as_modal ? b.modal_seen_count : 0} label={b.show_as_modal ? `${b.seen_rate}%` : '—'} tone="text-success" />
                      <Mini icon={MousePointerClick} value={b.cta_button_text ? b.cta_clickers : 0} label={b.cta_button_text ? `${b.click_rate}%` : '—'} tone="text-primary" />
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const Mini = ({ icon: Icon, value, label, tone }: any) => (
  <div className="text-center p-1.5 rounded-md bg-muted/30">
    <Icon className={`h-3 w-3 mx-auto ${tone}`} />
    <p className={`text-xs font-bold tabular-nums ${tone}`}>{value}</p>
    <p className="text-[9px] text-muted-foreground leading-tight">{label}</p>
  </div>
);
