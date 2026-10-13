-- Flora Fashion Hijab: one-time schema for the dashboard's first-account setup.
-- Run this file once in Supabase SQL Editor. Do NOT add passwords or service keys here.
create table if not exists public.flora_dashboard_admin_usernames (
  username text primary key check (char_length(username) between 3 and 64),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.flora_dashboard_admin_usernames enable row level security;
revoke all on table public.flora_dashboard_admin_usernames from anon, authenticated;
grant all on table public.flora_dashboard_admin_usernames to service_role;

-- The first-time dashboard flow verifies ownership of karimmohammedkadry@gmail.com by email OTP,
-- then assigns the admin role and saves the chosen username/password through the Edge Function.
-- After setup is complete, account name/password changes happen inside Dashboard > الحساب والأمان.
