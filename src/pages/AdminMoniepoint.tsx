import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Loader2, Banknote, Inbox, CheckCircle2, UserPlus, Search, Zap, Building2, Clock, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AdminMoniepoint() {
  const qc = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ['admin-platform-config-moniepoint'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_config')
        .select('payment_provider, moniepoint_account_number, moniepoint_account_name, moniepoint_bank_name')
        .eq('id', 1)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const [acct, setAcct] = useState('');
  const [name, setName] = useState('');
  const [bank, setBank] = useState('Moniepoint MFB');
  const [provider, setProvider] = useState<'moniepoint' | 'flutterwave' | 'paystack' | null>(null);

  // Hydrate account fields once
  if (config && acct === '' && (config.moniepoint_account_number || config.moniepoint_account_name)) {
    setAcct(config.moniepoint_account_number || '');
    setName(config.moniepoint_account_name || '');
    setBank(config.moniepoint_bank_name || 'Moniepoint MFB');
  }
  // Hydrate provider independently
  if (config && provider === null) {
    setProvider(((config.payment_provider as any) || 'moniepoint'));
  }

  const [switching, setSwitching] = useState(false);
  const switchProvider = async (next: 'moniepoint' | 'flutterwave' | 'paystack') => {
    if (next === provider || switching) return;
    const previous = provider;
    setProvider(next); // optimistic
    setSwitching(true);
    const { error } = await supabase
      .from('platform_config')
      .update({ payment_provider: next })
      .eq('id', 1);
    setSwitching(false);
    if (error) {
      setProvider(previous);
      toast({ title: 'Switch failed', description: error.message, variant: 'destructive' });
      return;
    }
    qc.invalidateQueries({ queryKey: ['admin-platform-config-moniepoint'] });
    qc.invalidateQueries({ queryKey: ['platform-config'] });
    const labelMap: Record<typeof next, string> = {
      moniepoint: 'Bank Transfer (Moniepoint)',
      flutterwave: 'Flutterwave',
      paystack: 'Paystack',
    } as const;
    toast({
      title: `Now using ${labelMap[next]}`,
      description: 'Every user will see this method on their next action.',
    });
  };

  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('platform_config')
      .update({
        moniepoint_account_number: acct || null,
        moniepoint_account_name: name || null,
        moniepoint_bank_name: bank || 'Moniepoint MFB',
      })
      .eq('id', 1);
    setSaving(false);
    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Saved', description: 'Payment settings updated.' });
    qc.invalidateQueries({ queryKey: ['admin-platform-config-moniepoint'] });
    qc.invalidateQueries({ queryKey: ['platform-config'] });
  };

  const { data: unmatched = [], refetch } = useQuery({
    queryKey: ['unmatched-moniepoint'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('unmatched_moniepoint_payments')
        .select('*')
        .eq('resolved', false)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30_000,
  });

  const markResolved = async (id: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase
      .from('unmatched_moniepoint_payments')
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: session?.user?.id ?? null,
      })
      .eq('id', id);
    if (error) {
      toast({ title: 'Failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Marked resolved' });
    refetch();
  };

  // ---- 24h pipeline health ----
  const { data: pipelineStats } = useQuery({
    queryKey: ['moniepoint-pipeline-stats'],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const [{ count: total }, { count: resolved }, { count: parseFailed }] = await Promise.all([
        supabase
          .from('unmatched_moniepoint_payments')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', since),
        supabase
          .from('unmatched_moniepoint_payments')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', since)
          .eq('resolved', true),
        supabase
          .from('unmatched_moniepoint_payments')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', since)
          .eq('reason', 'parse_failed'),
      ]);
      const t = total ?? 0;
      const m = resolved ?? 0;
      return {
        total: t,
        matched: m,
        pending: Math.max(0, t - m),
        parseFailed: parseFailed ?? 0,
      };
    },
    refetchInterval: 60_000,
  });

  // ---- Credit-to-user dialog ----
  const [creditTarget, setCreditTarget] = useState<any | null>(null);
  const [creditPurpose, setCreditPurpose] = useState<'deposit' | 'membership'>('deposit');
  const [userQuery, setUserQuery] = useState('');
  const [pickedUser, setPickedUser] = useState<{ id: string; full_name: string; phone_number: string | null } | null>(
    null,
  );
  const [crediting, setCrediting] = useState(false);

  const { data: searchResults = [], isFetching: searching } = useQuery({
    queryKey: ['admin-user-search', userQuery],
    queryFn: async () => {
      if (userQuery.trim().length < 2) return [];
      const term = `%${userQuery.trim()}%`;
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, phone_number, is_member')
        .or(`full_name.ilike.${term},phone_number.ilike.${term}`)
        .limit(8);
      if (error) throw error;
      return data || [];
    },
    enabled: !!creditTarget && userQuery.trim().length >= 2,
    staleTime: 10_000,
  });

  const openCreditDialog = (row: any) => {
    setCreditTarget(row);
    setCreditPurpose('deposit');
    setUserQuery('');
    setPickedUser(null);
  };

  const submitCredit = async () => {
    if (!creditTarget || !pickedUser) return;
    setCrediting(true);
    const { data, error } = await supabase.functions.invoke('admin-credit-unmatched-payment', {
      body: {
        unmatched_id: creditTarget.id,
        target_user_id: pickedUser.id,
        purpose: creditPurpose,
      },
    });
    setCrediting(false);
    if (error || (data as any)?.error) {
      toast({
        title: 'Credit failed',
        description: (data as any)?.error || error?.message || 'Could not credit user',
        variant: 'destructive',
      });
      return;
    }
    toast({
      title: 'Credited',
      description:
        creditPurpose === 'membership'
          ? `${pickedUser.full_name} is now activated.`
          : `₦${Number(creditTarget.amount).toLocaleString()} added to ${pickedUser.full_name}.`,
    });
    setCreditTarget(null);
    setPickedUser(null);
    refetch();
  };

  // ---- Pending payment attempts (user said paid, awaiting webhook) ----
  const { data: pendingAttempts = [], refetch: refetchAttempts } = useQuery({
    queryKey: ['admin-pending-payment-attempts'],
    queryFn: async () => {
      const since = new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(); // last 48h
      const { data, error } = await supabase
        .from('payment_attempts')
        .select('id, user_id, amount, unique_amount, purpose, status, sender_bank_name, sender_account_number, tx_ref, created_at, provider')
        .eq('status', 'pending')
        .eq('provider', 'moniepoint')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      if (!data || data.length === 0) return [];
      const userIds = Array.from(new Set(data.map((d: any) => d.user_id)));
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name, phone_number, is_member')
        .in('id', userIds);
      const map = new Map((profs || []).map((p: any) => [p.id, p]));
      return data.map((d: any) => ({ ...d, profile: map.get(d.user_id) }));
    },
    refetchInterval: 20_000,
  });

  const [approvingId, setApprovingId] = useState<string | null>(null);
  const approveAttempt = async (a: any) => {
    if (approvingId) return;
    const label = a.purpose === 'membership' ? 'activate this user' : `credit ₦${Number(a.amount).toLocaleString()}`;
    if (!confirm(`Force approve and ${label}? Only do this if you have confirmed the money landed in your bank.`)) return;
    setApprovingId(a.id);
    const { data, error } = await supabase.functions.invoke('admin-approve-payment-attempt', {
      body: { attempt_id: a.id },
    });
    setApprovingId(null);
    if (error || (data as any)?.error) {
      toast({
        title: 'Approve failed',
        description: (data as any)?.error || error?.message || 'Could not approve',
        variant: 'destructive',
      });
      return;
    }
    toast({
      title: 'Approved',
      description: a.purpose === 'membership'
        ? `${a.profile?.full_name || 'User'} activated.`
        : `₦${Number(a.amount).toLocaleString()} credited to ${a.profile?.full_name || 'user'}.`,
    });
    refetchAttempts();
  };


  return (
    <div className="container max-w-3xl mx-auto p-3 md:p-4 space-y-4 md:space-y-6 pb-24 md:pb-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <Banknote className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold truncate">Payment Methods</h1>
          <p className="text-xs md:text-sm text-muted-foreground">Pick how users pay & match unmatched transfers</p>
        </div>
      </div>

      {/* Pipeline health — last 24h */}
      {pipelineStats && (
        <Card className="border-muted/40 bg-muted/10">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email pipeline · last 24h</p>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <p className="text-lg font-bold">{pipelineStats.total}</p>
                <p className="text-[10px] text-muted-foreground">Emails</p>
              </div>
              <div>
                <p className="text-lg font-bold text-success">{pipelineStats.matched}</p>
                <p className="text-[10px] text-muted-foreground">Auto-matched</p>
              </div>
              <div>
                <p className={cn("text-lg font-bold", pipelineStats.pending > 0 ? 'text-caution' : 'text-muted-foreground')}>{pipelineStats.pending}</p>
                <p className="text-[10px] text-muted-foreground">Pending</p>
              </div>
              <div>
                <p className={cn("text-lg font-bold", pipelineStats.parseFailed > 0 ? 'text-destructive' : 'text-muted-foreground')}>{pipelineStats.parseFailed}</p>
                <p className="text-[10px] text-muted-foreground">Parse-failed</p>
              </div>
            </div>
            {pipelineStats.total === 0 && (
              <p className="text-[11px] text-caution mt-2">No emails received in 24h — check the Cloudflare Email Worker is deployed &amp; active.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Active Payment Method — prominent, instant-save toggle */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">What users see when they pay</CardTitle>
            {switching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          <p className="text-xs text-muted-foreground">
            Pick one. Every user paying right now sees this option only.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {([
            {
              id: 'moniepoint' as const,
              title: 'Bank Transfer (Manual)',
              sub: 'Moniepoint — users transfer to your account, you approve',
              Icon: Building2,
            },
            {
              id: 'flutterwave' as const,
              title: 'Flutterwave',
              sub: 'Auto-verified, bank-transfer-only paywall',
              Icon: Zap,
            },
            {
              id: 'paystack' as const,
              title: 'Paystack',
              sub: 'Auto-verified, bank-transfer-only paywall',
              Icon: Zap,
            },
          ]).map(({ id, title, sub, Icon }) => {
            const active = provider === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => switchProvider(id)}
                disabled={switching || !provider}
                className={cn(
                  'w-full flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-all',
                  active
                    ? 'border-primary bg-primary/10 shadow-[0_0_0_4px_hsl(var(--primary)/0.08)]'
                    : 'border-border bg-card hover:border-primary/40 opacity-80'
                )}
              >
                <div className={cn(
                  'h-10 w-10 rounded-lg flex items-center justify-center shrink-0',
                  active ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                )}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={cn('font-semibold', active ? 'text-foreground' : 'text-foreground/80')}>
                      {title}
                    </p>
                    {active && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-success">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
                        </span>
                        Live now
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{sub}</p>
                </div>
                <div
                  className={cn(
                    'h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0',
                    active ? 'border-primary bg-primary' : 'border-muted-foreground/30'
                  )}
                >
                  {active && <CheckCircle2 className="h-4 w-4 text-primary-foreground" />}
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {/* Paystack webhook URL — paste this into Paystack dashboard */}
      {provider === 'paystack' && (
        <Card className="border-warning/40 bg-warning/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Paystack Webhook URL</CardTitle>
            <p className="text-xs text-muted-foreground">
              Paste this in Paystack Dashboard → Settings → API Keys &amp; Webhooks
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 rounded-lg border bg-card p-2">
              <code className="flex-1 truncate text-xs">
                https://sbprvewcfrtazdlcfvxt.supabase.co/functions/v1/paystack-webhook
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(
                    'https://sbprvewcfrtazdlcfvxt.supabase.co/functions/v1/paystack-webhook'
                  );
                  toast({ title: 'Copied' });
                }}
              >
                Copy
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Also make sure <code>PAYSTACK_SECRET_KEY</code> is set in Supabase secrets.
            </p>
          </CardContent>
        </Card>
      )}


      <Card>
        <CardHeader>
          <CardTitle>Business Account</CardTitle>
          <p className="text-xs text-muted-foreground">
            Used only when Bank Transfer is the live method above.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <div>
                <label className="text-sm font-medium block mb-1">Account Number</label>
                <Input
                  inputMode="numeric"
                  maxLength={10}
                  value={acct}
                  onChange={(e) => setAcct(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit account"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Account Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Business name" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Bank Name</label>
                <Input value={bank} onChange={(e) => setBank(e.target.value)} placeholder="Moniepoint MFB" />
              </div>
              <Button onClick={save} disabled={saving} className="w-full">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save
              </Button>
              <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
                <p className="font-semibold">Email → auto-credit pipeline endpoint (Cloudflare Worker → Supabase):</p>
                <code className="block break-all bg-muted p-2 rounded text-[11px]">
                  https://sbprvewcfrtazdlcfvxt.supabase.co/functions/v1/moniepoint-email-webhook
                </code>
                <p className="mt-1">This is the URL your Cloudflare Email Worker forwards Moniepoint alerts to. Do not paste it anywhere else.</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Waiting for confirmation — users who said "I have paid" but webhook hasn't matched */}
      <Card className="border-caution/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-caution" />
            Waiting on Confirmation
            {pendingAttempts.length > 0 && (
              <span className="ml-auto text-sm font-normal text-muted-foreground">{pendingAttempts.length} pending</span>
            )}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Users who started a bank transfer in the last 48 hours and aren't credited yet.
            Check your Moniepoint app — if the money is really there, approve here.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {pendingAttempts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nobody waiting. All caught up.
            </p>
          ) : (
            pendingAttempts.map((a: any) => (
              <div key={a.id} className="border rounded-lg p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{a.profile?.full_name || 'Unknown user'}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {a.profile?.phone_number || 'no phone'}
                      {a.profile?.is_member ? ' • member' : ' • not member yet'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold tabular-nums">₦{Number(a.amount).toLocaleString()}</p>
                    {a.unique_amount && Number(a.unique_amount) !== Number(a.amount) && (
                      <p className="text-[10px] text-muted-foreground">
                        exact ₦{Number(a.unique_amount).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                  <span className="px-1.5 py-0.5 rounded bg-muted">
                    {a.purpose === 'membership' ? 'For activation' : 'For wallet'}
                  </span>
                  {a.sender_bank_name && (
                    <span>from {a.sender_bank_name} {a.sender_account_number ? `• ${a.sender_account_number}` : ''}</span>
                  )}
                  <span>{new Date(a.created_at).toLocaleString()}</span>
                </div>
                <div className="pt-1">
                  <Button
                    size="sm"
                    onClick={() => approveAttempt(a)}
                    disabled={approvingId === a.id}
                    className="w-full"
                  >
                    {approvingId === a.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                      : <ShieldCheck className="h-3.5 w-3.5 mr-1" />}
                    {a.purpose === 'membership' ? 'Approve & activate' : 'Approve & credit wallet'}
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Inbox className="h-5 w-5" />
            Unmatched Payments
            {unmatched.length > 0 && (
              <span className="ml-auto text-sm font-normal text-muted-foreground">{unmatched.length} pending</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {unmatched.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No unmatched payments. All clean.
            </p>
          ) : (
            unmatched.map((u: any) => (
              <div key={u.id} className="border rounded-lg p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="font-bold tabular-nums">₦{Number(u.amount).toLocaleString()}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(u.created_at).toLocaleString()}
                  </p>
                </div>
                <p className="text-xs">
                  <span className="text-muted-foreground">From:</span>{' '}
                  {u.sender_account_name || '—'} • {u.sender_account_number || 'no acct'} •{' '}
                  {u.sender_bank_name || 'no bank'}
                </p>
                <p className="text-[11px] text-caution">{u.reason}</p>
                {u.transaction_reference && (
                  <p className="text-[11px] text-muted-foreground">Ref: {u.transaction_reference}</p>
                )}
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={() => openCreditDialog(u)}>
                    <UserPlus className="h-3.5 w-3.5 mr-1" />
                    Credit to user
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => markResolved(u.id)}>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    Just mark resolved
                  </Button>
                </div>
              </div>
            ))
          )}
          <p className="text-[11px] text-muted-foreground text-center pt-2">
            "Credit to user" activates membership OR adds to wallet, then resolves the row.
          </p>
        </CardContent>
      </Card>

      {/* Credit-to-user dialog */}
      <Dialog open={!!creditTarget} onOpenChange={(o) => !o && setCreditTarget(null)}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Credit a user</DialogTitle>
            <DialogDescription>
              {creditTarget && (
                <>
                  ₦{Number(creditTarget.amount).toLocaleString()} from{' '}
                  <span className="font-medium">{creditTarget.sender_account_name || 'unknown'}</span>
                  {creditTarget.sender_account_number && ` (${creditTarget.sender_account_number})`}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold block mb-1">What is this for?</label>
              <div className="flex gap-2">
                {(['deposit', 'membership'] as const).map((p) => (
                  <Button
                    key={p}
                    type="button"
                    size="sm"
                    variant={creditPurpose === p ? 'default' : 'outline'}
                    onClick={() => setCreditPurpose(p)}
                    className="flex-1 capitalize"
                  >
                    {p === 'membership' ? 'Activate membership' : 'Add to wallet'}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold block mb-1">Find user (name or phone)</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={userQuery}
                  onChange={(e) => {
                    setUserQuery(e.target.value);
                    setPickedUser(null);
                  }}
                  placeholder="Type at least 2 characters…"
                  className="pl-9"
                />
              </div>

              {userQuery.trim().length >= 2 && (
                <div className="mt-2 max-h-56 overflow-y-auto border rounded-lg divide-y">
                  {searching ? (
                    <div className="p-3 text-xs text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" /> Searching…
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="p-3 text-xs text-muted-foreground">No users found.</div>
                  ) : (
                    searchResults.map((u: any) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() =>
                          setPickedUser({
                            id: u.id,
                            full_name: u.full_name,
                            phone_number: u.phone_number,
                          })
                        }
                        className={`w-full text-left p-2.5 text-sm hover:bg-muted ${
                          pickedUser?.id === u.id ? 'bg-primary/10' : ''
                        }`}
                      >
                        <div className="font-medium">{u.full_name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {u.phone_number || 'no phone'} • {u.is_member ? 'member' : 'not member'}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {pickedUser && (
              <div className="rounded-lg bg-primary/10 border border-primary/30 p-3 text-sm">
                <p className="font-semibold">{pickedUser.full_name}</p>
                <p className="text-xs text-muted-foreground">{pickedUser.phone_number || 'no phone'}</p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreditTarget(null)} disabled={crediting}>
              Cancel
            </Button>
            <Button onClick={submitCredit} disabled={!pickedUser || crediting}>
              {crediting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {creditPurpose === 'membership' ? 'Activate & credit' : 'Add to wallet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
