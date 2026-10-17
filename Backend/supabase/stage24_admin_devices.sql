-- Stage 24: private admin device registry for Firebase Cloud Messaging.
-- Safe to re-run. Tokens are never readable/writable from anon/authenticated clients.
create table if not exists public.flora_admin_device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text not null default 'android' check (platform in ('android','ios','web')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists flora_admin_device_tokens_active_idx
  on public.flora_admin_device_tokens(active, updated_at desc);
alter table public.flora_admin_device_tokens enable row level security;
revoke all on public.flora_admin_device_tokens from anon, authenticated;
grant all on public.flora_admin_device_tokens to service_role;

-- Repair columns queried by the current web store/dashboard.
alter table public.products add column if not exists updated_at timestamptz not null default now();
alter table public.contact_messages add column if not exists status text not null default 'new';

create or replace function public.set_products_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at before update on public.products
for each row execute function public.set_products_updated_at();

-- Idempotency guard for database webhook retries.
create table if not exists public.flora_order_push_events (
  order_id uuid primary key references public.orders(id) on delete cascade,
  created_at timestamptz not null default now(),
  sent_count integer not null default 0,
  failed_count integer not null default 0
);
alter table public.flora_order_push_events enable row level security;
revoke all on public.flora_order_push_events from anon, authenticated;
grant all on public.flora_order_push_events to service_role;
