# Flora customer OTP and production redirect checklist

## Important: Supabase Dashboard settings are required
The website code cannot make email arrive if Supabase SMTP/email delivery is misconfigured. In Supabase Dashboard → Authentication → URL Configuration:

- Set **Site URL** to the real deployed storefront origin (for example, `https://your-real-domain.vercel.app`; use the exact domain you actually deployed). Do not leave `http://localhost:3000` as the production Site URL.
- Add the exact deployed origin and the account page path to **Redirect URLs**, e.g. `https://your-real-domain.vercel.app/**` (or the exact allowed URL pattern supported by the dashboard).
- Do not copy the example domain literally. Use your actual Vercel domain/custom domain.

## Make the email deliver a six-digit OTP
In Authentication → Email Templates, inspect the template used for signup/magic link. The customer account UI expects a six-digit token, so the email body must display `{{ .Token }}` prominently. If the template only uses `{{ .ConfirmationURL }}`, it sends a clickable link instead of showing the code expected by this page. Save the template and send a test email.

## Email delivery
If no email arrives, check Authentication → Logs for the request/error, spam/junk, provider rate limits, and the project's email/SMTP configuration. For reliable production delivery, configure a verified SMTP provider and sender domain if the default service limits or delivery are insufficient. Never put SMTP passwords or service-role keys in frontend files.

## Signup profile fields
The account page now asks for full name and mobile number in Create Account mode, and stores these as Supabase Auth user metadata after OTP verification. They are not automatically copied into a separate public profile table unless the project has a trigger/table designed for that.

## Test after deploy
1. Deploy the updated `flora` website to Vercel.
2. Open the deployed URL, not a local development URL.
3. Create a test customer account and confirm the email contains a six-digit code.
4. Verify that the code succeeds and the browser remains on the deployed domain.
5. Test login with the same email.
6. Confirm active nav highlight and hover underline on desktop and mobile.
