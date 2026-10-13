# Flora Fashion Hijab — Stage 7 Final QA & Security Hardening

This stage is customer-store only. Dashboard work remains paused.

## Fixed in Stage 7
- Cart update/delete operations now include the authenticated user ID in the client query as an extra ownership guard.
- Product quantity selector is capped by the currently available stock.
- Switching product variants resets/clamps the selected quantity to the new variant stock.
- Removed remaining customer-facing `alert()` calls from product/shop flows and replaced them with the unified Arabic toast/error system.
- Product loading errors no longer expose raw database error text to customers.
- JavaScript syntax checked successfully for all store JS files.

## Security model confirmed in the project SQL
- Customer tables use Row Level Security.
- Cart rows are restricted to the current authenticated user.
- Orders are restricted to the current authenticated user; admin access is handled separately.
- Order items are visible only through the owning order or admin role.
- Customer checkout uses the server-side `create_order` RPC rather than trusting browser totals.
- The RPC recalculates subtotal, locks product rows, checks stock, creates order snapshots, decrements stock, and clears the user's cart.
- The `create_order` function is `security definer` with `search_path = public`, and direct table write privileges are not used by the customer checkout flow.
- Anonymous/public clients are not granted customer-table write access.

## Manual production acceptance tests
Run these against the actual Supabase project before handoff:

1. Open the store in a clean browser session and confirm products load.
2. Add a product with stock = 1; confirm the cart cannot increase it to 2.
3. Set a product inactive; confirm it disappears from the public store.
4. Set stock = 0; confirm it cannot be added.
5. Add two different products and place a cash-on-delivery order.
6. Confirm exactly one order is created and the cart becomes empty.
7. Double-click the checkout button rapidly; confirm only one order is created.
8. Change order status in the admin environment and confirm the customer timeline reflects it.
9. Open an order URL from another authenticated/anonymous session; confirm it is not accessible.
10. Submit the contact form and confirm the message reaches the database.
11. Refresh every customer page and confirm there are no broken script/page references.
12. Test mobile width and desktop width.

## Important deployment note
This package is hardened and statically checked, but a real production handoff still requires the manual Supabase/browser acceptance tests above. Static code checks cannot prove the live project's Auth, RLS, database migrations, domain, and network configuration are correct.
