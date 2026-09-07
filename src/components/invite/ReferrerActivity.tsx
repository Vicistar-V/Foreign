import { useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { CheckCircle2, Clock, Repeat, Users, Wallet } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { formatDistanceToNowStrict } from 'date-fns';
import type { Member } from '@/hooks/useMinerData';

interface RoyaltyEvent {
  amount: number;
  createdAt: string;
  refereeName: string;
}

interface ReferrerActivityProps {
  members: Member[];
  royalties: RoyaltyEvent[];
  referralCashBonus: number;
  isLoading?: boolean;
}

const initialsOf = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() || '')
    .join('') || '?';

const fmtTime = (iso: string) => {
  try {
    return formatDistanceToNowStrict(new Date(iso), { addSuffix: true });
  } catch {
    return '';
  }
};

/**
 * Single merged "Your network" section. Two tabs (Friends / Earnings)
 * sharing one card. Both lists are virtualized with @tanstack/react-virtual
 * so even hundreds of rows stay smooth on a low-end phone.
 */
export const ReferrerActivity = ({ members, royalties, referralCashBonus, isLoading }: ReferrerActivityProps) => {
  const [tab, setTab] = useState<'people' | 'earnings'>('people');
  const friendsRef = useRef<HTMLDivElement>(null);
  const earningsRef = useRef<HTMLDivElement>(null);

  const sortedMembers = useMemo(
    () =>
      [...members].sort((a, b) => {
        // Active first, then by joined date desc
        const aActive = a.is_member && a.has_spot ? 1 : 0;
        const bActive = b.is_member && b.has_spot ? 1 : 0;
        if (aActive !== bActive) return bActive - aActive;
        return new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime();
      }),
    [members],
  );

  const friendsVirtualizer = useVirtualizer({
    count: sortedMembers.length,
    getScrollElement: () => friendsRef.current,
    estimateSize: () => 102,
    overscan: 6,
  });

  const earningsVirtualizer = useVirtualizer({
    count: royalties.length,
    getScrollElement: () => earningsRef.current,
    estimateSize: () => 60,
    overscan: 6,
  });

  const showVirtualScroll = sortedMembers.length > 12 || royalties.length > 12;
  const listHeight = showVirtualScroll ? 'h-[420px]' : '';

  return (
    <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
      <Tabs value={tab} onValueChange={(v) => setTab(v as 'people' | 'earnings')} className="w-full">
        <div className="px-3 pt-3">
          <TabsList className="w-full grid grid-cols-2 h-10 bg-muted/40">
            <TabsTrigger value="people" className="text-[13px] gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Referrals ({sortedMembers.length})
            </TabsTrigger>
            <TabsTrigger value="earnings" className="text-[13px] gap-1.5">
              <Repeat className="h-3.5 w-3.5" />
              Extra earnings ({royalties.length})
            </TabsTrigger>
          </TabsList>
        </div>

        {/* People tab */}
        <TabsContent value="people" className="mt-0 p-3">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 rounded-xl bg-muted/30 animate-pulse" />
              ))}
            </div>
          ) : sortedMembers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No referrals yet"
              subtitle="Send your link above to bring your first person in."
            />
          ) : (
            <div
              ref={friendsRef}
              className={`${listHeight} ${showVirtualScroll ? 'overflow-y-auto' : ''}`}
            >
              <div
                style={{
                  height: showVirtualScroll
                    ? `${friendsVirtualizer.getTotalSize()}px`
                    : 'auto',
                  position: 'relative',
                }}
              >
                {(showVirtualScroll
                  ? friendsVirtualizer.getVirtualItems()
                  : sortedMembers.map((_, i) => ({ index: i, start: 0, size: 0, key: i }))
                ).map((vRow) => {
                  const m = sortedMembers[vRow.index];
                  const firstName = (m.name || 'Friend').split(' ')[0];
                  const isActive = m.is_member && m.has_spot;
                const totalEarned = Number(m.referrer_earnings || 0);
                // Breakdown: sign-up bonus first, anything extra beyond that
                // came from later friend activity.
                const activationPaid = isActive ? Math.min(referralCashBonus, totalEarned) : 0;
                const extraEarned = Math.max(0, totalEarned - activationPaid);
                  return (
                    <div
                      key={m.id}
                      style={
                        showVirtualScroll
                          ? {
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: `${vRow.size}px`,
                              transform: `translateY(${vRow.start}px)`,
                            }
                          : undefined
                      }
                      className="pb-1.5"
                    >
                      <div className="rounded-xl border border-border/40 bg-card px-3 py-2.5">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 shrink-0">
                            {m.avatar_url ? <AvatarImage src={m.avatar_url} alt={firstName} /> : null}
                            <AvatarFallback className="text-[11px] bg-muted">
                              {initialsOf(m.name || 'Friend')}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{firstName}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              {isActive ? (
                                <>
                                  <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                                  <span className="text-[11px] text-emerald-400 font-medium">
                                    Active
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Clock className="h-3 w-3 text-amber-400" />
                                  <span className="text-[11px] text-amber-400 font-medium">
                                    Waiting to activate
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              Total
                            </p>
                            <p className="text-sm font-bold tabular-nums text-foreground">
                              ₦{totalEarned.toLocaleString()}
                            </p>
                          </div>
                        </div>

                        {/* Monetary breakdown row */}
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <div className="rounded-lg bg-emerald-500/[0.06] border border-emerald-500/15 px-2 py-1.5">
                            <p className="text-[9px] uppercase tracking-wider text-emerald-400/90 font-semibold">
                              Activation
                            </p>
                            <p className={
                              'text-[12px] font-bold tabular-nums leading-tight ' +
                              (isActive ? 'text-foreground' : 'text-muted-foreground italic font-medium')
                            }>
                              {isActive
                                ? `₦${activationPaid.toLocaleString()}`
                                : 'Waiting'}
                            </p>
                          </div>
                          <div className="rounded-lg bg-amber-500/[0.06] border border-amber-500/15 px-2 py-1.5">
                            <p className="text-[9px] uppercase tracking-wider text-amber-400/90 font-semibold">
                              Extra earnings
                            </p>
                            <p className={
                              'text-[12px] font-bold tabular-nums leading-tight ' +
                              (extraEarned > 0 ? 'text-foreground' : 'text-muted-foreground italic font-medium')
                            }>
                              {extraEarned > 0 ? `₦${extraEarned.toLocaleString()}` : 'None yet'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Earnings tab */}
        <TabsContent value="earnings" className="mt-0 p-3">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-12 rounded-xl bg-muted/30 animate-pulse" />
              ))}
            </div>
          ) : royalties.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No extra earnings yet"
              subtitle="They'll show up here every time a friend activates an ad share."
            />
          ) : (
            <div
              ref={earningsRef}
              className={`${listHeight} ${showVirtualScroll ? 'overflow-y-auto' : ''}`}
            >
              <div
                style={{
                  height: showVirtualScroll
                    ? `${earningsVirtualizer.getTotalSize()}px`
                    : 'auto',
                  position: 'relative',
                }}
              >
                {(showVirtualScroll
                  ? earningsVirtualizer.getVirtualItems()
                  : royalties.map((_, i) => ({ index: i, start: 0, size: 0, key: i }))
                ).map((vRow) => {
                  const r = royalties[vRow.index];
                  return (
                    <div
                      key={`${r.createdAt}-${vRow.index}`}
                      style={
                        showVirtualScroll
                          ? {
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: `${vRow.size}px`,
                              transform: `translateY(${vRow.start}px)`,
                            }
                          : undefined
                      }
                      className="pb-1.5"
                    >
                      <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-card px-3 py-2.5">
                        <div className="h-8 w-8 rounded-full bg-amber-500/10 border border-amber-500/25 flex items-center justify-center shrink-0">
                          <Repeat className="h-4 w-4 text-amber-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground truncate">
                            From <span className="font-medium">{r.refereeName}</span>'s pending balance
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {fmtTime(r.createdAt)}
                          </p>
                        </div>
                        <p className="text-sm font-bold tabular-nums text-emerald-400 shrink-0">
                          +₦{Number(r.amount).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

const EmptyState = ({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof Users;
  title: string;
  subtitle: string;
}) => (
  <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 px-4 py-8 text-center">
    <Icon className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
    <p className="text-sm font-medium text-foreground">{title}</p>
    <p className="text-[12px] text-muted-foreground mt-0.5">{subtitle}</p>
  </div>
);
