import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ResolveAccountParams {
  bank_code: string;
  account_number: string;
}

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
  complete_message?: string;
  bank_name?: string;
  account_number?: string;
  full_name?: string;
  amount?: number;
}

interface CheckStatusParams {
  transfer_id: number;
}

interface RetryTransferParams {
  transfer_id: number;
}

/**
 * Hook to verify a bank account before sending money
 */
export const useResolveAccount = () => {
  return useMutation({
    mutationFn: async (params: ResolveAccountParams): Promise<ResolveAccountResponse> => {
      console.log('[useResolveAccount] Verifying account:', params);
      
      const { data, error } = await supabase.functions.invoke('admin-flutterwave-transfer', {
        body: {
          action: 'resolve',
          bank_code: params.bank_code,
          account_number: params.account_number,
        },
      });

      console.log('[useResolveAccount] Response:', data, 'Error:', error);

      // Handle edge function errors - extract the actual error message from the response
      if (error) {
        console.error('[useResolveAccount] Error:', error);
        // Try to get the error message from the data (edge functions return error in body even on 4xx)
        const errorMessage = data?.error || error.message || 'Failed to verify account';
        throw new Error(errorMessage);
      }

      // Handle unsuccessful responses (edge function returned success but operation failed)
      if (data && !data.success) {
        throw new Error(data.error || 'Could not verify this account. Please check the account number and bank.');
      }

      return data as ResolveAccountResponse;
    },
    onError: (error) => {
      console.error('[useResolveAccount] Mutation error:', error);
      toast.error('Could not verify account', {
        description: error.message || 'Please check the account number and try again',
      });
    },
  });
};

/**
 * Hook to send money directly via Flutterwave
 */
export const useAdminSendMoney = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: SendMoneyParams): Promise<SendMoneyResponse> => {
      console.log('[useAdminSendMoney] Sending money:', params);
      
      const { data, error } = await supabase.functions.invoke('admin-flutterwave-transfer', {
        body: {
          action: 'transfer',
          bank_code: params.bank_code,
          account_number: params.account_number,
          amount: params.amount,
          narration: params.narration,
        },
      });

      console.log('[useAdminSendMoney] Response:', data, 'Error:', error);

      // Handle edge function errors - extract the actual error message from the response
      if (error) {
        console.error('[useAdminSendMoney] Error:', error);
        const errorMessage = data?.error || error.message || 'Failed to send money';
        throw new Error(errorMessage);
      }

      // Handle unsuccessful responses
      if (data && !data.success) {
        throw new Error(data.error || 'Transfer failed. Please try again.');
      }

      return data as SendMoneyResponse;
    },
    onSuccess: (data) => {
      toast.success('Money Sent!', {
        description: `Transfer initiated. Reference: ${data.reference}`,
      });
      // Refresh Flutterwave data to show the new transfer
      queryClient.invalidateQueries({ queryKey: ['flutterwave-data'] });
      queryClient.invalidateQueries({ queryKey: ['flutterwave-audit-logs'] });
    },
    onError: (error) => {
      console.error('[useAdminSendMoney] Mutation error:', error);
      toast.error('Transfer Failed', {
        description: error.message || 'Could not send money. Please try again.',
      });
    },
  });
};

/**
 * Hook to check the latest status of a transfer
 */
export const useCheckTransferStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CheckStatusParams): Promise<SendMoneyResponse> => {
      console.log('[useCheckTransferStatus] Checking status for:', params.transfer_id);
      
      const { data, error } = await supabase.functions.invoke('admin-flutterwave-transfer', {
        body: {
          action: 'get_status',
          transfer_id: params.transfer_id,
        },
      });

      console.log('[useCheckTransferStatus] Response:', data, 'Error:', error);

      // Handle edge function errors
      if (error) {
        console.error('[useCheckTransferStatus] Error:', error);
        const errorMessage = data?.error || error.message || 'Failed to check status';
        throw new Error(errorMessage);
      }

      // Handle unsuccessful responses
      if (data && !data.success) {
        throw new Error(data.error || 'Could not fetch status');
      }

      return data as SendMoneyResponse;
    },
    onSuccess: (data) => {
      const statusLabel = data.status?.toLowerCase() === 'successful' ? 'Completed ✓' 
        : data.status?.toLowerCase() === 'failed' ? 'Problem ✗'
        : 'Processing...';
      
      toast.success('Status Updated', {
        description: `Current status: ${statusLabel}`,
      });
      // Refresh Flutterwave data and audit logs
      queryClient.invalidateQueries({ queryKey: ['flutterwave-data'] });
      queryClient.invalidateQueries({ queryKey: ['flutterwave-audit-logs'] });
    },
    onError: (error) => {
      console.error('[useCheckTransferStatus] Mutation error:', error);
      toast.error('Could Not Check Status', {
        description: error.message || 'Please try again.',
      });
    },
  });
};

/**
 * Hook to retry a failed transfer
 */
export const useRetryTransfer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: RetryTransferParams): Promise<SendMoneyResponse> => {
      console.log('[useRetryTransfer] Retrying transfer:', params.transfer_id);
      
      const { data, error } = await supabase.functions.invoke('admin-flutterwave-transfer', {
        body: {
          action: 'retry',
          transfer_id: params.transfer_id,
        },
      });

      console.log('[useRetryTransfer] Response:', data, 'Error:', error);

      // Handle edge function errors
      if (error) {
        console.error('[useRetryTransfer] Error:', error);
        const errorMessage = data?.error || error.message || 'Failed to retry transfer';
        throw new Error(errorMessage);
      }

      // Handle unsuccessful responses
      if (data && !data.success) {
        throw new Error(data.error || 'Could not retry transfer');
      }

      return data as SendMoneyResponse;
    },
    onSuccess: () => {
      toast.success('Retry Initiated!', {
        description: 'The transfer is being retried. Check back in a moment.',
      });
      // Refresh Flutterwave data and audit logs
      queryClient.invalidateQueries({ queryKey: ['flutterwave-data'] });
      queryClient.invalidateQueries({ queryKey: ['flutterwave-audit-logs'] });
    },
    onError: (error) => {
      console.error('[useRetryTransfer] Mutation error:', error);
      toast.error('Retry Failed', {
        description: error.message || 'Could not retry transfer. It may not be in a failed state.',
      });
    },
  });
};
