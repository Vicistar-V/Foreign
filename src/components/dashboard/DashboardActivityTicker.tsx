import { useState } from 'react';
import { useLiveActivity, LiveActivityEvent } from '@/hooks/useLiveActivity';
import { AvatarPreviewDrawer } from '@/components/results/AvatarPreviewDrawer';
import { UserAvatar } from '@/components/results/UserAvatar';
import { Zap, Gift, TrendingUp, Rocket, Banknote } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export function DashboardActivityTicker() {
  const { data: events = [], isLoading } = useLiveActivity();
  const [selectedEvent, setSelectedEvent] = useState<LiveActivityEvent | null>(null);

  // Don't render if no events
  if (isLoading || events.length === 0) {
    return null;
  }

  // Duplicate events for seamless infinite scroll
  const duplicatedEvents = [...events, ...events];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'payout':
        return <TrendingUp className="h-3 w-3 text-emerald-500" />;
      case 'activation':
        return <Zap className="h-3 w-3 text-amber-500" />;
      case 'referral':
        return <Gift className="h-3 w-3 text-purple-500" />;
      case 'withdrawal':
        return <Banknote className="h-3 w-3 text-green-500" />;
      default:
        return <Zap className="h-3 w-3 text-primary" />;
    }
  };

  const formatTime = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: false });
    } catch {
      return '';
    }
  };

  return (
    <>
      <div className="sticky top-0 z-30 relative overflow-hidden bg-background">
        {/* Gradient fade edges */}
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

        {/* Scrolling container */}
        <div className="py-2.5 overflow-hidden">
          <div 
            className="flex gap-4 animate-scroll"
            style={{
              width: 'max-content',
            }}
          >
            {duplicatedEvents.map((event, index) => (
              <button
                key={`${event.id}-${index}`}
                onClick={() => setSelectedEvent(event)}
                className="flex items-center gap-2 px-3 py-1 rounded-full bg-card/50 border border-border/30 hover:bg-card hover:border-border transition-all duration-200 shrink-0"
              >
                {/* Avatar */}
                <div className="relative">
                  <UserAvatar
                    avatarUrl={event.avatarUrl}
                    name={event.firstName}
                    size="sm"
                  />
                </div>

                {/* Activity details */}
                <div className="flex items-center gap-1.5">
                  {getActivityIcon(event.type)}
                  <span className="text-xs font-medium text-foreground whitespace-nowrap">
                    {event.message}
                  </span>
                </div>

                {/* Time */}
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {formatTime(event.timestamp)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Avatar Preview Drawer */}
      <AvatarPreviewDrawer
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        avatarUrl={selectedEvent?.avatarUrl || null}
        name={selectedEvent?.firstName || 'User'}
        amount={selectedEvent?.type === 'payout' || selectedEvent?.type === 'referral' || selectedEvent?.type === 'withdrawal'
          ? selectedEvent.amount 
          : undefined
        }
      />

      {/* CSS for infinite scroll animation */}
      <style>{`
        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-scroll {
          animation: scroll 90s linear infinite;
        }
        .animate-scroll:hover {
          animation-play-state: paused;
        }
      `}</style>
    </>
  );
}
