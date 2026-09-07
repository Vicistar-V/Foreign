/**
 * Format Nigerian phone number for WhatsApp
 * Converts various formats to international format without +
 * 
 * Examples:
 * - 08012345678 → 2348012345678
 * - +2348012345678 → 2348012345678
 * - 2348012345678 → 2348012345678
 */
export const formatPhoneForWhatsApp = (phone: string): string => {
  // Remove spaces, dashes, and plus sign
  let cleaned = phone.replace(/[\s\-+]/g, '');
  
  // If starts with 0, replace with 234 (Nigeria country code)
  if (cleaned.startsWith('0')) {
    cleaned = '234' + cleaned.substring(1);
  }
  
  return cleaned;
};

/**
 * Open WhatsApp chat with the given phone number
 * Opens in a new tab/window
 */
export const openWhatsAppChat = (phone: string, message?: string) => {
  const formattedPhone = formatPhoneForWhatsApp(phone);
  const baseUrl = `https://wa.me/${formattedPhone}`;
  const url = message ? `${baseUrl}?text=${encodeURIComponent(message)}` : baseUrl;
  window.open(url, '_blank');
};
