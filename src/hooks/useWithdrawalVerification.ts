import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

interface VerificationResponse {
  status: 'completed' | 'failed' | 'pending';
  message: string;
  reference: string;
  amount?: number;
}

export const useWithdrawalVerification = (userId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reference: string): Promise<VerificationResponse> => {
      console.log('🔍 Checking withdrawal status:', reference);
      
      // Call our extended callback function with type=withdrawal
      const response = await fetch(
        `https://sbprvewcfrtazdlcfvxt.supabase.co/functions/v1/flutterwave-callback?type=withdrawal&reference=${reference}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Could not check status');
      }

      return await response.json();
    },
    onSuccess: (data) => {
      // Invalidate queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['transactions', userId] });
      queryClient.invalidateQueries({ queryKey: ['balances', userId] });

      // Show appropriate toast
      if (data.status === 'completed') {
        toast({
          title: "Money Sent!",
          description: `₦${data.amount?.toLocaleString()} successfully sent to your bank.`,
        });
      } else if (data.status === 'failed') {
        toast({
          title: "Withdrawal Failed",
          description: "Money has been returned to your earnings wallet.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Still Processing",
          description: "Your withdrawal is being processed by the bank. Check back soon.",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Could Not Check Status",
        description: error.message,
        variant: "destructive",
      });
    }
  });
};
