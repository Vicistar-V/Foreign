import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface StaggeredListProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
  /** Optional key to force re-animation when it changes (e.g., on page/filter change) */
  animationKey?: string | number;
}

export const StaggeredList = ({ 
  children, 
  className = '',
  staggerDelay = 0.05,
  animationKey
}: StaggeredListProps) => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
        delayChildren: 0.05,
      },
    },
  };

  return (
    <motion.div
      key={animationKey}
      className={className}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
};
