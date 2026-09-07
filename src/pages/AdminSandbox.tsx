import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FlaskConical, Shield } from 'lucide-react';
import { ActivationSuccessModal } from '@/components/ActivationSuccessModal';
import { BuySpotDrawer } from '@/components/dashboard/BuySpotDrawer';
import { SpotQuantityDrawer } from '@/components/SpotQuantityDrawer';
import { onboardingSkip } from '@/lib/onboardingSkip';

/**
 * Admin Sandbox — preview in-development UX flows with mock data,
 * without needing to activate membership or trigger real payments.
 */
export default function AdminSandbox() {
  const [showActivationModal, setShowActivationModal] = useState(false);
  const [showBuySpot, setShowBuySpot] = useState(false);
  const [showSpotQty, setShowSpotQty] = useState(false);

  const mockConfig = {
    entry_fee: 5000,
    target_amount: 10000,
    profit_amount: 10000,
    system_active: true,
  };

  const previews = [
    {
      id: 'activation-success',
      title: 'Activation Success Modal',
      description:
        'The celebration + "Increase My Spot" upsell shown right after a user joins The Viketa Line.',
      status: 'Live',
      action: () => {
        onboardingSkip.skipPin();
        onboardingSkip.skipAvatar();
        localStorage.removeItem('viketa_activation_success_seen');
        localStorage.removeItem('viketa_welcome_bonus_seen');
        setShowActivationModal(true);
      },
    },
    {
      id: 'buy-spot',
      title: 'Buy Spot Drawer',
      description:
        'Confirmation drawer opened from MachinesCard. Adjust quantity inside the drawer to test payout math, wallet picker, and CTA copy.',
      status: 'Live',
      action: () => {
        setShowBuySpot(true);
      },
    },
    {
      id: 'spot-quantity',
      title: 'Join The Line — Spot Quantity Drawer',
      description:
        'Non-member upsell drawer. Adjust quantity to see the payout hero climb (₦10k × qty) and the total price update in real time. Pay button triggers the live payment flow.',
      status: 'Live',
      action: () => setShowSpotQty(true),
    },
  ];

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
          <FlaskConical className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sandbox</h1>
          <p className="text-sm text-muted-foreground">
            Preview upcoming and in-progress UX flows with mock data — no real payment or activation needed.
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        {previews.map((p) => (
          <Card key={p.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Shield className="h-4 w-4 text-primary" />
                    {p.title}
                  </CardTitle>
                  <CardDescription className="mt-1">{p.description}</CardDescription>
                </div>
                <Badge variant="secondary">{p.status}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Button onClick={p.action} className="w-full sm:w-auto">
                Preview
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <ActivationSuccessModal
        isOpen={showActivationModal}
        mockMode
        onClose={() => {
          setShowActivationModal(false);
          onboardingSkip.reset();
        }}
      />

      <BuySpotDrawer
        open={showBuySpot}
        onOpenChange={setShowBuySpot}
        config={mockConfig}
        defaultQuantity={1}
      />

      <SpotQuantityDrawer open={showSpotQty} onOpenChange={setShowSpotQty} />
    </div>
  );
}
