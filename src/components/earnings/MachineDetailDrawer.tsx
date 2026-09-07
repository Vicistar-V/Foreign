import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SpotEntry } from '@/hooks/useEarningsTimeline';
import { Cpu, User, TrendingUp, Zap } from 'lucide-react';

interface MachineDetailDrawerProps {
  spot: SpotEntry | null;
  isOwner?: boolean;
  onClose: () => void;
}

export const MachineDetailDrawer = ({ spot, isOwner, onClose }: MachineDetailDrawerProps) => {
  if (!spot) return null;

  const ownerInitials = spot.owner.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const lastCycleDate = spot.last_cycle_at ? new Date(spot.last_cycle_at) : null;
  const cycleText = spot.cycles_today === 1 ? '1 payout' : `${spot.cycles_today} payouts`;

  return (
    <Drawer open={!!spot} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="text-center pb-0">
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Cpu className="w-8 h-8 text-primary" />
            </div>
            <div>
              <DrawerTitle className="text-lg font-semibold">
                {spot.spot_name}
              </DrawerTitle>
              {isOwner && (
                <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-medium">
                  Your share
                </span>
              )}
            </div>
          </div>
        </DrawerHeader>

        <div className="p-6 space-y-4">
          {/* Today's Performance */}
          <div className="rounded-xl bg-muted/50 border border-border/50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cycles Today</p>
                  <p className="text-lg font-semibold">{cycleText}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Total Earned</p>
                <p className="text-lg font-bold text-emerald-500">+₦{spot.total_earned_today.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Last Cycle Time */}
          {lastCycleDate && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Last cycle</span>
              <span className="font-medium">
                {lastCycleDate.toLocaleString('en-NG', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          )}

          {/* Owner Section */}
          <div className="pt-4 border-t border-border/50">
            <p className="text-xs text-muted-foreground mb-3">Spot Owner</p>
            <div className="rounded-xl bg-card border border-border/50 p-4">
              <div className="flex items-center gap-3">
                <Avatar className="w-12 h-12 border-2 border-border/50">
                  <AvatarImage src={spot.owner.avatar_url || undefined} />
                  <AvatarFallback className="bg-muted text-muted-foreground text-sm font-medium">
                    {ownerInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium">{spot.owner.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Owns {spot.owner.total_spots} {spot.owner.total_spots === 1 ? 'spot' : 'spots'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
