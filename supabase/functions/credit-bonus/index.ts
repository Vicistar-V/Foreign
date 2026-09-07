// Admin balance adjustment — supports ADD or REMOVE on earnings, deposit, or pending wallet.
// Kept the function name "credit-bonus" for backwards compatibility; treat it as "admin-adjust-balance".

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ success: false, error: 'Not signed in' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const service = createClient(supabaseUrl, serviceKey);

    // Identify the caller from the JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: authError } = await service.auth.getUser(token);
    if (authError || !userData?.user) {
      console.error('[admin-adjust-balance] auth error:', authError?.message);
      return json({ success: false, error: 'Not signed in' }, 401);
    }
    const adminId = userData.user.id;

    // Confirm admin
    const { data: isAdmin, error: roleErr } = await service.rpc('has_role', {
      _user_id: adminId,
      _role: 'admin',
    });
    if (roleErr || !isAdmin) {
      console.error('[admin-adjust-balance] not admin:', roleErr?.message);
      return json({ success: false, error: 'Only admins can do this' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const {
      userId,
      amount,
      walletType,
      reason,
      adminPin,
      operation, // 'add' | 'remove' — defaults to 'add' for backwards compat
    } = body || {};

    const op: 'add' | 'remove' = operation === 'remove' ? 'remove' : 'add';

    if (!userId || typeof userId !== 'string') {
      return json({ success: false, error: 'Pick a user' }, 400);
    }
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      return json({ success: false, error: 'Enter an amount greater than zero' }, 400);
    }
    if (!['earnings', 'deposit', 'pending'].includes(walletType)) {
      return json({ success: false, error: 'Pick a wallet (earnings, deposit or pending)' }, 400);
    }
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return json({ success: false, error: 'Type a reason' }, 400);
    }
    if (!adminPin || typeof adminPin !== 'string' || !/^\d{4}$/.test(adminPin)) {
      return json({ success: false, error: 'Enter your 4-digit admin PIN' }, 400);
    }

    // Verify admin PIN by calling verify-pin with the caller's JWT
    const verifyResp = await fetch(`${supabaseUrl}/functions/v1/verify-pin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
        apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      },
      body: JSON.stringify({ pin: adminPin }),
    });
    const verifyJson = await verifyResp.json().catch(() => ({}));
    if (!verifyResp.ok || !verifyJson?.valid) {
      console.log('[admin-adjust-balance] PIN rejected');
      return json({ success: false, error: verifyJson?.error || 'Wrong PIN' }, 400);
    }

    // Run the atomic balance change
    const { data: result, error: rpcError } = await service.rpc('atomic_admin_adjust_balance', {
      _user_id: userId,
      _amount: amount,
      _wallet_type: walletType,
      _operation: op,
      _reason: reason,
      _admin_id: adminId,
    });

    if (rpcError) {
      console.error('[admin-adjust-balance] rpc error:', rpcError.message);
      return json({ success: false, error: rpcError.message || 'Could not adjust balance' }, 400);
    }

    const userName = (result as any)?.user_name ?? 'the user';
    console.log(
      `[admin-adjust-balance] ${op.toUpperCase()} ₦${amount} on ${walletType} for ${userName} by admin ${adminId}`,
    );

    return json({
      success: true,
      message:
        op === 'add'
          ? `Added ₦${amount.toLocaleString()} to ${userName}'s ${walletType} wallet`
          : `Removed ₦${amount.toLocaleString()} from ${userName}'s ${walletType} wallet`,
      user_name: userName,
      amount,
      wallet_type: walletType,
      operation: op,
    });
  } catch (e: any) {
    console.error('[admin-adjust-balance] unexpected:', e?.message || e);
    return json({ success: false, error: e?.message || 'Server error' }, 500);
  }
});
