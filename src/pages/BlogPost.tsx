// Blog Post Page - Individual article view
// Mobile-first with reading progress, TOC, share, related posts

import { useMemo } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PublicHeader } from "@/components/PublicHeader";
import { LandingFooter } from "@/components/landing/LandingFooter";
import {
  BlogContent,
  BlogMeta,
  BlogShareButtons,
  BlogTableOfContents,
  BlogRelatedPosts,
  BlogProgressBar,
  BlogSEO,
  BlogStructuredData,
  BlogFAQSchemaFromContent,
} from "@/components/blog";
import { getBlogPostBySlug, getAllBlogPosts } from "@/lib/blogContent";
import { extractTableOfContents, getRelatedPosts, getBlogCanonicalUrl } from "@/lib/blogUtils";

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  
  const post = useMemo(() => slug ? getBlogPostBySlug(slug) : undefined, [slug]);
  const allPosts = useMemo(() => getAllBlogPosts(), []);
  const relatedPosts = useMemo(
    () => post ? getRelatedPosts(post, allPosts, 3) : [],
    [post, allPosts]
  );
  const toc = useMemo(
    () => post ? extractTableOfContents(post.content) : [],
    [post]
  );
  
  // 404 if post not found
  if (!post) {
    return <Navigate to="/blog" replace />;
  }
  
  const canonicalUrl = getBlogCanonicalUrl(post.slug);

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      <BlogSEO
        title={post.title}
        description={post.description}
        image={post.image}
        slug={post.slug}
        type="article"
        publishedDate={post.date}
        modifiedDate={post.updatedDate}
        author={post.author}
      />
      <BlogStructuredData post={post} />
      <BlogFAQSchemaFromContent content={post.content} />
      <BlogProgressBar />
      
      <PublicHeader />
      
      <main className="container max-w-3xl mx-auto px-4 py-6">
        {/* Back link */}
        <Link to="/blog">
          <Button variant="ghost" size="sm" className="gap-2 mb-4 -ml-2" haptic="light">
            <ArrowLeft className="w-4 h-4" />
            Back to Blog
          </Button>
        </Link>
        
        {/* Article header */}
        <motion.header
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-3">
            {post.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
          
          {/* Title */}
          <h1 className="text-2xl md:text-4xl font-bold mb-4 leading-tight">
            {post.title}
          </h1>
          
          {/* Meta & Share */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <BlogMeta
              date={post.date}
              readingTime={post.readingTime}
              author={post.author}
            />
            <BlogShareButtons
              title={post.title}
              url={canonicalUrl}
              description={post.description}
            />
          </div>
        </motion.header>
        
        {/* Featured image */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-8 rounded-2xl overflow-hidden bg-muted aspect-[16/9]"
        >
          <img
            src={post.image || "/placeholder.svg"}
            alt={post.title}
            className="w-full h-full object-cover"
            onError={(e) => { e.currentTarget.src = "/placeholder.svg"; }}
          />
        </motion.div>
        
        {/* Table of Contents - Mobile */}
        {toc.length >= 2 && (
          <div className="mb-6 md:hidden">
            <BlogTableOfContents items={toc} />
          </div>
        )}
        
        {/* Article content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <BlogContent content={post.content} />
        </motion.div>
        
        {/* Related posts */}
        <BlogRelatedPosts posts={relatedPosts} />
      </main>
      
      <div className="mt-16">
        <LandingFooter />
      </div>
    </div>
  );
};

export default BlogPost;
