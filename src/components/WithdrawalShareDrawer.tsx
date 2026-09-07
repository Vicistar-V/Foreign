import { useEffect, useState } from 'react';
import { CheckCircle2, Download, Share2, Loader2, MessageCircle } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { haptics } from '@/lib/haptics';
import {
  generateWithdrawalFlyer,
  buildWithdrawalCaption,
} from '@/lib/withdrawalFlyer';
import { useWithdrawalSharePrompt } from '@/hooks/useWithdrawalSharePrompt';
import { useWhatsAppGroupLink } from '@/hooks/useWhatsAppGroupLink';
import { trackClarityEvent } from '@/lib/clarityTracking';

export const WithdrawalShareDrawer = () => {
  const { pending, dismiss } = useWithdrawalSharePrompt();
  const { link: whatsappGroupLink } = useWhatsAppGroupLink();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [flyerBlob, setFlyerBlob] = useState<Blob | null>(null);
  const [sharing, setSharing] = useState(false);
  const [building, setBuilding] = useState(false);

  const amount = pending?.amount ?? 0;
  const caption = buildWithdrawalCaption(amount);

  // Generate the flyer the moment the drawer opens
  useEffect(() => {
    if (!pending) {
      setPreviewUrl((url) => {
        if (url) URL.revokeObjectURL(url);
        return null;
      });
      setFlyerBlob(null);
      return;
    }

    let cancelled = false;
    setBuilding(true);
    generateWithdrawalFlyer(amount)
      .then((blob) => {
        if (cancelled) return;
        setFlyerBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        trackClarityEvent('withdrawal_share_prompt_shown');
      })
      .catch(() => {
        if (!cancelled) toast.error('Could not build the picture. You can still share the message.');
      })
      .finally(() => {
        if (!cancelled) setBuilding(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pending, amount]);

  const handleOpenChange = (open: boolean) => {
    if (!open) dismiss();
  };

  const shareWithFiles = async (): Promise<boolean> => {
    if (!flyerBlob) return false;
    const file = new File([flyerBlob], `viketa-withdrawal-${amount}.jpg`, {
      type: 'image/jpeg',
    });
    const nav = navigator as Navigator & {
      canShare?: (data: { files?: File[] }) => boolean;
      share?: (data: { files?: File[]; text?: string; title?: string }) => Promise<void>;
    };
    if (nav.canShare?.({ files: [file] }) && nav.share) {
      try {
        await nav.share({
          files: [file],
          text: caption,
          title: 'My Viketa withdrawal just landed',
        });
        return true;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return true;
        return false;
      }
    }
    return false;
  };

  const handleShareToWhatsAppGroup = async () => {
    haptics.medium();
    setSharing(true);
    trackClarityEvent('withdrawal_share_group_clicked');
    try {
      // 1. Try native share-sheet (lets them pick the Viketa group on mobile)
      const shared = await shareWithFiles();
      if (shared) {
        toast.success('Posted! Thank you for sharing 💚');
        dismiss();
        return;
      }

      // 2. Fallback: copy caption + open the group
      await navigator.clipboard.writeText(caption);
      toast.success('Message copied. Now pick the picture from your gallery and paste this caption.', {
        duration: 6000,
      });
      if (whatsappGroupLink) {
        setTimeout(() => window.open(whatsappGroupLink, '_blank'), 400);
      }
      // Auto-download the flyer so it's in the gallery
      downloadFlyer();
      dismiss();
    } finally {
      setSharing(false);
    }
  };

  const handleShareAnywhere = async () => {
    haptics.medium();
    setSharing(true);
    trackClarityEvent('withdrawal_share_anywhere_clicked');
    try {
      const shared = await shareWithFiles();
      if (shared) {
        toast.success('Posted! Thank you for sharing 💚');
        dismiss();
        return;
      }
      // Fallback to download + copy
      await navigator.clipboard.writeText(caption);
      downloadFlyer();
      toast.success('Picture saved and message copied. Post it on your status now.');
      dismiss();
    } finally {
      setSharing(false);
    }
  };

  const downloadFlyer = () => {
    if (!previewUrl) return;
    const a = document.createElement('a');
    a.href = previewUrl;
    a.download = `viketa-withdrawal-${amount}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <Drawer open={!!pending} onOpenChange={handleOpenChange}>
      <DrawerContent className="max-h-[92vh]">
        <div className="mx-auto w-full max-w-md overflow-y-auto px-4 pb-6">
          <DrawerHeader className="px-0 pb-3 text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-success ring-1 ring-success/30">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <DrawerTitle className="text-xl font-bold leading-tight">
              Your ₦{amount.toLocaleString()} just landed
            </DrawerTitle>
            <DrawerDescription className="text-sm leading-snug text-muted-foreground">
              Help us by posting this in the Viketa WhatsApp group. It encourages other people who are waiting.
            </DrawerDescription>
          </DrawerHeader>

          {/* Flyer preview */}
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl border border-border bg-muted/40">
            {building && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            {previewUrl && (
              <img
                src={previewUrl}
                alt={`Flyer celebrating my ₦${amount.toLocaleString()} Viketa withdrawal`}
                className="h-full w-full object-cover"
              />
            )}
          </div>

          {/* Caption preview */}
          <div className="mt-3 rounded-xl bg-muted/50 p-3">
            <p className="text-xs font-medium text-muted-foreground">Message that goes with the picture</p>
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-foreground">
              {caption}
            </p>
          </div>

          {/* Actions */}
          <div className="mt-4 space-y-2">
            <Button
              size="lg"
              onClick={handleShareToWhatsAppGroup}
              disabled={!flyerBlob || sharing}
              className="h-14 w-full rounded-2xl bg-[hsl(var(--social-whatsapp))] text-white shadow-medium hover:bg-[hsl(var(--social-whatsapp))]/90"
              haptic="medium"
            >
              {sharing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <FaWhatsapp className="h-5 w-5" />
              )}
              Post to Viketa WhatsApp Group
            </Button>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={handleShareAnywhere}
                disabled={!flyerBlob || sharing}
                className="h-12 rounded-2xl"
                haptic="light"
              >
                <Share2 className="h-4 w-4" />
                Send anywhere
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  haptics.light();
                  downloadFlyer();
                  toast.success('Picture saved to your phone');
                }}
                disabled={!previewUrl}
                className="h-12 rounded-2xl"
                haptic="light"
              >
                <Download className="h-4 w-4" />
                Save picture
              </Button>
            </div>

            <Button
              variant="ghost"
              onClick={dismiss}
              className="h-11 w-full text-muted-foreground"
            >
              Maybe later
            </Button>

            <p className="pt-1 text-center text-[11px] leading-snug text-muted-foreground">
              <MessageCircle className="mr-1 inline h-3 w-3" />
              Sharing helps your friends trust Viketa. We will not ask you about this same withdrawal again.
            </p>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
