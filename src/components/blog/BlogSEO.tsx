// Blog SEO Component
// Handles all meta tags for blog posts using react-helmet-async
// Aligned with PageSEO component for consistency

import { Helmet } from "react-helmet-async";
import { getBlogCanonicalUrl, getBlogListCanonicalUrl } from "@/lib/blogUtils";

const SITE_URL = "https://viketa.xyz";
const SITE_NAME = "Viketa";

interface BlogSEOProps {
  title: string;
  description: string;
  image?: string;
  slug?: string; // If provided, this is a single post page
  type?: "website" | "article";
  publishedDate?: string;
  modifiedDate?: string;
  author?: string;
}

export const BlogSEO = ({
  title,
  description,
  image = "/images/blog/default-og.jpg",
  slug,
  type = "website",
  publishedDate,
  modifiedDate,
  author = "Viketa Team",
}: BlogSEOProps) => {
  const canonicalUrl = slug ? getBlogCanonicalUrl(slug) : getBlogListCanonicalUrl();
  const fullTitle = `${title} | Viketa Blog`;
  const fullImageUrl = image.startsWith("http") ? image : `${SITE_URL}${image}`;
  
  return (
    <Helmet>
      {/* Basic SEO */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />
      
      {/* Open Graph / Facebook / WhatsApp */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={fullImageUrl} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_NG" />
      
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={canonicalUrl} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={fullImageUrl} />
      
      {/* Article specific */}
      {type === "article" && publishedDate && (
        <meta property="article:published_time" content={publishedDate} />
      )}
      {type === "article" && modifiedDate && (
        <meta property="article:modified_time" content={modifiedDate} />
      )}
      {type === "article" && (
        <meta property="article:author" content={author} />
      )}
      
      {/* Additional SEO */}
      <meta name="robots" content="index, follow" />
      <meta name="googlebot" content="index, follow" />
      <meta name="author" content={author} />
    </Helmet>
  );
};
