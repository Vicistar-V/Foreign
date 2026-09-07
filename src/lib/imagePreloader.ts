// Image preloading utility with cache management
const imageCache = new Set<string>();

export const preloadImage = (url: string): Promise<void> => {
  if (!url || imageCache.has(url)) return Promise.resolve();
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageCache.add(url);
      resolve();
    };
    img.onerror = reject;
    img.src = url;
  });
};

export const preloadImages = (urls: (string | null | undefined)[]): void => {
  urls.filter(Boolean).forEach(url => preloadImage(url as string));
};

export const isImageCached = (url: string): boolean => imageCache.has(url);
