-- Stage 20: add customer email to orders.
alter table public.orders add column if not exists customer_email text;
-- Apply the matching updated create_order function from supabase/schema.sql as part of deployment.
