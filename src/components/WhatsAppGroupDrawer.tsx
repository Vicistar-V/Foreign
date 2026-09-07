import { useEffect, useState } from 'react';
import { FaWhatsapp } from 'react-icons/fa';
import { Users } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useWhatsAppGroupLink } from '@/hooks/useWhatsAppGroupLink';
import { trackClarityEvent, ClarityEvents } from '@/lib/clarityTracking';
import { triggerHaptic } from '@/lib/haptics';

/** Wait this long after the person is activated before the first invite. */
const ONE_HOUR_MS = 60 * 60 * 1000;
/** Ask again after this long (about 3 days). */
const ASK_AGAIN_AFTER_MS = 3 * 24 * 60 * 60 * 1000;

const storeKey = (userId: string) => `viketa_whatsapp_group_prompt_${userId}`;

const readLastShown = (userId: string): number => {
  try {
    const raw = localStorage.getItem(storeKey(userId));
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
};

const writeLastShown = (userId: string) => {
  try {
    localStorage.setItem(storeKey(userId), String(Date.now()));
  } catch {
    /* private mode — it just shows again next time */
  }
};

/**
 * Gentle nudge to join the WhatsApp info group.
 *
 * Shows once the person has been a paid member for at least one hour, then
 * again every ~3 days if they keep dismissing it. Same words as the small
 * dashboard card so nothing feels different.
 */
export const WhatsAppGroupDrawer = () => {
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const { link, showPromo } = useWhatsAppGroupLink();
  const [open, setOpen] = useState(false);

  const userId = user?.id;
  const isMember = !!profile?.is_member;
  const activatedAt = (profile as { activated_at?: string | null } | undefined)?.activated_at || null;

  useEffect(() => {
    if (!userId || !isMember || !showPromo || !link || !activatedAt) return;

    const activatedMs = new Date(activatedAt).getTime();
    if (!Number.isFinite(activatedMs)) return;

    const now = Date.now();
    const lastShown = readLastShown(userId);

    // Not a member for a full hour yet — check again when the hour is up.
    const msUntilEligible = activatedMs + ONE_HOUR_MS - now;
    // Dismissed recently — wait out the cool-off.
    const msUntilNextAsk = lastShown ? lastShown + ASK_AGAIN_AFTER_MS - now : 0;
    const delay = Math.max(msUntilEligible, msUntilNextAsk, 0);

    // Don't schedule wildly long timers (tab won't live that long anyway).
    if (delay > 10 * 60 * 1000) return;

    const timer = setTimeout(() => {
      setOpen(true);
      writeLastShown(userId);
      trackClarityEvent(ClarityEvents.WHATSAPP_GROUP_PROMO_VIEWED);
      triggerHaptic('light');
    }, delay === 0 ? 1200 : delay);

    return () => clearTimeout(timer);
  }, [userId, isMember, showPromo, link, activatedAt]);

  const handleJoin = () => {
    triggerHaptic('medium');
    trackClarityEvent(ClarityEvents.WHATSAPP_GROUP_LINK_CLICKED);
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
    setOpen(false);
  };

  if (!link) return null;

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerContent className="border-t border-border">
        <div className="mx-auto w-full max-w-md px-5 pb-8 pt-2">
          <div className="flex justify-center">
            <div className="h-14 w-14 rounded-full bg-[hsl(var(--social-whatsapp))] flex items-center justify-center">
              <FaWhatsapp className="h-8 w-8 text-white" />
            </div>
          </div>

          <DrawerHeader className="px-0 text-center">
            <DrawerTitle className="text-xl">Join Our Info Group</DrawerTitle>
            <DrawerDescription className="text-sm">
              Get tips &amp; connect with members
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex items-center justify-center gap-2 rounded-xl bg-[hsl(var(--social-whatsapp))]/10 border border-[hsl(var(--social-whatsapp))]/20 px-3 py-2.5">
            <Users className="h-4 w-4 text-[hsl(var(--social-whatsapp))]" />
            <p className="text-xs text-muted-foreground">
              See other members getting paid, and never miss an update
            </p>
          </div>

          <div className="mt-5 space-y-2.5">
            <Button
              onClick={handleJoin}
              className="w-full h-12 text-base font-semibold bg-[hsl(var(--social-whatsapp))] text-white hover:bg-[hsl(var(--social-whatsapp))]/90"
            >
              <FaWhatsapp className="mr-2 h-5 w-5" />
              Join the group
            </Button>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              className="w-full h-11 text-muted-foreground"
            >
              Maybe later
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
