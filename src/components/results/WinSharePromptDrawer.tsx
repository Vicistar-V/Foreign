import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle, 
  DrawerDescription,
  DrawerFooter 
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { MessageCircle, AlertTriangle, Trophy, Copy, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import { useWinSharePrompt } from '@/hooks/useWinSharePrompt';
import { trackClarityEvent, ClarityEvents } from '@/lib/clarityTracking';

interface WinSharePromptDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  referralCode?: string;
}

export const WinSharePromptDrawer = ({ 
  isOpen, 
  onClose, 
  amount,
  referralCode
}: WinSharePromptDrawerProps) => {
  const { 
    shareToWhatsAppGroup, 
    shareMessage,
    hasGroupLink,
  } = useWinSharePrompt({ amount, referralCode });

  const handleShareToGroup = () => {
    shareToWhatsAppGroup();
    onClose();
  };

  const handleSkip = () => {
    trackClarityEvent(ClarityEvents.WIN_SHARE_PROMPT_DISMISSED);
    onClose();
  };

  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent className="max-h-[95vh]">
        <DrawerHeader className="text-center pb-2">
          {/* Celebration icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
            className="mx-auto mb-3"
          >
            <div className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center">
              <Trophy className="w-10 h-10 text-success" />
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <DrawerTitle className="text-2xl font-bold text-foreground">
              Congratulations! 🎉
            </DrawerTitle>
            <p className="text-3xl font-bold text-success mt-2">
              You Won ₦{amount?.toLocaleString()}!
            </p>
          </motion.div>
          
          <DrawerDescription className="mt-3 text-base">
            Send your win to our WhatsApp Group!
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-4 space-y-4">
          {/* Instructions */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-muted/50 rounded-lg p-4 space-y-3"
          >
            <p className="text-sm font-medium text-foreground">How it works:</p>
            <ol className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                <span>Tap the button below to copy your message</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                <span>WhatsApp Group will open automatically</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                <span>Paste and send the news!</span>
              </li>
            </ol>
          </motion.div>

          {/* Preview of message */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="bg-success/5 border border-success/20 rounded-lg p-3"
          >
            <p className="text-xs text-muted-foreground mb-1">Your message:</p>
            <p className="text-sm text-foreground whitespace-pre-line">{shareMessage}</p>
          </motion.div>

          {/* Main CTA */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Button
              onClick={handleShareToGroup}
              disabled={!hasGroupLink}
              className="w-full h-16 text-lg bg-social-whatsapp hover:bg-social-whatsapp/90 text-white font-semibold"
              size="lg"
              haptic="heavy"
            >
              <MessageCircle className="w-6 h-6 mr-2" />
              {hasGroupLink ? 'Send to WhatsApp Group' : 'Group link coming soon'}
              {hasGroupLink && <ExternalLink className="w-4 h-4 ml-2" />}
            </Button>
          </motion.div>

          {/* Warning */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="bg-caution/10 border border-caution/20 rounded-lg p-3 flex items-start gap-3"
          >
            <AlertTriangle className="w-5 h-5 text-caution flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-caution-foreground">
                Telling friends builds our community
              </p>
              <p className="text-xs text-muted-foreground">
                Members who don't tell friends about their payouts may have their accounts reviewed. 
                This helps prevent fraud and keeps our community trusted.
              </p>
            </div>
          </motion.div>
        </div>

        <DrawerFooter className="pt-0">
          <Button 
            variant="ghost" 
            onClick={handleSkip} 
            className="text-muted-foreground"
          >
            I'll tell them later
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
