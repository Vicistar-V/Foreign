import { EconomyForm } from '@/components/admin/EconomyForm';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import { DollarSign } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdminEconomy() {
  const { data: config, isLoading } = usePlatformConfig();

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-4 md:space-y-6 pb-24 md:pb-8">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 md:h-6 md:w-6 text-primary" />
          <h1 className="text-xl md:text-3xl font-bold">Earnings & Fees</h1>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : config ? (
          <EconomyForm
            initialValues={{
              membershipFee: config.membership_fee ?? 5000,
              referralCashBonus: config.referral_cash_bonus ?? 1000,
              referralPendingBonus: (config as any).referral_pending_bonus ?? 3000,
              extensionSpotPrice: config.drop_entry_fee ?? 5000,
              dropQueueContribution: (config as any).drop_queue_contribution ?? 2000,
              payoutPerSpot: config.drop_target_amount ?? 10000,
              minimumWithdrawal: config.minimum_withdrawal ?? 1000,
              withdrawalFee: config.withdrawal_fee ?? 0,
              emailsEnabled: config.emails_enabled ?? true,
              manualWithdrawalMode: config.manual_withdrawal_mode ?? false,
              taskNairaPerBatch: config.task_naira_per_batch ?? 180,
              taskBatchesPerDay: config.task_batches_per_day ?? 0,
              taskTapsPerBatch: config.task_taps_per_batch ?? 10,
            }}
          />
        ) : null}
    </div>
  );
}
