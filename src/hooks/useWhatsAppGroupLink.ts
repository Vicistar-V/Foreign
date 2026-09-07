import { useCallback } from 'react';
import { usePlatformConfig } from './usePlatformConfig';

/**
 * Single source of truth for the WhatsApp group link.
 *
 * The link lives in platform_config.whatsapp_group_link and is set by the
 * admin on the Platform Controls page. Nothing in the app should hardcode it.
 */
export const useWhatsAppGroupLink = () => {
  const { data: config, isLoading } = usePlatformConfig();

  const raw = ((config as any)?.whatsapp_group_link as string | null | undefined)?.trim() || '';
  const isRealLink = /^https?:\/\/(chat\.whatsapp\.com|wa\.me|whatsapp\.com)/i.test(raw);
  const link = isRealLink ? raw : null;

  // Admin can hide the "Join our group" card without deleting the link.
  const isPromoEnabled = (config as any)?.whatsapp_group_promo_enabled !== false;

  const openGroup = useCallback(() => {
    if (!link) return false;
    window.open(link, '_blank', 'noopener,noreferrer');
    return true;
  }, [link]);

  return {
    link,
    hasLink: !!link,
    isPromoEnabled,
    /** Show the dashboard promo card only when there is a link AND it is turned on */
    showPromo: !!link && isPromoEnabled,
    isLoading,
    openGroup,
  };
};
