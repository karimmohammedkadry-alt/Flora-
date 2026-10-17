-- Flora Fashion Hijab — Stage 8 Production Audit
-- Run this in Supabase SQL Editor.
-- Read-only checks; this script does not delete or modify business data.

select 'TABLES' as section, table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('products','cart_items','orders','order_items','contact_messages')
order by table_name;

select 'RLS' as section, c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('products','cart_items','orders','order_items','contact_messages')
order by c.relname;

select 'POLICIES' as section,
       schemaname, tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in ('products','cart_items','orders','order_items','contact_messages')
order by tablename, policyname;

select 'FUNCTION' as section,
       n.nspname as schema_name,
       p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as arguments,
       p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'create_order';

select 'GRANTS' as section,
       routine_schema, routine_name, grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name = 'create_order'
order by grantee, privilege_type;

select 'COUNTS' as section,
  (select count(*) from public.products) as products,
  (select count(*) from public.cart_items) as cart_items,
  (select count(*) from public.orders) as orders,
  (select count(*) from public.order_items) as order_items,
  (select count(*) from public.contact_messages) as contact_messages;
