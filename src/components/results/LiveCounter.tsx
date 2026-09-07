import { useCountUp } from '@/hooks/useCountUp';

interface LiveCounterProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
}

export const LiveCounter = ({ value, duration = 1000, prefix = '', suffix = '' }: LiveCounterProps) => {
  const displayValue = useCountUp({ end: value, duration });

  return (
    <span className="tabular-nums">
      {prefix}{displayValue.toLocaleString()}{suffix}
    </span>
  );
};
