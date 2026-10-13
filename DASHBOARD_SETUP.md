# Flora Fashion Hijab — Dashboard Setup

## One-time setup
1. Confirm `karimmohammedkadry@gmail.com` exists in Supabase Authentication → Users and can receive email.
2. Run `supabase/dashboard_admin_auth_setup.sql` once in Supabase SQL Editor to create the private username mapping table.
3. Make sure the Edge Function has the project's public anon/publishable key configured as `SUPABASE_ANON_KEY` or `SUPABASE_PUBLISHABLE_KEY`.
4. Deploy `flora-admin` using `supabase functions deploy flora-admin --no-verify-jwt` from the project root. See `FLORA_DASHBOARD_AUTH_UPDATE.md` for the full setup steps.
5. Open `/dashboard/`. If no admin account has been initialized, the page will automatically ask you to create a username, password, and password confirmation, then verify the email OTP.

After first-time setup, manage credentials from Dashboard → الحساب والأمان. Do not put the Supabase service-role key or any password in frontend files.
