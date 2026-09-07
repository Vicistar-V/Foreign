import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type RangeKey = '1d' | '2d' | '7d' | '14d' | '30d' | '90d' | 'all'
type Granularity = 'hour' | 'day' | 'week'

interface Bucket {
  bucket: string // ISO timestamp marking start of bucket (Nigerian local moment, stored as UTC ISO)
  signups: number
  activations: number
}

const LAGOS_OFFSET_MS = 60 * 60 * 1000 // UTC+1, no DST

// Convert a real UTC Date to a Date object whose UTC fields read like Nigerian local time
function toLagosClock(d: Date): Date {
  return new Date(d.getTime() + LAGOS_OFFSET_MS)
}
// Inverse — take a Date whose UTC fields are Lagos clock, return real UTC
function fromLagosClock(d: Date): Date {
  return new Date(d.getTime() - LAGOS_OFFSET_MS)
}

function startOfLagosHour(d: Date): Date {
  const lagos = toLagosClock(d)
  lagos.setUTCMinutes(0, 0, 0)
  return fromLagosClock(lagos)
}
function startOfLagosDay(d: Date): Date {
  const lagos = toLagosClock(d)
  lagos.setUTCHours(0, 0, 0, 0)
  return fromLagosClock(lagos)
}
function startOfLagosWeek(d: Date): Date {
  const lagos = toLagosClock(d)
  const dow = lagos.getUTCDay() // 0=Sun
  lagos.setUTCDate(lagos.getUTCDate() - dow)
  lagos.setUTCHours(0, 0, 0, 0)
  return fromLagosClock(lagos)
}

function resolveGranularity(range: RangeKey): Granularity {
  if (range === '1d' || range === '2d') return 'hour'
  if (range === 'all') return 'week'
  return 'day'
}

function getPeriodStart(range: RangeKey, now: Date): Date {
  if (range === 'all') {
    // 1 year back ceiling — anything older bucketed into earliest week
    const d = new Date(now)
    d.setUTCFullYear(d.getUTCFullYear() - 1)
    return startOfLagosWeek(d)
  }
  if (range === '1d') return startOfLagosDay(now)
  if (range === '2d') {
    const d = startOfLagosDay(now)
    d.setUTCDate(d.getUTCDate() - 1)
    return d
  }
  const days = parseInt(range, 10)
  const d = startOfLagosDay(now)
  d.setUTCDate(d.getUTCDate() - (days - 1))
  return d
}

function bucketKey(d: Date, gran: Granularity): string {
  if (gran === 'hour') return startOfLagosHour(d).toISOString()
  if (gran === 'week') return startOfLagosWeek(d).toISOString()
  return startOfLagosDay(d).toISOString()
}

function buildBucketSpine(start: Date, end: Date, gran: Granularity): string[] {
  const keys: string[] = []
  let cursor = gran === 'hour' ? startOfLagosHour(start)
    : gran === 'week' ? startOfLagosWeek(start)
    : startOfLagosDay(start)
  while (cursor.getTime() <= end.getTime()) {
    keys.push(cursor.toISOString())
    const next = new Date(cursor)
    if (gran === 'hour') next.setUTCHours(next.getUTCHours() + 1)
    else if (gran === 'week') next.setUTCDate(next.getUTCDate() + 7)
    else next.setUTCDate(next.getUTCDate() + 1)
    cursor = next
  }
  return keys
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // --- Auth gate: must be logged-in admin ---
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: userErr } = await supabase.auth.getUser(token)
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: userData.user.id,
      _role: 'admin',
    })
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }


    let range: RangeKey = '30d'
    try {
      const body = await req.json()
      if (body?.range && ['1d', '2d', '7d', '14d', '30d', '90d', 'all'].includes(body.range)) {
        range = body.range as RangeKey
      }
    } catch {
      // default
    }

    const now = new Date()
    const granularity = resolveGranularity(range)
    const periodStart = getPeriodStart(range, now)
    const periodStartISO = periodStart.toISOString()

// Page through results to bypass the 1000-row default limit
    async function fetchAllDates(
      table: 'profiles_signups' | 'profiles_activations',
    ): Promise<string[]> {
      const PAGE = 1000
      const out: string[] = []
      let from = 0
      // eslint-disable-next-line no-constant-condition
      while (true) {
        let q
        if (table === 'profiles_signups') {
          q = supabase.from('profiles')
            .select('created_at')
            .gte('created_at', periodStartISO)
            .order('created_at', { ascending: true })
            .range(from, from + PAGE - 1)
        } else {
          q = supabase.from('profiles')
            .select('activated_at')
            .not('activated_at', 'is', null)
            .gte('activated_at', periodStartISO)
            .order('activated_at', { ascending: true })
            .range(from, from + PAGE - 1)
        }
        const { data, error } = await q
        if (error) throw error
        if (!data || data.length === 0) break
        for (const row of data) {
          const v = (row as { created_at?: string; activated_at?: string }).created_at
            ?? (row as { activated_at?: string }).activated_at
          if (v) out.push(v)
        }
        if (data.length < PAGE) break
        from += PAGE
      }
      return out
    }

    const [signupDates, activationDates] = await Promise.all([
      fetchAllDates('profiles_signups'),
      fetchAllDates('profiles_activations'),
    ])

    const signupsByBucket: Record<string, number> = {}
    const activationsByBucket: Record<string, number> = {}

    signupDates.forEach((iso) => {
      const k = bucketKey(new Date(iso), granularity)
      signupsByBucket[k] = (signupsByBucket[k] || 0) + 1
    })
    activationDates.forEach((iso) => {
      const k = bucketKey(new Date(iso), granularity)
      activationsByBucket[k] = (activationsByBucket[k] || 0) + 1
    })

    const spine = buildBucketSpine(periodStart, now, granularity)
    const buckets: Bucket[] = spine.map((b) => ({
      bucket: b,
      signups: signupsByBucket[b] || 0,
      activations: activationsByBucket[b] || 0,
    }))

    const totalSignups = buckets.reduce((s, b) => s + b.signups, 0)
    const totalActivations = buckets.reduce((s, b) => s + b.activations, 0)

    return new Response(
      JSON.stringify({
        range,
        granularity,
        periodStart: periodStartISO,
        periodEnd: now.toISOString(),
        totalSignups,
        totalActivations,
        buckets,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('get-user-growth-trend error:', err)
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
