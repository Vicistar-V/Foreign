import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UniqueEarner } from '@/hooks/useEarningsTimeline';
import { TrendingUp, Cpu, Star } from 'lucide-react';

interface PersonDetailDrawerProps {
  person: UniqueEarner | null;
  isCurrentUser?: boolean;
  onClose: () => void;
}

export const PersonDetailDrawer = ({ person, isCurrentUser, onClose }: PersonDetailDrawerProps) => {
  if (!person) return null;

  const initials = person.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <Drawer open={!!person} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="text-center pb-0">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <Avatar className="w-20 h-20 border-4 border-primary/20">
                <AvatarImage src={person.avatar_url || undefined} alt={person.full_name} />
                <AvatarFallback className="bg-muted text-muted-foreground text-xl font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              {isCurrentUser && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
                  YOU
                </div>
              )}
            </div>
            <DrawerTitle className="text-lg font-semibold">
              {person.full_name}
            </DrawerTitle>
          </div>
        </DrawerHeader>

        <div className="p-6 space-y-4">
          {/* Today's Earnings */}
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Earned Today</p>
                <p className="text-xl font-bold text-emerald-500">
                  ₦{person.total_earned_today.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Spots Count */}
          <div className="rounded-xl bg-muted/50 border border-border/50 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Cpu className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Active Spots</p>
                <p className="text-lg font-semibold text-foreground">
                  {person.spots_count} {person.spots_count === 1 ? 'spot' : 'spots'}
                </p>
              </div>
            </div>
          </div>

          {/* Badge */}
          {person.spots_count >= 3 && (
            <div className="flex items-center justify-center gap-2 py-3">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span className="text-sm font-medium text-amber-500">Power Earner</span>
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
