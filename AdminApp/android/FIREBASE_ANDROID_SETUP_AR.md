# إعداد Firebase للإشعارات — Flora Admin (Android)

> إعدادات Android الكاملة قد تُنشأ محليًا بواسطة Flutter عند الحاجة. أُضيف في مجلد AdminApp السكربت `repair_android_gradle.cmd` لمعالجة خطأ Kotlin Gradle المذكور. لا تضع `google-services.json` داخل مستودع عام.

## 1) إنشاء تطبيق Firebase
1. افتح Firebase Console وأنشئ/اختر مشروعًا تملكه.
2. أضف تطبيق Android بنفس `applicationId` الذي ستعتمده عند إنشاء مشروع Flutter (مثل `com.example.flora_admin` فقط إذا اخترته فعلًا).
3. نزّل `google-services.json` وضعه في `AdminApp/android/app/google-services.json` بعد إنشاء مجلد Android بواسطة Flutter.
4. فعّل Firebase Cloud Messaging في المشروع. لا ترسل ملف Service Account أو مفتاحه إلى التطبيق.

## 2) توليد ملفات Android
من مجلد `AdminApp` شغّل `repair_android_gradle.cmd` إذا ظهر خطأ كتلة `kotlin { compilerOptions }`. السكربت ينشئ نسخة احتياطية من `android/app/build.gradle.kts` قبل التعديل، ويتحقق من تطابق `applicationId` مع Firebase. إذا كان المشروع يستخدم `build.gradle` بنمط Groovy، يتوقف السكربت بدلًا من تعديل الملف الخطأ.

فعّل Google Services Gradle plugin وفق إصدار Gradle/Flutter الذي أنشأه الأمر أعلاه، باستخدام الإعداد الرسمي المتوافق مع ملفات Gradle الناتجة. لا تستبدل ملفات Gradle عشوائيًا بإعداد قديم.

## 3) إعداد Supabase
- نفّذ `Backend/supabase/stage24_admin_devices.sql` مرة واحدة من SQL Editor بعد مراجعة المخطط.
- انشر Edge Function `flora-admin` بعد تحديثها.
- اضبط `FIREBASE_SERVICE_ACCOUNT_JSON` و`FLORA_ORDER_WEBHOOK_SECRET` كـ Supabase Function Secrets فقط، ولا تضعهما في التطبيق.
- فعّل Database Webhook/Trigger لجدول `orders` عند إنشاء طلب، يرسل POST إلى وظيفة `flora-order-push` مع رأس `x-flora-webhook-secret` بالقيمة نفسها. راجع صيغة الـ payload وجرّب طلبًا تجريبيًا قبل الإنتاج.
- تأكد أن حساب الإدارة فقط يستطيع تسجيل الجهاز؛ الوظيفة تتحقق من جلسة المستخدم ودور admin.

## 4) بناء APK
بعد إعداد Firebase وAndroid:
```powershell
cd AdminApp
flutter pub get
flutter analyze
flutter build apk --release
```
الناتج المتوقع: `build/app/outputs/flutter-apk/app-release.apk`.

## ملاحظات مهمة
- التطبيق يحاول بدء Firebase بشكل آمن؛ إذا لم توجد الإعدادات الأصلية، يستمر في العمل دون إشعارات ويكتب سببًا في سجل التشغيل.
- لا يمكن تأكيد وصول الإشعارات قبل ضبط Firebase الحقيقي، تسجيل جهاز الإدارة، إعداد الأسرار، ونشر webhook.
- لا تضع مفتاح `service_role` أو Firebase service-account في APK.
