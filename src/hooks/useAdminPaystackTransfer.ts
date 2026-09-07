// Paystack version of useAdminFlutterwaveTransfer. Identical hook surface
// (same inputs/outputs) so AdminSendMoneyDrawer can use either by switching
// which set of hooks it calls.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ResolveAccountParams { bank_code: string; account_number: string; }
interface ResolveAccountResponse {
  success: boolean;
  account_name?: string;
  account_number?: string;
  bank_code?: string;
  error?: string;
}
interface SendMoneyParams {
  bank_code: string;
  account_number: string;
  amount: number;
  narration: string;
}
interface SendMoneyResponse {
  success: boolean;
  transfer_id?: number;
  reference?: string;
  status?: string;
  message?: string;
  error?: string;
}

const FN = 'admin-paystack-transfer';

export const usePaystackResolveAccount = () => {
  return useMutation({
    mutationFn: async (params: ResolveAccountParams): Promise<ResolveAccountResponse> => {
      const { data, error } = await supabase.functions.invoke(FN, {
        body: { action: 'resolve', ...params },
      });
      if (error) throw new Error(data?.error || error.message || 'Failed to verify account');
      if (data && !data.success) throw new Error(data.error || 'Could not verify this account.');
      return data as ResolveAccountResponse;
    },
    onError: (error) => {
      toast.error('Could not verify account', {
        description: error.message || 'Please check the account number and try again',
      });
    },
  });
};

export const usePaystackSendMoney = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: SendMoneyParams): Promise<SendMoneyResponse> => {
      const { data, error } = await supabase.functions.invoke(FN, {
        body: { action: 'transfer', ...params },
      });
      if (error) throw new Error(data?.error || error.message || 'Failed to send money');
      if (data && !data.success) throw new Error(data.error || 'Transfer failed. Please try again.');
      return data as SendMoneyResponse;
    },
    onSuccess: (data) => {
      toast.success('Money Sent!', {
        description: data.message || `Transfer initiated. Reference: ${data.reference}`,
      });
      queryClient.invalidateQueries({ queryKey: ['paystack-data'] });
      queryClient.invalidateQueries({ queryKey: ['paystack-audit-logs'] });
    },
    onError: (error) => {
      toast.error('Transfer Failed', {
        description: error.message || 'Could not send money. Please try again.',
      });
    },
  });
};
