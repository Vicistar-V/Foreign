import { useEffect, useState } from 'react';

interface UseCountUpOptions {
  start?: number;
  end: number;
  duration?: number;
  delay?: number;
}

export const useCountUp = ({ 
  start = 0, 
  end, 
  duration = 1000,
  delay = 0 
}: UseCountUpOptions) => {
  const [count, setCount] = useState(start);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    if (delay > 0) {
      const delayTimer = setTimeout(() => setHasStarted(true), delay);
      return () => clearTimeout(delayTimer);
    } else {
      setHasStarted(true);
    }
  }, [delay]);

  useEffect(() => {
    if (!hasStarted) return;

    const startTime = Date.now();
    const difference = end - start;

    const easeOutQuad = (t: number) => t * (2 - t);

    const updateCount = () => {
      const now = Date.now();
      const progress = Math.min((now - startTime) / duration, 1);
      const easedProgress = easeOutQuad(progress);
      
      const currentCount = start + difference * easedProgress;
      setCount(currentCount);

      if (progress < 1) {
        requestAnimationFrame(updateCount);
      } else {
        setCount(end);
      }
    };

    requestAnimationFrame(updateCount);
  }, [hasStarted, start, end, duration]);

  return Math.floor(count);
};
