import { useState } from 'react';
import { MachineCard } from './MachineCard';
import { MachineDetailDrawer } from './MachineDetailDrawer';
import { SpotEntry } from '@/hooks/useEarningsTimeline';
import { useAuth } from '@/hooks/useAuth';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MachinesListProps {
  spots: SpotEntry[];
  hasMore?: boolean;
}

export const MachinesList = ({ spots, hasMore }: MachinesListProps) => {
  const { user } = useAuth();
  const [selectedMachine, setSelectedMachine] = useState<SpotEntry | null>(null);

  if (spots.length === 0) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground">
        No ad shares finished yet
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {spots.map((spot, index) => (
          <MachineCard
            key={spot.spot_id}
            spot={spot}
            isOwner={user?.id === spot.owner.user_id}
            index={index}
            onTap={() => setSelectedMachine(spot)}
          />
        ))}
        
        {hasMore && (
          <div className="flex justify-center pt-2">
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1">
              <ChevronDown className="w-3 h-3" />
              More ad shares finished
            </Button>
          </div>
        )}
      </div>

      <MachineDetailDrawer
        spot={selectedMachine}
        isOwner={selectedMachine?.owner.user_id === user?.id}
        onClose={() => setSelectedMachine(null)}
      />
    </>
  );
};
