-- Flora Fashion Hijab — Stage 7 live security audit
-- Run AFTER schema.sql and phase2_dashboard_integration.sql.
-- Read-only audit: this file does not modify business data.

-- 1) RLS must be enabled on every customer table.
select c.relname as table_name,
       c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('products','cart_items','orders','order_items','contact_messages')
order by c.relname;

-- 2) Public/anonymous table privileges should be read-only for products and absent for customer data.
select table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee = 'anon'
  and table_name in ('products','cart_items','orders','order_items','contact_messages')
order by table_name, privilege_type;

-- 3) Customer-facing authenticated privileges.
select table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee = 'authenticated'
  and table_name in ('products','cart_items','orders','order_items','contact_messages')
order by table_name, privilege_type;

-- 4) Policies currently installed.
select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('products','cart_items','orders','order_items','contact_messages')
order by tablename, policyname;

-- 5) Checkout RPC must be SECURITY DEFINER and have a fixed search_path.
select p.oid::regprocedure as function_name,
       p.prosecdef as security_definer,
       p.proconfig as configuration
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'create_order';

-- 6) Confirm expected foreign keys.
select tc.table_name,
       kcu.column_name,
       ccu.table_name as referenced_table,
       ccu.column_name as referenced_column,
       rc.delete_rule
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.table_schema = kcu.table_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
 and ccu.table_schema = tc.table_schema
join information_schema.referential_constraints rc
  on rc.constraint_name = tc.constraint_name
 and rc.constraint_schema = tc.table_schema
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema = 'public'
  and tc.table_name in ('cart_items','orders','order_items','contact_messages')
order by tc.table_name, kcu.column_name;
