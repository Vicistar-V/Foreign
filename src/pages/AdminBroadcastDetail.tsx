import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  ChevronLeft, Users, MailOpen, Eye, MousePointerClick,
  Search, CheckCircle2, Clock, Calendar, Target, Megaphone,
} from 'lucide-react';
import { fmtTimeAgo, fmtDateTime } from '@/lib/formatLagos';
import { UserAvatar } from '@/components/results/UserAvatar';
import { parseSimpleMarkdown } from '@/lib/parseSimpleMarkdown';

interface Broadcast {
  id: string;
  title: string;
  message: string;
  sent_at: string;
  audience: string | null;
  show_as_modal: boolean;
  icon_template?: string;
  cta_button_text?: string;
  cta_button_link?: string;
  recipients: number;
  read_count: number;
  modal_seen_count: number;
  cta_clickers: number;
  cta_total_clicks: number;
  read_rate: number;
  seen_rate: number;
  click_rate: number;
}

interface Recipient {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  is_member: boolean;
  delivered_at: string;
  read_at: string | null;
  modal_seen_at: string | null;
  cta_click_count: number;
  cta_first_clicked_at: string | null;
  cta_last_clicked_at: string | null;
}

const audienceLabel = (a: string | null) => {
  switch (a) {
    case 'all': return 'Everyone';
    case 'members': return 'Activated only';
    case 'non_members': return 'Not activated';
    case 'manual': return 'Hand-picked';
    default: return 'Unknown';
  }
};

type FilterKey = 'all' | 'opened' | 'unopened' | 'clicked' | 'saw_popup';

export default function AdminBroadcastDetail() {
  const { broadcastId } = useParams<{ broadcastId: string }>();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-broadcast-detail', broadcastId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('admin-broadcasts', {
        body: { action: 'detail', broadcast_id: broadcastId },
      });
      if (error) throw error;
      return data as { success: boolean; broadcast: Broadcast; recipients: Recipient[] };
    },
    enabled: !!broadcastId,
    refetchInterval: 30_000,
  });

  const b = data?.broadcast;
  const all = data?.recipients || [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter(r => {
      if (q && !r.full_name.toLowerCase().includes(q)) return false;
      switch (filter) {
        case 'opened': return !!r.read_at;
        case 'unopened': return !r.read_at;
        case 'clicked': return r.cta_click_count > 0;
        case 'saw_popup': return !!r.modal_seen_at;
        default: return true;
      }
    });
  }, [all, search, filter]);

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-background/95 border-b">
        <div className="flex items-center gap-2 p-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/notifications')}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Broadcast</p>
            <h1 className="text-sm font-semibold truncate">
              {isLoading ? 'Loading…' : b?.title || 'Not found'}
            </h1>
          </div>
        </div>
      </div>

      <div className="p-3 space-y-3 pb-24 max-w-3xl mx-auto">
        {isLoading || !b ? (
          <>
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </>
        ) : (
          <>
            {/* Message preview */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Megaphone className="h-3.5 w-3.5" />
                  <span>Sent {fmtTimeAgo(b.sent_at)}</span>
                  <span>·</span>
                  <span>{fmtDateTime(b.sent_at)}</span>
                </div>
                <h2 className="text-base font-bold">{b.title}</h2>
                <div
                  className="text-sm text-muted-foreground leading-relaxed [&_strong]:text-foreground"
                  dangerouslySetInnerHTML={{ __html: parseSimpleMarkdown(b.message) }}
                />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Badge variant="outline" className="text-[10px]">
                    <Target className="h-3 w-3 mr-1" /> {audienceLabel(b.audience)}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {b.show_as_modal ? 'Popup + Bell' : 'Bell only'}
                  </Badge>
                  {b.cta_button_text && (
                    <Badge variant="outline" className="text-[10px] max-w-[200px] truncate">
                      Button: "{b.cta_button_text}" → {b.cta_button_link}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Big stat grid */}
            <div className="grid grid-cols-2 gap-2">
              <StatTile
                icon={Users}
                label="Delivered"
                value={b.recipients}
                sub="people"
                tone="text-foreground"
                bg="bg-muted/40"
              />
              <StatTile
                icon={MailOpen}
                label="Opened bell"
                value={b.read_count}
                sub={`${b.read_rate}% open rate`}
                tone="text-info"
                bg="bg-info/10"
              />
              {b.show_as_modal && (
                <StatTile
                  icon={Eye}
                  label="Saw popup"
                  value={b.modal_seen_count}
                  sub={`${b.seen_rate}% saw it`}
                  tone="text-success"
                  bg="bg-success/10"
                />
              )}
              {b.cta_button_text && (
                <StatTile
                  icon={MousePointerClick}
                  label="Tapped button"
                  value={b.cta_clickers}
                  sub={`${b.click_rate}% · ${b.cta_total_clicks.toLocaleString()} total taps`}
                  tone="text-primary"
                  bg="bg-primary/10"
                />
              )}
            </div>

            {/* Funnel bar */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Reach Funnel
                </p>
                <FunnelRow label="Delivered" value={b.recipients} max={b.recipients} tone="bg-muted-foreground/40" />
                <FunnelRow label="Opened bell" value={b.read_count} max={b.recipients} tone="bg-info" />
                {b.show_as_modal && (
                  <FunnelRow label="Saw popup" value={b.modal_seen_count} max={b.recipients} tone="bg-success" />
                )}
                {b.cta_button_text && (
                  <FunnelRow label="Tapped button" value={b.cta_clickers} max={b.recipients} tone="bg-primary" />
                )}
              </CardContent>
            </Card>

            {/* Recipients */}
            <Card>
              <CardContent className="p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Recipients</p>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {filtered.length} of {all.length}
                  </span>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name…"
                    className="pl-9 h-10"
                  />
                </div>

                <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
                  <TabsList className="w-full grid grid-cols-5 h-9">
                    <TabsTrigger value="all" className="text-[11px]">All</TabsTrigger>
                    <TabsTrigger value="opened" className="text-[11px]">Opened</TabsTrigger>
                    <TabsTrigger value="unopened" className="text-[11px]">Missed</TabsTrigger>
                    {b.show_as_modal && (
                      <TabsTrigger value="saw_popup" className="text-[11px]">Popup</TabsTrigger>
                    )}
                    {b.cta_button_text && (
                      <TabsTrigger value="clicked" className="text-[11px]">Tapped</TabsTrigger>
                    )}
                  </TabsList>
                  <TabsContent value={filter} className="mt-3">
                    <div className="space-y-1.5">
                      {filtered.length === 0 ? (
                        <div className="text-center py-10 text-sm text-muted-foreground">
                          No recipients match this filter
                        </div>
                      ) : (
                        filtered.map(r => (
                          <button
                            key={r.user_id}
                            onClick={() => navigate(`/admin/users/${r.user_id}`)}
                            className="w-full text-left flex items-center gap-3 p-2.5 rounded-lg bg-card border hover:bg-muted/40 transition-colors"
                          >
                            <UserAvatar name={r.full_name} avatarUrl={r.avatar_url} size="sm" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{r.full_name}</p>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <span className="text-[10px] text-muted-foreground">
                                  {r.is_member ? 'Activated' : 'Not activated'}
                                </span>
                                {r.cta_click_count > 0 && (
                                  <Badge className="bg-primary/15 text-primary border-0 h-4 px-1.5 text-[10px]">
                                    {r.cta_click_count.toLocaleString()}× tap
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-0.5 text-[10px] shrink-0">
                              {r.read_at ? (
                                <span className="flex items-center gap-1 text-info">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Opened {fmtTimeAgo(r.read_at)}
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-muted-foreground">
                                  <Clock className="h-3 w-3" /> Not opened
                                </span>
                              )}
                              {b.show_as_modal && (
                                r.modal_seen_at ? (
                                  <span className="text-success">Saw popup</span>
                                ) : (
                                  <span className="text-muted-foreground">Popup pending</span>
                                )
                              )}
                              {b.cta_button_text && r.cta_last_clicked_at && (
                                <span className="text-primary flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  Tapped {fmtTimeAgo(r.cta_last_clicked_at)}
                                </span>
                              )}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

const StatTile = ({ icon: Icon, label, value, sub, tone, bg }: any) => (
  <div className={`p-3.5 rounded-xl ${bg}`}>
    <div className="flex items-center justify-between">
      <Icon className={`h-4 w-4 ${tone}`} />
      <span className={`text-2xl font-bold tabular-nums ${tone}`}>{value}</span>
    </div>
    <p className="text-[11px] text-muted-foreground mt-1">{label}</p>
    <p className={`text-[10px] ${tone} opacity-80`}>{sub}</p>
  </div>
);

const FunnelRow = ({ label, value, max, tone }: { label: string; value: number; max: number; tone: string }) => {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${tone} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};
