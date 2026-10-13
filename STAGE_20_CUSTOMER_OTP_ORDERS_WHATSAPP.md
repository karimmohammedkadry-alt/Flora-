# Stage 20 — Customer OTP, mandatory checkout verification, and WhatsApp status messages

## Behavior
- Browsing and adding products to the cart does not require a customer account.
- Checkout requires a one-time email OTP. `signInWithOtp` creates a customer auth account if needed and signs existing customers in.
- After OTP verification, the customer can submit an order. New orders remain `pending`; the success page says the order is under review.
- The dashboard order dialog includes a WhatsApp notification action. When the admin clicks it, WhatsApp opens with a status-specific prefilled message. The admin must press Send. Automatic WhatsApp delivery requires WhatsApp Business Cloud API credentials and a server-side integration; this ZIP does not pretend to send automatically without those credentials.
- Customer email is stored on the order for dashboard visibility.

## One-time Supabase steps
1. Apply the updated `supabase/schema.sql` (or apply an equivalent migration to the existing database). It adds `orders.customer_email` and updates `create_order` to save the authenticated customer's email.
2. In Supabase Dashboard → Authentication → Email, configure the email template to contain `{{ .Token }}` so customers receive a one-time code rather than only a magic-link URL.
3. Make sure email OTP is enabled and email delivery/SMTP is configured.
4. Keep Anonymous Sign-ins enabled if the existing cart implementation is used before checkout; the checkout code preserves the guest cart across OTP sign-in and copies it into the customer account.
5. Test: browse without login → add to cart → checkout → send OTP → verify OTP → submit order → confirm the order appears as `pending` in the dashboard → set status to `confirmed` → click WhatsApp notification and press Send.

## Dashboard email verification distinction
Supabase's built-in email-confirmation setting is project-wide, not a separate toggle for dashboard versus customers. This customer flow explicitly uses OTP. The dashboard's existing first-time setup flow is separate from customer checkout and should not be disabled globally without redesigning it.
