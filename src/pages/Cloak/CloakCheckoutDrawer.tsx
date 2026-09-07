import { useState } from 'react';
import { Loader2, Lock, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  price: number;
  onClose: () => void;
}

/**
 * Real Flutterwave handoff for the mentorship landing.
 * Calls initiate-deposit with purpose='mentorship' (no "cloak" wording goes to FW).
 */
export const CloakCheckoutDrawer = ({ price, onClose }: Props) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.includes('@')) return;
    setError(null);
    setLoading(true);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke('initiate-deposit', {
        body: {
          amount: price,
          metadata: { purpose: 'mentorship', source: 'mentorship_landing' },
          guest_name: name.trim(),
          guest_email: email.trim(),
        },
      });
      if (invokeErr || !data?.success || !data?.paymentLink) {
        setError(data?.details || data?.error || 'Could not start checkout. Please try again.');
        setLoading(false);
        return;
      }
      window.location.href = data.paymentLink;
    } catch (err: any) {
      setError(err?.message || 'Network error. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-background rounded-t-2xl sm:rounded-2xl border border-border max-h-[92dvh] overflow-y-auto">
        <div className="p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-lg font-semibold">Reserve your ad share</h3>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Viketa Mentorship Program · ₦{price.toLocaleString()} one-time
          </p>

          <form onSubmit={submit} className="space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Your full name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading}
                placeholder="e.g. Chinedu Okafor"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Your email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                placeholder="you@email.com"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
              />
              <span className="text-[11px] text-muted-foreground mt-1 block">
                We send your access link here after payment.
              </span>
            </label>

            {error && (
              <div className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-lg p-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !name.trim() || !email.includes('@')}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-foreground text-background font-semibold text-sm disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Securing your share…
                </>
              ) : (
                <>Pay ₦{price.toLocaleString()} with Flutterwave</>
              )}
            </button>
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground pt-1">
              <Lock className="h-3 w-3" />
              Encrypted · Powered by Flutterwave
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
