# Flora Fashion Hijab

## Project layout

- `Store/frontend/html/`: one HTML file per storefront page.
- `Store/frontend/css/`: page-specific CSS and shared storefront styles.
- `Store/frontend/js/`: page-specific JavaScript and shared UI helpers.
- `Store/frontend/images/`: local product, hero, logo, and splash images.
- `Store/backend/`: storefront backend integration notes.
- `Dashboard/frontend/html/`: admin dashboard page.
- `Dashboard/frontend/css/`: dashboard styles.
- `Dashboard/frontend/js/`: dashboard behavior.
- `Dashboard/frontend/images/`: dashboard-only assets when needed.
- `Dashboard/backend/`: dashboard backend integration notes.
- `Backend/supabase/`: shared schema, SQL security policies, storage policies, and Edge Functions.
- `Backend/firebase/`: reserved for server-side Firebase integration; never store private credentials in the repo.
- `Shared/frontend/js/`: public client configuration shared by storefront and dashboard.
- `AdminApp/`: Flutter admin app, Dart code, dependencies, Android Firebase client config, and build scripts.

## Local web testing

Serve the repository root using a local web server; do not open HTML pages as `file://` URLs because Supabase and browser security behavior differs. The deployment rewrites are defined in `vercel.json`.

## Android build

Open PowerShell in `AdminApp` and run `./build_android_release.ps1`. This script requires Flutter, Android SDK, Java, and the Android NDK version listed in the build script. It runs analysis and tests before creating the release APK.

## Database safety

SQL files named `stage*.sql` are retained because they may be required migration history. Review migration order before applying. `Backend/supabase/reset_store_data.sql` is potentially destructive and must not be run against production data without a verified backup and explicit intent.

## Secrets

Only the Supabase publishable/anon key belongs in browser/mobile clients. Never commit Supabase service-role keys or Firebase Admin service-account credentials.


## مزامنة منتجات الداشبورد مع المتجر
راجع `Backend/supabase/DASHBOARD_LIVE_PRODUCTS_SETUP_AR.md` لإعداد رمز الإدارة في أسرار Supabase ونشر الدالة؛ بعد ذلك يتم حفظ المنتجات والصور مباشرة في قاعدة البيانات وStorage.

## النسخة 9 — Modern Store + Advanced Dashboard
- تحسينات حديثة مشتركة لواجهة المتجر والصفحة الرئيسية مع مراعاة RTL والموبايل وتقليل الحركة.
- لوحة نظرة عامة أغنى: مؤشرات، مخطط نشاط 7 أيام، تنبيهات مخزون، أحدث الطلبات واختصارات.
- بحث في رسائل العملاء وشارات حالات أوضح، وتحسين حفظ ورفع صور المنتجات.
- راجع `IMPLEMENTATION_REPORT_AR.md` لنتائج الاختبارات وحدود التحقق وما يحتاج إعدادًا حيًا قبل الإنتاج.
