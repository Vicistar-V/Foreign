import { useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { Check, ChevronLeft } from 'lucide-react';

interface SwipeableNotificationProps {
  children: React.ReactNode;
  onSwipe: () => void;
  onClick?: () => void;
}

const SWIPE_THRESHOLD = -80;
const CLICK_THRESHOLD = 15; // Pixels - if drag is less than this, consider it a click

export function SwipeableNotification({ children, onSwipe, onClick }: SwipeableNotificationProps) {
  const [isRemoving, setIsRemoving] = useState(false);
  const hasDragged = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  
  // Transform for revealing the check icon background
  const checkOpacity = useTransform(x, [-100, -40, 0], [1, 0.5, 0]);
  const checkScale = useTransform(x, [-100, -40, 0], [1, 0.8, 0.5]);
  
  const handleDragStart = () => {
    hasDragged.current = false;
  };

  const handleDrag = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    // Mark as dragging if moved more than threshold
    if (Math.abs(info.offset.x) > CLICK_THRESHOLD || Math.abs(info.offset.y) > CLICK_THRESHOLD) {
      hasDragged.current = true;
    }
  };

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    // Check if this was a swipe (moved beyond threshold to the left)
    if (info.offset.x < SWIPE_THRESHOLD) {
      setIsRemoving(true);
      // Animate out then trigger callback
      setTimeout(() => {
        onSwipe();
      }, 200);
    } 
    // If it was barely a drag (essentially a tap)
    else if (!hasDragged.current && onClick) {
      onClick();
    }
    
    // Reset
    hasDragged.current = false;
  };

  // Handle direct tap (for touch devices that might not trigger drag)
  const handleTap = () => {
    if (!hasDragged.current && onClick) {
      onClick();
    }
  };

  return (
    <div ref={containerRef} className="relative overflow-hidden">
      {/* Background reveal when swiping */}
      <motion.div 
        className="absolute inset-y-0 right-0 flex items-center justify-end px-6 bg-success/20 rounded-xl"
        style={{ 
          opacity: checkOpacity,
          width: '100%'
        }}
      >
        <motion.div style={{ scale: checkScale }}>
          <Check className="h-6 w-6 text-success" />
        </motion.div>
      </motion.div>
      
      {/* Swipeable content */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -120, right: 0 }}
        dragElastic={0.1}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        onTap={handleTap}
        style={{ x }}
        animate={isRemoving ? { x: -400, opacity: 0 } : { x: 0 }}
        transition={{ duration: 0.2 }}
        className="relative bg-background cursor-pointer"
      >
        {/* Swipe hint */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/20 pointer-events-none">
          <ChevronLeft className="h-4 w-4" />
        </div>
        
        {children}
      </motion.div>
    </div>
  );
}
