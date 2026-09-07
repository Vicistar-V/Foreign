import { haptics, triggerHaptic, type HapticType } from '@/lib/haptics';

/**
 * Hook for using haptic feedback in components
 * Provides convenient methods for triggering different haptic patterns
 */
export const useHaptic = () => {
  return {
    /** Light tap - keypad buttons, small interactive elements */
    triggerLight: () => haptics.light(),
    
    /** Medium tap - form submissions, step completions */
    triggerMedium: () => haptics.medium(),
    
    /** Heavy tap - confirmations, important actions */
    triggerHeavy: () => haptics.heavy(),
    
    /** Success pattern - double tap for positive feedback */
    triggerSuccess: () => haptics.success(),
    
    /** Error pattern - stronger feedback for errors */
    triggerError: () => haptics.error(),
    
    /** Trigger by type */
    trigger: (type: HapticType) => triggerHaptic(type),
  };
};
