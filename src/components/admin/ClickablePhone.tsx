import { openWhatsAppChat } from '@/lib/whatsappUtils';
import { FaWhatsapp } from 'react-icons/fa';

interface ClickablePhoneProps {
  phone: string | null | undefined;
  className?: string;
}

/**
 * Displays a phone number that opens WhatsApp when clicked
 * Shows "No phone" in muted style if no number provided
 */
export const ClickablePhone = ({ phone, className = '' }: ClickablePhoneProps) => {
  if (!phone) {
    return (
      <span className={`text-muted-foreground ${className}`}>
        No phone
      </span>
    );
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    openWhatsAppChat(phone);
  };

  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center gap-1.5 text-success hover:text-success hover:underline cursor-pointer transition-colors ${className}`}
      title="Open WhatsApp chat"
    >
      <span>{phone}</span>
      <FaWhatsapp className="h-3.5 w-3.5" />
    </button>
  );
};
