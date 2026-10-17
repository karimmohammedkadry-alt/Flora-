-- Flora Fashion Hijab — Stage 1 security/database baseline audit
-- READ ONLY. Run in Supabase SQL Editor before applying any further migration.
-- Does not change schema, policies, credentials, or business data.

-- A. Core table existence and RLS state.
select c.relname as table_name, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as force_rls
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r'
  and c.relname in ('products','cart_items','orders','order_items','contact_messages',
                    'flora_dashboard_admin_usernames','flora_customer_accounts',
                    'flora_admin_device_tokens','flora_order_push_events')
order by c.relname;

-- B. Direct table grants to browser roles. Review unexpected INSERT/UPDATE/DELETE/ALL grants.
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema='public' and grantee in ('anon','authenticated','public')
  and table_name in ('products','cart_items','orders','order_items','contact_messages',
                     'flora_dashboard_admin_usernames','flora_customer_accounts',
                     'flora_admin_device_tokens','flora_order_push_events')
order by table_name, grantee, privilege_type;

-- C. RLS policies on the app's data tables.
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies where schemaname='public'
  and tablename in ('products','cart_items','orders','order_items','contact_messages',
                    'flora_dashboard_admin_usernames','flora_customer_accounts',
                    'flora_admin_device_tokens','flora_order_push_events')
order by tablename, policyname;

-- D. SECURITY DEFINER functions: confirm fixed search_path and least-privilege EXECUTE grants.
select n.nspname as schema_name, p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as arguments,
       p.prosecdef as security_definer, p.proconfig as function_settings,
       coalesce(array_to_string(p.proacl, ', '), '(default ACL)') as acl
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prosecdef
order by p.proname;

-- E. Storage bucket visibility (review public buckets and policies manually).
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets order by name;

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies where schemaname='storage' order by tablename, policyname;

-- F. Counts for sanity only; no row content is exposed and nothing is modified.
select (select count(*) from public.products) as products,
       (select count(*) from public.orders) as orders,
       (select count(*) from public.order_items) as order_items,
       (select count(*) from public.contact_messages) as contact_messages;
