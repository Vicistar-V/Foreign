// Blog Content - Re-exports from individual post files
// 
// This file now imports from src/content/blog/ where each post
// has its own separate file for easy editing.
// 
// TO ADD A NEW BLOG POST:
// 1. Go to src/content/blog/
// 2. Create a new .ts file (copy from existing one)
// 3. Write your article
// 4. Add it to src/content/blog/index.ts
// 
// See src/content/blog/index.ts for detailed instructions.

// Re-export everything from the blog content folder
export {
  blogPosts,
  getAllBlogPosts,
  getBlogPostBySlug,
  getBlogPostCount,
  getFeaturedPosts,
  getPostsByTag,
} from "@/content/blog";
