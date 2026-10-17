# الخطوة التالية لإعداد Firebase وAndroid

1. افتح PowerShell داخل مجلد `AdminApp`.
2. شغّل: `powershell -ExecutionPolicy Bypass -File .\prepare_firebase_android.ps1`
3. السكربت ينشئ ملفات Android إذا كانت غير موجودة، ثم يضبط `applicationId` وGoogle Services على `com.florafashionhijab.admin` بعد التحقق من `google-services.json`.
4. بعد نجاحه شغّل:
   ```powershell
   flutter pub get
   flutter analyze
   flutter build apk --release
   ```
5. مكان APK المتوقع: `build\app\outputs\flutter-apk\app-release.apk`.

تنبيه: هذا الإعداد لا ينشر وظائف Supabase أو أسرار Firebase ولا يثبت وحده وصول إشعارات الطلبات. يلزم إعداد Firebase service account كـ Supabase Function Secret، ونشر وظائف backend وتهيئة webhook للطلبات، ثم اختبار إشعار فعلي. لا تضع service-account داخل التطبيق.
