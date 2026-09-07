interface PromoBannerProps {
  currentFee: number;
  minWithdrawal?: number;
}

export function PromoBanner({ currentFee }: PromoBannerProps) {
  const oldFee = currentFee * 2;

  return (
    <>
      <style>{`
        @keyframes promo-dim-flash {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .promo-dim-flash { animation: promo-dim-flash 1.2s ease-in-out infinite; }
      `}</style>
      <div className="rounded-2xl border border-orange-500/40 bg-orange-500/10 px-4 py-4 text-center">
        <p className="promo-dim-flash text-lg font-extrabold text-orange-400 leading-snug">
          1 day left
        </p>
        <p className="text-[13px] text-orange-100/85 mt-1.5 leading-snug">
          Every other person that comes late will pay{' '}
          <span className="font-bold text-orange-300">₦{oldFee.toLocaleString()}</span>{' '}
          instead of <span className="font-semibold text-white">₦{currentFee.toLocaleString()}</span>
        </p>
      </div>
    </>
  );
}
