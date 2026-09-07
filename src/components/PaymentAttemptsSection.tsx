import { useState } from 'react';
import { usePaymentAttempts, PaymentAttempt } from '@/hooks/usePaymentAttempts';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { 
  Clock, 
  ChevronDown, 
  Loader2, 
  RefreshCw,
  CreditCard,
  Crown
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface PaymentAttemptsSectionProps {
  purpose?: 'membership' | 'deposit' | 'all';
  onSuccess?: () => void;
}

export const PaymentAttemptsSection = ({ 
  purpose = 'all',
  onSuccess 
}: PaymentAttemptsSectionProps) => {
  const { data: attempts, isLoading, invalidate } = usePaymentAttempts();
  const [verifying, setVerifying] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Filter attempts by purpose if specified
  const filteredAttempts = attempts?.filter(a => 
    purpose === 'all' || a.purpose === purpose
  ) || [];

  const handleVerifyAttempt = async (attempt: PaymentAttempt) => {
    setVerifying(attempt.id);

    try {
      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: { 
          tx_ref: attempt.tx_ref,
          attempt_id: attempt.id
        },
      });

      if (error) {
        toast({
          title: 'Verification Failed',
          description: error.message || 'Could not verify payment',
          variant: 'destructive',
        });
        return;
      }

      if (data?.error) {
        toast({
          title: 'Verification Failed',
          description: data.error,
          variant: 'destructive',
        });
        return;
      }

      // Handle different statuses
      if (data?.status === 'processed_now') {
        toast({
          title: 'Success!',
          description: data.message,
        });
        invalidate();
        onSuccess?.();
        // Reload page to refresh state
        window.location.reload();
      } else if (data?.status === 'already_done') {
        toast({
          title: 'Already Processed',
          description: data.message,
        });
        invalidate();
        if (data.is_member) {
          onSuccess?.();
          window.location.reload();
        }
      } else if (data?.status === 'pending') {
        toast({
          title: 'Still Processing',
          description: data.message,
        });
      } else if (data?.status === 'not_found') {
        toast({
          title: 'Payment Not Found',
          description: 'This payment was not found. It may not have been completed.',
          variant: 'destructive',
        });
      } else if (data?.status === 'failed') {
        toast({
          title: 'Payment Failed',
          description: data.message,
          variant: 'destructive',
        });
        invalidate(); // Refresh to show updated status
      } else {
        toast({
          title: 'Result',
          description: data?.message || 'Unknown status',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setVerifying(null);
    }
  };

  // Don't show if no pending attempts
  if (!isLoading && filteredAttempts.length === 0) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-2">
          <Clock className="h-3 w-3" />
          <span>
            {filteredAttempts.length > 0 
              ? `${filteredAttempts.length} pending payment${filteredAttempts.length > 1 ? 's' : ''} found`
              : 'Check past payments'
            }
          </span>
          <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-2">
        <Card className="border-border/50 bg-muted/30">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              If you paid but it wasn't processed (network issue, browser closed), 
              tap any payment below to verify it:
            </p>

            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredAttempts.length === 0 ? (
              <p className="text-sm text-center text-muted-foreground py-2">
                No pending payments found
              </p>
            ) : (
              <div className="space-y-2">
                {filteredAttempts.map((attempt) => (
                  <button
                    key={attempt.id}
                    onClick={() => handleVerifyAttempt(attempt)}
                    disabled={verifying === attempt.id}
                    className="w-full p-3 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors text-left disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                        attempt.purpose === 'membership' 
                          ? 'bg-primary/20' 
                          : 'bg-success/20'
                      }`}>
                        {attempt.purpose === 'membership' ? (
                          <Crown className={`h-4 w-4 text-primary`} />
                        ) : (
                          <CreditCard className={`h-4 w-4 text-success`} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">
                            ₦{attempt.amount.toLocaleString()}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {attempt.purpose === 'membership' ? 'Activation' : 'Deposit'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {formatDistanceToNow(new Date(attempt.created_at), { addSuffix: true })}
                          {' • '}
                          {format(new Date(attempt.created_at), 'MMM d, h:mm a')}
                        </p>
                      </div>
                      {verifying === attempt.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      ) : (
                        <RefreshCw className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
};
