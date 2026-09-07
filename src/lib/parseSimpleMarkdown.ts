/**
 * Simple markdown parser for broadcast messages
 * Keeps it clean and readable - not like a textbook!
 */
export function parseSimpleMarkdown(text: string): string {
  if (!text || typeof text !== 'string') return '';
  
  try {
    let html = text
      // Escape HTML to prevent XSS
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Bold: **text** → <strong>text</strong>
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      // Bullet points: lines starting with • or - (simple inline style)
      .replace(/^[•\-]\s+(.+)$/gm, '→ $1')
      // Paragraph breaks: double newlines
      .replace(/\n\n/g, '<br/><br/>')
      // Single line breaks
      .replace(/\n/g, '<br/>');
    
    return html;
  } catch (error) {
    console.error('Error parsing markdown:', error);
    return text.replace(/\n/g, '<br/>');
  }
}
