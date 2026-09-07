import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Trophy, Users, RefreshCw } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AvatarPreviewDrawer } from '@/components/results/AvatarPreviewDrawer';
import { useNavigate } from 'react-router-dom';

interface TopPerformersCardProps {
  referrers: Array<{ code: string; name: string; avatar: string | null; count: number; user_id?: string }>;
  cyclers: Array<{ name: string; avatar: string | null; cycles: number; earnings: number; user_id?: string }>;
  isLoading?: boolean;
}

export function TopPerformersCard({ referrers, cyclers, isLoading }: TopPerformersCardProps) {
  const navigate = useNavigate();
  const [previewUser, setPreviewUser] = useState<{ name: string; avatar: string | null } | null>(null);

  if (isLoading) {
    return (
      <Card className="bg-card/50">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const getMedalColor = (index: number) => {
    if (index === 0) return 'text-warning';
    if (index === 1) return 'text-muted-foreground';
    if (index === 2) return 'text-accent-orange';
    return 'text-muted-foreground';
  };

  const handleUserClick = (userId: string | undefined) => {
    if (userId) {
      navigate(`/admin/users/${userId}?from=dashboard`);
    }
  };

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          Top Performers
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="referrers" className="w-full">
          <TabsList className="w-full grid grid-cols-2 h-8 mb-3">
            <TabsTrigger value="referrers" className="text-xs">Referrers</TabsTrigger>
            <TabsTrigger value="cyclers" className="text-xs">Cyclers</TabsTrigger>
          </TabsList>
          
          <TabsContent value="referrers" className="mt-0">
            {referrers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No referrers yet</p>
            ) : (
              <div className="space-y-2">
                {referrers.slice(0, 5).map((referrer, index) => (
                  <div key={referrer.code} className="flex items-center gap-2 bg-muted/30 rounded-lg p-2">
                    <span className={`text-sm font-bold w-5 ${getMedalColor(index)}`}>{index + 1}.</span>
                    <Avatar 
                      className="h-6 w-6 cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                      onClick={() => setPreviewUser({ name: referrer.name, avatar: referrer.avatar })}
                    >
                      <AvatarImage src={referrer.avatar || undefined} />
                      <AvatarFallback className="text-[10px]">
                        {referrer.name?.slice(0, 2).toUpperCase() || '??'}
                      </AvatarFallback>
                    </Avatar>
                    <button
                      onClick={() => handleUserClick(referrer.user_id)}
                      className={`text-sm flex-1 truncate text-left ${referrer.user_id ? 'hover:text-primary hover:underline cursor-pointer' : ''}`}
                      disabled={!referrer.user_id}
                    >
                      {referrer.name || 'Unknown'}
                    </button>
                    <span className="text-xs font-medium text-muted-foreground tabular-nums">{referrer.count} refs</span>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="cyclers" className="mt-0">
            {cyclers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No cycles yet</p>
            ) : (
              <div className="space-y-2">
                {cyclers.slice(0, 5).map((cycler, index) => (
                  <div key={`${cycler.name}-${index}`} className="flex items-center gap-2 bg-muted/30 rounded-lg p-2">
                    <span className={`text-sm font-bold w-5 ${getMedalColor(index)}`}>{index + 1}.</span>
                    <Avatar 
                      className="h-6 w-6 cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                      onClick={() => setPreviewUser({ name: cycler.name, avatar: cycler.avatar })}
                    >
                      <AvatarImage src={cycler.avatar || undefined} />
                      <AvatarFallback className="text-[10px]">
                        {cycler.name?.slice(0, 2).toUpperCase() || '??'}
                      </AvatarFallback>
                    </Avatar>
                    <button
                      onClick={() => handleUserClick(cycler.user_id)}
                      className={`text-sm flex-1 truncate text-left ${cycler.user_id ? 'hover:text-primary hover:underline cursor-pointer' : ''}`}
                      disabled={!cycler.user_id}
                    >
                      {cycler.name || 'Unknown'}
                    </button>
                    <div className="text-xs font-medium flex items-center gap-1 tabular-nums">
                      <RefreshCw className="h-3 w-3" />
                      {cycler.cycles}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
        
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
