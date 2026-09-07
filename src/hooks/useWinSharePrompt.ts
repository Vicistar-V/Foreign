import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { haptics } from '@/lib/haptics';
import { trackClarityEvent, ClarityEvents } from '@/lib/clarityTracking';
import { useWhatsAppGroupLink } from './useWhatsAppGroupLink';
import { useShareMessage } from './useShareMessage';
import { generateReferralLink } from '@/lib/shareUtils';

interface UseWinSharePromptProps {
  amount: number;
  referralCode?: string;
}

export const useWinSharePrompt = ({ amount, referralCode }: UseWinSharePromptProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { link: whatsappGroupLink, hasLink, openGroup } = useWhatsAppGroupLink();

  // Unified FOMO share message (same across all share surfaces)
  const referralLink = generateReferralLink(referralCode || 'join');
  const shareMsg = useShareMessage();
  const shareMessage = shareMsg.build(referralLink);
  
  const openPrompt = useCallback(() => {
    setIsOpen(true);
    trackClarityEvent(ClarityEvents.WIN_SHARE_PROMPT_SHOWN);
  }, []);
  
  const closePrompt = useCallback(() => {
    setIsOpen(false);
    trackClarityEvent(ClarityEvents.WIN_SHARE_PROMPT_DISMISSED);
  }, []);
  
  const shareToWhatsAppGroup = useCallback(async () => {
    if (!hasLink) {
      toast.info('The group link is not set up yet. Please try again later.');
      setIsOpen(false);
      return;
    }
    try {
      // Copy message to clipboard first
      await navigator.clipboard.writeText(shareMessage);
      
      // Haptic feedback
      haptics.heavy();
      
      // Show toast with instructions
      toast.success('Message copied! Paste it in the group 📋', {
        duration: 4000,
      });
      
      // Track the event
      trackClarityEvent(ClarityEvents.WIN_SHARE_TO_GROUP_CLICKED);
      
      // Open WhatsApp group in new tab
      setTimeout(() => {
        openGroup();
      }, 500);
      
      setIsOpen(false);
    } catch (error) {
      // Fallback: just open the group
      toast.info('Opening WhatsApp Group...', {
        duration: 2000,
      });
      openGroup();
      setIsOpen(false);
    }
  }, [shareMessage, hasLink, openGroup]);
  
  return {
    isOpen,
    openPrompt,
    closePrompt,
    shareToWhatsAppGroup,
    shareMessage,
    whatsappGroupLink,
    hasGroupLink: hasLink,
  };
};
