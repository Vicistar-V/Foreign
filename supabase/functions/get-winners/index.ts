import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UniqueEarner {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  total_earned_today: number;
  spots_count: number;
}

interface SpotEntry {
  spot_id: string;
  spot_name: string;
  cycles_today: number;
  total_earned_today: number;
  last_cycle_at: string;
  owner: {
    user_id: string;
    full_name: string;
    avatar_url: string | null;
    total_spots: number;
  };
}

interface DayData {
  date: string;
  label: string;
  unique_earners: UniqueEarner[];
  spots: SpotEntry[];
  stats: {
    total_cycles: number;
    total_distributed: number;
    unique_earners_count: number;
  };
  has_more_spots: boolean;
}

// ===== Nigerian Time Utilities =====
function getNigerianDate(): string {
  const now = new Date();
  const lagosTime = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Lagos' }));
  const year = lagosTime.getFullYear();
  const month = String(lagosTime.getMonth() + 1).padStart(2, '0');
  const day = String(lagosTime.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toNigerianDateString(utcTimestamp: string): string {
  const date = new Date(utcTimestamp);
  const lagosTime = new Date(date.toLocaleString('en-US', { timeZone: 'Africa/Lagos' }));
  const year = lagosTime.getFullYear();
  const month = String(lagosTime.getMonth() + 1).padStart(2, '0');
  const day = String(lagosTime.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getNigerianDaysAgoStart(daysBack: number): string {
  const now = new Date();
  const lagosNow = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Lagos' }));
  lagosNow.setDate(lagosNow.getDate() - daysBack);
  lagosNow.setHours(0, 0, 0, 0);
  // Convert back to UTC (Lagos is UTC+1)
  const utcTime = new Date(lagosNow.getTime() - (1 * 60 * 60 * 1000));
  return utcTime.toISOString();
}

function getNigerianTodayStart(): string {
  const now = new Date();
  const lagosNow = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Lagos' }));
  lagosNow.setHours(0, 0, 0, 0);
  // Convert back to UTC (Lagos is UTC+1)
  const utcTime = new Date(lagosNow.getTime() - (1 * 60 * 60 * 1000));
  return utcTime.toISOString();
}
// ===================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { days_back = 7, spots_per_day = 10 } = await req.json().catch(() => ({}));

    // Calculate date range using Nigerian time
    const startDateUtc = getNigerianDaysAgoStart(days_back);

    // Get all PAID drops (paid_at IS NOT NULL) within date range with spot info
    // Using paid_at instead of status='paid' because drops quickly become 're-entered' after payment
    const { data: drops, error: dropsError } = await supabaseAdmin
      .from("drops")
      .select(`
        id,
        paid_at,
        spot_id,
        spots (id, spot_name, user_id, total_cycles)
      `)
      .not("paid_at", "is", null)
      .gte("paid_at", startDateUtc)
      .order("paid_at", { ascending: false });

    if (dropsError) throw dropsError;

    console.log(`[get-winners] Found ${drops?.length || 0} paid drops (paid_at IS NOT NULL)`);

    // Get unique user IDs
    const userIds = [...new Set((drops || []).map((d: any) => d.spots?.user_id).filter(Boolean))];
    
    // Fetch profiles
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", userIds.length > 0 ? userIds : ['none']);

    const profilesMap = new Map((profiles || []).map((p: any) => [p.id, p]));

    // Get spot counts per user
    const { data: spotCounts } = await supabaseAdmin
      .from("spots")
      .select("user_id")
      .eq("status", "active")
      .in("user_id", userIds.length > 0 ? userIds : ['none']);

    const userSpotCounts = new Map<string, number>();
    (spotCounts || []).forEach((s: any) => {
      userSpotCounts.set(s.user_id, (userSpotCounts.get(s.user_id) || 0) + 1);
    });

    // Group drops by Nigerian date (using paid_at)
    const dropsByDate = new Map<string, any[]>();
    
    (drops || []).forEach((d: any) => {
      if (!d.spots?.user_id || !d.paid_at) return;
      
      const dateKey = toNigerianDateString(d.paid_at);
      if (!dropsByDate.has(dateKey)) {
        dropsByDate.set(dateKey, []);
      }
      dropsByDate.get(dateKey)!.push(d);
    });

    // Format date label using Nigerian time
    const todayNigerian = getNigerianDate();
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayNigerian = toNigerianDateString(yesterdayDate.toISOString());

    const formatDateLabel = (dateStr: string): string => {
      if (dateStr === todayNigerian) return "Today";
      if (dateStr === yesterdayNigerian) return "Yesterday";
      
      const [year, month, day] = dateStr.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString('en-NG', { 
        weekday: 'short',
        month: 'short', 
        day: 'numeric' 
      });
    };

    // Build days array
    const days: DayData[] = [];
    const sortedDates = [...dropsByDate.keys()].sort((a, b) => b.localeCompare(a));

    for (const dateKey of sortedDates) {
      const dayDrops = dropsByDate.get(dateKey) || [];
      
      // Build unique earners map (aggregate by user)
      const earnerMap = new Map<string, { total: number; count: number }>();
      dayDrops.forEach((d: any) => {
        const userId = d.spots.user_id;
        const existing = earnerMap.get(userId) || { total: 0, count: 0 };
        earnerMap.set(userId, { 
          total: existing.total + 400, 
          count: existing.count + 1 
        });
      });

      // Convert to unique earners array
      const unique_earners: UniqueEarner[] = [...earnerMap.entries()].map(([userId, data]) => {
        const profile = profilesMap.get(userId);
        return {
          user_id: userId,
          full_name: profile?.full_name || "Member",
          avatar_url: profile?.avatar_url || null,
          total_earned_today: data.total,
          spots_count: userSpotCounts.get(userId) || 1,
        };
      }).sort((a, b) => b.total_earned_today - a.total_earned_today);

      // Build spots list - group by spot_id and aggregate
      const spotMap = new Map<string, SpotEntry>();
      
      dayDrops.forEach((d: any) => {
        const profile = profilesMap.get(d.spots.user_id);
        const existing = spotMap.get(d.spot_id);
        
        if (existing) {
          existing.cycles_today += 1;
          existing.total_earned_today += 400;
          // Keep the most recent payment time
          if (d.paid_at > existing.last_cycle_at) {
            existing.last_cycle_at = d.paid_at;
          }
        } else {
          spotMap.set(d.spot_id, {
            spot_id: d.spot_id,
            spot_name: d.spots.spot_name || "Ad Share",
            cycles_today: 1,
            total_earned_today: 400,
            last_cycle_at: d.paid_at,
            owner: {
              user_id: d.spots.user_id,
              full_name: profile?.full_name || "Member",
              avatar_url: profile?.avatar_url || null,
              total_spots: userSpotCounts.get(d.spots.user_id) || 1,
            },
          });
        }
      });
      
      // Convert to array, sort by total earned (highest first), and limit
      const allSpots = [...spotMap.values()]
        .sort((a, b) => b.total_earned_today - a.total_earned_today);
      const spots = allSpots.slice(0, spots_per_day);

      days.push({
        date: dateKey,
        label: formatDateLabel(dateKey),
        unique_earners,
        spots,
        stats: {
          total_cycles: dayDrops.length,
          total_distributed: dayDrops.length * 400,
          unique_earners_count: earnerMap.size,
        },
        has_more_spots: allSpots.length > spots_per_day,
      });
    }

    // Global stats - use paid_at IS NOT NULL with Nigerian time
    const { count: totalAllTime } = await supabaseAdmin
      .from("drops")
      .select("id", { count: "exact", head: true })
      .not("paid_at", "is", null);

    const todayStartUtc = getNigerianTodayStart();
    const { count: todayCount } = await supabaseAdmin
      .from("drops")
      .select("id", { count: "exact", head: true })
      .not("paid_at", "is", null)
      .gte("paid_at", todayStartUtc);

    console.log(`[get-winners] Returning ${days.length} days, all_time=${totalAllTime}, today=${todayCount}`);

    return new Response(
      JSON.stringify({
        days,
        global_stats: {
          all_time_cycles: totalAllTime || 0,
          all_time_distributed: (totalAllTime || 0) * 400,
          today_cycles: todayCount || 0,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[get-winners] Error:", error);
    return new Response(JSON.stringify({ error: error?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
