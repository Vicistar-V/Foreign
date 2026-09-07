import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { 
  Trophy, 
  Shield, 
  Banknote, 
  AlertTriangle, 
  Megaphone, 
  Gift, 
  AlertOctagon, 
  PartyPopper,
  Bell,
  ArrowDownCircle,
  XCircle,
  UserPlus,
  ChevronDown,
  ChevronUp,
  Check,
  ChevronRight,
  MessageSquare,
  type LucideIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { getNotificationRoute } from '@/lib/notificationRoutes';

export interface Notification {
  id: string;
  source: 'notification' | 'admin_notification';
  event_type: string;
  title?: string;
  message?: string;
  event_data: Record<string, any>;
  created_at: string;
  read_at: string | null;
}

interface NotificationItemProps {
  notification: Notification;
  onClick?: () => void;
  onMarkAsRead?: () => void;
  onNavigate?: (path: string) => void;
  truncate?: boolean;
  showMarkReadButton?: boolean;
  alwaysShowMarkReadButton?: boolean;
  showNavigationHint?: boolean;
}

interface NotificationDisplay {
  icon: LucideIcon;
  title: string;
  description: string;
  iconClass: string;
  bgClass: string;
}

// Get icon config based on event type
function getIconConfig(eventType: string): { icon: LucideIcon; iconClass: string; bgClass: string } {
  const configs: Record<string, { icon: LucideIcon; iconClass: string; bgClass: string }> = {
    winner_alert: { icon: Trophy, iconClass: 'text-success', bgClass: 'bg-success/10' },
    refund_notice: { icon: Shield, iconClass: 'text-info', bgClass: 'bg-info/10' },
    withdrawal_complete: { icon: Banknote, iconClass: 'text-success', bgClass: 'bg-success/10' },
    withdrawal_failed: { icon: XCircle, iconClass: 'text-destructive', bgClass: 'bg-destructive/10' },
    debt_warning: { icon: AlertTriangle, iconClass: 'text-warning', bgClass: 'bg-warning/10' },
    chargeback_alert: { icon: AlertOctagon, iconClass: 'text-destructive', bgClass: 'bg-destructive/10' },
    chargeback_detected: { icon: AlertOctagon, iconClass: 'text-destructive', bgClass: 'bg-destructive/10' },
    account_banned: { icon: AlertOctagon, iconClass: 'text-destructive', bgClass: 'bg-destructive/10' },
    admin_message: { icon: Megaphone, iconClass: 'text-primary', bgClass: 'bg-primary/10' },
    welcome: { icon: PartyPopper, iconClass: 'text-primary', bgClass: 'bg-primary/10' },
    membership_bonus: { icon: Gift, iconClass: 'text-success', bgClass: 'bg-success/10' },
    deposit: { icon: ArrowDownCircle, iconClass: 'text-success', bgClass: 'bg-success/10' },
    new_user_signup: { icon: UserPlus, iconClass: 'text-info', bgClass: 'bg-info/10' },
    member_activated: { icon: UserPlus, iconClass: 'text-success', bgClass: 'bg-success/10' },
    distribution_failed: { icon: AlertTriangle, iconClass: 'text-destructive', bgClass: 'bg-destructive/10' },
    system_critical_error: { icon: AlertOctagon, iconClass: 'text-destructive', bgClass: 'bg-destructive/10' },
    ticket_created: { icon: Bell, iconClass: 'text-info', bgClass: 'bg-info/10' },
    ticket_reply: { icon: MessageSquare, iconClass: 'text-primary', bgClass: 'bg-primary/10' },
    ticket_resolved: { icon: Shield, iconClass: 'text-success', bgClass: 'bg-success/10' },
    new_ticket: { icon: MessageSquare, iconClass: 'text-warning', bgClass: 'bg-warning/10' },
    user_reply_on_ticket: { icon: MessageSquare, iconClass: 'text-info', bgClass: 'bg-info/10' },
    cycle_complete: { icon: Trophy, iconClass: 'text-success', bgClass: 'bg-success/10' },
    cycle_joined: { icon: ArrowDownCircle, iconClass: 'text-primary', bgClass: 'bg-primary/10' },
  };

  return configs[eventType] || { icon: Bell, iconClass: 'text-muted-foreground', bgClass: 'bg-muted' };
}

function getNotificationDisplay(notification: Notification): NotificationDisplay {
  const { event_type, event_data, title, message } = notification;
  const iconConfig = getIconConfig(event_type);

  // If notification has direct title/message (new format), use them
  if (title && message) {
    return {
      ...iconConfig,
      title,
      description: message,
    };
  }

  // Legacy fallback for event_data based notifications
  const eventTitle = event_data?.title;
  const eventMessage = event_data?.message;

  if (eventTitle && eventMessage) {
    return {
      ...iconConfig,
      title: eventTitle,
      description: eventMessage,
    };
  }

  // Generate display based on event_type for older notifications
  switch (event_type) {
    case 'winner_alert':
      return {
        ...iconConfig,
        title: `You won ₦${event_data?.amount?.toLocaleString() || '0'}!`,
        description: event_data?.rank ? `Rank #${event_data.rank}` : 'Congratulations!',
      };

    case 'refund_notice':
      return {
        ...iconConfig,
        title: 'Credit Returned',
        description: 'Your credit was returned to your wallet',
      };

    case 'withdrawal_complete':
      return {
        ...iconConfig,
        title: 'Money Sent',
        description: `₦${event_data?.amount?.toLocaleString() || '0'} sent to your bank`,
      };

    case 'withdrawal_failed':
      return {
        ...iconConfig,
        title: 'Withdrawal Failed',
        description: event_data?.message || event_data?.reason || 'Please try again',
      };

    case 'debt_warning':
      return {
        ...iconConfig,
        title: 'Account Alert',
        description: event_data?.reason || event_data?.message || 'Please check your account',
      };

    case 'membership_bonus': {
      const amount = event_data?.amount?.toLocaleString() || '0';
      return {
        ...iconConfig,
        title: `You earned ₦${amount}!`,
        description: event_data?.admin_action 
          ? `Bonus: ${event_data?.reason || 'Thank you!'}`
          : 'Referral bonus credited',
      };
    }

    case 'deposit':
      return {
        ...iconConfig,
        title: `₦${event_data?.amount?.toLocaleString() || '0'} Added`,
        description: 'Your deposit was successful',
      };

    case 'new_user_signup':
      return {
        ...iconConfig,
        title: 'New User Joined',
        description: `${event_data?.user_name || 'Someone'} just signed up`,
      };

    case 'member_activated':
      return {
        ...iconConfig,
        title: 'New Member Activated',
        description: `${event_data?.user_name || 'User'} activated membership`,
      };

    case 'ticket_created':
      return {
        ...iconConfig,
        title: 'Help Request Sent',
        description: event_data?.subject || 'Your help request was received',
      };

    case 'ticket_reply':
      return {
        ...iconConfig,
        title: 'Support Replied',
        description: event_data?.message_preview || 'You have a new reply',
      };

    case 'ticket_resolved':
      return {
        ...iconConfig,
        title: 'Issue Resolved',
        description: event_data?.subject || 'Your request has been resolved',
      };

    case 'admin_message':
      return {
        ...iconConfig,
        title: event_data?.title || 'Message from Team',
        description: event_data?.message || 'You have a new message',
      };

    case 'welcome':
      return {
        ...iconConfig,
        title: 'Welcome!',
        description: event_data?.message || 'Thanks for joining us',
      };

    case 'cycle_complete':
      return {
        ...iconConfig,
        title: 'Campaign Payout!',
        description: `You earned ₦${event_data?.profit?.toLocaleString() || '0'} profit`,
      };

    case 'cycle_joined':
      return {
        ...iconConfig,
        title: 'Ad Share Activated',
        description: `Your campaign is now underway`,
      };

    default:
      return {
        ...iconConfig,
        title: 'Notification',
        description: event_data?.message || 'You have a new update',
      };
  }
}

const TRUNCATE_LENGTH = 60;

export function NotificationItem({ 
  notification, 
  onClick, 
  onMarkAsRead,
  onNavigate,
  truncate = false,
  showMarkReadButton = false,
  alwaysShowMarkReadButton = false,
  showNavigationHint = true
}: NotificationItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { icon: Icon, title, description, iconClass, bgClass } = getNotificationDisplay(notification);
  const isUnread = !notification.read_at;
  const timeAgo = formatDistanceToNow(new Date(notification.created_at), { addSuffix: true });
  
  const isLongDescription = description.length > TRUNCATE_LENGTH;
  const shouldTruncate = truncate && isLongDescription && !isExpanded;
  const displayDescription = shouldTruncate 
    ? `${description.slice(0, TRUNCATE_LENGTH)}...` 
    : description;

  const handleClick = () => {
    if (onNavigate) {
      if (isUnread && onMarkAsRead) {
        onMarkAsRead();
      }
      const route = getNotificationRoute(notification);
      onNavigate(route);
    }
    onClick?.();
  };

  const handleExpandToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleMarkAsRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMarkAsRead?.();
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        'group flex items-start gap-3 p-4 rounded-xl border bg-card transition-all cursor-pointer',
        'hover:shadow-sm hover:border-border/80 active:scale-[0.99]',
        isUnread && 'bg-accent/30'
      )}
    >
      {/* Icon */}
      <div className={cn('p-2.5 rounded-lg flex-shrink-0', bgClass)}>
        <Icon className={cn('h-5 w-5', iconClass)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className={cn(
              'text-sm',
              isUnread ? 'font-semibold' : 'font-medium'
            )}>
              {title}
            </p>
            <p className={cn(
              'text-xs text-muted-foreground mt-1',
              !isExpanded && truncate && 'line-clamp-2'
            )}>
              {displayDescription}
            </p>
            
            {/* Expand/Collapse button for long messages */}
            {truncate && isLongDescription && (
              <button
                onClick={handleExpandToggle}
                className="flex items-center gap-1 text-[11px] text-primary hover:underline mt-1"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="h-3 w-3" />
                    Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3" />
                    Show more
                  </>
                )}
              </button>
            )}
            
            <p className="text-[10px] text-muted-foreground/70 mt-1.5">
              {timeAgo}
            </p>
          </div>
          
          {/* Mark as read button */}
          {(showMarkReadButton || alwaysShowMarkReadButton) && isUnread && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAsRead}
              className={cn(
                "h-7 px-2 text-xs text-muted-foreground hover:text-foreground",
                !alwaysShowMarkReadButton && "opacity-0 group-hover:opacity-100 transition-opacity"
              )}
            >
              <Check className="h-3.5 w-3.5 mr-1" />
              Read
            </Button>
          )}
          
          {/* Navigation hint arrow */}
          {showNavigationHint && onNavigate && !showMarkReadButton && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {isUnread && (
                <div className="w-2 h-2 rounded-full bg-primary" />
              )}
              <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
            </div>
          )}
          
          {/* Unread indicator only */}
          {!showNavigationHint && isUnread && !showMarkReadButton && (
            <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
          )}
        </div>
      </div>
    </div>
  );
}
