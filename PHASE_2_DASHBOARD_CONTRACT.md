# Flora Fashion Hijab — Phase 2 Dashboard Contract

## Store
- Public/anonymous users: read only `products` where `active = true`.
- Authenticated customer: own cart, own orders and own order items only.
- Customer checkout: only through `public.create_order()`.
- Store frontend must never contain `service_role`.

## Admin Dashboard
Admin authentication must issue a Supabase JWT with:

```json
{
  "app_metadata": {
    "role": "admin"
  }
}
```

The dashboard can then manage:
- products: insert/update/delete
- product stock, price, active, featured, sort_order
- orders: read/update status
- order items: read
- contact messages: read/update status

## Important
Do not use `user_metadata.role` for authorization. Use `app_metadata.role` because users cannot safely self-assign it from the public client.

## Recommended order-status workflow
`pending -> confirmed -> preparing -> shipping -> delivered`

Cancellation should normally be:
`pending/confirmed/preparing -> cancelled`

The dashboard should not change an order from `delivered` back to an earlier state without an explicit business rule.
