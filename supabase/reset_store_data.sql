-- Flora Fashion Hijab - CLEAN STORE DATA RESET
-- WARNING: This permanently deletes store business data.
-- It does NOT delete auth.users or Supabase Anonymous Auth accounts.
-- Run only when you intentionally want an empty store before importing real data.

truncate table
  public.contact_messages,
  public.order_items,
  public.orders,
  public.cart_items,
  public.products
restart identity cascade;

-- Verify the store is empty.
select
  (select count(*) from public.products) as products,
  (select count(*) from public.cart_items) as cart_items,
  (select count(*) from public.orders) as orders,
  (select count(*) from public.order_items) as order_items,
  (select count(*) from public.contact_messages) as contact_messages;
