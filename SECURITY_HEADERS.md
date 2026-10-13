# Production Hosting Headers

The static frontend should be deployed behind HTTPS. Configure the host to send:

- `Content-Security-Policy` appropriate for the chosen host. The current app requires the Supabase API origin and `https://cdn.jsdelivr.net` for Supabase JS.
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Content-Type-Options: nosniff`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Strict-Transport-Security` only after HTTPS is confirmed on the final domain.

Do not put a Supabase service-role/secret key in this frontend. Only the publishable key belongs in `js/supabase-config.js`.
