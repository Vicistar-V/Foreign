/**
 * Automatic Sitemap Generator
 * 
 * This script generates public/sitemap.xml automatically by:
 * 1. Reading all public routes from src/config/routes.ts
 * 2. Reading all blog posts from src/content/blog/index.ts
 * 3. Combining them into a proper XML sitemap
 * 
 * RUN: npx tsx scripts/generate-sitemap.ts
 * OR: npm run generate:sitemap (after adding to package.json)
 * 
 * This runs automatically on every build!
 */

import * as fs from 'fs';
import * as path from 'path';

// Import routes configuration
import { getPublicRoutes, appRoutes } from '../src/config/routes';

// Import blog posts
import { blogPosts } from '../src/content/blog/index';

// Configuration
const SITE_URL = 'https://viketa.xyz';
const OUTPUT_PATH = path.join(process.cwd(), 'public', 'sitemap.xml');

/**
 * Format date as YYYY-MM-DD for sitemap
 */
const formatDate = (date: Date | string): string => {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

/**
 * Get today's date formatted
 */
const getTodayDate = (): string => {
  return formatDate(new Date());
};

/**
 * Escape special XML characters
 */
const escapeXml = (str: string): string => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

/**
 * Generate a single URL entry for the sitemap
 */
const generateUrlEntry = (
  loc: string,
  lastmod: string,
  changefreq: string,
  priority: number
): string => {
  return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority.toFixed(1)}</priority>
  </url>`;
};

/**
 * Generate the complete sitemap XML
 */
const generateSitemap = (): string => {
  const today = getTodayDate();
  const urls: string[] = [];

  // =============================================
  // 1. Add all public static routes
  // =============================================
  const publicRoutes = getPublicRoutes();
  
  console.log(`📄 Found ${publicRoutes.length} public routes`);
  
  for (const route of publicRoutes) {
    const fullUrl = `${SITE_URL}${route.path}`;
    const urlEntry = generateUrlEntry(
      fullUrl,
      today,
      route.changefreq || 'weekly',
      route.priority || 0.5
    );
    urls.push(urlEntry);
  }

  // =============================================
  // 2. Add all blog posts
  // =============================================
  console.log(`📝 Found ${blogPosts.length} blog posts`);
  
  // Blog post SEO settings
  const blogPostPriority = appRoutes.blogPost.priority || 0.7;
  const blogPostChangefreq = appRoutes.blogPost.changefreq || 'monthly';
  
  for (const post of blogPosts) {
    const fullUrl = `${SITE_URL}/blog/${post.slug}`;
    const lastmod = formatDate(post.date);
    const urlEntry = generateUrlEntry(
      fullUrl,
      lastmod,
      blogPostChangefreq,
      blogPostPriority
    );
    urls.push(urlEntry);
  }

  // =============================================
  // 3. Build final XML
  // =============================================
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

  return xml;
};

/**
 * Main function - generate and save sitemap
 */
const main = () => {
  console.log('\n🗺️  Generating sitemap...\n');
  
  try {
    // Generate the sitemap XML
    const sitemapXml = generateSitemap();
    
    // Ensure public directory exists
    const publicDir = path.dirname(OUTPUT_PATH);
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    
    // Write the sitemap file
    fs.writeFileSync(OUTPUT_PATH, sitemapXml, 'utf-8');
    
    // Count total URLs
    const totalUrls = getPublicRoutes().length + blogPosts.length;
    
    console.log(`\n✅ Sitemap generated successfully!`);
    console.log(`📍 Location: ${OUTPUT_PATH}`);
    console.log(`🔗 Total URLs: ${totalUrls}`);
    console.log(`   - Static pages: ${getPublicRoutes().length}`);
    console.log(`   - Blog posts: ${blogPosts.length}`);
    console.log('');
  } catch (error) {
    console.error('❌ Error generating sitemap:', error);
    process.exit(1);
  }
};

// Run the generator
main();
