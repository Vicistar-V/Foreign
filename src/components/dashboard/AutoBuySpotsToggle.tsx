import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Repeat, Power } from 'lucide-react';
import { triggerHaptic } from '@/lib/haptics';

interface AutoBuySpotsToggleProps {
  enabled: boolean;
}

/**
 * Compact toggle that lives inside the "Your spots" card.
 * ON  = profits automatically buy new spots when you have enough.
 * OFF = profits go to your earnings wallet (default).
 */
export function AutoBuySpotsToggle({ enabled: propEnabled }: AutoBuySpotsToggleProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(propEnabled);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEnabled(propEnabled);
  }, [propEnabled]);

  const handleToggle = async () => {
    if (!user?.id || saving) return;
    const next = !enabled;
    setEnabled(next);
    setSaving(true);
    triggerHaptic('light');

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ auto_compound_enabled: next })
        .eq('id', user.id);
      if (error) throw error;

      toast({
        title: next ? 'Auto-buy shares is ON' : 'Auto-buy shares is OFF',
        description: next
          ? 'Your earnings will automatically activate new shares when you have enough.'
          : 'Your earnings will stay in your wallet. No new shares will be activated.',
      });

      queryClient.invalidateQueries({ queryKey: ['dashboard-data', user.id] });
      queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
    } catch {
      setEnabled(!next);
      toast({
        title: 'Could not save',
        description: 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={saving}
      aria-pressed={enabled}
      className={`
        w-full flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5
        transition-colors active:scale-[0.99]
        ${enabled
          ? 'border-primary/40 bg-primary/10'
          : 'border-border bg-muted/20 hover:bg-muted/30'}
      `}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div
          className={`
            h-7 w-7 rounded-full flex items-center justify-center shrink-0
            ${enabled ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}
          `}
        >
          {enabled ? <Repeat className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
        </div>
        <div className="min-w-0 text-left">
          <p className={`text-[13px] font-semibold leading-tight ${enabled ? 'text-primary' : 'text-foreground'}`}>
            Auto-buy shares
          </p>
          <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
            {enabled
              ? 'Earnings will activate new shares automatically'
              : 'Tap to use earnings to activate more shares automatically'}
          </p>
        </div>
      </div>

      {/* Toggle switch */}
      <span
        className={`
          relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors
          ${enabled ? 'bg-primary' : 'bg-muted-foreground/30'}
        `}
      >
        <span
          className={`
            inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform
            ${enabled ? 'translate-x-[22px]' : 'translate-x-[2px]'}
          `}
        />
      </span>
    </button>
  );
}
