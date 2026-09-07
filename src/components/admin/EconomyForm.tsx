import { useState, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { AdminSettingConfirmDialog, ConfirmDialogConfig } from './AdminSettingConfirmDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, DollarSign, Wallet, Mail, Lock, LockOpen, CheckCircle2, AlertTriangle, ShieldCheck, ArrowRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const economySchema = z.object({
  membershipFee: z.number().min(1, 'Must be greater than 0'),
  referralCashBonus: z.number().min(0, 'Cannot be negative'),
  referralPendingBonus: z.number().min(0, 'Cannot be negative'),
  extensionSpotPrice: z.number().min(1, 'Must be greater than 0'),
  dropQueueContribution: z.number().min(0, 'Cannot be negative'),
  payoutPerSpot: z.number().min(1, 'Must be greater than 0'),
  minimumWithdrawal: z.number().min(1, 'Must be greater than 0'),
  withdrawalFee: z.number().min(0, 'Cannot be negative'),
  emailsEnabled: z.boolean(),
  manualWithdrawalMode: z.boolean(),
  taskNairaPerBatch: z.number().min(0, 'Cannot be negative'),
  taskBatchesPerDay: z.number().int().min(0, 'Use 0 for unlimited'),
  taskTapsPerBatch: z.number().int().min(1, 'Must be at least 1'),
});

type EconomyFormData = z.infer<typeof economySchema>;

interface EconomyFormProps {
  initialValues: EconomyFormData;
}

export const EconomyForm = ({ initialValues }: EconomyFormProps) => {
  const [showPinDrawer, setShowPinDrawer] = useState(false);
  const [pin, setPin] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const pinInputRef = useRef<HTMLInputElement>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    config: ConfirmDialogConfig | null;
    field: 'manualWithdrawalMode' | 'emailsEnabled' | null;
    newValue: boolean;
  }>({ open: false, config: null, field: null, newValue: false });
  
  const queryClient = useQueryClient();

  const form = useForm<EconomyFormData>({
    resolver: zodResolver(economySchema),
    defaultValues: initialValues,
  });

  const updateMutation = useMutation({
    mutationFn: async (values: EconomyFormData) => {
      const { data, error } = await supabase.functions.invoke('update-economy', {
        body: { ...values, adminPin: pin },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to update settings');

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-config'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      toast.success('Settings Saved Successfully', {
        description: 'The changes have been applied to the platform.',
        duration: 5000,
        icon: <CheckCircle2 className="h-5 w-5 text-success" />,
      });
      setShowPinDrawer(false);
      setPin('');
      setIsEditMode(false);
    },
    onError: (error: Error) => {
      toast.error('Update Failed', {
        description: error.message,
        duration: 5000,
      });
      setPin('');
    },
  });

  const onSubmit = () => {
    setShowPinDrawer(true);
  };

  const handlePinChange = (value: string) => {
    const cleanedValue = value.replace(/\D/g, '').slice(0, 4);
    setPin(cleanedValue);
    
    if (cleanedValue.length === 4) {
      const values = form.getValues();
      updateMutation.mutate(values);
    }
  };

  const handleEditModeToggle = (checked: boolean) => {
    setIsEditMode(checked);
    if (checked) {
      toast.info('Settings Unlocked', {
        description: 'You can now make changes. Remember to save your work.',
        duration: 3000,
      });
    } else {
      form.reset(initialValues);
      toast.info('Settings Locked', {
        description: 'Unsaved changes have been discarded.',
        duration: 3000,
      });
    }
  };

  const handleManualWithdrawalToggle = useCallback((checked: boolean) => {
    setConfirmDialog({
      open: true,
      field: 'manualWithdrawalMode',
      newValue: checked,
      config: {
        title: checked ? 'Check payments manually?' : 'Allow automatic payments?',
        description: checked
          ? 'You will need to personally check and approve every withdrawal request. This is safer but takes more of your time.'
          : 'Payments will be sent automatically via Flutterwave. Make sure your account has enough balance.',
        confirmLabel: checked ? 'Yes, I will check them' : 'Yes, make it automatic',
        variant: 'warning',
      },
    });
  }, []);

  const handleEmailsToggle = useCallback((checked: boolean) => {
    setConfirmDialog({
      open: true,
      field: 'emailsEnabled',
      newValue: checked,
      config: {
        title: checked ? 'Send email updates?' : 'Stop sending emails?',
        description: checked
          ? 'Members will receive emails for wins and other important news.'
          : 'Members will only see updates inside the app. They might miss important news.',
        confirmLabel: checked ? 'Yes, send emails' : 'Yes, stop emails',
        variant: checked ? 'info' : 'warning',
      },
    });
  }, []);

  const handleConfirmToggle = () => {
    if (confirmDialog.field) {
      form.setValue(confirmDialog.field, confirmDialog.newValue);
    }
    setConfirmDialog({ open: false, config: null, field: null, newValue: false });
  };

  const values = form.watch();

  const hasManualModeChanged = values.manualWithdrawalMode !== initialValues.manualWithdrawalMode;
  const hasEmailsChanged = values.emailsEnabled !== initialValues.emailsEnabled;
  const hasMembershipChanged = values.membershipFee !== initialValues.membershipFee;
  const hasReferralCashChanged = values.referralCashBonus !== initialValues.referralCashBonus;
  const hasReferralPendingChanged = values.referralPendingBonus !== initialValues.referralPendingBonus;
  const hasExtensionPriceChanged = values.extensionSpotPrice !== initialValues.extensionSpotPrice;
  const hasQueueContributionChanged = values.dropQueueContribution !== initialValues.dropQueueContribution;
  const hasPayoutPerSpotChanged = values.payoutPerSpot !== initialValues.payoutPerSpot;
  const hasMinWithdrawalChanged = values.minimumWithdrawal !== initialValues.minimumWithdrawal;
  const hasFeeChanged = values.withdrawalFee !== initialValues.withdrawalFee;
  const hasTaskNairaChanged = values.taskNairaPerBatch !== initialValues.taskNairaPerBatch;
  const hasTaskBatchesChanged = values.taskBatchesPerDay !== initialValues.taskBatchesPerDay;
  const hasTaskTapsChanged = values.taskTapsPerBatch !== initialValues.taskTapsPerBatch;

  const anyChanges = hasManualModeChanged || hasEmailsChanged || hasMembershipChanged ||
                     hasReferralCashChanged || hasReferralPendingChanged || hasExtensionPriceChanged ||
                     hasQueueContributionChanged || hasPayoutPerSpotChanged ||
                     hasMinWithdrawalChanged || hasFeeChanged ||
                     hasTaskNairaChanged || hasTaskBatchesChanged || hasTaskTapsChanged;

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Edit Mode Toggle */}
          <Card className={cn(
            "transition-colors duration-300",
            isEditMode ? "border-primary/50 bg-primary/5" : "border-muted"
          )}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-medium flex items-center gap-2">
                    {isEditMode ? (
                      <LockOpen className="h-4 w-4 text-primary" />
                    ) : (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    )}
                    {isEditMode ? 'Settings Unlocked' : 'Settings Locked'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isEditMode 
                      ? 'You can now safely change these amounts.' 
                      : 'Turn this on to make changes to money settings.'}
                  </p>
                </div>
                <Switch 
                  checked={isEditMode} 
                  onCheckedChange={handleEditModeToggle}
                />
              </div>
            </CardContent>
          </Card>

          {/* Fees & Bonuses */}
          <Card className={cn("transition-opacity duration-300", !isEditMode && "opacity-60")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <DollarSign className="h-5 w-5 text-primary" />
                Earnings & Rewards
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="membershipFee"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex justify-between items-end">
                      <FormLabel>Entry Fee for New Members (₦)</FormLabel>
                      {isEditMode && (
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                          Current: ₦{initialValues.membershipFee.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        className="h-12 tabular-nums"
                        disabled={!isEditMode}
                      />
                    </FormControl>
                    <FormDescription>
                      What every new person pays once to join the app.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="referralCashBonus"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex justify-between items-end">
                      <FormLabel>Thank You Gift for Inviting Friends (₦)</FormLabel>
                      {isEditMode && (
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                          Current: ₦{initialValues.referralCashBonus.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        className="h-12 tabular-nums"
                        disabled={!isEditMode}
                      />
                    </FormControl>
                    <FormDescription>
                      The one-time reward given to a member for bringing in someone new.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="referralPendingBonus"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex justify-between items-end">
                      <FormLabel>Pending Balance Jump per Invited Friend (₦)</FormLabel>
                      {isEditMode && (
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                          Current: ₦{initialValues.referralPendingBonus.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        className="h-12 tabular-nums"
                        disabled={!isEditMode}
                      />
                    </FormControl>
                    <FormDescription>
                      The shortcut: how much is instantly added to a member's pending balance when a friend they invited activates. Capped so the pending balance never passes the payout target.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />


              <FormField
                control={form.control}
                name="extensionSpotPrice"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex justify-between items-end">
                      <FormLabel>Price of an Extra Spot (₦)</FormLabel>
                      {isEditMode && (
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                          Current: ₦{initialValues.extensionSpotPrice.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        className="h-12 tabular-nums"
                        disabled={!isEditMode}
                      />
                    </FormControl>
                    <FormDescription>
                      What a member pays to add another earning spot after they have joined.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dropQueueContribution"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex justify-between items-end">
                      <FormLabel>How Much of a Share Goes Into the Campaign (₦)</FormLabel>
                      {isEditMode && (
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                          Current: ₦{initialValues.dropQueueContribution.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        className="h-12 tabular-nums"
                        disabled={!isEditMode}
                      />
                    </FormControl>
                    <FormDescription>
                      From every spot purchase, this amount goes into the queue to pay people. The rest stays with the platform.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="payoutPerSpot"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex justify-between items-end">
                      <FormLabel>Payout Per Spot (₦)</FormLabel>
                      {isEditMode && (
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                          Current: ₦{initialValues.payoutPerSpot.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        className="h-12 tabular-nums"
                        disabled={!isEditMode}
                      />
                    </FormControl>
                    <FormDescription>
                      The one-time amount each spot pays out before it retires from the line forever.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Daily Earning Tasks */}
          <Card className={cn("transition-opacity duration-300", !isEditMode && "opacity-60")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <DollarSign className="h-5 w-5 text-primary" />
                Daily Earning Tasks
                {(hasTaskNairaChanged || hasTaskBatchesChanged || hasTaskTapsChanged) && (
                  <Badge variant="outline" className="text-warning border-warning/50 bg-warning/5">
                    Changed
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="taskNairaPerBatch"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex justify-between items-end">
                      <FormLabel>Money Per Batch (₦)</FormLabel>
                      {isEditMode && (
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                          Current: ₦{initialValues.taskNairaPerBatch.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        className="h-12 tabular-nums"
                        disabled={!isEditMode}
                      />
                    </FormControl>
                    <FormDescription>
                      How much a member earns for finishing one batch of taps.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="taskBatchesPerDay"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex justify-between items-end">
                      <FormLabel>Batches Per Day (0 = unlimited)</FormLabel>
                      {isEditMode && (
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                          Current: {initialValues.taskBatchesPerDay === 0 ? 'Unlimited' : initialValues.taskBatchesPerDay}
                        </span>
                      )}
                    </div>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                        className="h-12 tabular-nums"
                        disabled={!isEditMode}
                      />
                    </FormControl>
                    <FormDescription>
                      Set to <span className="font-semibold">0</span> for unlimited grind mode — members can grind the full pending balance in one day if they want. Any positive number caps them at that many batches per day.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="taskTapsPerBatch"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex justify-between items-end">
                      <FormLabel>Taps Per Batch</FormLabel>
                      {isEditMode && (
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                          Current: {initialValues.taskTapsPerBatch}
                        </span>
                      )}
                    </div>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                        className="h-12 tabular-nums"
                        disabled={!isEditMode}
                      />
                    </FormControl>
                    <FormDescription>
                      How many taps a member must do to finish one batch.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isEditMode && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Live Preview
                  </p>
                  {values.taskBatchesPerDay === 0 ? (
                    <p className="text-sm font-semibold tabular-nums">
                      <span className="text-primary">Unlimited</span> — members earn ₦
                      {(values.taskNairaPerBatch || 0).toLocaleString()} per batch with no daily cap. They stop only when the pending balance fills.
                    </p>
                  ) : (
                    <p className="text-sm font-semibold tabular-nums">
                      ₦{(values.taskNairaPerBatch || 0).toLocaleString()} × {values.taskBatchesPerDay || 0} batches ={' '}
                      <span className="text-primary">
                        ₦{((values.taskNairaPerBatch || 0) * (values.taskBatchesPerDay || 0)).toLocaleString()}
                      </span>{' '}
                      max per day
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Email Settings */}
          <Card className={cn("transition-opacity duration-300", !isEditMode && "opacity-60")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Mail className="h-5 w-5 text-primary" />
                Email Updates
                {hasEmailsChanged && (
                  <Badge variant="outline" className="text-warning border-warning/50 bg-warning/5">
                    Changed
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="emailsEnabled"
                render={({ field }) => (
                  <FormItem className={cn(
                    "flex flex-row items-center justify-between rounded-xl border p-4 transition-colors",
                    hasEmailsChanged ? 'border-warning/50 bg-warning/5' : 'bg-muted/30'
                  )}>
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Keep Members Updated via Email</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Send automatic emails to members about their wins and news.
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={(checked) => {
                          if (isEditMode) {
                            handleEmailsToggle(checked);
                          }
                        }}
                        disabled={!isEditMode}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Withdrawals */}
          <Card className={cn("transition-opacity duration-300", !isEditMode && "opacity-60")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Wallet className="h-5 w-5 text-primary" />
                Payment Settings
                {hasManualModeChanged && (
                  <Badge variant="outline" className="text-warning border-warning/50 bg-warning/5">
                    Changed
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="manualWithdrawalMode"
                render={({ field }) => (
                  <FormItem className={cn(
                    "flex flex-row items-center justify-between rounded-xl border p-4 transition-colors",
                    hasManualModeChanged ? 'border-warning/50 bg-warning/5' : 'bg-muted/30'
                  )}>
                    <div className="space-y-0.5 pr-4">
                      <FormLabel className="text-base font-medium flex items-center gap-2">
                        Personally Approve Every Payment
                        {field.value && (
                          <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/20">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        )}
                      </FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Turn this on if you want to check and approve every withdrawal yourself.
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={(checked) => {
                          if (isEditMode) {
                            handleManualWithdrawalToggle(checked);
                          }
                        }}
                        disabled={!isEditMode}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="minimumWithdrawal"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex justify-between items-end">
                      <FormLabel>Smallest Amount a Member can Withdraw (₦)</FormLabel>
                      {isEditMode && (
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                          Current: ₦{initialValues.minimumWithdrawal.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        className="h-12 tabular-nums"
                        disabled={!isEditMode}
                      />
                    </FormControl>
                    <FormDescription>
                      The minimum balance a person must have before they can take money out.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="withdrawalFee"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex justify-between items-end">
                      <FormLabel>Bank Processing Charge (₦)</FormLabel>
                      {isEditMode && (
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                          Current: ₦{initialValues.withdrawalFee.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        className="h-12 tabular-nums"
                        disabled={!isEditMode}
                      />
                    </FormControl>
                    <FormDescription>
                      This amount is taken from a member's withdrawal to cover bank transfer costs.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Button 
            type="submit" 
            className="w-full h-14 text-base font-semibold" 
            size="lg"
            disabled={!isEditMode || !anyChanges}
          >
            {isEditMode 
              ? anyChanges 
                ? 'Review and Save Changes' 
                : 'No Changes to Save'
              : 'Unlock Settings to Make Changes'}
          </Button>
        </form>
      </Form>

      {/* Confirmation Dialog for Critical Toggles */}
      <AdminSettingConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmDialog({ open: false, config: null, field: null, newValue: false });
          }
        }}
        config={confirmDialog.config}
        onConfirm={handleConfirmToggle}
      />

      {/* PIN Confirmation Drawer */}
      <Drawer open={showPinDrawer} onOpenChange={setShowPinDrawer}>
        <DrawerContent className="max-h-[92vh] flex flex-col">
          <DrawerHeader className="text-left pb-2">
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <ShieldCheck className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <DrawerTitle className="text-lg leading-tight">Confirm with PIN</DrawerTitle>
                <DrawerDescription className="text-sm mt-1">
                  Review what's changing, then enter your 4-digit PIN to apply.
                </DrawerDescription>
              </div>
            </div>
          </DrawerHeader>

          <div className="px-4 pb-6 space-y-4 overflow-y-auto flex-1">
            {/* Warning */}
            <div className="p-3 rounded-2xl bg-warning/10 border border-warning/30 flex gap-2.5">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <p className="text-xs text-foreground/90 font-medium leading-snug">
                These changes take effect right away for all members.
              </p>
            </div>

            {/* Change Summary */}
            {(() => {
              const changeCount = [
                hasMembershipChanged,
                hasReferralCashChanged,
                hasExtensionPriceChanged,
                hasQueueContributionChanged,
                hasPayoutPerSpotChanged,
                hasMinWithdrawalChanged,
                hasFeeChanged,
                hasManualModeChanged,
                hasEmailsChanged,
                hasTaskNairaChanged,
                hasTaskBatchesChanged,
                hasTaskTapsChanged,
              ].filter(Boolean).length;

              const moneyRow = (
                label: string,
                oldVal: number,
                newVal: number,
                lowerIsBetter = false,
              ) => {
                const delta = newVal - oldVal;
                const deltaPct = oldVal !== 0 ? (delta / oldVal) * 100 : 0;
                const isUp = delta > 0;
                const isDown = delta < 0;
                const isGood = (isUp && !lowerIsBetter) || (isDown && lowerIsBetter);
                const deltaTone = delta === 0
                  ? 'bg-muted text-muted-foreground'
                  : isGood
                    ? 'bg-success/15 text-success'
                    : 'bg-warning/15 text-warning';
                const Icon = delta === 0 ? Minus : isUp ? TrendingUp : TrendingDown;
                return (
                  <div className="p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-muted-foreground">{label}</span>
                      <span className={cn(
                        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums',
                        deltaTone,
                      )}>
                        <Icon className="h-2.5 w-2.5" />
                        {delta > 0 ? '+' : ''}₦{Math.abs(delta).toLocaleString()}
                        {oldVal !== 0 && (
                          <span className="opacity-70">
                            ({delta > 0 ? '+' : ''}{deltaPct.toFixed(0)}%)
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-semibold tabular-nums">
                      <span className="text-muted-foreground line-through">₦{oldVal.toLocaleString()}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-foreground">₦{newVal.toLocaleString()}</span>
                    </div>
                  </div>
                );
              };

              const toggleRow = (label: string, oldVal: boolean, newVal: boolean) => (
                <div className="p-3 flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">{label}</span>
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    <span className={cn(
                      'px-2 py-0.5 rounded-md',
                      oldVal ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground',
                    )}>
                      {oldVal ? 'On' : 'Off'}
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className={cn(
                      'px-2 py-0.5 rounded-md',
                      newVal ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning',
                    )}>
                      {newVal ? 'On' : 'Off'}
                    </span>
                  </div>
                </div>
              );

              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Summary of Changes
                    </p>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold tabular-nums">
                      {changeCount} change{changeCount === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="rounded-2xl border bg-muted/20 divide-y divide-border overflow-hidden">
                    {hasMembershipChanged && moneyRow('Entry Fee', initialValues.membershipFee, values.membershipFee)}
                    {hasReferralCashChanged && moneyRow('Invite Gift', initialValues.referralCashBonus, values.referralCashBonus)}
                    {hasReferralPendingChanged && moneyRow('Pending Jump per Friend', initialValues.referralPendingBonus, values.referralPendingBonus)}
                    {hasExtensionPriceChanged && moneyRow('Extra Spot Price', initialValues.extensionSpotPrice, values.extensionSpotPrice)}
                    {hasQueueContributionChanged && moneyRow('Queue Contribution', initialValues.dropQueueContribution, values.dropQueueContribution)}
                    {hasPayoutPerSpotChanged && moneyRow('Payout Per Spot', initialValues.payoutPerSpot, values.payoutPerSpot)}
                    {hasTaskNairaChanged && moneyRow('Money Per Batch', initialValues.taskNairaPerBatch, values.taskNairaPerBatch)}
                    {hasTaskBatchesChanged && moneyRow('Batches Per Day', initialValues.taskBatchesPerDay, values.taskBatchesPerDay)}
                    {hasTaskTapsChanged && moneyRow('Taps Per Batch', initialValues.taskTapsPerBatch, values.taskTapsPerBatch)}
                    {hasMinWithdrawalChanged && moneyRow('Min Withdrawal', initialValues.minimumWithdrawal, values.minimumWithdrawal, true)}
                    {hasFeeChanged && moneyRow('Bank Charge', initialValues.withdrawalFee, values.withdrawalFee, true)}
                    {hasManualModeChanged && toggleRow('Manual Payment Review', initialValues.manualWithdrawalMode, values.manualWithdrawalMode)}
                    {hasEmailsChanged && toggleRow('Email Updates', initialValues.emailsEnabled, values.emailsEnabled)}
                  </div>
                </div>
              );
            })()}

            {/* PIN Input */}
            {updateMutation.isPending ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                <p className="text-sm font-medium">Applying your changes...</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold">Enter Admin PIN</p>
                </div>

                <div
                  className="py-7 bg-muted/40 rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer active:scale-[0.98] transition-transform"
                  onClick={() => pinInputRef.current?.focus()}
                >
                  <div className="flex items-center justify-center gap-4 mb-3">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={cn(
                          'w-5 h-5 rounded-full transition-all duration-200 border-2',
                          pin.length > i
                            ? 'bg-primary border-primary scale-125 shadow-sm shadow-primary/30'
                            : 'bg-transparent border-muted-foreground/30',
                        )}
                      />
                    ))}
                  </div>
                  <p className="text-xs font-medium text-muted-foreground">
                    {pin.length === 0 ? 'Tap to enter PIN' : `${pin.length} of 4 digits entered`}
                  </p>

                  <Input
                    ref={pinInputRef}
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={pin}
                    onChange={(e) => handlePinChange(e.target.value)}
                    maxLength={4}
                    className="sr-only"
                    autoComplete="off"
                    autoFocus
                  />
                </div>
              </div>
            )}

            <Button
              onClick={() => {
                setShowPinDrawer(false);
                setPin('');
              }}
              variant="ghost"
              className="w-full h-11 text-muted-foreground"
              disabled={updateMutation.isPending}
            >
              Go back and edit more
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
};
