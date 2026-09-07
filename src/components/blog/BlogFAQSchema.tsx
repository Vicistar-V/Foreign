// Blog FAQ Schema Component
// Generates JSON-LD FAQ structured data for Google rich snippets
// This helps blog posts appear with expandable FAQ sections in Google search results

import { Helmet } from "react-helmet-async";

interface FAQItem {
  question: string;
  answer: string;
}

interface BlogFAQSchemaProps {
  faqs: FAQItem[];
}

/**
 * Extracts FAQ items from blog content markdown
 * Looks for patterns like:
 * **Q: Question here?**
 * A: Answer here.
 * 
 * OR
 * 
 * ### Q: Question here?
 * Answer here.
 */
export const extractFAQsFromContent = (content: string): FAQItem[] => {
  const faqs: FAQItem[] = [];
  
  // Pattern 1: **Q: Question?**\nA: Answer (common format)
  const pattern1 = /\*\*Q:\s*(.+?)\*\*\s*\n+A:\s*(.+?)(?=\n\n|\n\*\*Q:|\n###|\n##|\n#|$)/gs;
  let match;
  
  while ((match = pattern1.exec(content)) !== null) {
    const question = match[1].trim();
    const answer = match[2].trim().replace(/\n/g, ' ').replace(/\s+/g, ' ');
    if (question && answer) {
      faqs.push({ question, answer });
    }
  }
  
  // Pattern 2: **Question?**\nAnswer (simpler bold format)
  const pattern2 = /\*\*([^*]+\?)\*\*\s*\n+([^*\n#]+)/g;
  
  while ((match = pattern2.exec(content)) !== null) {
    const question = match[1].trim();
    const answer = match[2].trim();
    // Avoid duplicates and ensure it looks like a Q&A
    if (question && answer && !faqs.some(f => f.question === question)) {
      faqs.push({ question, answer });
    }
  }
  
  // Limit to first 10 FAQs for schema (Google recommendation)
  return faqs.slice(0, 10);
};

/**
 * BlogFAQSchema Component
 * Renders JSON-LD FAQ structured data for Google rich snippets
 */
export const BlogFAQSchema = ({ faqs }: BlogFAQSchemaProps) => {
  if (!faqs || faqs.length === 0) {
    return null;
  }
  
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };
  
  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(structuredData)}
      </script>
    </Helmet>
  );
};

/**
 * Convenience component that extracts FAQs from content and renders schema
 */
interface BlogFAQSchemaFromContentProps {
  content: string;
}

export const BlogFAQSchemaFromContent = ({ content }: BlogFAQSchemaFromContentProps) => {
  const faqs = extractFAQsFromContent(content);
  return <BlogFAQSchema faqs={faqs} />;
};

export default BlogFAQSchema;
