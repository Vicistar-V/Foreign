import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReferralNode {
  id: string;
  full_name: string;
  avatar_url: string | null;
  referral_code: string;
  is_member: boolean;
  created_at: string;
  referral_count: number;
  earnings_generated: number;
  children: ReferralNode[];
}

async function buildReferralTree(
  supabase: any,
  referralCode: string,
  depth: number = 0,
  maxDepth: number = 3
): Promise<ReferralNode[]> {
  if (depth >= maxDepth) return [];

  // Find users referred by this code
  const { data: referrals, error } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, referral_code, is_member, created_at')
    .ilike('referred_by_code', referralCode)
    .order('created_at', { ascending: false });

  if (error || !referrals || referrals.length === 0) {
    return [];
  }

  const nodes: ReferralNode[] = [];

  for (const referral of referrals) {
    // Count direct referrals
    const { count: referralCount } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .ilike('referred_by_code', referral.referral_code);

    // Calculate earnings generated (referral bonuses paid out for this user)
    const { data: earningsData } = await supabase
      .from('transactions')
      .select('amount')
      .eq('transaction_type', 'membership_bonus')
      .eq('status', 'completed')
      .contains('metadata', { original_user_id: referral.id });

    const earnings = earningsData?.reduce((sum: number, tx: any) => sum + Math.abs(tx.amount), 0) || 0;

    // Get children (recursive)
    const children = await buildReferralTree(supabase, referral.referral_code, depth + 1, maxDepth);

    nodes.push({
      id: referral.id,
      full_name: referral.full_name,
      avatar_url: referral.avatar_url,
      referral_code: referral.referral_code,
      is_member: referral.is_member,
      created_at: referral.created_at,
      referral_count: referralCount || 0,
      earnings_generated: earnings,
      children
    });
  }

  return nodes;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify the user from the token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is admin
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse query params
    const url = new URL(req.url);
    const searchQuery = url.searchParams.get('search') || '';
    const userId = url.searchParams.get('userId') || '';

    console.log('get-referral-tree: Fetching tree', { searchQuery, userId });

    let rootUser;

    if (userId) {
      // Get user by ID
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, referral_code, is_member, created_at, referred_by_code')
        .eq('id', userId)
        .single();

      if (error) throw error;
      rootUser = data;
    } else if (searchQuery) {
      // Search by name or referral code
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, referral_code, is_member, created_at, referred_by_code')
        .or(`full_name.ilike.%${searchQuery}%,referral_code.ilike.%${searchQuery}%`)
        .limit(1)
        .single();

      if (error) {
        return new Response(JSON.stringify({ 
          error: 'User not found',
          tree: null,
          stats: null
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      rootUser = data;
    } else {
      return new Response(JSON.stringify({ error: 'Please provide a search query or userId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!rootUser) {
      return new Response(JSON.stringify({ 
        error: 'User not found',
        tree: null,
        stats: null
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build the referral tree
    const children = await buildReferralTree(supabase, rootUser.referral_code, 0, 3);

    // Count total referrals
    const { count: directReferrals } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .ilike('referred_by_code', rootUser.referral_code);

    // Calculate total earnings from referrals
    const { data: totalEarningsData } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', rootUser.id)
      .eq('transaction_type', 'membership_bonus')
      .eq('status', 'completed');

    const totalEarnings = totalEarningsData?.reduce((sum: number, tx: any) => sum + tx.amount, 0) || 0;

    // Find who referred this user
    let referredBy = null;
    if (rootUser.referred_by_code && rootUser.referred_by_code !== 'SYSTEM') {
      const { data: referrer } = await supabase
        .from('profiles')
        .select('id, full_name, referral_code')
        .ilike('referral_code', rootUser.referred_by_code)
        .single();
      referredBy = referrer;
    }

    // Count total in tree (recursive)
    const countTreeNodes = (nodes: ReferralNode[]): number => {
      return nodes.reduce((sum, node) => sum + 1 + countTreeNodes(node.children), 0);
    };

    const totalInTree = countTreeNodes(children);

    const tree: ReferralNode = {
      id: rootUser.id,
      full_name: rootUser.full_name,
      avatar_url: rootUser.avatar_url,
      referral_code: rootUser.referral_code,
      is_member: rootUser.is_member,
      created_at: rootUser.created_at,
      referral_count: directReferrals || 0,
      earnings_generated: totalEarnings,
      children
    };

    console.log('get-referral-tree: Success', { 
      rootUser: rootUser.full_name, 
      directReferrals,
      totalInTree 
    });

    return new Response(JSON.stringify({
      tree,
      referredBy,
      stats: {
        direct_referrals: directReferrals || 0,
        total_in_tree: totalInTree,
        total_earnings: totalEarnings
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('get-referral-tree: Error', error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
