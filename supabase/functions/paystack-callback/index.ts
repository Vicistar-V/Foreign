// Paystack browser-redirect callback.
// User finishes payment on Paystack → Paystack redirects here with `?reference=...&trxref=...`
// We verify with Paystack, run the shared processor, then redirect to /dashboard with a status param.

import { paystackVerify, processPaystackPayment } from '../_shared/paystack-processor.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_SAFE_ORIGIN = 'https://viketa.xyz';

function safeOrigin(candidate: string | null): string {
  if (!candidate) return DEFAULT_SAFE_ORIGIN;
  try {
    const u = new URL(candidate);
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.origin;
  } catch {}
  return DEFAULT_SAFE_ORIGIN;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const origin = safeOrigin(url.searchParams.get('origin'));

  try {
    console.log('🔗 Paystack callback received');

    // Paystack sends `reference` AND `trxref` (same value)
    const reference =
      url.searchParams.get('reference') ||
      url.searchParams.get('trxref');

    if (!reference) {
      console.error('❌ Missing Paystack reference');
      return Response.redirect(`${origin}/dashboard?payment=failed&reason=missing_reference`, 302);
    }

    console.log('🔎 Verifying Paystack reference:', reference);

    let verifyData;
    try {
      verifyData = await paystackVerify(reference);
    } catch (e) {
      console.error('❌ Paystack verify error:', e);
      return Response.redirect(`${origin}/dashboard?payment=failed&reason=verification_failed`, 302);
    }

    const result = await processPaystackPayment(verifyData, 'callback');

    if (!result.ok) {
      console.error('❌ Process failed:', result);
      const reason =
        result.code === 'AMOUNT_MISMATCH' ? 'amount_mismatch' :
        result.code === 'USER_NOT_FOUND' ? 'user_not_found' :
        result.code === 'MISSING_USER_META' ? 'missing_user_data' :
        result.code === 'INVALID_CURRENCY' ? 'invalid_currency' :
        result.code === 'BAD_STATUS' ? verifyData.status :
        'server_error';
      return Response.redirect(`${origin}/dashboard?payment=failed&reason=${reason}`, 302);
    }

    if (result.duplicate) {
      return Response.redirect(
        `${origin}/dashboard?payment=success&amount=${result.amount}&type=${result.payment_type}&note=already_processed`,
        302
      );
    }

    return Response.redirect(
      `${origin}/dashboard?payment=success&amount=${result.amount}&type=${result.payment_type}`,
      302
    );
  } catch (error) {
    console.error('💥 paystack-callback error:', error);
    return Response.redirect(`${origin}/dashboard?payment=failed&reason=server_error`, 302);
  }
});
