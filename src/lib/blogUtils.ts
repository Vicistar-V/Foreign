// Blog Utility Functions
// Simple helper functions for working with blog posts

import type { BlogPost, BlogPostMeta, TableOfContentsItem } from "@/types/blog";

/**
 * Calculate how long it takes to read an article
 * Average person reads 200 words per minute
 */
export const calculateReadingTime = (content: string): number => {
  const wordsPerMinute = 200;
  const wordCount = content.trim().split(/\s+/).length;
  const readingTime = Math.ceil(wordCount / wordsPerMinute);
  return Math.max(1, readingTime); // Minimum 1 minute
};

/**
 * Format a date nicely like "January 20, 2025"
 */
export const formatBlogDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

/**
 * Format date shorter like "Jan 20, 2025"
 */
export const formatBlogDateShort = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

/**
 * Get blog post metadata (without full content) for listing pages
 */
export const getBlogPostMeta = (post: BlogPost): BlogPostMeta => {
  const { content, ...meta } = post;
  return meta;
};

/**
 * Extract table of contents from markdown content
 * Finds all headings (## and ###) and creates navigation links
 */
export const extractTableOfContents = (content: string): TableOfContentsItem[] => {
  const headingRegex = /^(#{2,3})\s+(.+)$/gm;
  const toc: TableOfContentsItem[] = [];
  let match;

  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length; // 2 for ##, 3 for ###
    const text = match[2].trim();
    // Create URL-friendly ID from heading text
    const id = text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");

    toc.push({ id, text, level });
  }

  return toc;
};

/**
 * Search blog posts by query
 * Searches in title, description, and content
 */
export const searchBlogPosts = (posts: BlogPost[], query: string): BlogPost[] => {
  if (!query.trim()) return posts;
  
  const searchTerms = query.toLowerCase().trim().split(/\s+/);
  
  return posts.filter((post) => {
    const searchableText = `${post.title} ${post.description} ${post.content} ${post.tags.join(" ")}`.toLowerCase();
    return searchTerms.every((term) => searchableText.includes(term));
  });
};

/**
 * Filter blog posts by tag
 */
export const filterByTag = (posts: BlogPost[], tag: string): BlogPost[] => {
  if (!tag || tag === "All") return posts;
  return posts.filter((post) => post.tags.includes(tag));
};

/**
 * Sort blog posts by date (newest first)
 */
export const sortByDate = (posts: BlogPost[]): BlogPost[] => {
  return [...posts].sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateB - dateA;
  });
};

/**
 * Get featured posts (for hero section)
 */
export const getFeaturedPosts = (posts: BlogPost[]): BlogPost[] => {
  return posts.filter((post) => post.featured);
};

/**
 * Get related posts based on shared tags
 */
export const getRelatedPosts = (
  currentPost: BlogPost,
  allPosts: BlogPost[],
  limit: number = 3
): BlogPost[] => {
  const otherPosts = allPosts.filter((post) => post.slug !== currentPost.slug);
  
  // Score posts by number of shared tags
  const scored = otherPosts.map((post) => {
    const sharedTags = post.tags.filter((tag) => currentPost.tags.includes(tag));
    return { post, score: sharedTags.length };
  });
  
  // Sort by score (most related first), then by date
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return new Date(b.post.date).getTime() - new Date(a.post.date).getTime();
  });
  
  return scored.slice(0, limit).map((item) => item.post);
};

/**
 * Get all unique tags from posts with counts
 */
export const getTagsWithCounts = (posts: BlogPost[]): Array<{ tag: string; count: number }> => {
  const tagCounts: Record<string, number> = {};
  
  posts.forEach((post) => {
    post.tags.forEach((tag) => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });
  
  return Object.entries(tagCounts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
};

/**
 * Generate canonical URL for a blog post
 */
export const getBlogCanonicalUrl = (slug: string): string => {
  return `https://viketa.xyz/blog/${slug}`;
};

/**
 * Generate blog list canonical URL
 */
export const getBlogListCanonicalUrl = (): string => {
  return "https://viketa.xyz/blog";
};
