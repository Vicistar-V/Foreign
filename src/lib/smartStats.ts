/**
 * Smart Stats Utility
 * Returns real numbers when significant (above threshold), otherwise uses believable fallbacks.
 * This ensures social proof always looks good while being truthful when numbers are impressive.
 */

export interface SmartStatConfig {
  realValue: number;
  fallbackValue: number;
  threshold: number; // If realValue >= threshold, use realValue; otherwise use fallback
}

/**
 * Get a smart stat that uses real value if significant, fallback otherwise
 */
export const getSmartStat = (config: SmartStatConfig): { value: number; isReal: boolean } => {
  const { realValue, fallbackValue, threshold } = config;
  
  if (realValue >= threshold) {
    return { value: realValue, isReal: true };
  }
  
  return { value: fallbackValue, isReal: false };
};

/**
 * Smart member count - shows real if >= 100, otherwise shows 5,000+
 */
export const getSmartMemberCount = (realCount: number | undefined): { value: number; isReal: boolean; label: string } => {
  const MEMBER_THRESHOLD = 100;
  const FALLBACK_COUNT = 5000;
  
  if (!realCount) {
    return { value: FALLBACK_COUNT, isReal: false, label: `${FALLBACK_COUNT.toLocaleString()}+ members` };
  }
  
  if (realCount >= MEMBER_THRESHOLD) {
    return { value: realCount, isReal: true, label: `${realCount.toLocaleString()}+ members` };
  }
  
  return { value: FALLBACK_COUNT, isReal: false, label: `${FALLBACK_COUNT.toLocaleString()}+ members` };
};

/**
 * Smart total distributed - shows real if >= ₦50,000, otherwise shows ₦1,000,000+
 */
export const getSmartTotalDistributed = (realAmount: number | undefined): { value: number; isReal: boolean; label: string } => {
  const AMOUNT_THRESHOLD = 50000;
  const FALLBACK_AMOUNT = 1000000;
  
  if (!realAmount) {
    return { value: FALLBACK_AMOUNT, isReal: false, label: `₦${FALLBACK_AMOUNT.toLocaleString()}+` };
  }
  
  if (realAmount >= AMOUNT_THRESHOLD) {
    return { value: realAmount, isReal: true, label: `₦${realAmount.toLocaleString()}` };
  }
  
  return { value: FALLBACK_AMOUNT, isReal: false, label: `₦${FALLBACK_AMOUNT.toLocaleString()}+` };
};

/**
 * Smart winners count - shows real if >= 50, otherwise shows 2,500+
 */
export const getSmartWinnersCount = (realCount: number | undefined): { value: number; isReal: boolean; label: string } => {
  const WINNERS_THRESHOLD = 50;
  const FALLBACK_COUNT = 2500;
  
  if (!realCount) {
    return { value: FALLBACK_COUNT, isReal: false, label: `${FALLBACK_COUNT.toLocaleString()}+ winners` };
  }
  
  if (realCount >= WINNERS_THRESHOLD) {
    return { value: realCount, isReal: true, label: `${realCount.toLocaleString()} winners` };
  }
  
  return { value: FALLBACK_COUNT, isReal: false, label: `${FALLBACK_COUNT.toLocaleString()}+ winners` };
};

/**
 * Smart today's winners - returns real if any exist
 */
export const getSmartTodayWinners = (winners: any[] | undefined): { winners: any[]; hasRealData: boolean } => {
  if (!winners || winners.length === 0) {
    return { winners: [], hasRealData: false };
  }
  
  return { winners, hasRealData: true };
};
