import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface WithdrawalAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  is_verified: boolean;
  is_primary: boolean;
  created_at: string;
}

interface WithdrawalAccountsResponse {
  accounts: WithdrawalAccount[];
}

export const useWithdrawalAccountActions = (userId?: string) => {
  const queryClient = useQueryClient();

  const setAsPrimary = useMutation({
    mutationFn: async ({ accountId, pin }: { accountId: string; pin: string }) => {
      const { data, error } = await supabase.functions.invoke('add-bank-account', {
        body: {
          action: 'set_primary',
          account_id: accountId,
          pin: pin,
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to update');
      return accountId;
    },
    onMutate: async ({ accountId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ 
        queryKey: ['withdrawal-accounts', userId] 
      });

      // Snapshot previous value
      const previous = queryClient.getQueryData<WithdrawalAccountsResponse>([
        'withdrawal-accounts', 
        userId
      ]);

      // Optimistically update cache
      queryClient.setQueryData<WithdrawalAccountsResponse>(
        ['withdrawal-accounts', userId], 
        (old) => {
          if (!old) return old;
          return {
            ...old,
            accounts: old.accounts.map((acc) => ({
              ...acc,
              is_primary: acc.id === accountId
            }))
          };
        }
      );

      return { previous };
    },
    onError: (error: any, variables, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(
          ['withdrawal-accounts', userId], 
          context.previous
        );
      }
      toast({
        title: 'Failed to update',
        description: error.message,
        variant: 'destructive',
      });
    },
    onSuccess: () => {
      toast({
        title: 'Primary account updated',
        description: 'This account will be used for withdrawals',
      });
      // Trust optimistic update + real-time subscription, no need to invalidate
    }
  });

  const deleteAccount = useMutation({
    mutationFn: async ({ accountId, pin }: { accountId: string; pin: string }) => {
      const { data, error } = await supabase.functions.invoke('add-bank-account', {
        body: {
          action: 'delete',
          account_id: accountId,
          pin: pin,
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to remove');
      return accountId;
    },
    onMutate: async ({ accountId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ 
        queryKey: ['withdrawal-accounts', userId] 
      });

      // Snapshot previous value
      const previous = queryClient.getQueryData<WithdrawalAccountsResponse>([
        'withdrawal-accounts', 
        userId
      ]);

      // Optimistically remove from cache
      queryClient.setQueryData<WithdrawalAccountsResponse>(
        ['withdrawal-accounts', userId], 
        (old) => {
          if (!old) return old;
          return {
            ...old,
            accounts: old.accounts.filter((acc) => acc.id !== accountId)
          };
        }
      );

      return { previous };
    },
    onError: (error: any, variables, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(
          ['withdrawal-accounts', userId], 
          context.previous
        );
      }
      toast({
        title: 'Failed to remove',
        description: error.message,
        variant: 'destructive',
      });
    },
    onSuccess: () => {
      toast({
        title: 'Account removed',
        description: 'Bank account has been removed',
      });
      // Trust optimistic update + real-time subscription, no need to invalidate
    }
  });

  return {
    setAsPrimary: setAsPrimary.mutate,
    deleteAccount: deleteAccount.mutate,
    isSettingPrimary: setAsPrimary.isPending,
    isDeletingAccount: deleteAccount.isPending,
    settingPrimaryId: setAsPrimary.variables?.accountId,
  };
};
