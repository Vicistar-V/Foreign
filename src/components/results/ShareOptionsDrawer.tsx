import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle, 
  DrawerDescription,
  DrawerFooter 
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { MessageCircle, Share2, Copy, Users, ExternalLink } from 'lucide-react';
import { FaFacebook, FaTwitter } from 'react-icons/fa';
import { toast } from 'sonner';
import { trackClarityEvent, ClarityEvents } from '@/lib/clarityTracking';
import { haptics } from '@/lib/haptics';
import { useWhatsAppGroupLink } from '@/hooks/useWhatsAppGroupLink';

interface ShareOptionsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  message: string;
  url: string;
  isPersonalWin?: boolean;
}

export const ShareOptionsDrawer = ({ 
  isOpen, 
  onClose, 
  message, 
  url,
  isPersonalWin 
}: ShareOptionsDrawerProps) => {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const { link: whatsappGroupLink, openGroup } = useWhatsAppGroupLink();

  const handleShareToGroup = async () => {
    trackClarityEvent(ClarityEvents.WIN_SHARE_TO_GROUP_CLICKED);
    
    // Copy message to clipboard
    const fullMessage = `${message}\n\n${url}`;
    try {
      await navigator.clipboard.writeText(fullMessage);
      haptics.heavy();
      toast.success('Message copied! Paste it in the group 📋', {
        duration: 4000,
      });
      
      // Open WhatsApp group
      setTimeout(() => {
        openGroup();
      }, 500);
    } catch (error) {
      openGroup();
    }
    onClose();
  };

  const handleWhatsAppShare = () => {
    trackClarityEvent(ClarityEvents.WIN_SHARE_WHATSAPP);
    const fullMessage = `${message}\n\n${url}`;
    const text = encodeURIComponent(fullMessage);
    const whatsappUrl = isMobile 
      ? `whatsapp://send?text=${text}`
      : `https://web.whatsapp.com/send?text=${text}`;
    
    window.open(whatsappUrl, '_blank');
    onClose();
  };

  const handleTwitterShare = () => {
    trackClarityEvent(ClarityEvents.WIN_SHARE_TWITTER);
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(url)}`;
    window.open(twitterUrl, '_blank');
    onClose();
  };

  const handleFacebookShare = () => {
    trackClarityEvent(ClarityEvents.WIN_SHARE_FACEBOOK);
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(message)}`;
    window.open(facebookUrl, '_blank');
    onClose();
  };

  const handleCopyMessage = async () => {
    trackClarityEvent(ClarityEvents.WIN_SHARE_COPIED);
    const fullMessage = `${message}\n\n${url}`;
    try {
      await navigator.clipboard.writeText(fullMessage);
      toast.success('Copied! Now paste anywhere 📋');
      
      // Haptic feedback on mobile
      haptics.heavy();
      
      onClose();
    } catch (error) {
      toast.error('Failed to copy. Please try again.');
    }
  };

  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent>
        <DrawerHeader className="text-center">
          <DrawerTitle className="text-2xl">Tell a Friend About Your {isPersonalWin ? 'Win' : 'Discovery'}</DrawerTitle>
          <DrawerDescription>
            {isPersonalWin 
              ? 'Send your win to our community!'
              : 'Choose where to send it'
            }
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-6 space-y-3">
          {/* Priority: Send to Viketa Group - only for personal wins */}
          {isPersonalWin && whatsappGroupLink && (
            <Button
              onClick={handleShareToGroup}
              className="w-full h-16 text-base bg-social-whatsapp hover:bg-social-whatsapp/90 text-white font-semibold animate-pulse"
              size="lg"
            >
              <Users className="w-5 h-5" />
              Send to Viketa Group
              <ExternalLink className="w-4 h-4 ml-1" />
            </Button>
          )}

          {isPersonalWin && whatsappGroupLink && (
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">or share elsewhere</span>
              </div>
            </div>
          )}

          <Button
            onClick={handleWhatsAppShare}
            className="w-full h-14 text-base bg-social-whatsapp hover:bg-social-whatsapp/90 text-white"
            size="lg"
          >
            <MessageCircle className="w-5 h-5" />
            Send on WhatsApp
          </Button>

          <Button
            onClick={handleTwitterShare}
            className="w-full h-14 text-base bg-social-twitter hover:bg-social-twitter/90 text-white"
            size="lg"
          >
            <FaTwitter className="w-5 h-5" />
            Send on Twitter/X
          </Button>

          <Button
            onClick={handleFacebookShare}
            className="w-full h-14 text-base bg-social-facebook hover:bg-social-facebook/90 text-white"
            size="lg"
          >
            <FaFacebook className="w-5 h-5" />
            Send on Facebook
          </Button>

          <Button
            onClick={handleCopyMessage}
            variant="outline"
            className="w-full h-14 text-base"
            size="lg"
          >
            <Copy className="w-5 h-5" />
            Copy Message
          </Button>
        </div>

        <DrawerFooter>
          <Button variant="ghost" onClick={onClose} className="w-full">
            Cancel
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
