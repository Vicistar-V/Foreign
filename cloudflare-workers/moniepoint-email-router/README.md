# Moniepoint Email Router — Cloudflare Email Worker

Deployed as an **Email Worker** on Cloudflare, bound to `webhook@viketa.xyz`
via Cloudflare Email Routing (`Send to Worker`). When a Moniepoint credit-alert
email arrives, this worker:

1. Fully decodes the MIME body (base64 + quoted-printable + boundary parts).
2. Confirms it's a Moniepoint credit alert (`credit transaction occurred`).
3. Extracts sender name, credit amount, account number, timestamp, narration.
4. Computes a stable `email_id` hash (whitespace-normalized) for idempotency.
5. POSTs a small JSON payload to the Supabase edge function
   `moniepoint-email-webhook`, with **retry + backoff + 8s per-attempt timeout**
   and structured error logging on failure.
6. On parse failure it still POSTs a `parse_failed: true` stub so the raw email
   surfaces in the admin dashboard for manual recovery.

## Setup

1. In the Cloudflare dashboard: **Email → Email Routing → Email Workers**,
   create a new Email Worker and paste the contents of `worker.js`.
2. Set the following **environment variable** on the Worker:
   - `WEBHOOK_URL` — `https://sbprvewcfrtazdlcfvxt.supabase.co/functions/v1/moniepoint-email-webhook`
3. Under **Email → Routing Rules**, route `webhook@viketa.xyz` to this worker.

That's it. There is no shared secret. Abuse defenses live server-side:
- Hard `MAX_PLAUSIBLE_CREDIT = ₦2,000,000` ceiling in the Supabase function.
- Payload shape validation.
- Unique index on `transaction_reference` prevents replay.
- The matching RPC only credits real pending attempts by name + amount.

## Observability

- The Cloudflare Worker logs structured JSON on every failure
  (`webhook_fetch_failed`, `webhook_http_error`, `webhook_dlq`). Ship these to
  R2 or an external log sink via **Log Push** so you can replay lost emails.
- The Supabase admin page (`/admin/moniepoint`) shows a **24h pipeline health**
  card: total emails received, auto-matched, pending, parse-failed. If the
  total drops to 0 for a full day, the Worker is likely broken.

## Flow diagram

```
Moniepoint SMTP
      │
      ▼
Cloudflare Email Routing → Email Worker (this file)
      │  (JSON POST, retry×4, 8s timeout, no secret)
      ▼
Supabase Edge: moniepoint-email-webhook
      │
      ├─ INSERT unmatched_moniepoint_payments (idempotent by email_id)
      │
      ▼
RPC: match_and_credit_moniepoint
      │  (name-token + amount ±5 matching, FOR UPDATE SKIP LOCKED)
      │
      ├─ marks payment_attempts.verified
      │
      ▼
credit-user.ts: creditMembership / creditDeposit
      │
      ▼
Only after credit succeeds → mark unmatched.resolved = true
```

## Manual replay

If Log Push shows a `webhook_dlq` entry, re-POST the `lost_payload` object to
the `WEBHOOK_URL` manually with a fresh `email_id` (or the original — the
webhook is idempotent).
