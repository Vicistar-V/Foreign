import { MessageCircle, AlertTriangle, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { TicketStatusBadge } from './TicketStatusBadge';
import { CATEGORY_ICONS, CATEGORY_LABELS, CATEGORY_COLORS, type SupportTicket } from '@/hooks/useSupportTickets';
import { cn } from '@/lib/utils';
import { fmtTimeAgo, fmtDateTimeLong } from '@/lib/formatLagos';

interface TicketCardProps {
  ticket: SupportTicket;
  onClick: () => void;
  showUser?: boolean;
  onUserClick?: (userId: string) => void;
}

export const TicketCard = ({ ticket, onClick, showUser = false, onUserClick }: TicketCardProps) => {
  const timeAgo = fmtTimeAgo(ticket.updated_at);
  const absoluteTime = fmtDateTimeLong(ticket.updated_at);
  
  const handleUserClick = (e: React.MouseEvent) => {
    if (ticket.user && onUserClick) {
      e.stopPropagation();
      onUserClick(ticket.user.id);
    }
  };

  const Icon = CATEGORY_ICONS[ticket.category];
  const isUrgent = ticket.priority === 'urgent';
  const hasUnread = ticket.unread_count > 0;
  
  return (
    <Card 
      className={cn(
        'p-3 cursor-pointer transition-all hover:shadow-sm active:scale-[0.99] relative overflow-hidden',
        hasUnread && 'border-l-4 border-l-primary bg-primary/5',
        isUrgent && !hasUnread && 'border-l-4 border-l-destructive',
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
          CATEGORY_COLORS[ticket.category],
        )}>
          <Icon className="h-5 w-5" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 mb-1">
            <h3 className={cn(
              'text-sm leading-snug truncate flex-1',
              hasUnread ? 'font-bold text-foreground' : 'font-medium text-foreground',
            )}>
              {ticket.subject}
            </h3>
            {isUrgent && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-destructive/15 text-destructive text-[9px] font-bold uppercase tracking-wider shrink-0">
                <AlertTriangle className="h-2.5 w-2.5" />
                Urgent
              </span>
            )}
          </div>
          
          <p className="text-[11px] text-muted-foreground mb-1.5">
            {CATEGORY_LABELS[ticket.category]}
          </p>
          
          {showUser && ticket.user && (
            <div className="text-[11px] text-muted-foreground mb-2 flex items-center gap-1 min-w-0">
              <span className="shrink-0">From:</span>
              <button
                onClick={handleUserClick}
                className="font-medium text-foreground hover:text-primary transition-colors truncate"
              >
                {ticket.user.full_name}
              </button>
            </div>
          )}
          
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <TicketStatusBadge status={ticket.status} className="px-2 py-0.5 text-[10px]" />
            
            <div className="flex items-center gap-2.5 text-[10px] text-muted-foreground tabular-nums">
              <span className="flex items-center gap-1">
                <MessageCircle className="h-3 w-3" />
                {ticket.message_count}
              </span>
              <span className="flex items-center gap-1" title={absoluteTime}>
                <Clock className="h-3 w-3" />
                {timeAgo}
              </span>
            </div>
          </div>
        </div>
        
        {hasUnread && (
          <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold shrink-0 tabular-nums shadow-sm shadow-primary/30">
            {ticket.unread_count}
          </div>
        )}
      </div>
    </Card>
  );
};
