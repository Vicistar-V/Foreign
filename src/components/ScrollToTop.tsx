import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    // Scroll window for pages outside AppLayout (login, signup, etc.)
    window.scrollTo(0, 0);
    
    // Scroll the main content area for dashboard pages
    const mainElement = document.querySelector('main');
    if (mainElement) {
      mainElement.scrollTo(0, 0);
    }
  }, [pathname]);

  return null;
};
