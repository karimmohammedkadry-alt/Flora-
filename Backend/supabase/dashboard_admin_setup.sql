-- Flora Fashion Hijab — Admin setup
-- Run in Supabase SQL Editor.
-- Replace the email value below with the exact Admin user's email.
-- This script is safe to run before replacement: it will affect 0 rows if the email does not exist.

-- 1) Inspect the target user first.
select id, email, raw_app_meta_data
from auth.users
where lower(email) = lower('ADMIN_EMAIL_HERE');

-- 2) Assign the admin role.
-- IMPORTANT: replace ADMIN_EMAIL_HERE before running this UPDATE.
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('role', 'admin')
where lower(email) = lower('ADMIN_EMAIL_HERE');

-- 3) Verify the role.
select id, email, raw_app_meta_data
from auth.users
where lower(email) = lower('ADMIN_EMAIL_HERE');

-- 4) After signing in to the Dashboard, verify the JWT role with: 
-- select public.is_admin();
