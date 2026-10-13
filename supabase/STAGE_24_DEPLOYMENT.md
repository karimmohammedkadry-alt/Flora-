# Stage 24 — Store, admin app, products, and push backend

This update fixes the contract between the web dashboard and Flutter admin, adds the missing schema columns queried by the store, secures admin device tokens, and includes the server-side FCM sender. It does **not** claim a live deployment or successful phone test.

## 1. Apply the SQL migration

In Supabase SQL Editor, run `stage24_admin_devices.sql` once. It is re-runnable. It adds:
- private admin FCM token table (`flora_admin_device_tokens`),
- idempotency table for order push delivery,
- `products.updated_at` and its trigger (the storefront queries this field),
- `contact_messages.status` (the dashboard uses this field).

Keep RLS enabled. Never grant anon/authenticated direct access to device tokens or the idempotency table.

## 2. Deploy the Edge Functions

Deploy both functions from the `flora` project root:

```bash
supabase functions deploy flora-admin --no-verify-jwt
supabase functions deploy flora-order-push --no-verify-jwt
```

`flora-admin` uses Supabase's server-side `SUPABASE_SERVICE_ROLE_KEY` secret. Do not place it in browser or Flutter source. Preserve the existing `FLORA_DASHBOARD_ORIGIN` secret for the web dashboard.

## 3. Configure order webhook (Firebase credentials are still required)

In Supabase Edge Function secrets, set:
- `FLORA_ORDER_WEBHOOK_SECRET`: a newly generated random value of at least 32 characters.
- `FIREBASE_SERVICE_ACCOUNT_JSON`: the complete Firebase service-account JSON for the same Firebase project as the Android app. Store it only in Supabase secrets; never commit it or upload it to the APK.

In Supabase Database Webhooks, create a webhook:
- Table: `public.orders`
- Event: `INSERT` only
- Type: HTTP Request / POST
- URL: `https://<project-ref>.supabase.co/functions/v1/flora-order-push`
- Header: `x-flora-webhook-secret: <the exact FLORA_ORDER_WEBHOOK_SECRET value>`
- Body: the normal Supabase webhook payload, including `record` with `id`, `order_number`, and `total`.

The sender uses Firebase HTTP v1 and reads active device tokens only from the private table. It marks unregistered tokens inactive and has an order-level duplicate guard.

## 4. Flutter app

The Flutter source uses the same Supabase project as the website. The login action remains username/password without admin OTP; customer email OTP behavior on the website is unchanged. Product operations now map to the real schema (`image_path`, `color_name`, `group_key`, etc.) and accept the app's `product_create`, `product_update`, and `product_delete` actions. After a successful admin login, the app requests FCM permission and registers/refreshes the device token through the protected Edge Function.

This ZIP contains Flutter source, not a built APK. The original source package did not contain a complete generated Android Gradle wrapper/scaffold. With Flutter stable installed, run `flutter create . --platforms=android` from the `android_admin` folder if Android platform files are absent, then apply the app manifest changes and add `android/app/google-services.json` after creating the Firebase Android app. Run `flutter pub get`, `flutter analyze`, and then build the APK with the `FLORA_SUPABASE_URL` and `FLORA_SUPABASE_KEY` dart-defines.

## 5. Required acceptance tests before production

1. Admin login succeeds with password only; a non-admin session cannot call admin actions.
2. Create, update, hide, and delete a test product in the app; confirm the web store reflects it.
3. Place a test customer order after customer OTP; verify one order and its items appear in Supabase and dashboard.
4. Confirm an INSERT webhook sends a push to a registered admin device while the app is foreground, background, and terminated.
5. Confirm duplicate webhook delivery does not notify twice, and deleted/invalid FCM tokens are deactivated.
6. Test status changes, stock restoration on cancellation, customer email configuration, and WhatsApp message links.
7. Check Supabase logs and browser console for errors; remove setup-only secrets after admin setup.

## Remaining external setup

Firebase project/app configuration, `google-services.json`, service-account secret, database webhook configuration, and a real-device build/test are not possible to complete from source code alone. Until those are configured and tested, background push is not considered active.
