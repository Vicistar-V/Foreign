import { motion } from 'framer-motion';
import { Radio } from 'lucide-react';

export const LivePulseIndicator = () => {
  return (
    <motion.div 
      className="flex items-center gap-2 text-xs text-muted-foreground"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="relative flex items-center justify-center">
        <motion.div
          className="absolute w-3 h-3 rounded-full bg-success/30"
          animate={{ scale: [1, 1.8, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <div className="w-2 h-2 rounded-full bg-success" />
      </div>
      <span className="flex items-center gap-1">
        <Radio className="w-3 h-3" />
        Live Updates
      </span>
    </motion.div>
  );
};
