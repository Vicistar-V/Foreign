create table if not exists public.pending_restore_intents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  count int not null check (count between 1 and 50),
  total_cost numeric not null check (total_cost >= 0),
  base_fee numeric not null default 5000,
  extra_fee numeric not null default 3000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);

grant select on public.pending_restore_intents to authenticated;
grant all on public.pending_restore_intents to service_role;

alter table public.pending_restore_intents enable row level security;

drop policy if exists "own read" on public.pending_restore_intents;
create policy "own read" on public.pending_restore_intents
  for select using (auth.uid() = user_id);

create or replace function public.pending_restore_intents_touch()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pending_restore_intents_touch on public.pending_restore_intents;
create trigger pending_restore_intents_touch before update on public.pending_restore_intents
for each row execute function public.pending_restore_intents_touch();

-- Referral bonus dedupe: partial unique index enforces
-- "one referral_payout per referee on activation" at the DB level so
-- concurrent activation webhooks can never double-pay the referrer.
create unique index if not exists uniq_referral_activation_per_referee
  on public.transactions ((metadata->>'referee_id'))
  where transaction_type = 'referral_payout'
    and metadata->>'paid_on' = 'activation';