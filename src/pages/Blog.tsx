// Blog List Page - Mobile-First Design
// Shows all blog posts with search and filtering

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { PublicHeader } from "@/components/PublicHeader";
import { LandingFooter } from "@/components/landing/LandingFooter";
import {
  BlogHero,
  BlogSearch,
  BlogTagFilter,
  BlogCard,
  BlogSEO,
  BlogListStructuredData,
} from "@/components/blog";
import { getAllBlogPosts } from "@/lib/blogContent";
import { searchBlogPosts, filterByTag, getTagsWithCounts, getFeaturedPosts } from "@/lib/blogUtils";

const Blog = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  
  // Get all posts
  const allPosts = useMemo(() => getAllBlogPosts(), []);
  const featuredPosts = useMemo(() => getFeaturedPosts(allPosts), [allPosts]);
  const tagsWithCounts = useMemo(() => getTagsWithCounts(allPosts), [allPosts]);
  
  // Filter posts based on search and tag
  const filteredPosts = useMemo(() => {
    let posts = allPosts;
    if (selectedTag) posts = filterByTag(posts, selectedTag);
    if (searchQuery) posts = searchBlogPosts(posts, searchQuery);
    return posts;
  }, [allPosts, searchQuery, selectedTag]);
  
  const showFeatured = !searchQuery && !selectedTag && featuredPosts.length > 0;
  const regularPosts = showFeatured 
    ? filteredPosts.filter(p => !p.featured)
    : filteredPosts;

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      <BlogSEO
        title="Viketa Blog - Money Tips & Guides"
        description="Tips, guides, and success stories to help you earn with Viketa ad shares. Learn how to maximize your earnings in Nigeria."
        image="/og-blog.png"
      />
      <BlogListStructuredData posts={allPosts} />
      
      <PublicHeader />
      
      <main className="container max-w-4xl mx-auto px-4">
        <BlogHero />
        
        {/* Search */}
        <div className="mb-4">
          <BlogSearch value={searchQuery} onChange={setSearchQuery} />
        </div>
        
        {/* Tags */}
        <div className="mb-6">
          <BlogTagFilter
            tags={tagsWithCounts}
            selectedTag={selectedTag}
            onSelectTag={setSelectedTag}
          />
        </div>
        
        {/* Featured Posts */}
        {showFeatured && (
          <section className="mb-8">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              Featured
            </h2>
            <div className="space-y-4">
              {featuredPosts.map((post, index) => (
                <BlogCard key={post.slug} post={post} index={index} featured />
              ))}
            </div>
          </section>
        )}
        
        {/* All Posts */}
        <section>
          {showFeatured && regularPosts.length > 0 && (
            <h2 className="text-lg font-bold mb-4">Latest Articles</h2>
          )}
          
          {filteredPosts.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <p className="text-muted-foreground">No articles found</p>
              <button
                onClick={() => { setSearchQuery(""); setSelectedTag(""); }}
                className="mt-2 text-primary text-sm font-medium"
              >
                Clear filters
              </button>
            </motion.div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {regularPosts.map((post, index) => (
                <BlogCard key={post.slug} post={post} index={index} />
              ))}
            </div>
          )}
        </section>
      </main>
      
      <div className="mt-16">
        <LandingFooter />
      </div>
    </div>
  );
};

export default Blog;
