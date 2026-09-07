import { STATUS_LABELS, STATUS_COLORS, type TicketStatus } from '@/hooks/useSupportTickets';
import { cn } from '@/lib/utils';

interface TicketStatusBadgeProps {
  status: TicketStatus;
  className?: string;
}

export const TicketStatusBadge = ({ status, className }: TicketStatusBadgeProps) => {
  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium',
      STATUS_COLORS[status],
      className
    )}>
      {STATUS_LABELS[status]}
    </span>
  );
};
