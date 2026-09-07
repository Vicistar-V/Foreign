import { useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface NativePinInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  maxLength?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}

export function NativePinInput({
  value,
  onChange,
  onComplete,
  maxLength = 4,
  disabled = false,
  autoFocus = true,
  className,
}: NativePinInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const focusInput = () => {
    const el = inputRef.current;
    if (!el || disabled) return;
    el.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (!autoFocus || disabled) return;
    const t = setTimeout(focusInput, 100);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus, disabled]);

  const handleChange = (rawValue: string) => {
    const nextValue = rawValue.replace(/\D/g, '').slice(0, maxLength);
    onChange(nextValue);
    if (nextValue.length === maxLength) {
      onComplete?.(nextValue);
    }
  };

  return (
    <div ref={wrapperRef} className={cn('space-y-3', className)} onClick={focusInput}>
      <div
        className={cn(
          'relative rounded-2xl border border-border bg-card px-4 py-5 shadow-sm',
          'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background',
          disabled && 'opacity-60'
        )}
      >
        <div className="flex items-center justify-center gap-3">
          {Array.from({ length: maxLength }).map((_, index) => (
            <div
              key={index}
              className={cn(
                'h-4 w-4 rounded-full transition-all',
                value.length > index ? 'bg-primary scale-110' : 'bg-muted'
              )}
            />
          ))}
        </div>

        <Input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          onChange={(event) => handleChange(event.target.value)}
          maxLength={maxLength}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete="one-time-code"
          className="absolute inset-0 h-full w-full cursor-text border-0 bg-transparent text-transparent caret-transparent opacity-0"
        />
      </div>
    </div>
  );
}
