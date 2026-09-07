import { useState, useEffect, useRef, useCallback } from 'react';

type ScrollDirection = 'up' | 'down' | null;

interface UseScrollDirectionOptions {
  threshold?: number; // Minimum scroll distance to trigger direction change
  initialVisible?: boolean;
  debounceMs?: number; // Debounce time to prevent flickering
}

export function useScrollDirection(options: UseScrollDirectionOptions = {}) {
  const { 
    threshold = 10, 
    initialVisible = true,
    debounceMs = 100 
  } = options;
  
  const [isVisible, setIsVisible] = useState(initialVisible);
  const [scrollDirection, setScrollDirection] = useState<ScrollDirection>(null);
  
  // Refs for tracking scroll state without causing re-renders
  const lastScrollY = useRef(0);
  const lastDirection = useRef<ScrollDirection>(null);
  const directionChangeY = useRef(0); // Y position when direction changed
  const isAtBoundary = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibilityLock = useRef(false); // Prevents rapid visibility changes
  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateVisibility = useCallback((visible: boolean) => {
    // If locked, queue the change
    if (visibilityLock.current) return;
    
    // Lock visibility changes for debounceMs
    visibilityLock.current = true;
    setIsVisible(visible);
    
    if (lockTimer.current) {
      clearTimeout(lockTimer.current);
    }
    lockTimer.current = setTimeout(() => {
      visibilityLock.current = false;
    }, debounceMs);
  }, [debounceMs]);

  useEffect(() => {
    // Get the scrollable container (main content area)
    const scrollContainer = document.querySelector('main.overflow-y-auto') as HTMLElement | null;
    const scrollTarget = scrollContainer || window;
    
    const getScrollY = (): number => {
      if (scrollContainer) {
        return scrollContainer.scrollTop;
      }
      return window.scrollY;
    };
    
    const getMaxScrollY = (): number => {
      if (scrollContainer) {
        return scrollContainer.scrollHeight - scrollContainer.clientHeight;
      }
      return document.documentElement.scrollHeight - window.innerHeight;
    };
    
    const handleScroll = () => {
      // Clear any pending debounce
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      
      debounceTimer.current = setTimeout(() => {
        const currentScrollY = getScrollY();
        const maxScrollY = getMaxScrollY();
        
        // Detect if we're at scroll boundaries (top or bottom)
        const atTop = currentScrollY <= 5;
        const atBottom = currentScrollY >= maxScrollY - 5;
        
        // If at boundary, always show nav and skip direction detection
        if (atTop) {
          updateVisibility(true);
          setScrollDirection(null);
          lastScrollY.current = currentScrollY;
          isAtBoundary.current = true;
          return;
        }
        
        // At bottom - show nav but don't flicker
        if (atBottom) {
          if (!isAtBoundary.current) {
            // First time hitting bottom - keep current visibility
            isAtBoundary.current = true;
          }
          lastScrollY.current = currentScrollY;
          return;
        }
        
        // We were at boundary but now we're not
        if (isAtBoundary.current) {
          isAtBoundary.current = false;
          lastScrollY.current = currentScrollY;
          directionChangeY.current = currentScrollY;
          return;
        }
        
        const diff = currentScrollY - lastScrollY.current;
        
        // Need more than threshold movement to register direction
        if (Math.abs(diff) < threshold) {
          return;
        }
        
        const newDirection: ScrollDirection = diff > 0 ? 'down' : 'up';
        
        // Direction changed - reset tracking point
        if (newDirection !== lastDirection.current) {
          lastDirection.current = newDirection;
          directionChangeY.current = currentScrollY;
          setScrollDirection(newDirection);
        }
        
        // Calculate total distance scrolled in current direction
        const distanceInDirection = Math.abs(currentScrollY - directionChangeY.current);
        
        // Need to scroll at least 2x threshold in same direction to change visibility
        // This creates "hysteresis" and prevents flickering
        const hysteresisThreshold = threshold * 2;
        
        if (distanceInDirection >= hysteresisThreshold) {
          if (newDirection === 'down' && currentScrollY > 50) {
            updateVisibility(false);
          } else if (newDirection === 'up') {
            updateVisibility(true);
          }
        }
        
        lastScrollY.current = currentScrollY;
      }, 16); // ~1 frame debounce for smooth handling
    };

    // Initialize lastScrollY
    lastScrollY.current = getScrollY();

    // Use passive listener for better performance
    scrollTarget.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      scrollTarget.removeEventListener('scroll', handleScroll);
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      if (lockTimer.current) {
        clearTimeout(lockTimer.current);
      }
    };
  }, [threshold, debounceMs, updateVisibility]);

  return { isVisible, scrollDirection };
}
