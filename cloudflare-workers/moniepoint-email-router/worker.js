/**
 * Moniepoint Email Router — Cloudflare Email Worker
 * ---------------------------------------------------
 * Bound to webhook@viketa.xyz via Cloudflare Email Routing.
 *
 * Flow per email:
 *   1. Fully decode MIME (base64 + quoted-printable) parts.
 *   2. Reject anything that isn't a Moniepoint credit alert.
 *   3. Extract fields with tight regexes (title/label-safe).
 *   4. Compute a stable email_id hash (whitespace-normalized).
 *   5. POST to Supabase webhook with retry + timeout + structured error logs.
 *   6. On parse failure, POST a "parse_failed" stub so admin still sees it.
 *
 * Env vars: WEBHOOK_URL
 */

export default {
  async email(message, env, ctx) {
    try {
      const raw = await streamToText(message.raw);
      const body = decodeMime(raw);

      if (!/credit transaction occurred/i.test(body)) return;

      const parsed = extractFields(body);
      const subject = message.headers.get('subject') || null;

      // ---- Parse failure: still forward a stub so admin sees the raw event
      if (!parsed.credit_amount || !parsed.sender_name) {
        const stubId = await sha256(raw.slice(0, 1000) + (subject || ''));
        await dispatchWithRetry(env, ctx, {
          email_id: stubId,
          credit_amount: null,
          sender_name: '__PARSE_FAILED__',
          raw_body_preview: body.slice(0, 2000),
          subject,
          received_at: new Date().toISOString(),
          parse_failed: true,
        });
        return;
      }

      const normalizedDate = (parsed.date_time || '').replace(/\s+/g, ' ').trim();
      const emailId = await sha256(
        [
          parsed.sender_name.trim().toUpperCase(),
          String(parsed.credit_amount),
          normalizedDate,
          parsed.account_number || '',
        ].join('|')
      );

      const payload = {
        email_id: emailId,
        credit_amount: parsed.credit_amount,
        sender_name: parsed.sender_name,
        account_balance: parsed.account_balance,
        account_number: parsed.account_number,
        date_time: parsed.date_time,
        narration: parsed.narration,
        subject,
        received_at: new Date().toISOString(),
      };

      await dispatchWithRetry(env, ctx, payload);
    } catch (err) {
      // Never throw from an Email Worker — Cloudflare would bounce the email.
      console.error(JSON.stringify({ event: 'worker_uncaught', error: String(err) }));
    }
  },
};

/* ---------- dispatch with retry + timeout ---------- */

function dispatchWithRetry(env, ctx, payload) {
  ctx.waitUntil(
    (async () => {
      const bodyStr = JSON.stringify(payload);
      const delays = [0, 2000, 8000, 20000]; // ~30s of retries under CF's wall
      for (let attempt = 0; attempt < delays.length; attempt++) {
        if (delays[attempt]) await sleep(delays[attempt]);
        try {
          const res = await fetch(env.WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: bodyStr,
            signal: AbortSignal.timeout(8000),
          });
          if (res.ok) return;
          const txt = await res.text().catch(() => '');
          console.error(
            JSON.stringify({
              event: 'webhook_http_error',
              attempt,
              status: res.status,
              email_id: payload.email_id,
              body_preview: txt.slice(0, 200),
            })
          );
          if (res.status < 500 && res.status !== 429) return; // no retry on 4xx
        } catch (err) {
          console.error(
            JSON.stringify({
              event: 'webhook_fetch_failed',
              attempt,
              email_id: payload.email_id,
              credit_amount: payload.credit_amount,
              sender_name: payload.sender_name,
              error: String(err),
            })
          );
        }
      }
      // All retries exhausted — final DLQ record in Worker logs.
      console.error(
        JSON.stringify({ event: 'webhook_dlq', lost_payload: payload })
      );
    })()
  );
  return Promise.resolve();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- MIME decoding ---------- */

async function streamToText(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8');
  let out = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  return out;
}

function decodeMime(raw) {
  // Normalize CR and quoted-printable soft breaks up front.
  const normalized = raw.replace(/\r/g, '').replace(/=\n/g, '');

  const boundaryMatch = normalized.match(/boundary="?([^"\r\n;]+)"?/i);
  if (!boundaryMatch) {
    return decodeSection(normalized) + '\n' + normalized;
  }

  const boundary = boundaryMatch[1];
  const escBoundary = boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = normalized.split(new RegExp('--' + escBoundary, 'g'));

  const decoded = [];
  for (const part of parts) {
    decoded.push(decodeSection(part));
  }
  // Include raw as well — some malformed emails have fields outside parts.
  decoded.push(normalized);
  return decoded.join('\n');
}

function decodeSection(section) {
  const headerEnd = section.indexOf('\n\n');
  const headers = headerEnd >= 0 ? section.slice(0, headerEnd) : section;
  const payload = headerEnd >= 0 ? section.slice(headerEnd + 2) : '';

  if (/Content-Transfer-Encoding:\s*base64/i.test(headers)) {
    try {
      return atob(payload.replace(/\s+/g, ''));
    } catch {
      return payload;
    }
  }
  if (/Content-Transfer-Encoding:\s*quoted-printable/i.test(headers)) {
    return payload.replace(/=([0-9A-Fa-f]{2})/g, (_, h) =>
      String.fromCharCode(parseInt(h, 16))
    );
  }
  return payload || section;
}

/* ---------- helpers ---------- */

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function grab(body, regex) {
  const m = body.match(regex);
  return m ? m[1].trim() : null;
}

function parseAmount(txt) {
  if (!txt) return null;
  const cleaned = txt.replace(/[^\d.]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function extractFields(body) {
  const clean = body.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ');

  const credit_amount = parseAmount(
    grab(clean, /Credit Amount[\s\S]{0,60}?(?:N|₦|NGN)?\s*([\d,]+\.\d{2})/i)
  );

  const account_balance = parseAmount(
    grab(clean, /Account Balance:?[\s\S]{0,60}?(?:N|₦|NGN)?\s*([\d,]+\.\d{2})/i)
  );

  const account_number = grab(clean, /Account Number:?[\s\S]{0,60}?(\d{10,})/i);

  // Sender name: strictly uppercase word tokens (max 5), stopping before any
  // subsequent label word so we don't absorb "Date", "Transfer", etc.
  const senderRegex =
    /Sender['’]s\s*Name:?[\s\S]{0,120}?(?:from\s+)?([A-Z][A-Z.'’-]+(?:\s+[A-Z][A-Z.'’-]+){0,4})/i;
  let sender_name = grab(clean, senderRegex);
  if (sender_name) {
    // Guard: reject if match starts with a stopword-only token
    sender_name = sender_name.replace(/\s+/g, ' ').trim();
    const first = sender_name.split(' ')[0].toLowerCase();
    if (['date', 'time', 'narration', 'account', 'balance', 'credit', 'transfer'].includes(first)) {
      sender_name = null;
    }
  }

  const date_time = grab(
    clean,
    /Date\s*&?\s*Time:?[\s\S]{0,60}?([0-9]{1,2}\s+\w+,\s*\d{4}\s*\|\s*[\d:]+\s*[AP]\.?M\.?)/i
  );

  const narration = grab(
    clean,
    /Narration:?[\s\S]{0,60}?(Transfer\s+from[^\n<]+)/i
  );

  return {
    credit_amount,
    account_balance,
    account_number,
    sender_name,
    date_time,
    narration: narration ? narration.trim() : null,
  };
}
