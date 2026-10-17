-- Flora customer phone/password auth mapping. Run once in Supabase SQL Editor.
create table if not exists public.flora_customer_accounts (
  phone text primary key check (phone ~ '^01[0125][0-9]{8}$'),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null,
  created_at timestamptz not null default now()
);
alter table public.flora_customer_accounts enable row level security;
revoke all on public.flora_customer_accounts from anon, authenticated;
grant all on public.flora_customer_accounts to service_role;
