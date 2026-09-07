import { Trophy } from 'lucide-react';
import { Card } from '@/components/ui/card';

export const EmptyResultsState = () => {
  return (
    <Card className="p-12 text-center">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted mb-4">
        <Trophy className="w-10 h-10 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-semibold text-foreground mb-2">
        No Payouts Yet
      </h3>
      <p className="text-muted-foreground max-w-md mx-auto">
        No campaigns have finished yet. Check back soon!
      </p>
    </Card>
  );
};
