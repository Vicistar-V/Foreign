// Blog Search Component
// Mobile-friendly search input for finding blog posts

import { useState, useCallback } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface BlogSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const BlogSearch = ({ 
  value, 
  onChange, 
  placeholder = "Search articles..." 
}: BlogSearchProps) => {
  const [isFocused, setIsFocused] = useState(false);
  
  const handleClear = useCallback(() => {
    onChange("");
  }, [onChange]);
  
  return (
    <div className="relative w-full">
      <div
        className={`relative flex items-center transition-all duration-200 ${
          isFocused ? "ring-2 ring-primary/20" : ""
        } rounded-xl overflow-hidden border border-border bg-card`}
      >
        {/* Search icon */}
        <div className="absolute left-3 pointer-events-none">
          <Search className="w-4 h-4 text-muted-foreground" />
        </div>
        
        {/* Input */}
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className="pl-10 pr-10 py-3 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-base"
        />
        
        {/* Clear button */}
        {value && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClear}
            className="absolute right-1 h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
      
      {/* Search hint */}
      {value && (
        <p className="text-xs text-muted-foreground mt-2 px-1">
          Searching for "{value}"
        </p>
      )}
    </div>
  );
};
