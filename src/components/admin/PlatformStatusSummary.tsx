import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings, Zap, Wrench, Wallet, CircleDollarSign } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';

interface PlatformStatusSummaryProps {
  dropSystemActive: boolean;
  distributionActive: boolean;
  maintenanceMode: boolean;
  withdrawalsEnabled: boolean;
  isLoading?: boolean;
}

export const PlatformStatusSummary = ({
  dropSystemActive,
  distributionActive,
  maintenanceMode,
  withdrawalsEnabled,
  isLoading,
}: PlatformStatusSummaryProps) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-24" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Platform Status
          </CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/controls" className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
              <Settings className="h-4 w-4" />
              Manage
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3">
          {/* Viketa Line Status */}
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            dropSystemActive 
              ? 'bg-success/10 text-success' 
              : 'bg-muted text-muted-foreground'
          }`}>
            <span className={`w-2 h-2 rounded-full ${dropSystemActive ? 'bg-success' : 'bg-muted-foreground'}`} />
            Viketa Line {dropSystemActive ? 'Active' : 'Paused'}
          </div>

          {/* Distribution Status */}
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            distributionActive 
              ? 'bg-success/10 text-success' 
              : 'bg-destructive/10 text-destructive'
          }`}>
            <CircleDollarSign className="h-3 w-3" />
            Payouts {distributionActive ? 'On' : 'Off'}
          </div>

          {/* Maintenance Status */}
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            maintenanceMode 
              ? 'bg-destructive/10 text-destructive' 
              : 'bg-success/10 text-success'
          }`}>
            <Wrench className="h-3 w-3" />
            {maintenanceMode ? 'Maintenance' : 'Online'}
          </div>

          {/* Withdrawals Status */}
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            withdrawalsEnabled 
              ? 'bg-success/10 text-success' 
              : 'bg-destructive/10 text-destructive'
          }`}>
            <Wallet className="h-3 w-3" />
            Withdrawals {withdrawalsEnabled ? 'On' : 'Off'}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
