import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { FaWhatsapp } from 'react-icons/fa';
import { ChevronRight } from 'lucide-react';
import { trackClarityEvent, ClarityEvents } from '@/lib/clarityTracking';

interface WhatsAppGroupPromoProps {
  link: string;
  className?: string;
}

export const WhatsAppGroupPromo = ({ 
  link, 
  className = '' 
}: WhatsAppGroupPromoProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [hasTrackedView, setHasTrackedView] = useState(false);

  // Track view when component becomes visible
  useEffect(() => {
    if (hasTrackedView || !cardRef.current) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          trackClarityEvent(ClarityEvents.WHATSAPP_GROUP_PROMO_VIEWED);
          setHasTrackedView(true);
        }
      },
      { threshold: 0.5 }
    );
    
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [hasTrackedView]);

  const handleJoinClick = () => {
    trackClarityEvent(ClarityEvents.WHATSAPP_GROUP_LINK_CLICKED);
    window.open(link, '_blank', 'noopener,noreferrer');
  };

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={className}
    >
      <button
        onClick={handleJoinClick}
        className="w-full flex items-center gap-3 p-3 rounded-xl bg-[hsl(var(--social-whatsapp))]/10 border border-[hsl(var(--social-whatsapp))]/20 hover:bg-[hsl(var(--social-whatsapp))]/15 active:scale-[0.98] transition-all duration-200 group"
      >
        {/* WhatsApp Icon */}
        <div className="flex-shrink-0 h-9 w-9 rounded-full bg-[hsl(var(--social-whatsapp))] flex items-center justify-center">
          <FaWhatsapp className="h-5 w-5 text-white" />
        </div>
        
        {/* Text */}
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-foreground truncate">Join Our Info Group</p>
            <span className="flex-shrink-0 text-[10px] font-bold uppercase bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] px-1.5 py-0.5 rounded-full animate-pulse">
              New
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate">Get tips & connect with members</p>
        </div>
        
        {/* Arrow */}
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-[hsl(var(--social-whatsapp))] transition-colors flex-shrink-0" />
      </button>
    </motion.div>
  );
};
