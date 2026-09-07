// Blog Progress Bar Component
// Shows reading progress at the top of the page

import { useState, useEffect } from "react";
import { motion, useScroll, useSpring } from "framer-motion";

export const BlogProgressBar = () => {
  const [isVisible, setIsVisible] = useState(false);
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });
  
  // Only show progress bar after scrolling past the hero
  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > 200);
    };
    
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  
  if (!isVisible) return null;
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-50 h-1 bg-muted/50"
    >
      <motion.div
        style={{ scaleX }}
        className="h-full bg-primary origin-left"
      />
    </motion.div>
  );
};
