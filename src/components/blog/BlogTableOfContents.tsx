// Blog Table of Contents Component
// Jump to different sections of the article

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { List, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TableOfContentsItem } from "@/types/blog";
import { haptics } from "@/lib/haptics";

interface BlogTableOfContentsProps {
  items: TableOfContentsItem[];
}

export const BlogTableOfContents = ({ items }: BlogTableOfContentsProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeId, setActiveId] = useState<string>("");
  
  // Track which section is currently visible
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: "-80px 0px -80% 0px" }
    );
    
    // Observe all heading elements
    items.forEach((item) => {
      const element = document.getElementById(item.id);
      if (element) observer.observe(element);
    });
    
    return () => observer.disconnect();
  }, [items]);
  
  const handleClick = (id: string) => {
    haptics.light();
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      setIsOpen(false);
    }
  };
  
  if (items.length < 2) return null;
  
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Toggle button */}
      <Button
        variant="ghost"
        onClick={() => {
          haptics.light();
          setIsOpen(!isOpen);
        }}
        className="w-full flex items-center justify-between h-12 px-4 rounded-none"
      >
        <span className="flex items-center gap-2 font-medium">
          <List className="w-4 h-4" />
          In This Article
        </span>
        {isOpen ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </Button>
      
      {/* TOC items */}
      <AnimatePresence>
        {isOpen && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <ul className="p-3 space-y-1 border-t border-border">
              {items.map((item, index) => (
                <motion.li
                  key={item.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <button
                    onClick={() => handleClick(item.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      item.level === 3 ? "pl-6" : ""
                    } ${
                      activeId === item.id
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    {item.text}
                  </button>
                </motion.li>
              ))}
            </ul>
          </motion.nav>
        )}
      </AnimatePresence>
    </div>
  );
};
