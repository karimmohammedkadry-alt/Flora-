# Stage 23 — QA, order alerts, and security hardening

## Included in this package
- Customer account OTP resend button now has a 30-second visible cooldown. This is a usability guard only; configure Supabase Auth rate limits as the server-side control.
- Dashboard includes an explicit “Enable order alerts” button. After the admin clicks it, the open dashboard polls the protected bootstrap endpoint every 20 seconds and refreshes order/product/message data. Newly observed pending orders trigger a sound, an in-dashboard toast, and a browser notification when the browser permission is granted.
- Polling pauses while the dashboard tab is hidden and resumes on the next interval after it becomes visible. Notifications require the dashboard to be open and authenticated; this is not a background push service and will not notify while the browser/site is closed.
- Edge Function no longer uses wildcard CORS. Set `FLORA_DASHBOARD_ORIGIN` to the exact deployed dashboard origin, e.g. `https://your-domain.example` (no trailing slash). If hosted on a separate dashboard domain, use that exact origin.
- Password-change UI validation now requires at least 12 characters, aligned with first-time setup guidance.

## Required deployment configuration
1. In Supabase Edge Function secrets, set `FLORA_DASHBOARD_ORIGIN` to the exact origin serving `dashboard/index.html`.
2. Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only. Never add it to HTML/JS or public hosting environment variables.
3. Keep customer OTP enabled in Supabase Auth. Configure email SMTP/template and test delivery to a real mailbox.
4. Configure Supabase Auth rate limits and CAPTCHA/abuse controls where available. The browser cooldown is not a security boundary.
5. Redeploy: `supabase functions deploy flora-admin --no-verify-jwt`.
6. Enable dashboard notifications once per open session by clicking “تفعيل تنبيهات الطلبات”. Allow notifications in the browser and keep the dashboard open.

## Verification performed on the package
- `node --check` passed for every `js/*.js` and `dashboard/*.js` file.
- ZIP integrity check passed.

## Not claimed as verified
This package has not been live-tested against the user's Supabase project, actual SMTP/Resend provider, deployed domain, or a real WhatsApp account. Browser alerts depend on the dashboard remaining open. To notify while the dashboard/browser is closed, configure a server-side push/email/WhatsApp provider and its credentials; do not put provider secrets in frontend code.

## Recommended end-to-end acceptance test
1. Create a test customer, request OTP, verify a valid code, then test invalid/expired codes.
2. Request a second OTP and verify the visible cooldown blocks repeated clicks for 30 seconds.
3. Place one test order and confirm exactly one row/order-items set appears in Supabase and the dashboard.
4. Keep dashboard open, enable alerts, place a second test order in another browser/session, and confirm the toast/sound/notification.
5. Test invalid admin password, valid login, wrong current password on account update, and a successful password change.
6. Confirm requests from the configured dashboard origin work and an unrelated browser origin is rejected by CORS.
7. Test order confirmation/WhatsApp manually and verify the phone number and message before sending.
8. Test cancellation/restock and confirm a repeated cancellation does not restore stock twice.
