# Flora Fashion Hijab — Production release checklist

## Important boundary
The source ZIP can implement application behavior, but it cannot publish DNS/HTTPS, change Supabase project settings, configure a verified sender, or prove that remote backups restore correctly. Mark each item complete only after the live test passes.

## Apply safely
1. Back up the Supabase database before changing production.
2. Apply `supabase/stage21_production_hardening.sql` in Supabase SQL Editor. It only creates/replaces the status-transition function and grants; it does not delete store rows.
3. Deploy `supabase/functions/flora-admin` using `supabase functions deploy flora-admin --no-verify-jwt`.
4. Set Edge Function secrets: `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, and the public key variable required by the deployed client (`SUPABASE_ANON_KEY` or `SUPABASE_PUBLISHABLE_KEY`). Never expose the service role key in frontend files.
5. For first admin setup only, set `FLORA_ADMIN_SETUP_SECRET` to a random secret with at least 24 characters. Create the admin using `/dashboard/`, then remove this secret from Edge Function secrets.
6. For automatic order status emails, configure `RESEND_API_KEY` and a verified `FLORA_FROM_EMAIL`. Without both, status changes continue to work but email notifications are not sent.
7. Publish the static site on an HTTPS host and test the final deployed URL. The dashboard must be under `/dashboard/`.

## Must-pass live tests
- Customer: browse and add to cart while signed out; request OTP; reject incorrect and expired OTP; verify correct OTP; submit once; refresh the success page; ensure no duplicate order.
- Inventory: test insufficient stock and simultaneous attempts; confirm no negative stock.
- Privacy: customer A cannot read customer B's order or order items by changing URL/ID; anonymous users cannot read orders.
- Admin: wrong username/password rejected; customer session rejected from admin APIs; valid admin can update product and order status; no dashboard OTP prompt.
- Cancellation: cancel a pending/confirmed/preparing order; stock increases by the exact item quantities once; retrying cancellation or changing a cancelled order is rejected.
- Notifications: if Resend is configured, test delivered and failed email delivery; test WhatsApp opens the correct Egyptian number and prefilled message.
- Mobile/desktop: checkout, OTP input, product grid, cart, order success, dashboard dialogs and tables.
- Recovery: export/backup database and storage; restore into a separate test project and verify products, orders, order items, and images before relying on the backup.

## Shipping and policies
Current order RPC calculates shipping as 0.00. Confirm whether shipping is genuinely free before launch. If fees vary by governorate, implement and test the actual fee table before taking live orders; do not advertise free shipping unless that is the real policy. Publish accurate delivery, cancellation/returns, privacy, terms, and contact information.

## Deployment SEO
The package includes a favicon and Open Graph basics. Add `sitemap.xml` with the real public HTTPS domain after the domain is finalized; do not publish a sitemap with a placeholder domain. Confirm `robots.txt` and security headers at the host/CDN layer.
