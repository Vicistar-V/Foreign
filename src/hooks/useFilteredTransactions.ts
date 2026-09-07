import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

interface Transaction {
  id: string;
  amount: number;
  wallet_type: string;
  transaction_type: string;
  description: string;
  status: string;
  created_at: string;
  payment_reference: string | null;
}

interface TransactionsResponse {
  transactions: Transaction[];
  total: number;
  hasMore: boolean;
}

/**
 * Helper hook to instantly filter cached transactions by wallet type
 * This reads from the main transaction cache without any backend calls
 */
export const useFilteredTransactions = (
  userId?: string,
  walletType?: 'earnings' | 'deposit' | 'credits',
  limit: number = 10
) => {
  const queryClient = useQueryClient();
  
  // Get data from main cache (no backend call!)
  const allTransactionsData = queryClient.getQueryData<TransactionsResponse>(['transactions', userId]);
  
  // Filter based on wallet type (instant, client-side)
  return useMemo(() => {
    if (!allTransactionsData) {
      return { 
        transactions: [], 
        isLoading: true,
        total: 0,
        hasMore: false 
      };
    }
    
    // If no filter, return all
    if (!walletType) {
      return { 
        ...allTransactionsData,
        isLoading: false 
      };
    }
    
    // Filter by wallet type
    const filtered = allTransactionsData.transactions.filter(
      t => t.wallet_type === walletType
    );

    // Apply limit
    const limited = filtered.slice(0, limit);
    
    return {
      transactions: limited,
      total: filtered.length,
      hasMore: filtered.length > limit,
      isLoading: false
    };
  }, [allTransactionsData, walletType, limit]);
};
