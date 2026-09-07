import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNotifications, Notification } from '@/hooks/useNotifications';
import { NotificationItem } from './NotificationItem';
import { SwipeableNotification } from './SwipeableNotification';
import { Link, useNavigate } from 'react-router-dom';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useIsMobile } from '@/hooks/use-mobile';
import { getNotificationRoute } from '@/lib/notificationRoutes';
import { useHaptic } from '@/hooks/useHaptic';

export const NotificationDropdown = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { triggerMedium } = useHaptic();
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead } =
    useNotifications(20, 0);

  // Snapshot unread notifications on open so they don't vanish when auto-marked read
  const [snapshot, setSnapshot] = useState<Notification[]>([]);
  const hasMarkedRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      if (!hasMarkedRef.current) {
        const unread = notifications.filter(n => !n.read_at).slice(0, 5);
        setSnapshot(unread);
        if (unread.length > 0) {
          markAllAsRead();
        }
        hasMarkedRef.current = true;
      }
    } else {
      hasMarkedRef.current = false;
      setSnapshot([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const displayList = isOpen ? snapshot : [];

  const handleNotificationClick = (notification: Notification) => {
    triggerMedium();
    const route = getNotificationRoute(notification);
    if (!notification.read_at) {
      markAsRead([{ id: notification.id, source: notification.source }]);
    }
    setIsOpen(false);
    navigate(route);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-bold">
              {unreadCount > 999 ? '999+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0 z-50 bg-popover">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold text-foreground">New Updates</h3>
        </div>
        <ScrollArea className="h-[400px]">
          {displayList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">All caught up!</p>
            </div>
          ) : (
            <div className="space-y-2 p-2">
              {displayList.map((notification) => (
                isMobile ? (
                  <SwipeableNotification
                    key={notification.id}
                    onSwipe={() => handleNotificationClick(notification)}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <NotificationItem
                      notification={notification}
                      truncate
                      showNavigationHint={false}
                    />
                  </SwipeableNotification>
                ) : (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onNavigate={() => handleNotificationClick(notification)}
                    truncate
                    showNavigationHint={false}
                  />
                )
              ))}
            </div>
          )}
        </ScrollArea>
        <div className="p-3 border-t border-border">
          <Link to="/notifications" onClick={() => setIsOpen(false)}>
            <Button variant="ghost" className="w-full text-sm">
              View All Notifications
            </Button>
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
