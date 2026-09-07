import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, CheckCircle2, MessageSquare, Share2 } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import {
  generateReferralLink,
  copyToClipboard,
  shareViaWhatsApp,
  shareViaSMS,
  shareViaNativeAPI,
} from '@/lib/shareUtils';
import { useShareMessage } from '@/hooks/useShareMessage';
import { toast } from 'sonner';

interface ReferrerShareRowProps {
  referralCode: string;
  isLoading?: boolean;
}

export const ReferrerShareRow = ({ referralCode, isLoading }: ReferrerShareRowProps) => {
  const [copied, setCopied] = useState(false);
  const referralLink = referralCode ? generateReferralLink(referralCode) : '';
  const shareMsg = useShareMessage();
  const hasNativeShare = typeof navigator !== 'undefined' && !!(navigator as Navigator).share;

  const guard = (fn: () => void) => () => {
    if (!referralLink) {
      toast.error('Loading your link...');
      return;
    }
    fn();
  };

  const handleCopy = guard(async () => {
    const ok = await copyToClipboard(referralLink);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  });

  const handleWhatsApp = guard(() => shareViaWhatsApp(referralLink, shareMsg.build(referralLink)));
  const handleSMS = guard(() => shareViaSMS(referralLink, shareMsg.build(referralLink)));
  const handleNative = guard(async () => {
    await shareViaNativeAPI(referralLink, shareMsg.headlineAndBody);
  });

  const handleCopyCode = async () => {
    if (!referralCode) {
      toast.error('Loading your code...');
      return;
    }
    await copyToClipboard(referralCode);
  };

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Send your link
      </p>

      {/* Visible link card */}
      <button
        type="button"
        onClick={handleCopy}
        disabled={isLoading || !referralLink}
        className="w-full text-left rounded-2xl border border-border/60 bg-muted/20 px-3 py-2.5 flex items-center gap-2 hover:bg-muted/30 active:scale-[0.99] transition disabled:opacity-50"
      >
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Your link
          </p>
          <p className="text-[13px] text-foreground truncate font-mono">
            {referralLink || 'Loading...'}
          </p>
        </div>
        {copied ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
        ) : (
          <Copy className="h-5 w-5 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Code-only copy (for users who prefer to type the code) */}
      {referralCode && (
        <button
          type="button"
          onClick={handleCopyCode}
          className="w-full text-left rounded-2xl border border-border/60 bg-muted/10 px-3 py-2.5 flex items-center gap-2 hover:bg-muted/30 active:scale-[0.99] transition"
        >
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Or share just your code
            </p>
            <p className="text-base font-mono font-bold tracking-[0.2em] text-foreground">
              {referralCode}
            </p>
          </div>
          <Copy className="h-5 w-5 text-muted-foreground shrink-0" />
        </button>
      )}

      {/* WhatsApp primary */}
      <Button
        onClick={handleWhatsApp}
        disabled={isLoading || !referralLink}
        className="h-12 w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold"
      >
        <FaWhatsapp className="h-5 w-5 mr-2" />
        Send on WhatsApp
      </Button>

      {/* Secondary row */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={handleSMS}
          disabled={isLoading || !referralLink}
          variant="outline"
          className="h-11"
        >
          <MessageSquare className="h-4 w-4 mr-1.5" />
          SMS
        </Button>
        {hasNativeShare ? (
          <Button
            onClick={handleNative}
            disabled={isLoading || !referralLink}
            variant="outline"
            className="h-11"
          >
            <Share2 className="h-4 w-4 mr-1.5" />
            More
          </Button>
        ) : (
          <Button
            onClick={handleCopy}
            disabled={isLoading || !referralLink}
            variant="outline"
            className="h-11"
          >
            <Copy className="h-4 w-4 mr-1.5" />
            Copy
          </Button>
        )}
      </div>
    </div>
  );
};
