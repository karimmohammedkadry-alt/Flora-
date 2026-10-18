# Flora Fashion Hijab — المرحلة الأولى: الأمان وإعداد قاعدة البيانات

## ما تم تعديله في الكود

- إزالة سياسة CORS المفتوحة `*` من Edge Function الخاصة بالإدارة، وإضافة سماح للـ Origin المطابق فقط لـ `FLORA_DASHBOARD_ORIGIN`.
- إزالة CORS المفتوح من `flora-customer-auth` واستبداله بقائمة Origins محددة عبر `FLORA_CUSTOMER_AUTH_ORIGINS`.
- منع إرجاع رسائل أخطاء الخادم الداخلية من وظيفة الإدارة إلى المتصفح؛ التفاصيل تظل في سجل الخادم فقط.
- إضافة HTTP security headers أساسية في `vercel.json`.
- إضافة `Backend/supabase/stage25_security_baseline_audit.sql` لفحص RLS والصلاحيات والسياسات والدوال الأمنية وStorage. الملف للقراءة فقط ولا يعدّل قاعدة البيانات.
- لم أضف مفاتيح سرية إلى ملفات الواجهة، ولم أحذف أو أعدّل بيانات المتجر.

## مطلوب منك قبل النشر (إعدادات خارج ملفات المشروع)

1. من Supabase → Edge Functions → Secrets اضبط `FLORA_DASHBOARD_ORIGIN` على عنوان لوحة التحكم الفعلي بالكامل، مثل `https://dashboard.example.com` بدون `/` في النهاية.
2. اضبط `FLORA_CUSTOMER_AUTH_ORIGINS` على Origins المتجر الفعلية مفصولة بفواصل، مثل `https://flora.example.com,https://www.flora.example.com`.
3. تأكد أن `SUPABASE_SERVICE_ROLE_KEY` و`FLORA_ADMIN_SETUP_SECRET` و`RESEND_API_KEY` وأي بيانات Firebase موجودة في Secrets فقط، ولا تظهر في ملفات Store أو Dashboard أو Shared.
4. بعد إعداد حساب الإدارة لأول مرة بنجاح، احذف `FLORA_ADMIN_SETUP_SECRET` من Secrets ثم اختبر أن محاولة الإعداد مرة أخرى لا تنجح.
5. شغّل `stage25_security_baseline_audit.sql` في SQL Editor واحفظ النتائج. لا تشغّل `reset_store_data.sql`؛ ليس جزءًا من هذه المرحلة.
6. انشر Edge Functions المعدّلة بعد ضبط Secrets، ثم اختبر تسجيل دخول الإدارة والعميل، وطلبات OPTIONS من Origins المسموحة وغير المسموحة.

## ملاحظات مهمة

- لا أستطيع من ملف ZIP وحده التأكد من إعدادات مشروع Supabase الفعلي أو تنفيذ SQL عليه. يجب مراجعة نتائج التدقيق من لوحة Supabase قبل إعلان اكتمال الأمان.
- وظائف الإدارة والعميل تستخدم `verify_jwt = false` لأن لها تدفق مصادقة مخصصًا داخل الكود؛ لذلك يجب الحفاظ على فحوص التوكن/السر داخل كل وظيفة وعدم اعتبار CORS بديلًا عن المصادقة.
- إعداد Origin لا يمنع الطلبات غير المتصفحية وحده؛ التفويض الحقيقي يظل مسؤولية التحقق من الجلسة/الدور أو سر webhook.
- اختبر كل Origin على بيئة المعاينة أولًا. إذا كان تطبيق الهاتف يستدعي وظيفة من دون `Origin` فسيظل مسموحًا على مستوى CORS، لكن يجب أن تظل المصادقة مطبقة.

## اختبارات هذه النسخة

- تم فحص صياغة JSON الخاصة بـ `vercel.json`.
- سيتم فحص ملفات JavaScript الثابتة؛ لم يتم تنفيذ اتصال حي بـ Supabase أو اختبار نشر Edge Functions من هذه البيئة.
