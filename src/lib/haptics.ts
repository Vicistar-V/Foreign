/**
 * Centralized haptic feedback utility for mobile devices
 * Provides different vibration patterns for various interactions
 */

type VibrationPattern = number | number[];

const vibrate = (pattern: VibrationPattern): void => {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
};

/**
 * Haptic feedback patterns for different interaction types
 */
export const haptics = {
  /** Light tap - keypad buttons, small interactive elements */
  light: () => vibrate(10),
  
  /** Medium tap - form submissions, step completions */
  medium: () => vibrate(20),
  
  /** Heavy tap - confirmations, important actions */
  heavy: () => vibrate(50),
  
  /** Success pattern - double tap for positive feedback */
  success: () => vibrate([10, 50, 10]),
  
  /** Error pattern - stronger feedback for errors */
  error: () => vibrate([50, 30, 50]),
};

export type HapticType = keyof typeof haptics;

/**
 * Trigger haptic feedback by type
 */
export const triggerHaptic = (type: HapticType = 'light'): void => {
  haptics[type]();
};
