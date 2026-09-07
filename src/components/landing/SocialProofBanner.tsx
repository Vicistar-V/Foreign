import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import { Shield, Coins, Gift, Wallet, CheckCircle2, PackagePlus } from 'lucide-react';

interface ProofItemProps { icon: React.ReactNode; text: string; }
const ProofItem = ({ icon, text }: ProofItemProps) => (
  <div className="flex items-center gap-2 px-4 py-2 whitespace-nowrap">
    <span className="text-primary">{icon}</span>
    <span className="text-sm font-medium text-foreground">{text}</span>
  </div>
);

export const SocialProofBanner = () => {
  const { data: config } = usePlatformConfig();
  const membershipFee = Number(config?.membership_fee ?? 5000);
  const payout = Number(config?.drop_target_amount ?? 10000);
  const bonus = Number(config?.referral_cash_bonus ?? 1000);
  const minWithdrawal = Number(config?.minimum_withdrawal ?? 500);

  const proofItems = [
    { icon: <Coins className="h-4 w-4" />, text: `₦${membershipFee.toLocaleString()} to activate` },
    { icon: <PackagePlus className="h-4 w-4" />, text: `₦${payout.toLocaleString()} per share payout` },
    { icon: <Gift className="h-4 w-4" />, text: `₦${bonus.toLocaleString()} per friend invited` },
    { icon: <Wallet className="h-4 w-4" />, text: `Cash out from ₦${minWithdrawal.toLocaleString()}` },
    { icon: <Shield className="h-4 w-4" />, text: 'Powered by Flutterwave & Moniepoint' },
    { icon: <CheckCircle2 className="h-4 w-4" />, text: 'Made in Nigeria 🇳🇬' },
  ];
  const doubledItems = [...proofItems, ...proofItems];

  return (
    <section className="py-4 bg-muted/50 overflow-hidden border-y border-border/50">
      <div className="relative">
        <div className="flex animate-ticker">
          {doubledItems.map((item, index) => (
            <ProofItem key={index} icon={item.icon} text={item.text} />
          ))}
        </div>
      </div>
    </section>
  );
};
