import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
}

interface AnimatedProgressProps {
  value: number;
  variant?: 'default' | 'active' | 'primary' | 'muted';
  className?: string;
  showShimmer?: boolean;
  showParticles?: boolean;
}

export function AnimatedProgress({ 
  value, 
  variant = 'default',
  className,
  showShimmer = true,
  showParticles = true
}: AnimatedProgressProps) {
  const clampedValue = Math.min(100, Math.max(0, value));
  const [particles, setParticles] = useState<Particle[]>([]);
  
  // Generate particles on mount
  useEffect(() => {
    if (!showParticles || clampedValue === 0) return;
    
    const particleCount = variant === 'active' ? 6 : variant === 'primary' ? 4 : 2;
    const newParticles: Particle[] = Array.from({ length: particleCount }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      delay: Math.random() * 2
    }));
    setParticles(newParticles);
  }, [showParticles, variant, clampedValue]);
  
  const variantStyles = {
    default: 'bg-muted-foreground/40',
    active: 'bg-gradient-to-r from-amber-500 to-amber-400',
    primary: 'bg-gradient-to-r from-primary to-primary/80',
    muted: 'bg-muted-foreground/30'
  };

  const shimmerOpacity = {
    default: 'via-white/15',
    active: 'via-white/40',
    primary: 'via-white/30',
    muted: 'via-white/10'
  };

  const particleColor = {
    default: 'bg-white/40',
    active: 'bg-amber-200',
    primary: 'bg-primary-foreground/80',
    muted: 'bg-white/20'
  };

  return (
    <div className={cn("relative h-2 w-full rounded-full bg-secondary overflow-hidden", className)}>
      {/* Filled portion */}
      <div 
        className={cn(
          "h-full rounded-full transition-all duration-500 ease-out relative overflow-hidden",
          variantStyles[variant],
          variant === 'active' && 'animate-pulse'
        )}
        style={{ width: `${clampedValue}%` }}
      >
        {/* Shimmer overlay - always animating */}
        {showShimmer && clampedValue > 0 && (
          <div 
            className={cn(
              "absolute inset-0 bg-gradient-to-r from-transparent to-transparent",
              shimmerOpacity[variant],
              "animate-shimmer"
            )}
            style={{
              backgroundSize: '200% 100%',
            }}
          />
        )}
        
        {/* Floating particles */}
        {showParticles && clampedValue > 10 && particles.map((particle) => (
          <div
            key={particle.id}
            className={cn(
              "absolute rounded-full animate-float opacity-80",
              particleColor[variant]
            )}
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              animationDelay: `${particle.delay}s`,
              animationDuration: `${2 + particle.delay}s`
            }}
          />
        ))}
        
        {/* Extra glow for active variant */}
        {variant === 'active' && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-300/20 to-transparent animate-shimmer" />
        )}
      </div>
      
      {/* Subtle glow underneath for active/primary */}
      {(variant === 'active' || variant === 'primary') && clampedValue > 0 && (
        <div 
          className={cn(
            "absolute top-0 left-0 h-full rounded-full blur-sm opacity-50",
            variant === 'active' ? 'bg-amber-500' : 'bg-primary'
          )}
          style={{ width: `${clampedValue}%` }}
        />
      )}
    </div>
  );
}
