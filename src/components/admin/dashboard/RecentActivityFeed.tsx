import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Activity, ArrowUpRight, ArrowDownRight, Award, UserPlus, Wallet, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fmtTimeAgo } from '@/lib/formatLagos';
import { AvatarPreviewDrawer } from '@/components/results/AvatarPreviewDrawer';
import { useNavigate } from 'react-router-dom';

interface RecentActivityItem {
  id: string;
  type: string;
  amount: number;
  description: string;
  timestamp: string;
  status: string;
  user: { full_name: string; avatar_url: string | null; user_id?: string };
}

interface RecentActivityFeedProps {
  activities: RecentActivityItem[];
  isLoading?: boolean;
}

export function RecentActivityFeed({ activities, isLoading }: RecentActivityFeedProps) {
  const navigate = useNavigate();
  const [previewUser, setPreviewUser] = useState<{ name: string; avatar: string | null } | null>(null);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-2 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Helper to get icon based on transaction type
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'deposit':
        return ArrowDownRight;
      case 'withdrawal':
        return ArrowUpRight;
      case 'membership_fee':
      case 'membership_bonus':
        return UserPlus;
      case 'referral_payout':
        return Award;
      default:
        return Wallet;
    }
  };

  // Helper to get color based on transaction type
  const getActivityColor = (type: string, amount: number) => {
    if (type === 'membership_bonus' || type === 'referral_payout') {
      return 'text-accent-green bg-accent-green/10';
    }
    if (type === 'withdrawal') {
      return 'text-accent-orange bg-accent-orange/10';
    }
    if (type === 'deposit') {
      return 'text-primary bg-primary/10';
    }
    if (amount < 0) {
      return 'text-destructive bg-destructive/10';
    }
    return 'text-muted-foreground bg-muted';
  };

  // Helper to format transaction type for display
  const formatType = (type: string) => {
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No recent activity
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[280px] px-4 pb-4">
          <div className="space-y-3">
            {activities.map((activity) => {
              const Icon = getActivityIcon(activity.type);
              const colorClass = getActivityColor(activity.type, activity.amount);
              
              return (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 py-2 border-b border-border last:border-0"
                >
                  {/* Icon */}
                  <div className={cn("p-1.5 rounded-full flex-shrink-0", colorClass)}>
                    <Icon className="h-3 w-3" />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Avatar 
                        className="h-5 w-5 cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                        onClick={() => setPreviewUser({ name: activity.user.full_name, avatar: activity.user.avatar_url })}
                      >
                        <AvatarImage src={activity.user.avatar_url || undefined} />
                        <AvatarFallback className="text-[9px]">
                          {activity.user.full_name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <button
                        onClick={() => {
                          if (activity.user.user_id) {
                            navigate(`/admin/users/${activity.user.user_id}?from=dashboard`);
                          }
                        }}
                        className={`text-xs font-medium truncate text-left ${activity.user.user_id ? 'hover:text-primary hover:underline cursor-pointer' : ''}`}
                        disabled={!activity.user.user_id}
                      >
                        {activity.user.full_name}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {activity.description || formatType(activity.type)}
                    </p>
                  </div>
                  
                  {/* Amount & Time */}
                  <div className="text-right flex-shrink-0">
                    <p className={cn(
                      "text-xs font-semibold tabular-nums",
                      activity.amount >= 0 ? "text-success" : "text-destructive"
                    )}>
                      {activity.amount >= 0 ? '+' : ''}₦{Math.abs(activity.amount).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-muted-foreground tabular-nums">
                      {fmtTimeAgo(activity.timestamp)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
        
        {/* Avatar Preview Drawer */}
        <AvatarPreviewDrawer
          isOpen={!!previewUser}
          onClose={() => setPreviewUser(null)}
          name={previewUser?.name || ''}
          avatarUrl={previewUser?.avatar}
        />
      </CardContent>
    </Card>
  );
}
