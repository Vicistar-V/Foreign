import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

interface BannedBannerProps {
  reason?: string | null;
}

export const BannedBanner = ({ reason }: BannedBannerProps) => {
  return (
    <Alert variant="destructive" className="mb-4 border-2 border-destructive">
      <AlertTriangle className="h-5 w-5" />
      <AlertTitle className="font-bold text-lg">Account Suspended</AlertTitle>
      <AlertDescription className="mt-2">
        {reason || 'Your account has been suspended due to policy violations. You cannot perform most actions until this is resolved.'}
        <div className="mt-2 text-sm">
          Contact support if you believe this is an error.
        </div>
      </AlertDescription>
    </Alert>
  );
};
