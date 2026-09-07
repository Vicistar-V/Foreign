// Safely parse a Response body as JSON.
// Payment gateways (Flutterwave, Paystack) sometimes return HTML error pages
// (Cloudflare 502/503, maintenance, captcha challenges). Calling resp.json()
// directly on those throws "Unexpected token '<', '<!DOCTYPE'... is not valid JSON",
// which surfaces to users as a confusing crash.
//
// safeJson reads the body as text first, tries to parse, and on failure returns
// a friendly structured error so the caller can show "Payment gateway is busy,
// please try again" instead of leaking parser internals.

export type SafeJsonResult<T = any> =
  | { ok: true; data: T; status: number }
  | { ok: false; status: number; raw: string; error: string };

export async function safeJson<T = any>(resp: Response): Promise<SafeJsonResult<T>> {
  let raw = '';
  try {
    raw = await resp.text();
  } catch (e) {
    return {
      ok: false,
      status: resp.status,
      raw: '',
      error: `Could not read gateway response: ${(e as Error).message}`,
    };
  }

  if (!raw) {
    return {
      ok: false,
      status: resp.status,
      raw: '',
      error: `Empty response from gateway (HTTP ${resp.status})`,
    };
  }

  try {
    return { ok: true, data: JSON.parse(raw) as T, status: resp.status };
  } catch {
    const looksLikeHtml = /^\s*<(?:!doctype|html|head|body)/i.test(raw);
    const snippet = raw.slice(0, 200).replace(/\s+/g, ' ').trim();
    return {
      ok: false,
      status: resp.status,
      raw,
      error: looksLikeHtml
        ? `Gateway returned an HTML error page (HTTP ${resp.status}). It may be temporarily down. Snippet: ${snippet}`
        : `Gateway returned non-JSON (HTTP ${resp.status}): ${snippet}`,
    };
  }
}
