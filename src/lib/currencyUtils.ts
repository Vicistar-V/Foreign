/**
 * Currency Utility Functions
 * 
 * Formatting utilities for displaying Naira amounts in the Viketa system.
 */

// Default fee fallbacks (used when platform config is not available).
// FLAT PRICING: every ad share costs the same — ₦5,000 — and every share
// pays ₦10,000. Clean 2X on 1 share, 3 shares, 10 shares. No discounts.
export const DEFAULT_ENTRY_FEE = 5000;
export const DEFAULT_EXTENSION_SPOT_PRICE = 5000;
export const DEFAULT_PAYOUT_PER_SPOT = 10000;

/**
 * Format transaction amount for display
 * All amounts are shown in Naira
 */
export function formatTransactionAmount(
  amount: number, 
  walletType: string, 
  entryFee: number = DEFAULT_ENTRY_FEE,
  options?: { showSign?: boolean }
): string {
  const absAmount = Math.abs(amount);
  const sign = options?.showSign ? (amount >= 0 ? '+' : '-') : '';
  
  return `${sign}₦${absAmount.toLocaleString()}`;
}

/**
 * Format Naira amount for display
 */
export function formatNaira(amount: number, options?: { showSign?: boolean }): string {
  const absAmount = Math.abs(amount);
  const sign = options?.showSign ? (amount >= 0 ? '+' : '-') : '';
  
  return `${sign}₦${absAmount.toLocaleString()}`;
}
