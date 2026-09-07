// Blog Post Types - Simple, grandma-friendly naming
// These define what each blog post contains

/**
 * What each blog post contains
 */
export interface BlogPost {
  /** URL name like "is-viketa-legit" */
  slug: string;
  
  /** The article title "Is Viketa Legit?" */
  title: string;
  
  /** Short summary for Google (under 160 characters) */
  description: string;
  
  /** When it was written "2025-01-20" */
  date: string;
  
  /** When it was last updated (optional) */
  updatedDate?: string;
  
  /** Picture for the post */
  image: string;
  
  /** Categories like ["Money Tips", "Reviews"] */
  tags: string[];
  
  /** How long to read "3 min read" */
  readingTime: number;
  
  /** The actual article content (markdown format) */
  content: string;
  
  /** Is this a featured/highlighted post? */
  featured?: boolean;
  
  /** Author name (defaults to "Viketa Team") */
  author?: string;
  
  /** FAQ items for this post (used for FAQ schema) */
  faqs?: Array<{
    question: string;
    answer: string;
  }>;
}

/**
 * Blog post metadata (without the full content)
 * Used for listing pages to keep things fast
 */
export interface BlogPostMeta {
  slug: string;
  title: string;
  description: string;
  date: string;
  updatedDate?: string;
  image: string;
  tags: string[];
  readingTime: number;
  featured?: boolean;
  author?: string;
}

/**
 * Table of contents entry for blog posts
 */
export interface TableOfContentsItem {
  id: string;
  text: string;
  level: number;
}

/**
 * All available blog tags
 */
export const BLOG_TAGS = [
  "Money Tips",
  "Reviews",
  "Guides",
  "Success Stories",
  "FAQ",
  "News",
  "Referrals",
] as const;

export type BlogTag = typeof BLOG_TAGS[number];
