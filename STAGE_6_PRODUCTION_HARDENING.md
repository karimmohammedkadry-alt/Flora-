# Flora Fashion Hijab — Stage 6 Production Hardening

This stage focuses only on the customer-facing store. The Admin Dashboard is intentionally out of scope.

## Included
- Safer customer-facing error messages with reusable toast feedback.
- Cart stock warnings and disabled quantity controls when unavailable.
- Featured products now use the real `featured` database flag; fake positional badges were removed.
- Order timeline now marks completed steps and handles cancelled orders correctly.
- Order details validates a missing order id before querying.
- Checkout surfaces database/RPC errors without exposing raw database messages to customers.
- Contact form uses the same friendly error mapping.
- Arabic RTL declaration is applied to the loading page.
- No demo product seed is introduced.

## Supabase
Run the existing Stage 5 migrations in this order:
1. `supabase/schema.sql`
2. `supabase/phase2_dashboard_integration.sql`
3. `supabase/verify_schema.sql`

Do not run `reset_store_data.sql` unless an intentional empty-store reset is required.

## Manual acceptance tests
- Add a product with stock 1, add it to cart, try increasing to 2: it must be blocked.
- Set stock to 0: product must show unavailable and cannot be added.
- Create a valid COD order: it must create exactly one order and clear the cart.
- Double-click the checkout button: only one order should be created.
- Change an order status in Supabase: customer order timeline must show all completed steps.
- Set an order to cancelled: timeline must show cancellation instead of a fake delivery flow.
- Open an order belonging to another anonymous user: it must not be visible.
- Search from any page: it must route to `shop.html?q=...`.
