// Participant type for cycle payouts (replaces old drop-based Participant)
export interface Participant {
  full_name: string;
  avatar_url?: string | null;
  user_id?: string;
  amount?: number;
  cycle_number?: number;
  paid_at?: string;
}

export interface CyclePayoutSummary {
  total_payouts: number;
  total_amount: number;
  cyclers_count: number;
}
