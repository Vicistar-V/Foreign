// Blog Share Buttons Component
// WhatsApp, Twitter, Copy Link - Mobile-first design

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Share2, MessageCircle, Twitter, Link2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { haptics } from "@/lib/haptics";
import { toast } from "sonner";

interface BlogShareButtonsProps {
  title: string;
  url: string;
  description?: string;
}

export const BlogShareButtons = ({ title, url, description }: BlogShareButtonsProps) => {
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  const shareText = `${title}${description ? ` - ${description}` : ""}`;
  
  const handleWhatsApp = () => {
    haptics.medium();
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n\n${url}`)}`;
    window.open(whatsappUrl, "_blank");
  };
  
  const handleTwitter = () => {
    haptics.medium();
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`;
    window.open(twitterUrl, "_blank");
  };
  
  const handleCopyLink = async () => {
    haptics.success();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Could not copy link");
    }
  };
  
  const handleNativeShare = async () => {
    haptics.medium();
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: description,
          url,
        });
      } catch (err) {
        // User cancelled or share failed
        setIsOpen(true);
      }
    } else {
      setIsOpen(true);
    }
  };
  
  return (
    <div className="relative">
      {/* Main share button - uses native share on mobile */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleNativeShare}
        className="gap-2 rounded-full"
        haptic="light"
      >
        <Share2 className="w-4 h-4" />
        <span className="hidden sm:inline">Share</span>
      </Button>
      
      {/* Fallback share options */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-background/80 md:hidden"
              onClick={() => setIsOpen(false)}
            />
            
            {/* Share options panel */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-card border-t border-border rounded-t-2xl shadow-lg md:absolute md:bottom-auto md:top-full md:left-auto md:right-0 md:mt-2 md:w-48 md:rounded-xl md:border"
            >
              {/* Mobile header */}
              <div className="flex items-center justify-between mb-4 md:hidden">
                <h3 className="font-semibold">Share this article</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="h-8 w-8 p-0"
                >
                  ×
                </Button>
              </div>
              
              {/* Share options */}
              <div className="flex gap-3 md:flex-col md:gap-1">
                {/* WhatsApp */}
                <button
                  onClick={handleWhatsApp}
                  className="flex-1 flex flex-col md:flex-row items-center gap-2 p-3 md:p-2 rounded-xl md:rounded-lg bg-[hsl(var(--social-whatsapp))]/10 hover:bg-[hsl(var(--social-whatsapp))]/20 transition-colors"
                >
                  <div className="w-10 h-10 md:w-8 md:h-8 rounded-full bg-[hsl(var(--social-whatsapp))] flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 md:w-4 md:h-4 text-white" />
                  </div>
                  <span className="text-xs md:text-sm font-medium">WhatsApp</span>
                </button>
                
                {/* Twitter */}
                <button
                  onClick={handleTwitter}
                  className="flex-1 flex flex-col md:flex-row items-center gap-2 p-3 md:p-2 rounded-xl md:rounded-lg bg-[hsl(var(--social-twitter))]/10 hover:bg-[hsl(var(--social-twitter))]/20 transition-colors"
                >
                  <div className="w-10 h-10 md:w-8 md:h-8 rounded-full bg-[hsl(var(--social-twitter))] flex items-center justify-center">
                    <Twitter className="w-5 h-5 md:w-4 md:h-4 text-white" />
                  </div>
                  <span className="text-xs md:text-sm font-medium">Twitter</span>
                </button>
                
                {/* Copy Link */}
                <button
                  onClick={handleCopyLink}
                  className="flex-1 flex flex-col md:flex-row items-center gap-2 p-3 md:p-2 rounded-xl md:rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                >
                  <div className="w-10 h-10 md:w-8 md:h-8 rounded-full bg-foreground/10 flex items-center justify-center">
                    {copied ? (
                      <Check className="w-5 h-5 md:w-4 md:h-4 text-primary" />
                    ) : (
                      <Link2 className="w-5 h-5 md:w-4 md:h-4 text-foreground" />
                    )}
                  </div>
                  <span className="text-xs md:text-sm font-medium">
                    {copied ? "Copied!" : "Copy Link"}
                  </span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
