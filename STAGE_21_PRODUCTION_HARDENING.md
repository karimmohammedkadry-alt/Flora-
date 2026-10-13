# Stage 21 — Production hardening

## Implemented in this package
- Dashboard first-time setup no longer asks for email OTP. It is protected by a one-time `FLORA_ADMIN_SETUP_SECRET` held only in Edge Function secrets; remove the secret after bootstrap.
- Dashboard sign-in remains username + password and protected operations still require an admin-role session.
- Customer checkout email OTP is unchanged.
- Order status updates now use a database transaction. Cancelling an order restores the ordered quantities to stock exactly once, and cancelled orders cannot be reopened through the normal status flow.
- Optional customer status emails via Resend are sent by the Edge Function when `RESEND_API_KEY` and `FLORA_FROM_EMAIL` are configured. WhatsApp remains a manual prefilled-message fallback.
- A safe migration file is included for an existing database.

## Must still be configured/tested in your accounts
- Deploy the updated Edge Function and apply `supabase/stage21_production_hardening.sql`.
- Set then remove the one-time setup secret after first admin setup.
- Configure Resend sender/API key if automatic order status emails are wanted.
- Run real end-to-end tests on the deployed HTTPS domain, including OTP delivery, duplicate submit, insufficient stock, cancellation/restock, admin access from a non-admin session, and backup restore. This source package cannot verify the live Supabase project, DNS/hosting, SMTP, or backup provider from here.
