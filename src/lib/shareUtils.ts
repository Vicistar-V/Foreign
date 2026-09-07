import { toast } from 'sonner';
import { haptics } from '@/lib/haptics';
import { buildInviteUrl } from '@/lib/inviteKey';

/**
 * Generate full referral link from code.
 *
 * Automatically appends the platform's invite access key (?k=...) so the
 * recipient bypasses the cloak gate when they open the link.
 */
export const generateReferralLink = (code: string): string => {
  return buildInviteUrl(`/signup/${code}`);
};


/**
 * Unified, human-sounding FOMO message used across ALL share surfaces.
 * Money values come from platform_config (use the `useShareMessage` hook
 * to inject live values). The defaults below are safe fallbacks.
 */
export const SHARE_MESSAGE_HEADLINE =
  'Open this Viketa website. It is paying right now.';

export const buildShareBody = (
  profitAmount: number = 900,
  minWithdrawal: number = 5000,
): string => {
  return `Just activate one ad share, and every time your campaign finishes you make ₦${profitAmount.toLocaleString()} — just make sure your pending balance is full. Once it reaches ₦${minWithdrawal.toLocaleString()} you can withdraw it.`;
};

export const buildShareMessage = (
  link: string,
  profitAmount: number = 900,
  minWithdrawal: number = 5000,
): string => {
  return `${SHARE_MESSAGE_HEADLINE}\n\n${buildShareBody(profitAmount, minWithdrawal)}\n\n${link}`;
};

/** @deprecated kept only for the previous import name. */
export const SHARE_MESSAGE_BODY = buildShareBody();

/**
 * Copy text to clipboard with feedback
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    
    // Haptic feedback on mobile
    haptics.heavy();
    
    toast.success('Copied to clipboard!');
    return true;
  } catch (error) {
    console.error('Copy failed:', error);
    toast.error('Failed to copy');
    return false;
  }
};

/**
 * Share via WhatsApp
 */
export const shareViaWhatsApp = (link: string, message?: string): void => {
  const text = encodeURIComponent(message || buildShareMessage(link));
  
  // Mobile WhatsApp app
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const whatsappUrl = isMobile 
    ? `whatsapp://send?text=${text}`
    : `https://web.whatsapp.com/send?text=${text}`;
  
  window.open(whatsappUrl, '_blank');
};

/**
 * Share via Twitter/X
 */
export const shareViaTwitter = (link: string, message?: string): void => {
  // Twitter appends the URL separately, so don't include it in the text
  const baseText = message || `${SHARE_MESSAGE_HEADLINE} ${SHARE_MESSAGE_BODY}`;
  const text = encodeURIComponent(baseText);
  const url = encodeURIComponent(link);
  
  const twitterUrl = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
  window.open(twitterUrl, '_blank', 'width=550,height=420');
};

/**
 * Share via SMS (Mobile)
 */
export const shareViaSMS = (link: string, message?: string): void => {
  const text = encodeURIComponent(message || buildShareMessage(link));
  
  const smsUrl = `sms:?&body=${text}`;
  window.location.href = smsUrl;
};

/**
 * Share via native share API (Mobile)
 */
export const shareViaNativeAPI = async (link: string, message?: string): Promise<boolean> => {
  if (!navigator.share) {
    toast.error('Sharing not supported on this device');
    return false;
  }

  try {
    await navigator.share({
      title: 'Viketa',
      text: message || `${SHARE_MESSAGE_HEADLINE} ${SHARE_MESSAGE_BODY}`,
      url: link,
    });
    
    return true;
  } catch (error) {
    // User cancelled or error occurred
    if (error instanceof Error && error.name !== 'AbortError') {
      console.error('Share failed:', error);
      toast.error('Failed to share');
    }
    return false;
  }
};

/**
 * Generate shareable message with customization
 * (kept for backward compatibility — now returns the unified message).
 */
export const generateShareMessage = (referralCode: string, _earnings?: number): string => {
  const link = generateReferralLink(referralCode);
  return buildShareMessage(link);
};

/**
 * Share yield payout result to WhatsApp (uses unified message)
 */
export const shareYieldPayoutResult = (referralCode: string, _amount: number): void => {
  const link = generateReferralLink(referralCode);
  shareViaWhatsApp(link);
};
