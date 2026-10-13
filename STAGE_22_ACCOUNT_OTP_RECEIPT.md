# Stage 22 — Customer OTP, Receipt Animation, and WhatsApp Confirmation

## Included
- Added `pages/account.html` with OTP-based customer sign-in and account creation.
- Added a six-digit OTP UI with paste support, auto-advance, responsive styling, and reduced-motion support. Checkout OTP uses the same visual pattern.
- Added a thermal receipt animation on order success, with items, totals, barcode-style mark, and browser print/save action.
- Added a dedicated dashboard button `تأكيد الطلب + واتساب`: it changes the order to confirmed, then opens WhatsApp with a prefilled message to the customer. The admin still manually presses Send in WhatsApp.

## Important setup notes
- Supabase Auth Email OTP must be configured. Supabase email templates should deliver the numeric `{{ .Token }}` value if using the six-digit interface. If the project is configured for a different token length, update the UI length consistently.
- Login uses `shouldCreateUser: false`; registration uses `shouldCreateUser: true`. Supabase project settings and RLS still determine whether sign-in/registration succeeds.
- WhatsApp opening depends on a valid Egyptian phone number. The browser may block a popup; allow popups for the dashboard if needed. No message is sent automatically.
- Receipt print is a client-side print stylesheet. It does not create a tax invoice or legally certified receipt.
- Customer OTP and dashboard password-only login remain separate. No admin OTP is introduced.

## Validation
Run syntax checks on all `js/*.js` and `dashboard/*.js` files. Test customer registration, returning login, wrong/expired OTP, checkout, receipt printing, admin order confirmation, and WhatsApp message text in a deployed Supabase environment before production release.
