import { useEffect, useRef } from 'react';
import { checkInviteKey, saveInviteKey } from '@/lib/inviteKey';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import { openMoniepointDrawer } from '@/lib/moniepointDrawerStore';

export const CloakLanding = () => {
  const { data: config } = usePlatformConfig();
  const price = Number(config?.membership_fee ?? 1000);

  // Hidden admin bypass trigger (triple tap on red text)
  const taps = useRef(0);
  const tapTimer = useRef<number | null>(null);

  useEffect(() => {
    document.title = 'Access Verification';
    let m = document.querySelector('meta[name="robots"]');
    if (!m) {
      m = document.createElement('meta');
      m.setAttribute('name', 'robots');
      document.head.appendChild(m);
    }
    m.setAttribute('content', 'noindex,nofollow');
  }, []);

  const handleSecretTap = async () => {
    taps.current += 1;
    if (tapTimer.current) window.clearTimeout(tapTimer.current);
    tapTimer.current = window.setTimeout(() => {
      taps.current = 0;
    }, 600);

    if (taps.current >= 3) {
      taps.current = 0;
      const key = window.prompt('Access Key:');
      if (key) {
        const ok = await checkInviteKey(key.trim());
        if (ok) {
          saveInviteKey(key.trim());
          window.location.reload();
        } else {
          alert('Invalid key');
        }
      }
    }
  };

  const handleGetAccess = () => {
    // Triggers the Moniepoint Bank Transfer Drawer globally
    openMoniepointDrawer({
      amount: price,
      purpose: 'membership',
      onSuccess: () => {
        // Destination after payment is confirmed (e.g. your members vault or WhatsApp link)
        window.location.href = '/dashboard';
      },
    });
  };

  return (
    <div className="min-h-screen bg-white text-black font-sans antialiased px-5 py-8 flex flex-col justify-center max-w-md mx-auto">
      <main className="w-full">
        {/* MAIN HEADLINE */}
        <h1 className="text-[25px] sm:text-[27px] font-black text-black leading-[1.25] tracking-tight text-left">
          Stop wasting time learning 6 months tech skills when you have bills to pay this week.
        </h1>

        {/* SUB-HOOK */}
        <p className="mt-4 text-[17px] text-zinc-900 font-medium leading-snug text-left">
          Below is the two verified foreign platforms that I talked about.
        </p>

        {/* RAW REQUIREMENTS */}
        <div className="my-6 bg-zinc-50 border border-zinc-200/90 rounded-xl p-4 space-y-3 text-left">
          <div className="flex items-center gap-3">
            <span className="text-red-600 text-sm">🔴</span>
            <span className="text-[17px] font-black tracking-tight text-black">
              DON'T BUY A LAPTOP.
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-red-600 text-sm">🔴</span>
            <span className="text-[15px] font-semibold text-zinc-800">
              No need for VPN.
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-red-600 text-sm">🔴</span>
            <span className="text-[15px] font-semibold text-zinc-800">
              No need for PayPal.
            </span>
          </div>
        </div>

        {/* CALL TO ACTION BUTTON */}
        <button
          type="button"
          onClick={handleGetAccess}
          className="w-full mt-2 py-4 px-6 rounded-xl bg-[#16a34a] hover:bg-[#15803d] active:scale-[0.98] text-white font-extrabold text-xl tracking-tight shadow-md transition-all cursor-pointer"
        >
          Get Access
        </button>

        {/* SUB-TEXT IN RED */}
        <p
          onClick={handleSecretTap}
          className="mt-3 text-center text-sm font-bold text-red-600 cursor-default select-none"
        >
          Follow the exact instructions.
        </p>
      </main>
    </div>
  );
};
