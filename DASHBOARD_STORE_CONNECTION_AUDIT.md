# Flora Fashion Hijab — Store ↔ Dashboard Connection Audit

## Result
The Store and Dashboard use the same Supabase project and the same public client configuration.

## Verified contracts
- products: Store reads active products; Dashboard reads/writes as admin.
- cart_items: Store owns cart rows by auth.uid().
- orders: Store reads only its own orders; Dashboard reads/updates as admin.
- order_items: Store reads items through its own order; Dashboard reads order details as admin.
- contact_messages: Store inserts as its authenticated/anonymous user; Dashboard reads/updates as admin.
- create_order RPC: Checkout uses the server-side RPC; prices, totals and stock are calculated server-side.
- Admin role: app_metadata.role = admin; Dashboard rejects non-admin sessions.
- RLS: enabled on all business tables.

## Fixed in this audit
1. Admin setup SQL no longer casts a placeholder string to UUID. It uses a safe email placeholder.
2. Order status transitions are now enforced by a database trigger, not only by Dashboard JavaScript.
3. Dashboard explicitly warns when its client-side 500-row cache is reached.

## Production note
For very large stores, replace the Dashboard's client-side 500-row cache with server-side summary RPCs and pagination.
