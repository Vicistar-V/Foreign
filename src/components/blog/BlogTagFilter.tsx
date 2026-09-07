// Blog Tag Filter Component
// Scrollable horizontal tag chips for filtering posts

import { useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { haptics } from "@/lib/haptics";

interface BlogTagFilterProps {
  tags: Array<{ tag: string; count: number }>;
  selectedTag: string;
  onSelectTag: (tag: string) => void;
}

export const BlogTagFilter = ({ tags, selectedTag, onSelectTag }: BlogTagFilterProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const handleTagClick = (tag: string) => {
    haptics.light();
    onSelectTag(tag);
  };
  
  // Add "All" option at the beginning
  const allTags = [{ tag: "All", count: tags.reduce((sum, t) => sum + t.count, 0) }, ...tags];
  
  return (
    <div className="relative">
      {/* Scrollable container */}
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto pb-2 px-4 -mx-4 scrollbar-hide"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {allTags.map(({ tag, count }, index) => {
          const isSelected = selectedTag === tag || (tag === "All" && !selectedTag);
          
          return (
            <motion.div
              key={tag}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
            >
              <Button
                variant={isSelected ? "default" : "outline"}
                size="sm"
                onClick={() => handleTagClick(tag === "All" ? "" : tag)}
                className={`whitespace-nowrap rounded-full h-9 px-4 text-sm font-medium transition-all ${
                  isSelected
                    ? "gradient-primary text-primary-foreground shadow-sm"
                    : "bg-card hover:bg-muted border-border"
                }`}
              >
                {tag}
                <span className={`ml-1.5 text-xs ${isSelected ? "opacity-80" : "text-muted-foreground"}`}>
                  ({count})
                </span>
              </Button>
            </motion.div>
          );
        })}
      </div>
      
      {/* Fade edges for scroll indication */}
      <div className="absolute top-0 right-0 bottom-2 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none" />
    </div>
  );
};
