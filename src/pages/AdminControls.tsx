import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AdminControlsActionDrawer, ControlActionConfig } from '@/components/admin/AdminControlsActionDrawer';
import { Settings, Wrench, Wallet, Zap, MessageCircle, Building, CircleDollarSign, Rocket, ShieldAlert, BellRing, Bot } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdminStats } from '@/hooks/useAdminStats';
import { Skeleton } from '@/components/ui/skeleton';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import { cn } from '@/lib/utils';
import { ExplainerVideoUploader } from '@/components/admin/ExplainerVideoUploader';


type ActionType =
  | 'dropSystem'
  | 'distribution'
  | 'maintenance'
  | 'withdrawals'
  | 'syncBanks'
  | 'telegram'
  | 'whatsappPromo'
  | 'aiSupport';

export default function AdminControls() {
  const { data: stats, isLoading } = useAdminStats();
  const { data: platformConfig } = usePlatformConfig();
  const [confirmAction, setConfirmAction] = useState<{
    type: ActionType;
    config: ControlActionConfig;
  } | null>(null);
  const queryClient = useQueryClient();
  const whatsappPromoEnabled = (platformConfig as any)?.whatsapp_group_promo_enabled !== false;
  const savedWhatsappLink = ((platformConfig as any)?.whatsapp_group_link as string | null) ?? '';
  const [whatsappLinkInput, setWhatsappLinkInput] = useState('');
  const [whatsappLinkTouched, setWhatsappLinkTouched] = useState(false);
  const aiSupportEnabled = (platformConfig as any)?.ai_support_enabled !== false;

  // Keep the input in sync with the saved value until the admin edits it
  useEffect(() => {
    if (!whatsappLinkTouched) setWhatsappLinkInput(savedWhatsappLink);
  }, [savedWhatsappLink, whatsappLinkTouched]);


  const dropSystemActive = stats?.dropSystemActive ?? true;
  const distributionActive = stats?.distributionActive ?? true;
  const maintenanceMode = stats?.maintenanceMode ?? false;
  const withdrawalsEnabled = stats?.withdrawalsEnabled ?? true;
  const telegramAlertsEnabled = stats?.telegramAlertsEnabled ?? true;

  const toggleDropSystemMutation = useMutation({
    mutationFn: async (isActive: boolean) => {
      const { error } = await supabase.from('platform_config').update({ drop_system_active: isActive }).eq('id', 1);
      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      queryClient.invalidateQueries({ queryKey: ['platform-config'] });
      toast.success('System Status Updated');
    },
    onError: (error: Error) => toast.error('Failed to Update', { description: error.message }),
  });

  const toggleMaintenanceMutation = useMutation({
    mutationFn: async (mode: boolean) => {
      const { data, error } = await supabase.functions.invoke('toggle-maintenance', { body: { maintenanceMode: mode } });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to toggle maintenance');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      queryClient.invalidateQueries({ queryKey: ['platform-config'] });
      toast.success('Maintenance Mode Updated');
    },
    onError: (error: Error) => toast.error('Failed to Update', { description: error.message }),
  });

  const toggleWithdrawalsMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase.from('platform_config').update({ withdrawals_enabled: enabled }).eq('id', 1);
      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      queryClient.invalidateQueries({ queryKey: ['platform-config'] });
      toast.success('Withdrawal Status Updated');
    },
    onError: (error: Error) => toast.error('Failed to Update', { description: error.message }),
  });

  const toggleDistributionMutation = useMutation({
    mutationFn: async (isActive: boolean) => {
      const { error } = await supabase.from('platform_config').update({ distribution_active: isActive }).eq('id', 1);
      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      queryClient.invalidateQueries({ queryKey: ['platform-config'] });
      toast.success('Payout Status Updated');
    },
    onError: (error: Error) => toast.error('Failed to Update', { description: error.message }),
  });

  const toggleTelegramMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase.from('platform_config').update({ telegram_alerts_enabled: enabled }).eq('id', 1);
      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      queryClient.invalidateQueries({ queryKey: ['platform-config'] });
      toast.success('Alerts Updated');
    },
    onError: (error: Error) => toast.error('Failed to Update', { description: error.message }),
  });

  const toggleWhatsappPromoMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase.from('platform_config').update({ whatsapp_group_promo_enabled: enabled }).eq('id', 1);
      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-config'] });
      toast.success('WhatsApp Promo Updated');
    },
    onError: (error: Error) => toast.error('Failed to Update', { description: error.message }),
  });

  const saveWhatsappLinkMutation = useMutation({
    mutationFn: async (link: string) => {
      const clean = link.trim();
      const { error } = await supabase
        .from('platform_config')
        .update({ whatsapp_group_link: clean || null })
        .eq('id', 1);
      if (error) throw error;
      return clean;
    },
    onMutate: async (link: string) => {
      // Optimistic: show the new link everywhere immediately
      const previous = queryClient.getQueryData(['platform-config']);
      queryClient.setQueryData(['platform-config'], (old: any) =>
        old ? { ...old, whatsapp_group_link: link.trim() || null } : old,
      );
      return { previous };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-config'] });
      toast.success('WhatsApp group link saved');
    },
    onError: (error: Error, _link, context: any) => {
      if (context?.previous) queryClient.setQueryData(['platform-config'], context.previous);
      toast.error('Could not save link', { description: error.message });
    },
  });




  const toggleAiSupportMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase.from('platform_config').update({ ai_support_enabled: enabled }).eq('id', 1);
      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-config'] });
      toast.success('AI Support Helper Updated');
    },
    onError: (error: Error) => toast.error('Failed to Update', { description: error.message }),
  });


  const syncBanksMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('sync-banks');
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Bank sync failed');
      return data;
    },
    onSuccess: (data) => {
      toast.success('Bank List Synced', { description: `Successfully synced ${data.banks_count.toLocaleString()} banks` });
    },
    onError: (error: Error) => toast.error('Bank Sync Failed', { description: error.message }),
  });

  const { data: capData } = useQuery({
    queryKey: ['platform-config-cap'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_config')
        .select('max_auto_buys_per_pulse')
        .eq('id', 1)
        .maybeSingle();
      if (error) throw error;
      return (data as { max_auto_buys_per_pulse?: number } | null)?.max_auto_buys_per_pulse ?? 1;
    },
  });
  const [capInput, setCapInput] = useState<string>('1');
  useEffect(() => {
    if (typeof capData === 'number') setCapInput(String(capData));
  }, [capData]);

  const updateCapMutation = useMutation({
    mutationFn: async (newValue: number) => {
      const { error } = await supabase.from('platform_config').update({ max_auto_buys_per_pulse: newValue }).eq('id', 1);
      if (error) throw error;
      return newValue;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-config-cap'] });
      queryClient.invalidateQueries({ queryKey: ['platform-config'] });
      toast.success('Settings Saved');
    },
    onError: (e: Error) => toast.error('Failed to update', { description: e.message }),
  });

  const handleDropSystemToggle = (checked: boolean) => {
    setConfirmAction({
      type: 'dropSystem',
      config: {
        title: checked ? 'Turn On Payments & Spots?' : 'STOP All Payments & Spots?',
        description: checked
          ? 'You are about to bring the whole money engine back online.'
          : 'You are about to freeze the entire money engine. Only use this in an emergency.',
        variant: checked ? 'info' : 'danger',
        currentState: { label: checked ? 'System Paused' : 'System Running', tone: checked ? 'off' : 'on' },
        nextState: { label: checked ? 'System Running' : 'System Frozen', tone: checked ? 'on' : 'off' },
        impacts: checked
          ? [
              'People can buy new spots again.',
              'Automatic payouts will resume right away.',
              'New activity will start showing on the dashboard.',
            ]
          : [
              'Nobody can buy a new spot.',
              'Nobody will get paid until you turn this back on.',
              'Money already in the system stays where it is.',
              'Use only if something is seriously wrong.',
            ],
        confirmLabel: checked ? 'Yes, turn it ON' : 'Yes, STOP everything',
        confirmPhrase: checked ? undefined : 'STOP',
      },
    });
  };

  const handleMaintenanceToggle = (checked: boolean) => {
    setConfirmAction({
      type: 'maintenance',
      config: {
        title: checked ? 'Shut Down Site for Maintenance?' : 'Bring Site Back Online?',
        description: checked
          ? 'Normal users will be locked out and shown a maintenance page.'
          : 'The site will be open to everyone again.',
        variant: checked ? 'danger' : 'info',
        currentState: { label: checked ? 'Online' : 'Offline', tone: checked ? 'on' : 'off' },
        nextState: { label: checked ? 'Offline' : 'Online', tone: checked ? 'off' : 'on' },
        impacts: checked
          ? [
              'Everyone except admins is logged out of the app.',
              'Visitors see a "We will be back soon" page.',
              'Background jobs (payouts, alerts) keep running.',
            ]
          : [
              'Members can log in and use the site normally again.',
              'Pending actions resume immediately.',
            ],
        confirmLabel: checked ? 'Yes, shut it down' : 'Yes, go online',
        confirmPhrase: checked ? 'SHUTDOWN' : undefined,
      },
    });
  };

  const handleWithdrawalsToggle = (checked: boolean) => {
    setConfirmAction({
      type: 'withdrawals',
      config: {
        title: checked ? 'Allow Bank Withdrawals?' : 'BLOCK All Bank Withdrawals?',
        description: checked
          ? 'Members will be able to move their earnings to their bank again.'
          : 'Nobody will be able to take money out until you turn this back on.',
        variant: checked ? 'info' : 'danger',
        currentState: { label: checked ? 'Blocked' : 'Allowed', tone: checked ? 'off' : 'on' },
        nextState: { label: checked ? 'Allowed' : 'Blocked', tone: checked ? 'on' : 'off' },
        impacts: checked
          ? [
              'Withdrawal button becomes active on every wallet.',
              'Pending withdrawals continue processing normally.',
            ]
          : [
              'Withdrawal button is greyed out for everyone.',
              'No new transfers leave the platform.',
              'Existing balances are not touched, just frozen in place.',
              'Use only for urgent fraud or audit reasons.',
            ],
        confirmLabel: checked ? 'Yes, allow it' : 'Yes, BLOCK withdrawals',
        confirmPhrase: checked ? undefined : 'BLOCK',
      },
    });
  };

  const handleTelegramToggle = (checked: boolean) => {
    setConfirmAction({
      type: 'telegram',
      config: {
        title: checked ? 'Receive Telegram Alerts?' : 'Stop Telegram Alerts?',
        description: checked
          ? 'You will get a ping for sign-ups, payments and key events.'
          : 'Your phone will stop buzzing for platform events.',
        variant: 'info',
        currentState: { label: checked ? 'Silent' : 'Notifying', tone: checked ? 'off' : 'on' },
        nextState: { label: checked ? 'Notifying' : 'Silent', tone: checked ? 'on' : 'off' },
        impacts: checked
          ? ['Telegram bot will message you whenever someone signs up or pays for a spot.']
          : ['No more Telegram pings. You will need to open the dashboard to see what is happening.'],
        confirmLabel: checked ? 'Yes, turn ON' : 'Yes, turn OFF',
      },
    });
  };

  const handleWhatsappPromoToggle = (checked: boolean) => {
    setConfirmAction({
      type: 'whatsappPromo',
      config: {
        title: checked ? 'Show WhatsApp Link on Dashboard?' : 'Hide WhatsApp Link?',
        description: checked
          ? 'Everyone will see the "Join our WhatsApp group" card on their main screen.'
          : 'The WhatsApp box will be hidden from all members.',
        variant: 'info',
        currentState: { label: checked ? 'Hidden' : 'Visible', tone: checked ? 'off' : 'on' },
        nextState: { label: checked ? 'Visible' : 'Hidden', tone: checked ? 'on' : 'off' },
        impacts: checked
          ? ['The WhatsApp invite card shows up on every member dashboard.']
          : ['The WhatsApp card disappears from member dashboards.'],
        confirmLabel: checked ? 'Yes, show it' : 'Yes, hide it',
      },
    });
  };

  const handleDistributionToggle = (checked: boolean) => {
    setConfirmAction({
      type: 'distribution',
      config: {
        title: checked ? 'Start Automatic Payouts?' : 'Pause Automatic Payouts?',
        description: checked
          ? 'Money will start flowing to members again as they finish cycles.'
          : 'Spots still work, but money stops flowing out until you resume.',
        variant: checked ? 'info' : 'warning',
        currentState: { label: checked ? 'Paused' : 'Flowing', tone: checked ? 'off' : 'on' },
        nextState: { label: checked ? 'Flowing' : 'Paused', tone: checked ? 'on' : 'off' },
        impacts: checked
          ? ['Members start receiving their cycle credits automatically.', 'Queue starts moving again.']
          : ['Members will not be paid even after finishing a cycle.', 'Spots can still be bought.', 'Use this to take a controlled break.'],
        confirmLabel: checked ? 'Yes, start paying' : 'Yes, pause payouts',
      },
    });
  };


  const handleAiSupportToggle = (checked: boolean) => {
    setConfirmAction({
      type: 'aiSupport',
      config: {
        title: checked ? 'Turn On AI Support Helper?' : 'Turn Off AI Support Helper?',
        description: checked
          ? 'The AI helper will start replying instantly to every new help request.'
          : 'The AI helper will stop replying. Every help request will wait for you (admin) to answer.',
        variant: checked ? 'info' : 'warning',
        currentState: { label: checked ? 'Off' : 'On', tone: checked ? 'off' : 'on' },
        nextState: { label: checked ? 'On' : 'Off', tone: checked ? 'on' : 'off' },
        impacts: checked
          ? [
              'New help tickets get an instant smart reply from the AI helper.',
              'Users feel supported even when you are sleeping.',
              'You can still jump in and reply yourself anytime.',
            ]
          : [
              'No AI auto-reply on new tickets.',
              'You will need to reply manually to every help request.',
              'Use this if the AI is giving wrong answers or you want fully human support.',
            ],
        confirmLabel: checked ? 'Yes, turn ON' : 'Yes, turn OFF',
      },
    });
  };

  const handleSyncBanks = () => {
    setConfirmAction({
      type: 'syncBanks',
      config: {
        title: 'Update Bank List?',
        description: 'Refreshes the list of banks members can pick from.',
        variant: 'info',
        impacts: [
          'Pulls the freshest list from the payment provider.',
          'Existing accounts are not affected.',
          'Only run this if someone reports a missing bank.',
        ],
        confirmLabel: 'Yes, update banks',
      },
    });
  };

  const handleConfirm = () => {
    if (!confirmAction) return;
    if (confirmAction.type === 'dropSystem') toggleDropSystemMutation.mutate(!dropSystemActive);
    else if (confirmAction.type === 'distribution') toggleDistributionMutation.mutate(!distributionActive);
    else if (confirmAction.type === 'maintenance') toggleMaintenanceMutation.mutate(!maintenanceMode);
    else if (confirmAction.type === 'withdrawals') toggleWithdrawalsMutation.mutate(!withdrawalsEnabled);
    else if (confirmAction.type === 'telegram') toggleTelegramMutation.mutate(!telegramAlertsEnabled);
    else if (confirmAction.type === 'whatsappPromo') toggleWhatsappPromoMutation.mutate(!whatsappPromoEnabled);
    
    else if (confirmAction.type === 'aiSupport') toggleAiSupportMutation.mutate(!aiSupportEnabled);
    else if (confirmAction.type === 'syncBanks') syncBanksMutation.mutate();
    setConfirmAction(null);
  };

  const isPending =
    toggleDropSystemMutation.isPending ||
    toggleMaintenanceMutation.isPending ||
    toggleWithdrawalsMutation.isPending ||
    toggleDistributionMutation.isPending ||
    toggleTelegramMutation.isPending ||
    toggleWhatsappPromoMutation.isPending ||
    
    toggleAiSupportMutation.isPending ||
    syncBanksMutation.isPending;

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6 md:space-y-8 pb-24 md:pb-12">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Settings className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Switches & Settings</h1>
        </div>
        <p className="text-sm md:text-base text-muted-foreground">
          Master controls to manage how the whole platform works.
        </p>
      </div>

      {/* Main Controls Section */}
      <Card className="border-2 overflow-hidden">
        <CardHeader className="bg-muted/30 pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Zap className="h-5 w-5 text-primary" />
            Main System Controls
          </CardTitle>
          <CardDescription>High-level switches for core site functionality</CardDescription>
        </CardHeader>
        <CardContent className="p-0 divide-y">
          {/* System Status Toggle */}
          <div className={cn(
            'flex items-center justify-between p-5 transition-colors',
            !dropSystemActive ? 'bg-warning/5' : 'hover:bg-accent/30',
          )}>
            <div className="flex-1 pr-4">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <Zap className={cn('h-4 w-4', dropSystemActive ? 'text-primary' : 'text-warning')} />
                <p className="font-semibold text-base">System Payments & New Spots</p>
                <Badge variant={dropSystemActive ? 'success' : 'warning'} className="ml-1 uppercase text-[10px] tracking-wider">
                  {dropSystemActive ? 'Active' : 'Paused'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground leading-snug">
                {dropSystemActive
                  ? 'ON: People can buy spots and get paid automatically.'
                  : 'OFF: No new spots or payouts. Everything is paused.'}
              </p>
            </div>
            <Switch
              checked={dropSystemActive}
              onCheckedChange={handleDropSystemToggle}
              disabled={toggleDropSystemMutation.isPending}
              className="data-[state=checked]:bg-success"
            />
          </div>

          {/* Maintenance Mode Toggle */}
          <div className={cn(
            'flex items-center justify-between p-5 transition-colors',
            maintenanceMode ? 'bg-destructive/5' : 'hover:bg-accent/30',
          )}>
            <div className="flex-1 pr-4">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <ShieldAlert className={cn('h-4 w-4', maintenanceMode ? 'text-destructive' : 'text-muted-foreground')} />
                <p className="font-semibold text-base">Emergency Site Shutdown</p>
                <Badge variant={maintenanceMode ? 'destructive' : 'outline'} className="ml-1 uppercase text-[10px] tracking-wider">
                  {maintenanceMode ? 'Offline' : 'Online'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground leading-snug">
                {maintenanceMode
                  ? 'ON: Only Admins can see the site. Users see a maintenance page.'
                  : 'OFF: Everyone can use the site normally.'}
              </p>
            </div>
            <Switch
              checked={maintenanceMode}
              onCheckedChange={handleMaintenanceToggle}
              disabled={toggleMaintenanceMutation.isPending}
            />
          </div>
        </CardContent>
      </Card>

      {/* Money Controls Section */}
      <Card className="border-2 overflow-hidden">
        <CardHeader className="bg-muted/30 pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wallet className="h-5 w-5 text-success" />
            Money & Payouts
          </CardTitle>
          <CardDescription>Control how and when people get their money</CardDescription>
        </CardHeader>
        <CardContent className="p-0 divide-y">
          {/* Withdrawals Toggle */}
          <div className={cn(
            'flex items-center justify-between p-5 transition-colors',
            !withdrawalsEnabled ? 'bg-destructive/5' : 'hover:bg-accent/30',
          )}>
            <div className="flex-1 pr-4">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <Wallet className={cn('h-4 w-4', withdrawalsEnabled ? 'text-success' : 'text-destructive')} />
                <p className="font-semibold text-base">Allow Bank Withdrawals</p>
                <Badge variant={withdrawalsEnabled ? 'success' : 'destructive'} className="ml-1 uppercase text-[10px] tracking-wider">
                  {withdrawalsEnabled ? 'Allowed' : 'Blocked'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground leading-snug">
                {withdrawalsEnabled
                  ? 'ON: Users can move their earnings to their bank accounts.'
                  : 'OFF: All bank transfers are blocked for everyone.'}
              </p>
            </div>
            <Switch
              checked={withdrawalsEnabled}
              onCheckedChange={handleWithdrawalsToggle}
              disabled={toggleWithdrawalsMutation.isPending}
            />
          </div>

          {/* Distribution Toggle */}
          <div className={cn(
            'flex items-center justify-between p-5 transition-colors',
            !distributionActive ? 'bg-warning/5' : 'hover:bg-accent/30',
          )}>
            <div className="flex-1 pr-4">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <CircleDollarSign className={cn('h-4 w-4', distributionActive ? 'text-success' : 'text-warning')} />
                <p className="font-semibold text-base">Automatic Payouts</p>
                <Badge variant={distributionActive ? 'success' : 'warning'} className="ml-1 uppercase text-[10px] tracking-wider">
                  {distributionActive ? 'Flowing' : 'Paused'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground leading-snug">
                {distributionActive
                  ? 'ON: Users get paid automatically as they finish cycles.'
                  : 'OFF: Money stays in the system. Nobody gets paid for now.'}
              </p>
            </div>
            <Switch
              checked={distributionActive}
              onCheckedChange={handleDistributionToggle}
              disabled={toggleDistributionMutation.isPending}
            />
          </div>

          {/* Empire Builder Cap */}
          <div className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <Rocket className="h-4 w-4 text-primary" />
              <p className="font-semibold text-base">Max Auto-Buys per User</p>
            </div>
            <p className="text-sm text-muted-foreground mb-4 leading-snug">
              The maximum number of spots one person can buy automatically at once. Keeping this at{' '}
              <span className="font-bold">1</span> is best for most situations.
            </p>
            <div className="flex items-end gap-3 max-w-xs">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="cap-input" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Max spots
                </Label>
                <Input
                  id="cap-input"
                  type="number"
                  min={1}
                  max={50}
                  value={capInput}
                  onChange={(e) => setCapInput(e.target.value)}
                  className="h-10 text-lg font-medium tabular-nums"
                />
              </div>
              <Button
                size="lg"
                onClick={() => {
                  const n = parseInt(capInput, 10);
                  if (!Number.isFinite(n) || n < 1 || n > 50) {
                    toast.error('Enter a number between 1 and 50');
                    return;
                  }
                  updateCapMutation.mutate(n);
                }}
                disabled={updateCapMutation.isPending || parseInt(capInput, 10) === capData}
                className="px-8 shadow-md"
              >
                Save
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>


      {/* Notifications Section */}
      <Card className="border-2 overflow-hidden">
        <CardHeader className="bg-muted/30 pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BellRing className="h-5 w-5 text-info" />
            Alerts & Promotions
          </CardTitle>
          <CardDescription>Control notifications and dashboard visibility</CardDescription>
        </CardHeader>
        <CardContent className="p-0 divide-y">
          {/* Telegram Alerts Toggle */}
          <div className="flex items-center justify-between p-5 hover:bg-accent/30 transition-colors">
            <div className="flex-1 pr-4">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <MessageCircle className="h-4 w-4 text-info" />
                <p className="font-semibold text-base">Admin Notifications</p>
                <Badge variant={telegramAlertsEnabled ? 'info' : 'outline'} className="ml-1 uppercase text-[10px] tracking-wider">
                  {telegramAlertsEnabled ? 'On' : 'Off'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground leading-snug">
                Receive a Telegram message whenever someone signs up or pays.
              </p>
            </div>
            <Switch
              checked={telegramAlertsEnabled}
              onCheckedChange={handleTelegramToggle}
              disabled={toggleTelegramMutation.isPending}
            />
          </div>

          {/* WhatsApp Group Promo Toggle */}
          <div className="flex items-center justify-between p-5 hover:bg-accent/30 transition-colors">
            <div className="flex-1 pr-4">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <MessageCircle className="h-4 w-4 text-social-whatsapp" />
                <p className="font-semibold text-base">WhatsApp Link on Dashboard</p>
                <Badge variant={whatsappPromoEnabled ? 'info' : 'outline'} className="ml-1 uppercase text-[10px] tracking-wider">
                  {whatsappPromoEnabled ? 'Visible' : 'Hidden'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground leading-snug">
                Show the "Join our WhatsApp group" box to everyone on their main page.
              </p>
            </div>
            <Switch
              checked={whatsappPromoEnabled}
              onCheckedChange={handleWhatsappPromoToggle}
              disabled={toggleWhatsappPromoMutation.isPending}
            />
          </div>

          {/* WhatsApp Group Link (editable) */}
          <div className="p-5 space-y-3 hover:bg-accent/30 transition-colors">
            <div>
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <MessageCircle className="h-4 w-4 text-social-whatsapp" />
                <p className="font-semibold text-base">WhatsApp Group Link</p>
                <Badge
                  variant={savedWhatsappLink ? 'success' : 'warning'}
                  className="ml-1 uppercase text-[10px] tracking-wider"
                >
                  {savedWhatsappLink ? 'Set' : 'Not set'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground leading-snug">
                Paste the invite link of your WhatsApp group. Everywhere in the app that says
                "join the group" or "post your payout to the group" will open this exact link.
              </p>
            </div>

            <Label htmlFor="whatsapp-group-link" className="sr-only">
              WhatsApp group link
            </Label>
            <Input
              id="whatsapp-group-link"
              type="url"
              inputMode="url"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="https://chat.whatsapp.com/..."
              value={whatsappLinkInput}
              onChange={(e) => {
                setWhatsappLinkTouched(true);
                setWhatsappLinkInput(e.target.value);
              }}
              className="h-12 text-sm font-mono"
            />

            {whatsappLinkInput.trim() &&
              !/^https:\/\/(chat\.whatsapp\.com|wa\.me)\//i.test(whatsappLinkInput.trim()) && (
                <p className="text-xs text-warning">
                  This does not look like a WhatsApp group link. It should start with
                  https://chat.whatsapp.com/
                </p>
              )}

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="h-10"
                disabled={
                  saveWhatsappLinkMutation.isPending ||
                  whatsappLinkInput.trim() === savedWhatsappLink.trim()
                }
                onClick={() => {
                  saveWhatsappLinkMutation.mutate(whatsappLinkInput);
                  setWhatsappLinkTouched(false);
                }}
              >
                Save link
              </Button>
              {savedWhatsappLink && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-10"
                  onClick={() => window.open(savedWhatsappLink, '_blank', 'noopener,noreferrer')}
                >
                  Test it
                </Button>
              )}
              {whatsappLinkTouched && whatsappLinkInput.trim() !== savedWhatsappLink.trim() && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-10 text-muted-foreground"
                  onClick={() => {
                    setWhatsappLinkTouched(false);
                    setWhatsappLinkInput(savedWhatsappLink);
                  }}
                >
                  Undo
                </Button>
              )}
            </div>
          </div>



          {/* AI Support Helper Toggle */}
          <div className={cn(
            'flex items-center justify-between p-5 transition-colors',
            !aiSupportEnabled ? 'bg-warning/5' : 'hover:bg-accent/30',
          )}>
            <div className="flex-1 pr-4">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <Bot className={cn('h-4 w-4', aiSupportEnabled ? 'text-primary' : 'text-warning')} />
                <p className="font-semibold text-base">AI Support Helper</p>
                <Badge variant={aiSupportEnabled ? 'success' : 'warning'} className="ml-1 uppercase text-[10px] tracking-wider">
                  {aiSupportEnabled ? 'On' : 'Off'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground leading-snug">
                {aiSupportEnabled
                  ? 'ON: Help requests get an instant smart reply from the AI helper.'
                  : 'OFF: No auto-reply. You must answer every help request yourself.'}
              </p>
            </div>
            <Switch
              checked={aiSupportEnabled}
              onCheckedChange={handleAiSupportToggle}
              disabled={toggleAiSupportMutation.isPending}
            />
          </div>
        </CardContent>
      </Card>

      {/* Video people must watch before signing up */}
      <ExplainerVideoUploader />


      {/* Manual Tools Section */}
      <Card className="border-2 overflow-hidden">
        <CardHeader className="bg-muted/30 pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wrench className="h-5 w-5 text-muted-foreground" />
            Maintenance Tools
          </CardTitle>
          <CardDescription>One-off actions and manual updates</CardDescription>
        </CardHeader>
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border bg-card/50 shadow-sm">
            <div className="flex-1">
              <p className="font-semibold text-base mb-1">Update Bank List</p>
              <p className="text-sm text-muted-foreground leading-snug">
                Fetch the latest list of banks from the payment provider. Only use this if a user reports their bank is missing.
              </p>
            </div>
            <Button
              onClick={handleSyncBanks}
              variant="secondary"
              disabled={syncBanksMutation.isPending}
              className="w-full sm:w-auto font-medium"
            >
              <Building className="h-4 w-4 mr-2" />
              Sync Banks Now
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Drawer */}
      <AdminControlsActionDrawer
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        config={confirmAction?.config || null}
        onConfirm={handleConfirm}
        isLoading={isPending}
      />
    </div>
  );
}
