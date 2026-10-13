# Flora Fashion Hijab — Stage 8: Live Production Readiness

## Scope
This stage hardens the customer-facing store only. The Dashboard remains intentionally out of scope.

## Fixes included
- Fixed cart quantity updates so they explicitly resolve the current authenticated/anonymous user before querying or updating cart rows.
- Fixed cart item removal for the same reason.
- Added a checkout submission lock to prevent duplicate submissions caused by repeated clicks while the RPC request is running.
- Validation failures release the submission lock so the customer can correct the form and retry.
- Kept the authoritative order creation path on the Supabase `create_order` RPC; client-side totals remain display-only.
- Re-ran JavaScript syntax validation for every JS file in the store.

## Production checks to run before handover

### Supabase
1. Run `supabase/stage8_production_audit.sql` in the Supabase SQL Editor.
2. Confirm all required tables exist.
3. Confirm RLS is enabled on customer data tables.
4. Confirm the customer can only read/write their own cart and orders.
5. Confirm `create_order` exists and is executable by the client role.
6. Confirm no service-role/secret key exists in frontend files.
7. Confirm the publishable/anon key is the only Supabase credential shipped to the browser.

### Customer flow
1. Open the loading page.
2. Open the shop and confirm products load.
3. Open a product and add it to the cart.
4. Change quantity up/down.
5. Try a quantity above available stock; it must be rejected.
6. Remove an item from the cart.
7. Return to the shop and add another product.
8. Open checkout and verify totals.
9. Submit a valid cash-on-delivery order once.
10. Rapidly click the confirmation button; only one order must be created.
11. Verify the success page and order details.
12. Verify the cart is empty after successful order creation.
13. Change the order status in the database/admin flow and verify the customer timeline.
14. Verify another anonymous user cannot read the first user's order.

## Important delivery note
A store should only be called fully production-ready after the above checks are executed against the actual Supabase project and the deployed domain. Static code checks cannot prove live RLS, authentication, database policies, or hosting behavior.

## Dashboard
Dashboard work is intentionally paused for this stage.
