// Blog Related Posts Component
// Shows "You might also like" section at the bottom of posts

import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";
import { BlogCard } from "./BlogCard";
import type { BlogPost } from "@/types/blog";

interface BlogRelatedPostsProps {
  posts: BlogPost[];
}

export const BlogRelatedPosts = ({ posts }: BlogRelatedPostsProps) => {
  if (posts.length === 0) return null;
  
  return (
    <section className="mt-12 pt-8 border-t border-border">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        {/* Section header */}
        <div className="flex items-center gap-2 mb-6">
          <BookOpen className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold">You Might Also Like</h2>
        </div>
        
        {/* Related posts grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post, index) => (
            <BlogCard key={post.slug} post={post} index={index} />
          ))}
        </div>
      </motion.div>
    </section>
  );
};
