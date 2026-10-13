# Flora Fashion Hijab — First-Time Admin Account Setup

The first visit to `/dashboard/` offers **إنشاء الحساب لأول مرة**. Enter your chosen username, password, and password confirmation. The dashboard sends an email verification code to `karimmohammedkadry@gmail.com`; after verifying the code, the Edge Function securely assigns the admin role and links the username to the existing Supabase Auth user. Passwords are never stored in site files.

## One-time setup (before using the dashboard)
1. In Supabase Dashboard → Authentication → Users, make sure `karimmohammedkadry@gmail.com` already exists and can receive email.
2. Run `supabase/dashboard_admin_auth_setup.sql` once in Supabase SQL Editor. It only creates the private username mapping table.
3. In Supabase → Edge Functions → Secrets, ensure `SUPABASE_ANON_KEY` (or `SUPABASE_PUBLISHABLE_KEY`) is the project's public anon/publishable key, not the service-role key.
4. Deploy the Edge Function from the project root:
   ```bash
   supabase login
   supabase link --project-ref vznmljvoarfjugnaqdhv
   supabase functions deploy flora-admin --no-verify-jwt
   ```
   `verify_jwt = false` is required for the initial OTP/login requests. The function explicitly validates bearer tokens for setup and every protected dashboard action.
5. In Supabase → Authentication → Email Templates, make sure the Magic Link/OTP template includes the numeric `{{ .Token }}` code. Email OTP sign-in must be enabled. If email sending/confirmation is not configured, setup cannot finish.
6. Open `/dashboard/`, choose **إنشاء الحساب لأول مرة**, enter username, password and confirmation, request the email code, then submit it.

After the first account is created, the first-time setup endpoint refuses another setup. Use normal login and Dashboard → الحساب والأمان for future username/password changes. Never place an admin password or service-role key in website files, GitHub, or messages.
