// PageSEO Component
// Reusable SEO component for all pages using react-helmet-async
// Handles Open Graph, Twitter Card, and basic meta tags

import { Helmet } from "react-helmet-async";

const SITE_URL = "https://viketa.xyz";
const DEFAULT_IMAGE = "/og-image.jpg";
const SITE_NAME = "Viketa";

interface PageSEOProps {
  /** Page title - will be suffixed with "| Viketa" unless it already contains "Viketa" */
  title: string;
  /** Meta description - max 160 characters recommended */
  description: string;
  /** URL path relative to root (e.g., "/winners", "/signup") */
  path?: string;
  /** OG image path - can be relative or absolute URL */
  image?: string;
  /** Content type */
  type?: "website" | "article";
  /** Prevent search engines from indexing this page */
  noIndex?: boolean;
  /** Additional keywords for SEO */
  keywords?: string;
}

export const PageSEO = ({
  title,
  description,
  path = "",
  image = DEFAULT_IMAGE,
  type = "website",
  noIndex = false,
  keywords,
}: PageSEOProps) => {
  // Build absolute URLs
  const fullUrl = `${SITE_URL}${path}`;
  const fullTitle = title.includes("Viketa") ? title : `${title} | Viketa`;
  const imageUrl = image.startsWith("http") ? image : `${SITE_URL}${image}`;

  return (
    <Helmet>
      {/* Basic SEO */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={fullUrl} />
      {keywords && <meta name="keywords" content={keywords} />}

      {/* Open Graph / Facebook / WhatsApp */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:image:width" content="1080" />
      <meta property="og:image:height" content="1080" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_NG" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={fullUrl} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />

      {/* Robots */}
      {noIndex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow" />
      )}
    </Helmet>
  );
};

export default PageSEO;
