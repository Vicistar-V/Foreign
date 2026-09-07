import { useEffect } from 'react';
import { preloadImage } from '@/lib/imagePreloader';

export const useImagePreloader = (avatarUrl?: string | null) => {
  useEffect(() => {
    if (avatarUrl) {
      preloadImage(avatarUrl);
    }
  }, [avatarUrl]);
};
