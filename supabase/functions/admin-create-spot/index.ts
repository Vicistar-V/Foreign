// Admin creates a spot on behalf of a user (PIN-protected).
// Routes through the existing buy-spot edge function via service role so the
// full distribution / notification / telegram pipeline runs exactly the same
// way it does for a real purchase.

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
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const service = createClient(supabaseUrl, serviceKey);

    // Identify caller
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: authError } = await service.auth.getUser(token);
    if (authError || !userData?.user) {
      return json({ success: false, error: 'Not signed in' }, 401);
    }
    const adminId = userData.user.id;

    // Must be admin
    const { data: isAdmin } = await service.rpc('has_role', {
      _user_id: adminId,
      _role: 'admin',
    });
    if (!isAdmin) {
      return json({ success: false, error: 'Only admins can do this' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const { userId, sourceWallet, adminPin } = body || {};
    const quantity = Math.max(1, Math.min(100, Number(body?.quantity ?? 1)));
    // Deterministic dedup token: prefer client-supplied, fall back to a
    // minute-bucketed hash of admin+user+quantity so a browser-retried request
    // within the same minute maps to the same idempotency keys downstream.
    const clientIdemToken: string | undefined = typeof body?.idempotency_token === 'string' && body.idempotency_token.length > 0
      ? body.idempotency_token
      : undefined;

    if (!userId || typeof userId !== 'string') {
      return json({ success: false, error: 'Pick a user' }, 400);
    }
    if (sourceWallet !== 'deposit' && sourceWallet !== 'earnings') {
      return json({ success: false, error: 'Pick a wallet (deposit or earnings)' }, 400);
    }
    if (!Number.isFinite(quantity) || quantity < 1) {
      return json({ success: false, error: 'Pick how many spots to buy' }, 400);
    }
    if (!adminPin || typeof adminPin !== 'string' || !/^\d{4}$/.test(adminPin)) {
      return json({ success: false, error: 'Enter your 4-digit admin PIN' }, 400);
    }


    // Verify admin PIN
    const verifyResp = await fetch(`${supabaseUrl}/functions/v1/verify-pin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
        apikey: anonKey,
      },
      body: JSON.stringify({ pin: adminPin }),
    });
    const verifyJson = await verifyResp.json().catch(() => ({}));
    if (!verifyResp.ok || !verifyJson?.valid) {
      return json({ success: false, error: verifyJson?.error || 'Wrong PIN' }, 400);
    }

    // Confirm target user is activated + not banned
    const { data: targetProfile, error: profErr } = await service
      .from('profiles')
      .select('id, full_name, is_member, is_banned')
      .eq('id', userId)
      .single();

    if (profErr || !targetProfile) {
      return json({ success: false, error: 'User not found' }, 404);
    }
    if (targetProfile.is_banned) {
      return json({ success: false, error: 'User is banned' }, 400);
    }
    if (!targetProfile.is_member) {
      return json({ success: false, error: 'User has not activated yet' }, 400);
    }

    // Deterministic dedup base: minute-bucket so a client double-submit within
    // the same minute reuses the same idempotency keys and the second call
    // short-circuits via buy-spot's lockRef instead of double-charging.
    const minuteBucket = Math.floor(Date.now() / 60000);
    const idemBase = clientIdemToken ?? `admin::${adminId}::${userId}::${quantity}::${minuteBucket}`;

    // Loop: delegate to buy-spot per spot. Stop early on first failure
    // (typically insufficient balance) and report partial progress.
    const created: Array<{ spot_id: string; spot_name: string; position: number }> = [];
    let stopReason: string | null = null;

    for (let i = 0; i < quantity; i++) {
      let buyJson: { success?: boolean; spot_id?: string; spot_name?: string; position?: number; error?: string } = {};
      let ok = false;

      // Empire mode can race: a concurrent distribution may retire the ticket
      // between iterations, flipping the branch buy-spot takes. Retry once on
      // transient failure so a legitimate multi-spot bulk doesn't truncate.
      for (let attempt = 0; attempt < 2 && !ok; attempt++) {
        const buyResp = await fetch(`${supabaseUrl}/functions/v1/buy-spot`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            target_user_id: userId,
            source_wallet: sourceWallet,
            idempotency_key: `${idemBase}::${i}${attempt > 0 ? `::r${attempt}` : ''}`,
          }),
        });
        buyJson = await buyResp.json().catch(() => ({}));
        ok = buyResp.ok && !!buyJson?.success;
        if (!ok && attempt === 0) {
          console.warn('[admin-create-spot] transient buy-spot failure, retrying', { i, err: buyJson?.error });
        }
      }

      if (!ok) {
        console.error('[admin-create-spot] buy-spot failed at', i + 1, buyJson);
        stopReason = buyJson?.error || 'Could not activate the ad share';
        break;
      }

      created.push({
        spot_id: buyJson.spot_id!,
        spot_name: buyJson.spot_name!,
        position: buyJson.position!,
      });
    }


    if (created.length === 0) {
      return json(
        { success: false, error: stopReason || 'Could not activate the ad share' },
        400,
      );
    }

    // Audit notification for admins (one summary entry per bulk action)
    await service.from('admin_notifications').insert({
      notification_type: 'admin_created_spot',
      title: created.length > 1 ? 'Admin activated ad shares in bulk' : 'Admin activated an ad share',
      message:
        created.length > 1
          ? `Admin created ${created.length} spots for ${targetProfile.full_name} (from ${sourceWallet})`
          : `Admin created ${created[0].spot_name} for ${targetProfile.full_name} at position #${created[0].position} (from ${sourceWallet})`,
      metadata: {
        admin_id: adminId,
        target_user_id: userId,
        source_wallet: sourceWallet,
        quantity_requested: quantity,
        quantity_created: created.length,
        spots: created,
        stop_reason: stopReason,
      },
      link: `/admin/users/${userId}`,
    });

    console.log(
      `[admin-create-spot] admin ${adminId} created ${created.length}/${quantity} spots for ${userId} from ${sourceWallet}`,
    );

    const partial = created.length < quantity;
    return json({
      success: true,
      quantity_requested: quantity,
      quantity_created: created.length,
      spots: created,
      partial,
      stop_reason: stopReason,
      message: partial
        ? `Created ${created.length} of ${quantity} spots for ${targetProfile.full_name}. Stopped: ${stopReason}`
        : created.length > 1
          ? `Created ${created.length} spots for ${targetProfile.full_name}`
          : `${created[0].spot_name} created for ${targetProfile.full_name} at position #${created[0].position}`,
    });
  } catch (e: any) {
    console.error('[admin-create-spot] unexpected:', e?.message || e);
    return json({ success: false, error: e?.message || 'Server error' }, 500);
  }
});
