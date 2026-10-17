-- Flora Fashion Hijab - Phase 2: catalog/order query indexes
-- Non-destructive migration. Does not delete or rewrite store data.
-- Run only after the final review of the deployment target.

create index if not exists products_active_category_sort_idx
  on public.products (category, sort_order, created_at desc)
  where active = true;

create index if not exists products_active_price_idx
  on public.products (price asc)
  where active = true;

create index if not exists products_active_stock_idx
  on public.products (stock_quantity asc)
  where active = true;

create index if not exists orders_status_created_idx
  on public.orders (status, created_at desc);

create index if not exists orders_order_number_idx
  on public.orders (order_number);

create index if not exists orders_phone_idx
  on public.orders (phone);

create index if not exists order_items_product_id_idx
  on public.order_items (product_id);

-- Intentionally no destructive statements, no RLS changes, and no data reset.
