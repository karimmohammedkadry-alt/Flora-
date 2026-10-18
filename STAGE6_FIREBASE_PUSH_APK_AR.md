# المرحلة السادسة — Firebase Push Notifications وتجهيز APK

## ما أُضيف إلى المصدر
- إضافة حزم `firebase_core` و`firebase_messaging` و`flutter_local_notifications`.
- تهيئة Firebase بصورة لا تمنع فتح لوحة الإدارة إذا لم تُضبط إعدادات Firebase بعد.
- طلب إذن الإشعارات وتسجيل FCM token للجهاز بعد تسجيل دخول الإدارة عبر `flora-admin/register_device_token`.
- تحديث token عند تغيّره، وعرض إشعار محلي عندما تصل رسالة أثناء فتح التطبيق.
- فتح تبويب الطلبات عند الضغط على إشعار الطلب.
- إضافة خطوات إعداد Firebase وملف PowerShell لبناء APK بعد توفير المتطلبات.

## ما لا يمكن اعتباره مكتملًا بعد
- لم يُنتج APK في بيئة العمل هذه: Flutter SDK غير متاح، ونسخة المصدر لم تتضمن مجلد `AdminApp/android` أو `google-services.json` أو مفتاح توقيع Android.
- لم يُختبر إرسال حقيقي من Firebase؛ يتطلب مشروع Firebase يخصك، ملف إعداد Android، service-account secret محفوظًا في Supabase، ونشر وظيفة push وwebhook.
- لم يتم توقيع APK إنتاجي؛ لا تنشئ مفتاح توقيع داخل المحادثة ولا تشارك كلمات مروره.

## قبل الإصدار النهائي
1. نفّذ إعداد Android/Firebase حسب `AdminApp/android/FIREBASE_ANDROID_SETUP_AR.md`.
2. نفّذ SQL `Backend/supabase/stage24_admin_devices.sql` بعد مراجعة قاعدة البيانات.
3. انشر Edge Functions واضبط الأسرار ثم اربط webhook إنشاء الطلبات.
4. شغّل `AdminApp/build_android_release.ps1` من PowerShell بعد مراجعة إعدادات Gradle.
5. اختبر على هاتف حقيقي: طلب الإذن، رسالة والتطبيق مفتوح، رسالة بالخلفية، الضغط على الإشعار، تسجيل الخروج، وإلغاء/تغيير token.

لم تُحذف بيانات أو تُصفّر قاعدة البيانات.
