import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // --- Auth gate: must be logged-in admin ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: userData.user.id,
      _role: 'admin',
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }


    const { chartType, date, segment } = await req.json();

    console.log('Drill-down request:', { chartType, date, segment });

    let result: any = { items: [], summary: {} };

    switch (chartType) {
      case 'participation': {
        // Get all participants for a specific date with their details
        const { data: entries, error } = await supabase
          .from('drop_entries')
          .select(`
            id,
            user_id,
            total_amount,
            cash_amount,
            credit_amount,
            result_status,
            win_amount,
            entry_timestamp,
            metadata
          `)
          .eq('drop_date', date)
          .order('entry_timestamp', { ascending: false });

        if (error) throw error;

        // Fetch profiles separately to avoid type issues
        const userIds = [...new Set(entries?.map(e => e.user_id) || [])];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

        const entriesWithProfiles = entries?.map(e => ({
          ...e,
          profile: profileMap.get(e.user_id),
        })) || [];

        // Group by result status
        const winners = entriesWithProfiles.filter(e => e.result_status === 'beneficiary');
        const protected_ = entriesWithProfiles.filter(e => e.result_status === 'protected');
        const contributors = entriesWithProfiles.filter(e => e.result_status === 'contributor');
        const pending = entriesWithProfiles.filter(e => e.result_status === 'pending');

        result = {
          date,
          totalParticipants: entriesWithProfiles.length,
          groups: [
            {
              label: 'Winners',
              emoji: '🏆',
              color: 'green',
              count: winners.length,
              items: winners.map(e => ({
                id: e.id,
                name: e.profile?.full_name || 'Unknown',
                avatar: e.profile?.avatar_url,
                amount: e.win_amount || 0,
                entryAmount: e.total_amount,
                tier: (e.metadata as any)?.tier || 'winner',
                tierRank: (e.metadata as any)?.tierRank,
                time: e.entry_timestamp,
              })),
            },
            {
              label: 'Protected',
              emoji: '🛡️',
              color: 'blue',
              count: protected_.length,
              items: protected_.map(e => ({
                id: e.id,
                name: e.profile?.full_name || 'Unknown',
                avatar: e.profile?.avatar_url,
                amount: e.total_amount,
                time: e.entry_timestamp,
              })),
            },
            {
              label: 'Contributors',
              emoji: '📤',
              color: 'orange',
              count: contributors.length,
              items: contributors.map(e => ({
                id: e.id,
                name: e.profile?.full_name || 'Unknown',
                avatar: e.profile?.avatar_url,
                amount: e.total_amount,
                time: e.entry_timestamp,
              })),
            },
            {
              label: 'Pending',
              emoji: '⏳',
              color: 'gray',
              count: pending.length,
              items: pending.map(e => ({
                id: e.id,
                name: e.profile?.full_name || 'Unknown',
                avatar: e.profile?.avatar_url,
                amount: e.total_amount,
                time: e.entry_timestamp,
              })),
            },
          ].filter(g => g.count > 0),
        };
        break;
      }

      case 'treasury': {
        // Treasury removed — return empty drilldown
        result = {
          date,
          totalIncome: 0,
          totalExpenses: 0,
          netChange: 0,
          groups: [],
        };
        break;
      }

      case 'userGrowth': {
        // Get all users who signed up on a specific date
        const startOfDay = `${date}T00:00:00.000Z`;
        const endOfDay = `${date}T23:59:59.999Z`;

        const { data: users, error } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, is_member, created_at, referral_code, referred_by_code')
          .gte('created_at', startOfDay)
          .lte('created_at', endOfDay)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const members = users?.filter(u => u.is_member) || [];
        const nonMembers = users?.filter(u => !u.is_member) || [];

        result = {
          date,
          totalSignups: users?.length || 0,
          totalMembers: members.length,
          conversionRate: users?.length ? Math.round((members.length / users.length) * 100) : 0,
          groups: [
            {
              label: 'Active Members',
              emoji: '✅',
              color: 'green',
              count: members.length,
              items: members.map(u => ({
                id: u.id,
                name: u.full_name,
                avatar: u.avatar_url,
                amount: 0,
                referralCode: u.referral_code,
                referredBy: u.referred_by_code,
                time: u.created_at,
                isMember: true,
              })),
            },
            {
              label: 'Not Yet Members',
              emoji: '⏳',
              color: 'orange',
              count: nonMembers.length,
              items: nonMembers.map(u => ({
                id: u.id,
                name: u.full_name,
                avatar: u.avatar_url,
                amount: 0,
                referralCode: u.referral_code,
                referredBy: u.referred_by_code,
                time: u.created_at,
                isMember: false,
              })),
            },
          ].filter(g => g.count > 0),
        };
        break;
      }

      case 'distribution': {
        // Get users in a specific segment for today
        const today = new Date().toISOString().split('T')[0];
        
        let resultStatus = 'pending';
        if (segment === 'winners') resultStatus = 'beneficiary';
        else if (segment === 'protected') resultStatus = 'protected';
        else if (segment === 'contributors') resultStatus = 'contributor';

        const { data: entries, error } = await supabase
          .from('drop_entries')
          .select('id, user_id, total_amount, result_status, win_amount, entry_timestamp, metadata')
          .eq('drop_date', date || today)
          .eq('result_status', resultStatus)
          .order('win_amount', { ascending: false, nullsFirst: false });

        if (error) throw error;

        // Fetch profiles separately
        const userIds = [...new Set(entries?.map(e => e.user_id) || [])];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

        const entriesWithProfiles = entries?.map(e => ({
          ...e,
          profile: profileMap.get(e.user_id),
        })) || [];

        const segmentLabels: Record<string, { label: string; emoji: string; color: string }> = {
          winners: { label: 'Winners', emoji: '🏆', color: 'green' },
          protected: { label: 'Protected', emoji: '🛡️', color: 'blue' },
          contributors: { label: 'Contributors', emoji: '📤', color: 'orange' },
        };

        const segmentInfo = segmentLabels[segment] || { label: segment, emoji: '📊', color: 'gray' };

        result = {
          date: date || today,
          segment,
          totalCount: entriesWithProfiles.length,
          groups: [
            {
              label: segmentInfo.label,
              emoji: segmentInfo.emoji,
              color: segmentInfo.color,
              count: entriesWithProfiles.length,
              items: entriesWithProfiles.map(e => ({
                id: e.id,
                name: e.profile?.full_name || 'Unknown',
                avatar: e.profile?.avatar_url,
                amount: segment === 'winners' ? (e.win_amount || 0) : e.total_amount,
                tier: (e.metadata as any)?.tier,
                tierRank: (e.metadata as any)?.tierRank,
                time: e.entry_timestamp,
              })),
            },
          ],
        };
        break;
      }

      default:
        throw new Error(`Unknown chart type: ${chartType}`);
    }

    console.log('Drill-down result:', { chartType, itemCount: result.groups?.reduce((sum: number, g: any) => sum + g.count, 0) || 0 });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const error = err as Error;
    console.error('Drill-down error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
