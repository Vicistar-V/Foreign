import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface StaggeredItemProps {
  children: ReactNode;
  className?: string;
}

const itemVariants = {
  hidden: { 
    opacity: 0, 
    y: 12,
    scale: 0.98,
  },
  visible: { 
    opacity: 1, 
    y: 0,
    scale: 1,
    transition: {
      duration: 0.25,
      ease: [0.25, 0.1, 0.25, 1] as const,
    },
  },
};

export const StaggeredItem = ({ children, className = '' }: StaggeredItemProps) => {
  return (
    <motion.div variants={itemVariants} className={className}>
      {children}
    </motion.div>
  );
};
