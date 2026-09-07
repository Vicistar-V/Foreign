import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Types for Flutterwave data
export interface FlutterwaveBalance {
  currency: string;
  available_balance: number;
  ledger_balance: number;
}

export interface FlutterwaveTransfer {
  id: number;
  account_number: string;
  bank_name: string;
  full_name: string;
  amount: number;
  currency: string;
  reference: string;
  status: string;
  complete_message: string;
  created_at: string;
  fee: number;
  meta?: Record<string, unknown>;
}

// Matched platform user data (if transaction email matches a user)
export interface MatchedPlatformUser {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  is_member: boolean;
}

export interface FlutterwaveTransaction {
  id: number;
  tx_ref: string;
  flw_ref: string;
  device_fingerprint: string;
  amount: number;
  currency: string;
  charged_amount: number;
  app_fee: number;
  merchant_fee: number;
  processor_response: string;
  auth_model: string;
  ip: string;
  narration: string;
  status: string;
  payment_type: string;
  created_at: string;
  customer: {
    id: number;
    name: string;
    phone_number: string;
    email: string;
  };
  // Matched platform user (null if no email match found)
  matched_user?: MatchedPlatformUser | null;
}

export interface FlutterwaveSummary {
  totalPending: number;
  totalPendingAmount: number;
  totalSuccessful: number;
  totalSuccessfulAmount: number;
  totalFailed: number;
  totalFailedAmount: number;
  totalTransfers: number;
  totalDeposits: number;
  totalDepositsSuccessful: number;
  totalDepositsAmount: number;
  totalMatchedUsers?: number;
}

export interface FlutterwaveDataResponse {
  success: boolean;
  fetchedAt: string;
  dateRange: {
    from: string | null;
    to: string | null;
  };
  balances: FlutterwaveBalance[];
  transfers: {
    all: FlutterwaveTransfer[];
    pending: FlutterwaveTransfer[];
    successful: FlutterwaveTransfer[];
    failed: FlutterwaveTransfer[];
  };
  transactions: FlutterwaveTransaction[];
  summary: FlutterwaveSummary;
}

export interface DateRangeFilter {
  fromDate: string | null;
  toDate: string | null;
}

export const useFlutterwaveData = (dateRange?: DateRangeFilter) => {
  const fromDate = dateRange?.fromDate || null;
  const toDate = dateRange?.toDate || null;

  return useQuery({
    queryKey: ['flutterwave-data', fromDate, toDate],
    queryFn: async (): Promise<FlutterwaveDataResponse> => {
      console.log('[useFlutterwaveData] Fetching Flutterwave data with date range:', fromDate, 'to', toDate);
      
      const { data, error } = await supabase.functions.invoke('get-flutterwave-data', {
        body: { fromDate, toDate }
      });

      if (error) {
        console.error('[useFlutterwaveData] Error:', error);
        throw new Error(error.message || 'Failed to fetch Flutterwave data');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to fetch Flutterwave data');
      }

      console.log('[useFlutterwaveData] Success! Fetched at:', data.fetchedAt, 
        'Transactions:', data.transactions?.length || 0);
      return data as FlutterwaveDataResponse;
    },
    staleTime: 30 * 1000, // 30 seconds - data considered fresh
    refetchInterval: 60 * 1000, // Auto-refresh every 60 seconds
    refetchOnWindowFocus: true,
    retry: 2,
  });
};

// Helper to format Naira amounts
export const formatNaira = (amount: number): string => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

// Helper to get status color
export const getTransferStatusColor = (status: string): string => {
  const statusLower = status.toLowerCase();
  if (statusLower === 'successful') return 'text-green-600 bg-green-100';
  if (statusLower === 'failed') return 'text-red-600 bg-red-100';
  if (['pending', 'new', 'queued'].includes(statusLower)) return 'text-yellow-600 bg-yellow-100';
  return 'text-muted-foreground bg-muted';
};

// Helper to get simple status label (grandma-friendly)
export const getSimpleStatusLabel = (status: string): string => {
  const statusLower = status.toLowerCase();
  if (statusLower === 'successful') return 'Completed ✓';
  if (statusLower === 'failed') return 'Problem ✗';
  if (['pending', 'new', 'queued'].includes(statusLower)) return 'Processing...';
  return status;
};

// Helper to format date for display
export const formatFlutterwaveDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
};
