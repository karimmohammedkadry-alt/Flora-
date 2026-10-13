# Flora Fashion Hijab — Release Manifest

## Current stage
Stage 8 — Live Production Readiness

## Included
- Customer-facing storefront
- Supabase client integration
- Cart and checkout flow
- Server-authoritative `create_order` flow
- Customer order history/details
- Production QA/security documentation
- Supabase production audit SQL

## Intentionally excluded
- Dashboard implementation
- Admin UI work
- Payment gateway integration

## Browser credential rule
Only the Supabase Project URL and Publishable/Anon key may be shipped in frontend JavaScript. Never place a `service_role` or secret key in this project.

## Final handover condition
Do not advertise the build as fully production-ready until the live Supabase audit and customer-flow acceptance tests have been executed successfully.
\n## Stage 11–13 additions\n- Responsive/mobile hardening\n- SEO metadata and robots.txt\n- Production security-header checklist\n- Explicit free-shipping + cash-on-delivery configuration\n- Online payment visibly disabled until gateway integration\nEOF

node --check js/common.js && node --check js/checkout.js && node --check js/production-config.js && echo JS_OK


## Stage 23
See `STAGE_23_QA_NOTIFICATIONS_SECURITY.md` for resend cooldown, dashboard new-order sound/browser notifications, CORS configuration, and verification limits.
