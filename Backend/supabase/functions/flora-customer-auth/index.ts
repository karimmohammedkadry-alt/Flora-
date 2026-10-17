import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Comma-separated exact origins, e.g. https://flora.example.com,https://www.flora.example.com.
// No wildcard fallback: browser requests are denied until the allowlist is configured.
const allowedOrigins = (Deno.env.get("FLORA_CUSTOMER_AUTH_ORIGINS") || "")
  .split(",").map((value) => value.trim().replace(/\/$/, "")).filter(Boolean);
const baseCorsHeaders = {
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};
function corsHeadersFor(origin: string) {
  return origin && allowedOrigins.includes(origin)
    ? { ...baseCorsHeaders, "Access-Control-Allow-Origin": origin }
    : baseCorsHeaders;
}
const json = (body: unknown, status = 200, origin = "") => new Response(JSON.stringify(body), { status, headers: { ...corsHeadersFor(origin), "Content-Type": "application/json" } });
const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const auth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

function cleanPhone(value: unknown) { return String(value || "").replace(/[^0-9]/g, ""); }
function internalEmail(phone: string) { return `${phone}@customers.flora.invalid`; }

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin") || "";
  if (origin && !allowedOrigins.includes(origin)) return json({ error: "Origin not allowed." }, 403, origin);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeadersFor(origin) });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405, origin);
  try {
    const body = await req.json();
    const action = String(body.action || "");
    const phone = cleanPhone(body.phone);
    const password = String(body.password || "");
    const fullName = String(body.fullName || "").trim();
    if (!/^01[0125][0-9]{8}$/.test(phone)) return json({ error: "رقم الموبايل المصري غير صحيح." }, 400, origin);
    if (password.length < 8 || password.length > 128) return json({ error: "كلمة المرور لازم تكون من 8 إلى 128 حرفًا." }, 400, origin);
    if (!serviceKey || !anonKey) return json({ error: "خدمة الحساب غير مكتملة الإعداد." }, 503, origin);

    if (action === "register") {
      if (fullName.length < 2 || fullName.length > 120) return json({ error: "اكتب اسمًا صحيحًا." }, 400, origin);
      const { data: existing, error: lookupError } = await admin.from("flora_customer_accounts").select("user_id").eq("phone", phone).maybeSingle();
      if (lookupError) return json({ error: "جدول حسابات العملاء غير جاهز. طبّق ملف SQL المرفق في Supabase." }, 503, origin);
      if (existing) return json({ error: "رقم الموبايل مسجل بالفعل. سجّل الدخول بدل إنشاء حساب جديد." }, 409, origin);
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: internalEmail(phone), password, email_confirm: true,
        user_metadata: { full_name: fullName, phone, phone_login: true },
      });
      if (createError || !created.user) return json({ error: "تعذر إنشاء الحساب. تأكد أن رقم الموبايل غير مستخدم." }, 400, origin);
      const { error: mapError } = await admin.from("flora_customer_accounts").insert({ phone, user_id: created.user.id, full_name: fullName });
      if (mapError) {
        await admin.auth.admin.deleteUser(created.user.id);
        return json({ error: "تعذر حفظ بيانات الحساب. حاول مرة أخرى." }, 500, origin);
      }
    } else if (action !== "login") return json({ error: "عملية غير مدعومة." }, 400, origin);

    const { data: account, error: accountError } = await admin.from("flora_customer_accounts").select("user_id,full_name").eq("phone", phone).maybeSingle();
    if (accountError || !account) return json({ error: "رقم الموبايل أو كلمة المرور غير صحيحة." }, 401, origin);
    const { data: signed, error: signError } = await auth.auth.signInWithPassword({ email: internalEmail(phone), password });
    if (signError || !signed.session || !signed.user || signed.user.id !== account.user_id) return json({ error: "رقم الموبايل أو كلمة المرور غير صحيحة." }, 401, origin);
    return json({ session: { access_token: signed.session.access_token, refresh_token: signed.session.refresh_token }, user: { id: signed.user.id, phone, full_name: account.full_name } }, 200, origin);
  } catch (error) {
    console.error("Customer auth error", error);
    return json({ error: "حصل خطأ غير متوقع. حاول مرة أخرى." }, 500, origin);
  }
});
