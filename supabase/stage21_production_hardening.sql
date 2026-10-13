-- Flora Fashion Hijab Stage 21 migration: safe to apply to an existing database.
-- Does not drop tables, truncate rows, reset stock, or delete existing business data.
create or replace function public.admin_set_order_status(p_order_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_order public.orders%rowtype; v_allowed boolean := false; v_stock_restored boolean := false;
begin
  if auth.role() <> 'service_role' then raise exception 'Not authorized'; end if;
  if p_status not in ('pending','confirmed','preparing','shipping','delivered','cancelled') then raise exception 'Invalid order status'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.status = p_status then return jsonb_build_object('changed',false,'status',v_order.status,'stock_restored',false,'order',to_jsonb(v_order)); end if;
  v_allowed := case v_order.status when 'pending' then p_status in ('confirmed','cancelled') when 'confirmed' then p_status in ('preparing','cancelled') when 'preparing' then p_status in ('shipping','cancelled') when 'shipping' then p_status='delivered' when 'delivered' then false when 'cancelled' then false else false end;
  if not v_allowed then raise exception 'Invalid order status transition'; end if;
  update public.orders set status=p_status where id=p_order_id returning * into v_order;
  if p_status='cancelled' then
    update public.products p set stock_quantity=p.stock_quantity+r.qty from (select product_id,sum(quantity)::integer qty from public.order_items where order_id=p_order_id and product_id is not null group by product_id) r where p.id=r.product_id;
    v_stock_restored := true;
  end if;
  return jsonb_build_object('changed',true,'status',p_status,'stock_restored',v_stock_restored,'order',to_jsonb(v_order));
end; $$;
revoke all on function public.admin_set_order_status(uuid,text) from public, anon, authenticated;
grant execute on function public.admin_set_order_status(uuid,text) to service_role;
