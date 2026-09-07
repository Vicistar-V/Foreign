// Blog Content Component
// Renders markdown content as beautifully styled HTML
// ENHANCED: Rich visual styling, callout boxes, styled tables, visual hierarchy

import { useMemo, useEffect } from "react";
import { marked } from "marked";

interface BlogContentProps {
  content: string;
}

export const BlogContent = ({ content }: BlogContentProps) => {
  // Configure marked for safe rendering
  useEffect(() => {
    marked.setOptions({
      breaks: true,
      gfm: true,
    });
  }, []);
  
  // Process content to enhance styling
  const processedContent = useMemo(() => {
    let processed = content.trim();
    
    // Remove duplicate H1 (since it's already in the page header)
    // Match H1 at start of content (with possible leading whitespace/newlines)
    processed = processed.replace(/^#\s+[^\n]+\n?/, '');
    
    // Enhance Quick Answer blockquotes with special class
    processed = processed.replace(
      /\*\*Quick Answer:\*\*/g,
      '<span class="blog-quick-answer-label">Quick Answer:</span>'
    );
    
    // Enhance Last Updated with badge styling
    processed = processed.replace(
      /\*\*Last Updated:\*\*\s*([^\n]+)/g,
      '<span class="blog-updated-badge">Last Updated: $1</span>'
    );
    
    // Convert Q: and A: to styled FAQ format
    processed = processed.replace(
      /\*\*Q:\s*([^*]+)\*\*/g,
      '<span class="blog-faq-question">Q: $1</span>'
    );
    processed = processed.replace(
      /A:\s*/g,
      '<span class="blog-faq-answer-label">A:</span> '
    );
    
    // Style red flag items (❌ markers)
    processed = processed.replace(
      /❌\s*\*\*([^*]+)\*\*/g,
      '<span class="blog-red-flag">❌ <strong>$1</strong></span>'
    );
    
    // Style checkmark/success items (✅ markers)
    processed = processed.replace(
      /✅\s*/g,
      '<span class="blog-checkmark">✅</span> '
    );
    
    // Style star ratings (⭐)
    processed = processed.replace(
      /(⭐+)/g,
      '<span class="blog-stars">$1</span>'
    );
    
    // Highlight key statistics (₦ amounts)
    processed = processed.replace(
      /₦([\d,]+)/g,
      '<span class="blog-money">₦$1</span>'
    );
    
    // Enhance percentage callouts
    processed = processed.replace(
      /(\d+)%(?!\))/g,
      '<span class="blog-percentage">$1%</span>'
    );
    
    return processed;
  }, [content]);
  
  // Convert markdown to HTML
  const htmlContent = useMemo(() => {
    return marked.parse(processedContent) as string;
  }, [processedContent]);
  
  // Post-process HTML for additional enhancements
  const enhancedHtml = useMemo(() => {
    let html = htmlContent;
    
    // Add wrapper class to tables for responsive scrolling
    html = html.replace(
      /<table>/g,
      '<div class="blog-table-wrapper"><table>'
    );
    html = html.replace(
      /<\/table>/g,
      '</table></div>'
    );
    
    // Add class to Table of Contents section
    html = html.replace(
      /<h2([^>]*)>Table of Contents<\/h2>\s*<ol>/g,
      '<h2$1 class="blog-toc-title">Table of Contents</h2><ol class="blog-toc-list">'
    );
    
    // Style FAQ section headers
    html = html.replace(
      /<h3([^>]*)>(Basic Questions|About Winning|About Money|About Safety|About Getting Started|Technical Questions|Membership Questions|Trust &amp; Safety|Payment Questions|General Questions|How It Works|Withdrawals|Account Questions|Results|Referral Questions)<\/h3>/g,
      '<h3$1 class="blog-faq-category">$2</h3>'
    );
    
    // Add numbered classes to ordered list items
    html = html.replace(
      /<li>(\[([^\]]+)\]|(\d+\.)\s*\[([^\]]+)\])/g,
      '<li class="blog-toc-item">$1'
    );
    
    return html;
  }, [htmlContent]);
  
  return (
    <article
      className="blog-content prose prose-lg max-w-none
        prose-p:text-foreground/80 prose-p:leading-[1.8] prose-p:mb-5 prose-p:text-[15px] md:prose-p:text-base
        prose-headings:font-bold prose-headings:text-foreground
        prose-h1:hidden
        prose-h2:text-xl md:prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-5 prose-h2:scroll-mt-24
        prose-h2:pl-4 prose-h2:border-l-4 prose-h2:border-primary prose-h2:bg-gradient-to-r prose-h2:from-primary/5 prose-h2:to-transparent
        prose-h2:py-3 prose-h2:rounded-r-lg
        prose-h3:text-lg md:prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-4 prose-h3:scroll-mt-24
        prose-h3:text-foreground/90
        prose-h4:text-base md:prose-h4:text-lg prose-h4:mt-6 prose-h4:mb-3 prose-h4:font-semibold
        prose-strong:text-foreground prose-strong:font-bold
        prose-a:text-primary prose-a:font-medium prose-a:no-underline 
        prose-a:border-b prose-a:border-primary/30 prose-a:transition-all
        hover:prose-a:border-primary hover:prose-a:bg-primary/5
        prose-ul:text-foreground/80 prose-ul:my-5 prose-ul:pl-0 prose-ul:list-none prose-ul:space-y-2
        prose-ol:text-foreground/80 prose-ol:my-5 prose-ol:pl-0 prose-ol:list-none prose-ol:space-y-2
        prose-li:my-0 prose-li:pl-6 prose-li:relative
        prose-blockquote:border-l-4 prose-blockquote:border-primary 
        prose-blockquote:bg-gradient-to-r prose-blockquote:from-primary/10 prose-blockquote:via-primary/5 prose-blockquote:to-transparent
        prose-blockquote:py-4 prose-blockquote:px-5 prose-blockquote:my-8 
        prose-blockquote:rounded-r-xl prose-blockquote:not-italic 
        prose-blockquote:text-foreground prose-blockquote:shadow-soft
        prose-blockquote:relative
        prose-code:bg-muted prose-code:px-2 prose-code:py-1 prose-code:rounded-md 
        prose-code:text-sm prose-code:font-mono prose-code:text-foreground 
        prose-code:before:content-none prose-code:after:content-none
        prose-code:border prose-code:border-border
        prose-pre:bg-muted prose-pre:border prose-pre:border-border 
        prose-pre:rounded-xl prose-pre:p-5 prose-pre:my-8 prose-pre:overflow-x-auto
        prose-pre:shadow-soft
        prose-table:my-0 prose-table:w-full
        prose-th:bg-primary prose-th:text-primary-foreground prose-th:px-4 prose-th:py-3 
        prose-th:text-left prose-th:font-semibold prose-th:text-sm prose-th:uppercase prose-th:tracking-wide
        prose-td:px-4 prose-td:py-3 prose-td:text-foreground/80 prose-td:text-[15px]
        prose-hr:my-12 prose-hr:border-0 prose-hr:h-px
        prose-hr:bg-gradient-to-r prose-hr:from-transparent prose-hr:via-border prose-hr:to-transparent
        prose-img:rounded-2xl prose-img:my-8 prose-img:shadow-medium
      "
      dangerouslySetInnerHTML={{ __html: enhancedHtml }}
    />
  );
};
