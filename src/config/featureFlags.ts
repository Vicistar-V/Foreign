/**
 * Feature Flags - Simple toggles for showing/hiding features
 * 
 * Toggle these to true to show the feature, false to hide
 * These are code-level toggles (not from database)
 */

export const FEATURE_FLAGS = {
  /**
   * Show winners/results pages in navigation
   * Set to true when you have enough users to display
   */
  SHOW_WINNERS_NAV: false,
  
  /**
   * Show results link in sidebar for logged-in users
   */
  SHOW_RESULTS_NAV: false,
} as const;
