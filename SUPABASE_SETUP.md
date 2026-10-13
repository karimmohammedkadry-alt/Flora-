# Flora Fashion Hijab — Supabase Setup

## 1. Enable Anonymous Auth
Supabase Dashboard → Authentication → Providers → Anonymous → Enable.

## 2. Run the production-safe schema
Run `supabase/schema.sql` in the Supabase SQL Editor.

This file is idempotent:
- creates missing tables
- adds missing columns
- checks critical column types
- creates missing foreign keys
- enables RLS and recreates required policies
- recreates the checkout RPC with server-side validation
- does NOT seed demo products
- does NOT reset existing stock

## 3. Start with a completely empty store
If you intentionally want a clean store before importing real Flora products, run:

`supabase/reset_store_data.sql`

This deletes products, carts, orders, order items and contact messages. It does NOT delete `auth.users`.

## 4. Verify the database
Run:

`supabase/verify_schema.sql`

You should see these tables:
- products
- cart_items
- orders
- order_items
- contact_messages

And these important relationships:
- cart_items.user_id → auth.users.id
- cart_items.product_id → products.id
- orders.user_id → auth.users.id
- order_items.order_id → orders.id
- order_items.product_id → products.id
- contact_messages.user_id → auth.users.id

## 5. Important
Do not put the Supabase `service_role` / secret key in the website frontend. The frontend should use only the publishable/anon key.

## Phase 2 — Dashboard Integration
Run `supabase/phase2_dashboard_integration.sql` after the base schema.

The separate Admin Dashboard must authenticate an admin whose JWT contains:
`app_metadata.role = admin`.

The public Store never receives or stores a service-role key.
