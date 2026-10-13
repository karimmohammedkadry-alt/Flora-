# Flora Dashboard — Password-only admin login (no dashboard OTP)

Customer email OTP remains enabled in the checkout flow. Dashboard login uses the private username mapping plus Supabase Auth password and does not ask for an email OTP.

## One-time setup
1. Run `supabase/dashboard_admin_auth_setup.sql` in the Supabase SQL Editor if the private username mapping table is not already present.
2. In Supabase → Edge Functions → Secrets, set `FLORA_ADMIN_SETUP_SECRET` to a strong random secret of at least 24 characters. Do not put this secret in GitHub or any source file.
3. Ensure `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_URL` are set as function secrets. `SUPABASE_ANON_KEY` or `SUPABASE_PUBLISHABLE_KEY` may be set as the public key used by the login client.
4. Deploy from the project root:

```bash
supabase login
supabase link --project-ref vznmljvoarfjugnaqdhv
supabase functions deploy flora-admin --no-verify-jwt
```

5. Open `/dashboard/`. If no admin username has been set, use the one-time setup form with the server secret, username, and a password of at least 12 characters. The backend creates or updates the dedicated admin Auth account `karimmohammedkadry@gmail.com`, marks it email-confirmed server-side, and assigns `app_metadata.role=admin`.
6. Immediately remove `FLORA_ADMIN_SETUP_SECRET` from Edge Function secrets after successful setup. Do not share it. Setup then remains closed because the admin username mapping exists.
7. Log in using username + password. No OTP is requested for the dashboard. Customer checkout OTP is unaffected.

## Order status email notifications (optional but recommended)
Set Edge Function secrets `RESEND_API_KEY` and `FLORA_FROM_EMAIL` to enable status emails. `FLORA_FROM_EMAIL` must be a sender/domain verified in Resend. If these secrets are absent, dashboard status changes still work and the existing WhatsApp prefilled-message action remains available, but no automatic email is sent.

## Production safety
- Keep `SUPABASE_SERVICE_ROLE_KEY`, `FLORA_ADMIN_SETUP_SECRET`, and `RESEND_API_KEY` server-side only.
- The Edge Function uses `verify_jwt=false` so public login/bootstrap requests can reach it; all admin data operations validate a real Bearer token and `app_metadata.role=admin` inside the function.
- After deployment, test customer OTP separately from admin password login.
- Apply `supabase/stage21_production_hardening.sql` to an existing database to add atomic status changes and one-time stock restoration when an order is cancelled. This migration is non-destructive.
