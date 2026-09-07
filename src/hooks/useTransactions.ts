import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Transaction {
  id: string;
  amount: number;
  wallet_type: string;
  transaction_type: string;
  description: string;
  status: string;
  created_at: string;
  payment_reference: string | null;
  metadata?: {
    reason?: string;
    [key: string]: any;
  };
}

export type TxCategory = 'all' | 'drops' | 'referrals' | 'money' | 'membership';
export type TxDirection = 'all' | 'in' | 'out';
export type TxSort = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';

export interface TransactionFilters {
  category?: TxCategory;
  direction?: TxDirection;
  status?: 'all' | 'completed' | 'pending' | 'failed' | 'reversed';
  sort?: TxSort;
  page?: number;
  pageSize?: number;
}

export interface TransactionsResponse {
  transactions: Transaction[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
  stats: {
    all: number;
    money_in: number;
    money_out: number;
    pending: number;
  };
}

export const useTransactions = (
  userId?: string,
  filters: TransactionFilters = {}
) => {
  const {
    category = 'all',
    direction = 'all',
    status = 'all',
    sort = 'date_desc',
    page = 1,
    pageSize = 15,
  } = filters;

  const offset = (page - 1) * pageSize;

  return useQuery({
    queryKey: ['transactions', userId, category, direction, status, sort, page, pageSize],
    queryFn: async () => {
      if (!userId) throw new Error('No user ID');

      const body: Record<string, any> = {
        limit: pageSize,
        offset,
        sort,
      };
      if (category !== 'all') body.category = category;
      if (direction !== 'all') body.direction = direction;
      if (status !== 'all') body.status = status;

      const { data, error } = await supabase.functions.invoke('get-transactions', {
        body,
      });

      if (error) throw error;
      if (data?.success === false) {
        throw new Error(data.error || 'Failed to fetch transactions');
      }
      return data as TransactionsResponse;
    },
    enabled: !!userId,
    staleTime: 0,
    gcTime: 30 * 60 * 1000,
    placeholderData: keepPreviousData, // smooth pagination
    refetchOnWindowFocus: false,
  });
};
