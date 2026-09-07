/**
 * Referral code storage utilities
 * Manages referral codes in localStorage with 14-day expiry
 */

const REFERRAL_KEY = 'viketa_referral_code';
const REFERRAL_EXPIRY_DAYS = 14;

interface ReferralData {
  code: string;
  expiresAt: number;
}

/**
 * Save referral code to localStorage with 14-day expiry
 */
export const saveReferralCode = (code: string): void => {
  const expiresAt = Date.now() + (REFERRAL_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  const data: ReferralData = {
    code,
    expiresAt
  };
  localStorage.setItem(REFERRAL_KEY, JSON.stringify(data));
};

/**
 * Get referral code from localStorage if not expired
 */
export const getReferralCode = (): string | null => {
  try {
    const stored = localStorage.getItem(REFERRAL_KEY);
    if (!stored) return null;

    const data: ReferralData = JSON.parse(stored);
    
    // Check if expired
    if (Date.now() > data.expiresAt) {
      localStorage.removeItem(REFERRAL_KEY);
      return null;
    }

    return data.code;
  } catch (error) {
    console.error('Error reading referral code:', error);
    return null;
  }
};

/**
 * Clear referral code from localStorage
 */
export const clearReferralCode = (): void => {
  localStorage.removeItem(REFERRAL_KEY);
};