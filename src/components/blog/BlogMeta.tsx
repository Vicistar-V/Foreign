// Blog Meta Component
// Shows date, author, and reading time for a post

import { Calendar, Clock, User } from "lucide-react";
import { formatBlogDate } from "@/lib/blogUtils";

interface BlogMetaProps {
  date: string;
  readingTime: number;
  author?: string;
  className?: string;
}

export const BlogMeta = ({ 
  date, 
  readingTime, 
  author = "Viketa Team",
  className = ""
}: BlogMetaProps) => {
  return (
    <div className={`flex flex-wrap items-center gap-3 md:gap-4 text-sm text-muted-foreground ${className}`}>
      {/* Author */}
      <span className="flex items-center gap-1.5">
        <User className="w-4 h-4" />
        {author}
      </span>
      
      <span className="w-1 h-1 rounded-full bg-border" />
      
      {/* Date */}
      <span className="flex items-center gap-1.5">
        <Calendar className="w-4 h-4" />
        {formatBlogDate(date)}
      </span>
      
      <span className="w-1 h-1 rounded-full bg-border" />
      
      {/* Reading time */}
      <span className="flex items-center gap-1.5">
        <Clock className="w-4 h-4" />
        {readingTime} min read
      </span>
    </div>
  );
};
