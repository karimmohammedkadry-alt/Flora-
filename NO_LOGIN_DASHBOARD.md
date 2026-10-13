# Flora Dashboard — Supabase Auth Protected

The Dashboard now has an email/password login using Supabase Auth. The Edge Function validates the bearer access token, then checks `app_metadata.role = admin` server-side before any admin operation.

Browser -> Supabase Auth session -> `flora-admin` Edge Function -> service-role database client -> database.

The service-role key is never sent to the browser. Admin authorization must be assigned to an existing Auth account using the trusted SQL in `supabase/dashboard_admin_auth_setup.sql`.
