// Facebook Pixel tracking library for viketa.xyz
// Pixel (dataset) ID: 1580276863536035
// Updated: Aug 2026
export const FB_PIXEL_ID = '2479867182433266';

// Declare fbq on window
declare global {
  interface Window {
    fbq?: (
      command: 'track' | 'init' | 'trackCustom',
      eventOrId: string,
      params?: Record<string, unknown>,
      options?: { eventID?: string }
    ) => void;
    _fbq?: unknown;
  }
}

// Check if we're in production (not localhost or Lovable preview)
const isProduction = (): boolean => {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname.toLowerCase();
  return (
    hostname.indexOf('lovable') === -1 &&
    hostname !== 'localhost' &&
    hostname !== '127.0.0.1'
  );
};

/**
 * Track Facebook PageView event
 * This is called automatically by the base code in index.html
 */
export const trackFBPageView = (): void => {
  if (!isProduction()) {
    console.log('📘 FB Pixel PageView skipped (dev mode)');
    return;
  }
  
  if (window.fbq) {
    window.fbq('track', 'PageView');
    console.log('📘 FB Pixel: PageView tracked');
  }
};

/**
 * Track Facebook Purchase event
 * Called when membership payment is successful
 *
 * @param value - The amount paid (e.g., 1000 for ₦1,000)
 * @param currency - Currency code (default: 'NGN')
 * @param eventID - OPTIONAL stable id (transaction id) for Meta dedup so the
 *                  same purchase never counts twice across pixel + CAPI + retries.
 */
export const trackFBPurchase = (
  value: number,
  currency: string = 'NGN',
  eventID?: string,
): void => {
  if (!isProduction()) {
    console.log(`📘 FB Pixel Purchase skipped (dev mode): ₦${value}${eventID ? ` [id:${eventID}]` : ''}`);
    return;
  }

  if (window.fbq) {
    if (eventID) {
      window.fbq('track', 'Purchase', { value, currency }, { eventID } as any);
    } else {
      window.fbq('track', 'Purchase', { value, currency });
    }
    console.log(`📘 FB Pixel: Purchase tracked - ${currency} ${value}${eventID ? ` [id:${eventID}]` : ''}`);
  }
};

/**
 * Track InitiateCheckout event
 * Called when user starts checkout/payment process
 * 
 * @param value - The amount being checked out (optional)
 * @param currency - Currency code (default: 'NGN')
 */
export function trackFBInitiateCheckout(value?: number, currency?: string): void {
  const curr = currency || 'NGN';
  if (!isProduction()) {
    console.log(`📘 FB Pixel InitiateCheckout skipped (dev mode)${value ? `: ₦${value}` : ''}`);
    return;
  }
  
  if (window.fbq) {
    const params = value ? { value, currency: curr } : undefined;
    window.fbq('track', 'InitiateCheckout', params);
    console.log(`📘 FB Pixel: InitiateCheckout tracked${value ? ` - ${curr} ${value}` : ''}`);
  }
}

/**
 * Track Lead event
 * Can be used when user signs up or shows strong interest
 */
export const trackFBLead = (): void => {
  if (!isProduction()) {
    console.log('📘 FB Pixel Lead skipped (dev mode)');
    return;
  }
  
  if (window.fbq) {
    window.fbq('track', 'Lead');
    console.log('📘 FB Pixel: Lead tracked');
  }
};

/**
 * Track CompleteRegistration event
 * Called when user completes sign up
 */
export const trackFBCompleteRegistration = (): void => {
  if (!isProduction()) {
    console.log('📘 FB Pixel CompleteRegistration skipped (dev mode)');
    return;
  }
  
  if (window.fbq) {
    window.fbq('track', 'CompleteRegistration');
    console.log('📘 FB Pixel: CompleteRegistration tracked');
  }
};

// ============================================
// TEST-ONLY FUNCTIONS (bypass production check)
// Use these ONLY in admin pixel test page
// ============================================

/**
 * Force track PageView (bypasses dev mode check)
 * FOR ADMIN TESTING ONLY
 */
export const forceTrackFBPageView = (): boolean => {
  if (window.fbq) {
    window.fbq('track', 'PageView');
    console.log('📘 FB Pixel: PageView FORCE tracked');
    return true;
  }
  console.warn('📘 FB Pixel: fbq not available');
  return false;
};

/**
 * Force track Purchase (bypasses dev mode check)
 * FOR ADMIN TESTING ONLY
 */
export const forceTrackFBPurchase = (value: number, currency: string = 'NGN'): boolean => {
  if (window.fbq) {
    window.fbq('track', 'Purchase', { value, currency });
    console.log(`📘 FB Pixel: Purchase FORCE tracked - ${currency} ${value}`);
    return true;
  }
  console.warn('📘 FB Pixel: fbq not available');
  return false;
};

/**
 * Force track InitiateCheckout (bypasses dev mode check)
 * FOR ADMIN TESTING ONLY
 */
export const forceTrackFBInitiateCheckout = (value?: number, currency: string = 'NGN'): boolean => {
  if (window.fbq) {
    const params = value ? { value, currency } : undefined;
    window.fbq('track', 'InitiateCheckout', params);
    console.log(`📘 FB Pixel: InitiateCheckout FORCE tracked${value ? ` - ${currency} ${value}` : ''}`);
    return true;
  }
  console.warn('📘 FB Pixel: fbq not available');
  return false;
};

/**
 * Force track Lead (bypasses dev mode check)
 * FOR ADMIN TESTING ONLY
 */
export const forceTrackFBLead = (): boolean => {
  if (window.fbq) {
    window.fbq('track', 'Lead');
    console.log('📘 FB Pixel: Lead FORCE tracked');
    return true;
  }
  console.warn('📘 FB Pixel: fbq not available');
  return false;
};

/**
 * Force track CompleteRegistration (bypasses dev mode check)
 * FOR ADMIN TESTING ONLY
 */
export const forceTrackFBCompleteRegistration = (): boolean => {
  if (window.fbq) {
    window.fbq('track', 'CompleteRegistration');
    console.log('📘 FB Pixel: CompleteRegistration FORCE tracked');
    return true;
  }
  console.warn('📘 FB Pixel: fbq not available');
  return false;
};

// Pre-defined event values for consistency
export const FBPixelEvents = {
  PURCHASE_MEMBERSHIP: { value: 1000, currency: 'NGN' },
} as const;
