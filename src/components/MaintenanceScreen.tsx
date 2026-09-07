import { Card } from '@/components/ui/card';
import { Wrench } from 'lucide-react';

export const MaintenanceScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
    <Card className="max-w-md p-8 text-center">
      <div className="flex justify-center mb-4">
        <div className="p-4 rounded-full bg-accent-orange/10">
          <Wrench className="h-16 w-16 text-accent-orange" />
        </div>
      </div>
      <h1 className="text-2xl font-bold mb-2">Under Maintenance</h1>
      <p className="text-muted-foreground mb-4">
        We're making improvements to serve you better. 
        Please check back in a few minutes.
      </p>
      <div className="text-sm text-muted-foreground">
        Thank you for your patience
      </div>
    </Card>
  </div>
);
