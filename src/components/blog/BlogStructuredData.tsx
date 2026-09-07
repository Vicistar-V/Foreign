// Blog Structured Data Component
// JSON-LD schema for Google rich snippets and Google News

import { Helmet } from "react-helmet-async";
import type { BlogPost } from "@/types/blog";
import { getBlogCanonicalUrl } from "@/lib/blogUtils";

interface BlogStructuredDataProps {
  post: BlogPost;
}

export const BlogStructuredData = ({ post }: BlogStructuredDataProps) => {
  const url = getBlogCanonicalUrl(post.slug);
  const imageUrl = post.image.startsWith("http") 
    ? post.image 
    : `https://viketa.xyz${post.image}`;
  
  // Primary Article schema (better for Google News)
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": post.title,
    "description": post.description,
    "image": {
      "@type": "ImageObject",
      "url": imageUrl,
      "width": 1200,
      "height": 630
    },
    "datePublished": post.date,
    "dateModified": post.updatedDate || post.date,
    "author": {
      "@type": "Organization",
      "name": post.author || "Viketa Team",
      "url": "https://viketa.xyz",
      "logo": {
        "@type": "ImageObject",
        "url": "https://viketa.xyz/logo.png"
      }
    },
    "publisher": {
      "@type": "Organization",
      "name": "Viketa",
      "url": "https://viketa.xyz",
      "logo": {
        "@type": "ImageObject",
        "url": "https://viketa.xyz/logo.png",
        "width": 200,
        "height": 200
      }
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": url
    },
    "wordCount": post.content.split(/\s+/).length,
    "articleBody": post.content.replace(/[#*`\[\]]/g, "").substring(0, 500),
    "keywords": post.tags.join(", "),
    "articleSection": post.tags[0] || "Money Tips",
    "inLanguage": "en-NG",
    "isAccessibleForFree": true,
    "copyrightYear": new Date(post.date).getFullYear(),
    "copyrightHolder": {
      "@type": "Organization",
      "name": "Viketa"
    }
  };

  // Breadcrumb schema for navigation
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://viketa.xyz"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Blog",
        "item": "https://viketa.xyz/blog"
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": post.title,
        "item": url
      }
    ]
  };

  // WebPage schema for additional context
  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": url,
    "url": url,
    "name": post.title,
    "description": post.description,
    "isPartOf": {
      "@type": "WebSite",
      "@id": "https://viketa.xyz/#website",
      "name": "Viketa",
      "url": "https://viketa.xyz"
    },
    "primaryImageOfPage": {
      "@type": "ImageObject",
      "url": imageUrl
    },
    "datePublished": post.date,
    "dateModified": post.updatedDate || post.date,
    "breadcrumb": {
      "@id": `${url}#breadcrumb`
    },
    "potentialAction": {
      "@type": "ReadAction",
      "target": url
    },
    "speakable": {
      "@type": "SpeakableSpecification",
      "cssSelector": ["h1", ".blog-content p:first-of-type"]
    }
  };
  
  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(articleSchema)}
      </script>
      <script type="application/ld+json">
        {JSON.stringify(breadcrumbSchema)}
      </script>
      <script type="application/ld+json">
        {JSON.stringify(webPageSchema)}
      </script>
    </Helmet>
  );
};

// Blog List structured data
interface BlogListStructuredDataProps {
  posts: BlogPost[];
}

export const BlogListStructuredData = ({ posts }: BlogListStructuredDataProps) => {
  const blogSchema = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "name": "Viketa Blog - Money Tips & Guides",
    "description": "Tips, guides, and stories to help you win money daily in Nigeria",
    "url": "https://viketa.xyz/blog",
    "publisher": {
      "@type": "Organization",
      "name": "Viketa",
      "url": "https://viketa.xyz",
      "logo": {
        "@type": "ImageObject",
        "url": "https://viketa.xyz/logo.png",
        "width": 200,
        "height": 200
      }
    },
    "inLanguage": "en-NG",
    "blogPost": posts.slice(0, 10).map((post) => ({
      "@type": "BlogPosting",
      "headline": post.title,
      "description": post.description,
      "datePublished": post.date,
      "dateModified": post.updatedDate || post.date,
      "url": getBlogCanonicalUrl(post.slug),
      "image": post.image.startsWith("http") ? post.image : `https://viketa.xyz${post.image}`,
      "author": {
        "@type": "Organization",
        "name": post.author || "Viketa Team"
      }
    }))
  };

  // CollectionPage schema for the blog listing
  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "Viketa Blog - Money Tips & Guides",
    "description": "Tips, guides, and stories to help you win money daily in Nigeria",
    "url": "https://viketa.xyz/blog",
    "isPartOf": {
      "@type": "WebSite",
      "@id": "https://viketa.xyz/#website",
      "name": "Viketa",
      "url": "https://viketa.xyz"
    },
    "breadcrumb": {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": "https://viketa.xyz"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Blog",
          "item": "https://viketa.xyz/blog"
        }
      ]
    }
  };
  
  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(blogSchema)}
      </script>
      <script type="application/ld+json">
        {JSON.stringify(collectionSchema)}
      </script>
    </Helmet>
  );
};
