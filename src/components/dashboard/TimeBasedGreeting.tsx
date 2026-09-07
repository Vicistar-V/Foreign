import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { useMemo, useEffect, useState } from 'react';
import { Sun, Sunrise, Moon, ArrowRight, Lock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { triggerHaptic } from '@/lib/haptics';
import { useMembershipPaymentLoading } from '@/lib/startMembershipPayment';

interface TimeBasedGreetingProps {
  onActivate?: () => void;
  membershipFee?: number;
}

export const TimeBasedGreeting = ({ onActivate, membershipFee = 3000 }: TimeBasedGreetingProps) => {
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const paying = useMembershipPaymentLoading();

  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const { greeting, Icon, accent } = useMemo(() => {
    const hourStr = now.toLocaleString('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'Africa/Lagos',
    });
    const hour = parseInt(hourStr);
    if (hour >= 5 && hour < 12)
      return { greeting: 'Good morning', Icon: Sunrise, accent: 'text-amber-400' };
    if (hour >= 12 && hour < 17)
      return { greeting: 'Good afternoon', Icon: Sun, accent: 'text-yellow-400' };
    return { greeting: 'Good evening', Icon: Moon, accent: 'text-indigo-300' };
  }, [now]);

  const firstName = useMemo(() => {
    if (!profile?.full_name) return 'there';
    return profile.full_name.trim().split(' ')[0];
  }, [profile?.full_name]);

  const dateLabel = now.toLocaleDateString('en-NG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Africa/Lagos',
  });

  const isMember = profile?.is_member ?? false;

  // Non-member: ROI-first message. One sentence, cash-in-cash-out, bonus as the hook.
  if (!isMember && profile) {
    return (
      <div className="px-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Lock className="h-3.5 w-3.5" />
          <span className="tracking-wide uppercase">Not started yet</span>
        </div>
        <h1 className="text-lg sm:text-xl font-semibold text-foreground leading-snug">
          {firstName}, pay{' '}
          <span className="text-emerald-400 font-bold tabular-nums">
            ₦{membershipFee.toLocaleString()}
          </span>{' '}
          once. Get{' '}
          <span className="text-emerald-400 font-bold">₦10,000</span> back —
          plus <span className="underline decoration-emerald-400 decoration-2 underline-offset-4">1 free bonus share</span> right now.
        </h1>

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <Button
            onClick={() => {
              triggerHaptic('medium');
              onActivate?.();
            }}
            size="sm"
            disabled={paying}
            className="h-10 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-medium text-sm group disabled:opacity-80"
          >
            {paying ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Starting payment…
              </>
            ) : (
              <>
                Pay ₦{membershipFee.toLocaleString()} — get my share
                <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-1">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        <Icon className={`h-3.5 w-3.5 ${accent}`} />
        <span className="tracking-wide uppercase">{dateLabel}</span>
      </div>
      <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">
        {greeting},{' '}
        <span className="bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">
          {firstName}
        </span>
      </h1>
    </div>
  );
};
