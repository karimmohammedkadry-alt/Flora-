-- ============================================================
-- FLORA FASHION HIJAB - PHASE 2
-- STORE <-> ADMIN DASHBOARD INTEGRATION
-- ============================================================
-- Safe to run repeatedly.
-- Store users can READ active products and their own orders/cart.
-- Admin Dashboard users require app_metadata.role = 'admin'.
-- Never put service_role in the public Store frontend.
-- ============================================================

-- ---------- 1) Product/order timestamps ----------
alter table public.products
  add column if not exists updated_at timestamptz not null default now();

alter table public.orders
  add column if not exists updated_at timestamptz not null default now();

alter table public.contact_messages
  add column if not exists status text not null default 'new';

alter table public.contact_messages
  drop constraint if exists contact_messages_status_check;

alter table public.contact_messages
  add constraint contact_messages_status_check
  check (status in ('new','read','resolved'));

-- ---------- 2) Generic updated_at trigger ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

-- ---------- 3) Useful indexes ----------
create index if not exists products_updated_at_idx
  on public.products(updated_at desc);

create index if not exists products_active_category_idx
  on public.products(active, category, sort_order);

create index if not exists orders_updated_at_idx
  on public.orders(updated_at desc);

create index if not exists orders_status_idx
  on public.orders(status, created_at desc);

create index if not exists orders_user_created_idx
  on public.orders(user_id, created_at desc);

create index if not exists contact_messages_status_idx
  on public.contact_messages(status, created_at desc);

-- ---------- 4) Admin authorization helper ----------
create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

-- ---------- 5) Products: public read, admin write ----------
drop policy if exists products_public_read on public.products;
create policy products_public_read
on public.products
for select
to anon, authenticated
using (active = true or public.is_admin());

drop policy if exists products_admin_insert on public.products;
create policy products_admin_insert
on public.products
for insert
to authenticated
with check (public.is_admin());

drop policy if exists products_admin_update on public.products;
create policy products_admin_update
on public.products
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists products_admin_delete on public.products;
create policy products_admin_delete
on public.products
for delete
to authenticated
using (public.is_admin());

-- ---------- 6) Orders: owner read, admin read/update ----------
drop policy if exists orders_select_own on public.orders;
create policy orders_select_own
on public.orders
for select
to authenticated
using ((select auth.uid()) = user_id or public.is_admin());

drop policy if exists orders_admin_update on public.orders;
create policy orders_admin_update
on public.orders
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ---------- 7) Order items: owner/admin read ----------
drop policy if exists order_items_select_own on public.order_items;
create policy order_items_select_own
on public.order_items
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.orders o
    where o.id = order_id
      and o.user_id = (select auth.uid())
  )
);

-- ---------- 8) Database-enforced order status workflow ----------
create or replace function public.enforce_order_status_transition()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if not (
    (old.status = 'pending'   and new.status in ('confirmed','cancelled')) or
    (old.status = 'confirmed' and new.status in ('preparing','cancelled')) or
    (old.status = 'preparing' and new.status in ('shipping','cancelled')) or
    (old.status = 'shipping'  and new.status = 'delivered')
  ) then
    raise exception 'Invalid order status transition: % -> %', old.status, new.status;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_status_transition_guard on public.orders;
create trigger orders_status_transition_guard
before update of status on public.orders
for each row execute function public.enforce_order_status_transition();

-- ---------- 8) Contact messages: owner insert, admin read/update ----------
drop policy if exists contact_insert_own on public.contact_messages;
create policy contact_insert_own
on public.contact_messages
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists contact_admin_select on public.contact_messages;
create policy contact_admin_select
on public.contact_messages
for select
to authenticated
using (public.is_admin());

drop policy if exists contact_admin_update on public.contact_messages;
create policy contact_admin_update
on public.contact_messages
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ---------- 9) Keep public privileges tight ----------
revoke insert, update, delete on public.products from anon;
revoke insert, update, delete on public.orders from anon;
revoke insert, update, delete on public.order_items from anon;
revoke select, update, delete on public.contact_messages from anon;

-- Policies do not grant SQL privileges by themselves.
-- These grants allow authenticated sessions to reach the policy checks.
grant select, insert, update, delete on public.products to authenticated;
grant select, update on public.orders to authenticated;
grant select on public.order_items to authenticated;
grant insert, select, update on public.contact_messages to authenticated;

-- ---------- 10) Verification ----------
select
  'products' as table_name,
  count(*) as rows_count
from public.products
union all
select 'orders', count(*) from public.orders
union all
select 'order_items', count(*) from public.order_items
union all
select 'contact_messages', count(*) from public.contact_messages;

select
  tablename,
  policyname,
  cmd,
  roles
from pg_policies
where schemaname = 'public'
  and tablename in ('products','orders','order_items','contact_messages')
order by tablename, policyname;
