import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch recent transactions with user profiles
    const { data: rawTransactions, error } = await supabase
      .from('transactions')
      .select(`
        id,
        transaction_type,
        amount,
        created_at,
        user_id,
        description,
        metadata,
        profiles!inner (
          full_name,
          avatar_url
        )
      `)
      .in('transaction_type', ['drop_profit', 'drop_entry', 'membership_bonus', 'withdrawal'])
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(40);

    // Only treat membership_bonus as a "referral/invite bonus" when it's actually
    // paid to the referrer. The same transaction_type is also used for a new
    // user's own activation credit — that must NOT show as "earned invite bonus".
    const transactions = (rawTransactions || []).filter((tx: any) => {
      if (tx.transaction_type !== 'membership_bonus') return true;
      const purpose = tx.metadata?.purpose;
      if (purpose === 'spot_creation_credit') return false;
      const desc = (tx.description || '').toLowerCase();
      // Keep only rows that clearly represent a referral/invite reward
      return desc.includes('referral') || desc.includes('invite') || purpose === 'referral_bonus';
    }).slice(0, 15);

    if (error) {
      console.error('Failed to fetch activity:', error);
      throw error;
    }

    // Extract first name only for privacy
    const getFirstName = (fullName: string): string => {
      if (!fullName) return 'Someone';
      const parts = fullName.trim().split(' ');
      return parts[0] || 'Someone';
    };

    // Map to event format
    const events = (transactions || []).map((tx: any) => {
      const firstName = getFirstName(tx.profiles?.full_name || '');
      const amount = Math.abs(tx.amount);
      
      let type: 'payout' | 'activation' | 'referral' | 'withdrawal';
      let message: string;
      
      switch (tx.transaction_type) {
        case 'drop_profit':
          type = 'payout';
          message = `${firstName} collected ₦${amount.toLocaleString()} payout`;
          break;
        case 'drop_entry':
          type = 'activation';
          message = `${firstName} opened a new spot`;
          break;
        case 'membership_bonus':
          type = 'referral';
          message = `${firstName} earned ₦${amount.toLocaleString()} invite bonus`;
          break;
        case 'withdrawal':
          type = 'withdrawal';
          message = `${firstName} cashed out ₦${amount.toLocaleString()}`;
          break;
        default:
          type = 'payout';
          message = `${firstName} had activity`;
      }

      return {
        id: tx.id,
        type,
        firstName,
        avatarUrl: tx.profiles?.avatar_url || null,
        userId: tx.user_id,
        amount,
        message,
        timestamp: tx.created_at,
      };
    });

    console.log(`Returning ${events.length} live activity events`);

    return new Response(
      JSON.stringify({ events }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('Error in get-live-activity:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
