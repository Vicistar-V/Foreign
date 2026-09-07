import { usePlatformConfig } from './usePlatformConfig';
import {
  SHARE_MESSAGE_HEADLINE,
  buildShareBody,
  buildShareMessage,
} from '@/lib/shareUtils';

/**
 * Returns share-message helpers with profit / minimum-withdrawal values
 * pulled live from platform_config. Use this instead of the raw
 * `buildShareMessage` import wherever a React component is involved.
 */
export const useShareMessage = () => {
  const { data: config } = usePlatformConfig();

  const profit = Number(config?.drop_profit_amount_subsequent ?? 900);
  const minWithdrawal = Number(config?.minimum_withdrawal ?? 5000);

  return {
    headline: SHARE_MESSAGE_HEADLINE,
    body: buildShareBody(profit, minWithdrawal),
    /** Full message including link */
    build: (link: string) => buildShareMessage(link, profit, minWithdrawal),
    /** Headline + body without link (for ShareOptionsDrawer which appends url itself) */
    headlineAndBody: `${SHARE_MESSAGE_HEADLINE}\n\n${buildShareBody(profit, minWithdrawal)}`,
    profit,
    minWithdrawal,
  };
};
