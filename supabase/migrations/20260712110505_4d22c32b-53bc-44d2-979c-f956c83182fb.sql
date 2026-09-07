create or replace function public.expire_stale_payment_attempts()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_expired_gateway int;
  v_expired_moniepoint int;
  v_purged_intents int;
begin
  -- Paystack / Flutterwave: 1 hour window. Skip attempts owned by a user
  -- whose pending_restore_intents row is still live, so the deposit
  -- webhook's auto-resume has time to fire.
  with expired_gw as (
    update public.payment_attempts pa
    set status = 'expired',
        metadata = coalesce(pa.metadata, '{}'::jsonb) || jsonb_build_object(
          'expired_at', now(),
          'expired_reason', 'No completion after 1 hour'
        )
    where pa.status = 'pending'
      and pa.provider in ('paystack', 'flutterwave')
      and pa.created_at < now() - interval '1 hour'
      and not exists (
        select 1 from public.payment_attempts other
        where other.tx_ref = pa.tx_ref
          and other.status = 'verified'
      )
      and not exists (
        select 1 from public.pending_restore_intents pri
        where pri.user_id = pa.user_id
          and pri.expires_at > now()
      )
    returning 1
  )
  select count(*) into v_expired_gateway from expired_gw;

  -- Moniepoint bank transfer: 2 hour window. Same restore-intent shield.
  with expired_mnp as (
    update public.payment_attempts pa
    set status = 'expired',
        metadata = coalesce(pa.metadata, '{}'::jsonb) || jsonb_build_object(
          'expired_at', now(),
          'expired_reason', 'No matching Moniepoint credit after 2 hours'
        )
    where pa.status = 'pending'
      and pa.provider = 'moniepoint'
      and pa.created_at < now() - interval '2 hours'
      and not exists (
        select 1 from public.payment_attempts other
        where other.tx_ref = pa.tx_ref
          and other.status = 'verified'
      )
      and not exists (
        select 1 from public.pending_restore_intents pri
        where pri.user_id = pa.user_id
          and pri.expires_at > now()
      )
    returning 1
  )
  select count(*) into v_expired_moniepoint from expired_mnp;

  -- Sweep expired restore intents so the table stays healthy.
  with purged as (
    delete from public.pending_restore_intents
    where expires_at <= now()
    returning 1
  )
  select count(*) into v_purged_intents from purged;

  return jsonb_build_object(
    'success', true,
    'expired_count', v_expired_gateway + v_expired_moniepoint,
    'expired_gateway', v_expired_gateway,
    'expired_moniepoint', v_expired_moniepoint,
    'purged_restore_intents', v_purged_intents,
    'ran_at', now()
  );
end;
$$;