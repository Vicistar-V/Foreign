// Blog Card Component
// Shows a preview of a blog post in the listing

import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Calendar, Clock, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { BlogPost } from "@/types/blog";
import { formatBlogDateShort } from "@/lib/blogUtils";

interface BlogCardProps {
  post: BlogPost;
  index?: number;
  featured?: boolean;
}

export const BlogCard = ({ post, index = 0, featured = false }: BlogCardProps) => {
  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
    >
      <Link
        to={`/blog/${post.slug}`}
        className={`group block rounded-2xl overflow-hidden border border-border bg-card transition-all duration-300 hover:shadow-medium hover:border-primary/20 ${
          featured ? "md:flex md:gap-6" : ""
        }`}
      >
        {/* Image */}
        <div
          className={`relative overflow-hidden bg-muted ${
            featured ? "md:w-2/5 aspect-[16/10] md:aspect-auto md:min-h-[240px]" : "aspect-[16/10]"
          }`}
        >
          <img
            src={post.image || "/placeholder.svg"}
            alt={post.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.src = "/placeholder.svg";
            }}
          />
          
          {/* Tags overlay on mobile */}
          <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-1.5 md:hidden">
            {post.tags.slice(0, 2).map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="bg-background/90 text-xs font-medium"
              >
                {tag}
              </Badge>
            ))}
          </div>
          
          {/* Featured badge */}
          {post.featured && (
            <div className="absolute top-3 left-3">
              <Badge className="bg-primary text-primary-foreground text-xs font-semibold">
                Featured
              </Badge>
            </div>
          )}
        </div>
        
        {/* Content */}
        <div className={`p-4 md:p-5 ${featured ? "md:w-3/5 md:flex md:flex-col md:justify-center" : ""}`}>
          {/* Tags - desktop only */}
          <div className="hidden md:flex flex-wrap gap-1.5 mb-3">
            {post.tags.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="text-xs font-medium"
              >
                {tag}
              </Badge>
            ))}
          </div>
          
          {/* Title */}
          <h3 className={`font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-2 ${
            featured ? "text-xl md:text-2xl" : "text-lg"
          }`}>
            {post.title}
          </h3>
          
          {/* Description */}
          <p className="text-muted-foreground text-sm line-clamp-2 mb-3">
            {post.description}
          </p>
          
          {/* Meta info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {formatBlogDateShort(post.date)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {post.readingTime} min read
              </span>
            </div>
            
            {/* Read more indicator */}
            <span className="flex items-center gap-1 text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
              Read
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </Link>
    </motion.article>
  );
};
