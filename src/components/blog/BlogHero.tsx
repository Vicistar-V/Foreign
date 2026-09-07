// Blog Hero Section
// Header section for the blog list page

import { motion } from "framer-motion";
import { BookOpen, TrendingUp, Trophy } from "lucide-react";

export const BlogHero = () => {
  return (
    <section className="relative overflow-hidden py-8 md:py-12 px-4">
      {/* Background gradient */}
      <div className="absolute inset-0 gradient-hero opacity-50" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative max-w-2xl mx-auto text-center"
      >
        {/* Icon badge */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", delay: 0.2 }}
          className="inline-flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-full bg-primary/10 mb-4"
        >
          <BookOpen className="w-7 h-7 md:w-8 md:h-8 text-primary" />
        </motion.div>
        
        {/* Title */}
        <h1 className="text-2xl md:text-4xl font-bold mb-3">
          Viketa Blog
        </h1>
        
        {/* Subtitle */}
        <p className="text-muted-foreground text-base md:text-lg mb-5 px-4">
          Tips, guides, and stories to help you win more money
        </p>
        
        {/* Quick stats */}
        <div className="flex items-center justify-center gap-4 md:gap-6">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span>Money Tips</span>
          </div>
          <div className="w-1 h-1 rounded-full bg-border" />
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Trophy className="w-4 h-4 text-primary" />
            <span>Success Stories</span>
          </div>
        </div>
      </motion.div>
    </section>
  );
};
