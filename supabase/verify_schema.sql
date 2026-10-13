-- Flora Fashion Hijab - Supabase structure verification

select table_name
from information_schema.tables
where table_schema='public'
  and table_name in ('products','cart_items','orders','order_items','contact_messages')
order by table_name;

select
  tc.table_name, kcu.column_name, ccu.table_name as references_table,
  ccu.column_name as references_column, rc.delete_rule
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name=kcu.constraint_name and tc.table_schema=kcu.table_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name=tc.constraint_name and ccu.table_schema=tc.table_schema
join information_schema.referential_constraints rc
  on rc.constraint_name=tc.constraint_name and rc.constraint_schema=tc.table_schema
where tc.constraint_type='FOREIGN KEY'
  and tc.table_schema='public'
  and tc.table_name in ('cart_items','orders','order_items','contact_messages')
order by tc.table_name, kcu.column_name;

select schemaname, tablename, rowsecurity
from pg_tables
where schemaname='public'
  and tablename in ('products','cart_items','orders','order_items','contact_messages')
order by tablename;
