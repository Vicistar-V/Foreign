import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';

interface UserAvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  avatarUrl?: string | null;
  onClick?: () => void;
}

const getColorFromName = (name: string): string => {
  const colors = [
    'bg-destructive',
    'bg-accent-orange',
    'bg-warning',
    'bg-success',
    'bg-highlight',
    'bg-community',
    'bg-primary',
    'bg-secondary',
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
};

const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
  xl: 'h-28 w-28 text-2xl',
};

export const UserAvatar = ({ name, size = 'md', avatarUrl, onClick }: UserAvatarProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const colorClass = getColorFromName(name);
  const initials = getInitials(name);

  const clickableClasses = onClick 
    ? 'cursor-pointer hover:scale-105 transition-transform duration-200 hover:ring-2 hover:ring-primary/50 animate-avatar-pulse hover:animate-none' 
    : '';

  return (
    <Avatar 
      className={`${sizeClasses[size]} ${clickableClasses}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? `View ${name}'s profile picture` : undefined}
    >
      {avatarUrl && !hasError && (
        <>
          {isLoading && (
            <Skeleton className="absolute inset-0 rounded-full" />
          )}
          <AvatarImage 
            src={avatarUrl} 
            alt={name}
            className="object-cover"
            loading="lazy"
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setHasError(true);
              setIsLoading(false);
            }}
          />
        </>
      )}
      <AvatarFallback className={`${colorClass} text-white font-semibold`}>
        {initials}
      </AvatarFallback>
    </Avatar>
  );
};