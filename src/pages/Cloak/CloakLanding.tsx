import { useEffect, useRef } from 'react';
import { checkInviteKey, saveInviteKey } from '@/lib/inviteKey';
import { openMoniepointDrawer } from '@/lib/moniepointDrawerStore';

const SUCCESS_URL = 'https://velocityearn.xyz';

export const CloakLanding = () => {
  // Hidden admin bypass trigger (triple tap on the red warning text)
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
    openMoniepointDrawer({
      amount: 1000,
      purpose: 'membership',
      onSuccess: () => {
        // Redirects straight to your website once ₦1,000 payment confirms
        window.location.href = SUCCESS_URL;
      },
    });
  };

  return (
    <div className="h-[100dvh] w-full bg-black text-white font-sans antialiased flex items-center justify-center p-4 overflow-hidden select-none">
      {/* MOVING NEON GREEN LASER BORDER (NO BACK BLUR SHADOW) */}
      <div className="relative w-full max-w-sm rounded-[24px] p-[2px] overflow-hidden flex flex-col justify-center">
        
        {/* Continuous Rotating Neon Laser Beam */}
        <div
          className="absolute inset-[-100%] animate-[spin_3.5s_linear_infinite]"
          style={{
            background:
              'conic-gradient(from 0deg at 50% 50%, transparent 0deg, transparent 280deg, #22c55e 340deg, #4ade80 360deg)',
          }}
        />

        {/* INNER CONTENT CARD */}
        <div className="relative z-10 w-full bg-[#0a0a0c] rounded-[22px] px-5 py-6 flex flex-col justify-between">
          
          {/* MAIN HEADLINE */}
          <h1 className="text-[21px] sm:text-[23px] font-black text-white leading-[1.25] tracking-tight text-left">
            Stop wasting time learning 6 months tech skills when you have bills to pay{' '}
            <span className="text-[#22c55e] underline decoration-[#22c55e] underline-offset-4 decoration-2">
              this week
            </span>
            .
          </h1>

          {/* SUB-HOOK */}
          <p className="mt-3 text-[14px] sm:text-[15px] text-zinc-300 font-medium leading-snug text-left">
            Below is the two verified foreign platforms that I talked about.
          </p>

          {/* RAW REQUIREMENTS */}
          <div className="my-5 py-3 border-y border-zinc-800/80 space-y-1.5 text-left">
            <p className="text-[17px] font-black tracking-tight text-white">
              DON'T BUY A LAPTOP.
            </p>
            <p className="text-[14px] font-medium text-zinc-400">
              No need for VPN.
            </p>
            <p className="text-[14px] font-medium text-zinc-400">
              No need for PayPal.
            </p>
          </div>

          {/* CALL TO ACTION BUTTON */}
          <button
            type="button"
            onClick={handleGetAccess}
            className="w-full py-4 rounded-xl bg-[#22c55e] hover:bg-[#16a34a] active:scale-[0.98] text-black font-black text-xl tracking-tight shadow-[0_0_20px_rgba(34,197,94,0.3)] transition-all cursor-pointer"
          >
            Use 1k
          </button>

          {/* BIGGER RED TEXT BELOW */}
          <p
            onClick={handleSecretTap}
            className="mt-3 text-center text-[15px] sm:text-[16px] font-black text-red-500 tracking-tight leading-tight cursor-default select-none"
          >
            Take it very seriously. It can change your life.
          </p>
        </div>
      </div>
    </div>
  );
};
