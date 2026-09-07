import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { haptics } from '@/lib/haptics';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const toggleTheme = (event: React.MouseEvent<HTMLButtonElement>) => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    const goingToDark = newTheme === 'dark';
    
    // Haptic feedback on mobile
    haptics.light();
    
    // Get exact click position from the event
    const x = event.clientX;
    const y = event.clientY;

    // Calculate the maximum radius needed to cover the entire screen
    const maxX = Math.max(x, window.innerWidth - x);
    const maxY = Math.max(y, window.innerHeight - y);
    const radius = Math.sqrt(maxX * maxX + maxY * maxY);

    // Check if View Transitions API is supported and motion is allowed
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    if (!document.startViewTransition || prefersReducedMotion) {
      setTheme(newTheme);
      return;
    }

    // Add class to control z-index stacking for animation direction
    if (goingToDark) {
      document.documentElement.classList.add('theme-transition-dark');
    }

    // Start the view transition with circular clip-path animation
    const transition = document.startViewTransition(() => {
      setTheme(newTheme);
    });

    transition.ready.then(() => {
      if (goingToDark) {
        // DARK MODE: Darkness closes in - OLD view (light) shrinks to click point
        document.documentElement.animate(
          {
            clipPath: [
              `circle(${radius}px at ${x}px ${y}px)`,
              `circle(0px at ${x}px ${y}px)`
            ],
          },
          {
            duration: 500,
            easing: 'ease-in-out',
            pseudoElement: '::view-transition-old(root)',
          }
        );
      } else {
        // LIGHT MODE: Light spreads out - NEW view (light) expands from click point
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${radius}px at ${x}px ${y}px)`
            ],
          },
          {
            duration: 500,
            easing: 'ease-in-out',
            pseudoElement: '::view-transition-new(root)',
          }
        );
      }
    });

    // Clean up class after transition
    transition.finished.then(() => {
      document.documentElement.classList.remove('theme-transition-dark');
    });
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="h-9 w-9"
      aria-label="Toggle theme"
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  );
}
