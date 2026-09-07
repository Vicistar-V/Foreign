import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { parseSimpleMarkdown } from '@/lib/parseSimpleMarkdown';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { 
  Megaphone, 
  Gift, 
  Trophy, 
  Rocket, 
  Heart, 
  Star, 
  Bell, 
  Info,
  ArrowRight 
} from 'lucide-react';

// Icon template mapping with their colors
const ICON_TEMPLATES = {
  megaphone: { icon: Megaphone, color: 'from-blue-500 to-blue-600', bg: 'bg-blue-500/10' },
  gift: { icon: Gift, color: 'from-emerald-500 to-emerald-600', bg: 'bg-emerald-500/10' },
  trophy: { icon: Trophy, color: 'from-amber-500 to-yellow-500', bg: 'bg-amber-500/10' },
  rocket: { icon: Rocket, color: 'from-purple-500 to-purple-600', bg: 'bg-purple-500/10' },
  heart: { icon: Heart, color: 'from-rose-500 to-pink-500', bg: 'bg-rose-500/10' },
  star: { icon: Star, color: 'from-yellow-400 to-orange-500', bg: 'bg-yellow-500/10' },
  bell: { icon: Bell, color: 'from-indigo-500 to-indigo-600', bg: 'bg-indigo-500/10' },
  info: { icon: Info, color: 'from-cyan-500 to-cyan-600', bg: 'bg-cyan-500/10' },
} as const;

export type IconTemplate = keyof typeof ICON_TEMPLATES;

export interface BroadcastModalData {
  id: string;
  title: string;
  message: string;
  icon_template: IconTemplate;
  cta_button_text?: string;
  cta_button_link?: string;
}

interface BroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: BroadcastModalData | null;
}

export const BroadcastModal = ({ isOpen, onClose, data }: BroadcastModalProps) => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  if (!data) return null;

  const iconConfig = ICON_TEMPLATES[data.icon_template] || ICON_TEMPLATES.megaphone;
  const IconComponent = iconConfig.icon;

  const handleCTAClick = () => {
    if (data.cta_button_link) {
      // Fire-and-forget click tracking (optimistic — never blocks navigation)
      supabase.rpc('track_broadcast_cta_click' as any, { _notification_id: data.id })
        .then(() => {}, () => {});
      onClose();
      setTimeout(() => {
        navigate(data.cta_button_link!);
      }, 200);
    }
  };

  const handleDismiss = () => {
    onClose();
  };

  // Scrollable content (icon, title, message)
  const scrollableContent = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex flex-col items-center text-center px-4 pt-6 pb-2"
    >
      {/* Icon */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className={`w-14 h-14 rounded-full bg-gradient-to-br ${iconConfig.color} flex items-center justify-center mb-4 shadow-lg`}
      >
        <IconComponent className="w-7 h-7 text-white" strokeWidth={2.5} />
      </motion.div>

      {/* Title */}
      <motion.h2
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="text-lg font-bold text-foreground mb-3"
      >
        {data.title}
      </motion.h2>

      {/* Message */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-muted-foreground text-sm leading-relaxed max-w-xs [&_strong]:text-foreground [&_strong]:font-semibold [&_p]:mb-2 [&_ul]:text-left [&_ul]:my-2 [&_ul]:ml-4 [&_li]:py-0.5"
        dangerouslySetInnerHTML={{ __html: parseSimpleMarkdown(data.message) }}
      />
    </motion.div>
  );

  // CTA section (fixed at bottom)
  const ctaSection = (
    <div className="flex-shrink-0 bg-background px-4 pt-3 pb-4 border-t border-border/50">
      {/* CTA Button */}
      {data.cta_button_text && data.cta_button_link && (
        <Button
          onClick={handleCTAClick}
          size="lg"
          className={`w-full bg-gradient-to-r ${iconConfig.color} hover:opacity-90 text-white font-semibold h-12 text-base shadow-lg mb-2`}
        >
          {data.cta_button_text}
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      )}

      {/* Dismiss Button */}
      <button
        onClick={handleDismiss}
        className="w-full text-muted-foreground hover:text-foreground text-sm font-medium py-1 transition-colors"
      >
        Got it, thanks
      </button>
    </div>
  );

  // Use Drawer on mobile, Dialog on desktop
  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="max-h-[85vh] flex flex-col pb-0">
          <div className="overflow-y-auto flex-1">
            <AnimatePresence mode="wait">
              {isOpen && scrollableContent}
            </AnimatePresence>
          </div>
          {ctaSection}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md p-0 flex flex-col max-h-[80vh]">
        <div className="overflow-y-auto flex-1 p-6">
          <AnimatePresence mode="wait">
            {isOpen && scrollableContent}
          </AnimatePresence>
        </div>
        {ctaSection}
      </DialogContent>
    </Dialog>
  );
};
