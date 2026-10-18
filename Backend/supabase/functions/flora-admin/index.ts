import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Browser access is restricted to the exact deployed dashboard origin.
// Requests without an Origin header (server-to-server/native clients) remain supported.
const configuredDashboardOrigin = (Deno.env.get("FLORA_DASHBOARD_ORIGIN") || "").trim().replace(/\/$/, "");
const baseCorsHeaders = {
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-flora-dashboard-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};
function corsHeadersFor(origin: string) {
  return origin && configuredDashboardOrigin && origin === configuredDashboardOrigin
    ? { ...baseCorsHeaders, "Access-Control-Allow-Origin": configuredDashboardOrigin }
    : baseCorsHeaders;
}
const json = (body: unknown, status = 200, origin = "") =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeadersFor(origin), "Content-Type": "application/json" } });

const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const publicAuthKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

if (!serviceKey || !supabaseUrl) console.error("Missing Supabase function environment.");

const admin = createClient(supabaseUrl!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });
const publicAuth = publicAuthKey ? createClient(supabaseUrl!, publicAuthKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null;


// Optional dashboard editing key: configured ONLY as a Supabase Edge Function secret.
// This allows the dashboard to omit a login page while keeping writes server-authorized.
const dashboardEditSecret = Deno.env.get("FLORA_DASHBOARD_EDIT_SECRET") || "";
function constantTimeEqual(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function dashboardKeyOk(req: Request) {
  const supplied = req.headers.get("x-flora-dashboard-key") || "";
  return dashboardEditSecret.length >= 32 && constantTimeEqual(supplied, dashboardEditSecret);
}
async function handleDashboardKeyRequest(req: Request, origin: string) {
  if (!dashboardEditSecret || dashboardEditSecret.length < 32) {
    return json({ error: "لم يتم إعداد رمز إدارة المنتجات في أسرار Supabase. راجع دليل الربط." }, 503, origin);
  }
  if (!dashboardKeyOk(req)) return json({ error: "رمز الإدارة غير صحيح. أعد إدخاله وحاول مرة أخرى." }, 401, origin);

  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return json({ error: "ملف الصورة غير موجود." }, 400, origin);
    const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
    if (!allowed.has(file.type) || file.size < 1 || file.size > 5 * 1024 * 1024) {
      return json({ error: "الصورة لازم تكون JPG أو PNG أو WebP أو AVIF وبحد أقصى 5 ميجابايت." }, 400, origin);
    }
    const extByType: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };
    const path = `${crypto.randomUUID()}.${extByType[file.type]}`;
    const bytes = await file.arrayBuffer();
    const { error } = await admin.storage.from("product-images").upload(path, bytes, { contentType: file.type, upsert: false });
    if (error) {
      console.error("Dashboard image upload failed", error.message);
      return json({ error: "تعذر رفع الصورة. تأكد من وجود bucket باسم product-images." }, 400, origin);
    }
    const { data } = admin.storage.from("product-images").getPublicUrl(path);
    return json({ ok: true, path, publicUrl: data.publicUrl }, 200, origin);
  }

  const body = await req.json();
  const action = String(body?.action || "");
  const payload = body?.payload || {};
  try {
    if (action === "products_list") {
      const { data, error } = await admin.from("products").select("id,name,category,price,image_path,description,color_name,color_hex,group_key,active,stock_quantity,featured,sort_order,created_at,updated_at").order("sort_order", { ascending: true }).order("created_at", { ascending: false });
      if (error) throw error;
      return json({ ok: true, products: data || [] }, 200, origin);
    }
    if (action === "product_upsert") {
      const source = payload?.data && typeof payload.data === "object" ? payload.data : payload;
      const rawId = source?.id;
      const id = rawId == null || rawId === "" ? null : Number(rawId);
      if (id !== null && (!Number.isSafeInteger(id) || id <= 0)) throw new Error("رقم المنتج غير صالح.");
      const name = String(source?.name ?? "").trim();
      const category = String(source?.category ?? "").trim();
      const price = Number(source?.price);
      const stock = Number(source?.stock_quantity ?? 0);
      const colorName = String(source?.color_name ?? "أساسي").trim() || "أساسي";
      const groupKey = String(source?.group_key ?? category).trim() || category;
      if (!name || !category || !Number.isFinite(price) || price < 0 || !Number.isInteger(stock) || stock < 0 || !groupKey) throw new Error("راجع اسم المنتج والتصنيف والسعر والمخزون.");
      const fields = { name, category, price, stock_quantity: stock, color_name: colorName, color_hex: source?.color_hex ? String(source.color_hex).trim() : null, group_key: groupKey, image_path: source?.image_path ?? null, description: source?.description ? String(source.description).trim() : null, active: source?.active !== false, featured: source?.featured === true, sort_order: Number.isInteger(Number(source?.sort_order)) ? Number(source.sort_order) : 0 };
      const query = id ? admin.from("products").update(fields).eq("id", id).select("*").maybeSingle() : admin.from("products").insert(fields).select("*").single();
      const { data, error } = await query;
      if (error) throw error;
      if (!data) throw new Error("المنتج غير موجود أو لم يتم حفظ التغييرات.");
      return json({ ok: true, product: data }, 200, origin);
    }
    if (action === "product_toggle") {
      const id = Number(payload?.id);
      if (!Number.isSafeInteger(id) || id <= 0) throw new Error("رقم المنتج غير صالح.");
      const { data: product, error: readError } = await admin.from("products").select("active").eq("id", id).single();
      if (readError) throw readError;
      const { data, error } = await admin.from("products").update({ active: !product.active }).eq("id", id).select("id,active").single();
      if (error) throw error;
      return json({ ok: true, product: data }, 200, origin);
    }
    if (action === "product_delete") {
      const id = Number(payload?.id);
      if (!Number.isSafeInteger(id) || id <= 0) throw new Error("رقم المنتج غير صالح.");
      // Archive to preserve order history and foreign-key references.
      const { data, error } = await admin.from("products").update({ active: false }).eq("id", id).select("id,active").maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("المنتج غير موجود.");
      return json({ ok: true, archived: true, product: data }, 200, origin);
    }
    // No-login dashboard mode: the strong server-side edit secret authorizes only these allowlisted actions.
    const keyAllowedActions = new Set(["bootstrap", "order_detail", "order_status", "message_detail", "message_status"]);
    if (keyAllowedActions.has(action)) {
      const result = await handle(action, payload, { id: "dashboard-edit-key", app_metadata: { role: "admin" } });
      return json(result, 200, origin);
    }
    return json({ error: "عملية إدارة غير معروفة." }, 400, origin);
  } catch (error) {
    console.error("Dashboard key action failed", error);
    return json({ error: error instanceof Error ? error.message : "تعذر تنفيذ العملية." }, 400, origin);
  }
}

async function loginWithUsername(payload: any) {
  const username = String(payload?.username ?? "").trim().toLowerCase();
  const password = String(payload?.password ?? "");
  // Keep all failures generic so this endpoint does not reveal valid usernames or emails.
  const failure = () => json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة، أو الحساب غير مخوّل." }, 401);
  if (!username || username.length > 64 || !password || password.length > 256 || !publicAuth) return failure();

  const { data: mapping, error: mappingError } = await admin
    .from("flora_dashboard_admin_usernames")
    .select("user_id")
    .eq("username", username)
    .maybeSingle();
  if (mappingError || !mapping?.user_id) return failure();

  const { data: authUser, error: userError } = await admin.auth.admin.getUserById(mapping.user_id);
  if (userError || !authUser.user?.email || authUser.user.app_metadata?.role !== "admin") return failure();

  const { data, error } = await publicAuth.auth.signInWithPassword({ email: authUser.user.email, password });
  if (error || !data.session || !data.user || data.user.app_metadata?.role !== "admin") return failure();
  return json({
    session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token },
    user: { id: data.user.id, email: data.user.email, username },
  });
}


async function setupFirstAdmin(req: Request, payload: any) {
  const expectedSecret = Deno.env.get("FLORA_ADMIN_SETUP_SECRET") || "";
  const suppliedSecret = String(payload?.setupSecret ?? "");
  if (!expectedSecret || suppliedSecret.length < 24 || suppliedSecret !== expectedSecret) {
    return json({ error: "رمز الإعداد غير صحيح أو لم يتم ضبطه على الخادم." }, 401);
  }
  const username = String(payload?.username ?? "").trim().toLowerCase();
  const password = String(payload?.password ?? "");
  const email = "karimmohammedkadry@gmail.com";
  const failure = (message = "تعذر إنشاء حساب الإدارة.") => json({ error: message }, 400);
  if (username.length < 3 || username.length > 64 || /[\u0000-\u001f\u007f]/.test(username)) return failure("اسم المستخدم لازم يكون من 3 إلى 64 حرفًا.");
  if (password.length < 12 || password.length > 128) return failure("كلمة المرور لازم تكون 12 حرفًا على الأقل.");

  const { data: existing, error: existingError } = await admin.from("flora_dashboard_admin_usernames").select("user_id").limit(1);
  if (existingError) return failure("جدول إعداد الإدارة غير جاهز. شغّل ملف SQL المرفق مرة واحدة.");
  if ((existing || []).length) return failure("تم إعداد حساب الإدارة بالفعل. سجّل الدخول بدل إنشاء حساب جديد.");
  const { data: duplicate, error: duplicateError } = await admin.from("flora_dashboard_admin_usernames").select("user_id").eq("username", username).maybeSingle();
  if (duplicateError) return failure();
  if (duplicate) return failure("اسم المستخدم مستخدم بالفعل. اختار اسمًا آخر.");

  // Setup is protected by a one-time server secret, not customer email OTP.
  // Confirming this dedicated admin email server-side allows password login even when customer email confirmation is enabled.
  const { data: users, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) return failure("تعذر التحقق من حساب الإدارة في Supabase Auth.");
  const existingUser = users.users.find((u) => (u.email || "").toLowerCase() === email);
  let adminUser: any;
  if (existingUser) {
    const { data, error } = await admin.auth.admin.updateUserById(existingUser.id, {
      password,
      email_confirm: true,
      app_metadata: { ...(existingUser.app_metadata || {}), role: "admin" },
    });
    if (error) return failure("تعذر تحديث حساب الإدارة. راجع إعدادات Supabase Auth.");
    adminUser = data.user;
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, app_metadata: { role: "admin" },
    });
    if (error || !data.user) return failure("تعذر إنشاء حساب الإدارة في Supabase Auth.");
    adminUser = data.user;
  }
  const { error: mapError } = await admin.from("flora_dashboard_admin_usernames").insert({ username, user_id: adminUser.id });
  if (mapError) return failure("تعذر حفظ اسم المستخدم. لا تعِد المحاولة قبل مراجعة جدول الإدارة.");
  return json({ ok: true, username, note: "Remove FLORA_ADMIN_SETUP_SECRET from Edge Function secrets after setup." });
}

async function sendOrderStatusEmail(order: any, status: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("FLORA_FROM_EMAIL");
  if (!apiKey || !from || !order?.customer_email) return { sent: false, reason: "email_not_configured" };
  const labels: Record<string, string> = {
    pending: "طلبك وصلنا وهو جاري المراجعة",
    confirmed: "تم تأكيد طلبك",
    preparing: "طلبك جاري تجهيزه",
    shipping: "طلبك خرج للشحن",
    delivered: "تم تسجيل طلبك كمُسلَّم",
    cancelled: "تم إلغاء طلبك",
  };
  const subject = `تحديث طلب ${order.order_number} - Flora Fashion Hijab`;
  const html = `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.9;color:#222"><h2>Flora Fashion Hijab</h2><p>أهلًا ${String(order.customer_name || "بك").replace(/[&<>"']/g, "")}</p><p>${labels[status] || "تم تحديث حالة طلبك"}.</p><p>رقم الطلب: <strong>${String(order.order_number || "").replace(/[&<>"']/g, "")}</strong></p><p>الإجمالي: <strong>${Number(order.total || 0).toFixed(2)} ج.م</strong></p><p>لو عندك استفسار، تواصل معانا من خلال قنوات التواصل الموجودة على الموقع.</p></div>`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [order.customer_email], subject, html }),
  });
  if (!response.ok) {
    console.error("Order status email failed", response.status, await response.text());
    return { sent: false, reason: "provider_error" };
  }
  return { sent: true };
}

async function authorized(req: Request) {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return { ok: false, user: null };
  const { data, error } = await admin.auth.getUser(match[1]);
  if (error || !data.user) return { ok: false, user: null };
  if (data.user.app_metadata?.role !== "admin") return { ok: false, user: data.user };
  return { ok: true, user: data.user };
}

async function handle(action: string, payload: any, user: any) {
  switch (action) {
    case "admin_credentials_update": {
      const username = String(payload?.username ?? "").trim().toLowerCase();
      const newPassword = String(payload?.newPassword ?? "");
      if (!user?.id || user.app_metadata?.role !== "admin") throw new Error("غير مسموح بتعديل هذا الحساب.");
      if (!username && !newPassword) throw new Error("اكتب اسم مستخدم جديد أو كلمة مرور جديدة.");
      if (username && (username.length < 3 || username.length > 64 || /[\u0000-\u001f\u007f]/.test(username))) throw new Error("اسم المستخدم لازم يكون من 3 إلى 64 حرفًا.");
      if (newPassword && (newPassword.length < 8 || newPassword.length > 128)) throw new Error("كلمة المرور الجديدة لازم تكون من 8 إلى 128 حرفًا.");

      if (username) {
        const { data: duplicate, error: duplicateError } = await admin.from("flora_dashboard_admin_usernames").select("user_id").eq("username", username).maybeSingle();
        if (duplicateError) throw duplicateError;
        if (duplicate && duplicate.user_id !== user.id) throw new Error("اسم المستخدم ده مستخدم بالفعل. اختار اسمًا تانيًا.");
      }
      if (newPassword) {
        const { error } = await admin.auth.admin.updateUserById(user.id, { password: newPassword });
        if (error) throw new Error("تعذر تغيير كلمة المرور. جرّب مرة أخرى.");
      }
      if (username) {
        const { data: mapping, error: mappingError } = await admin.from("flora_dashboard_admin_usernames").update({ username }).eq("user_id", user.id).select("username").maybeSingle();
        if (mappingError) throw mappingError;
        if (!mapping) throw new Error("لم يتم العثور على ربط اسم المستخدم لهذا الحساب. يلزم إعداد الحساب أول مرة.");
      }
      return { ok: true, username: username || null, passwordChanged: !!newPassword };
    }
    case "bootstrap": {
      const [p, o, m] = await Promise.all([
        admin.from("products").select("*").order("sort_order").order("created_at", { ascending: false }),
        admin.from("orders").select("*").order("created_at", { ascending: false }).limit(500),
        admin.from("contact_messages").select("*").order("created_at", { ascending: false }).limit(500),
      ]);
      if (p.error) throw p.error; if (o.error) throw o.error; if (m.error) throw m.error;
      return { products: p.data ?? [], orders: o.data ?? [], messages: m.data ?? [], limited: { orders: (o.data?.length ?? 0) === 500, messages: (m.data?.length ?? 0) === 500 } };
    }
    case "product_upsert":
    case "product_create":
    case "product_update": {
      const source = payload?.data && typeof payload.data === "object" ? payload.data : payload;
      const rawRequestedId = payload?.id ?? source?.id ?? null;
      const requestedId = rawRequestedId == null || rawRequestedId === "" ? null : Number(rawRequestedId);
      if (rawRequestedId != null && rawRequestedId !== "" && (!Number.isSafeInteger(requestedId) || requestedId <= 0)) throw new Error("رقم المنتج غير صالح.");
      if (action === "product_create" && requestedId) throw new Error("لا ترسل رقم منتج عند الإضافة.");
      if (action === "product_update" && !requestedId) throw new Error("رقم المنتج مطلوب للتعديل.");
      const name = String(source?.name ?? "").trim();
      const category = String(source?.category ?? "").trim();
      const price = Number(source?.price);
      const stock = Number(source?.stock_quantity ?? source?.stock ?? 0);
      const colorName = String(source?.color_name ?? "أساسي").trim() || "أساسي";
      const groupKey = String(source?.group_key ?? category).trim() || category;
      if (!name || !category || !Number.isFinite(price) || price < 0 || !Number.isInteger(stock) || stock < 0 || !groupKey) throw new Error("راجع اسم المنتج والتصنيف والسعر والمخزون.");
      const fields = {
        name, category, price, stock_quantity: stock, color_name: colorName,
        color_hex: source?.color_hex ? String(source.color_hex).trim() : null,
        group_key: groupKey,
        image_path: source?.image_path ?? source?.image_url ?? source?.image ?? null,
        description: source?.description ? String(source.description).trim() : null,
        active: source?.active !== false,
        featured: source?.featured === true,
        sort_order: Number.isInteger(Number(source?.sort_order)) ? Number(source.sort_order) : 0,
      };
      const query = requestedId
        ? admin.from("products").update(fields).eq("id", requestedId).select("*").maybeSingle()
        : admin.from("products").insert(fields).select("*").single();
      const { data, error } = await query;
      if (error) throw error;
      if (!data) throw new Error("المنتج غير موجود أو لم يتم حفظ التغييرات.");
      return { ok: true, product: data };
    }
    case "register_device_token": {
      const token = String(payload?.token ?? "").trim();
      const platform = String(payload?.platform ?? "android").trim().toLowerCase();
      if (token.length < 20 || token.length > 4096) throw new Error("رمز الإشعارات غير صالح.");
      if (!user?.id || user.app_metadata?.role !== "admin") throw new Error("غير مسموح بتسجيل هذا الجهاز.");
      const { error } = await admin.from("flora_admin_device_tokens").upsert({ user_id: user.id, token, platform, active: true, updated_at: new Date().toISOString() }, { onConflict: "token" });
      if (error) throw error;
      return { ok: true };
    }
    case "unregister_device_token": {
      const token = String(payload?.token ?? "").trim();
      if (!token) throw new Error("رمز الجهاز مطلوب.");
      const { error } = await admin.from("flora_admin_device_tokens").update({ active: false, updated_at: new Date().toISOString() }).eq("token", token).eq("user_id", user.id);
      if (error) throw error;
      return { ok: true };
    }
    case "product_toggle": {
      const { data: p, error: pe } = await admin.from("products").select("active").eq("id", payload.id).single();
      if (pe) throw pe; const { error } = await admin.from("products").update({ active: !p.active }).eq("id", payload.id); if (error) throw error; return { ok: true };
    }
    case "product_delete": {
      // Preserve order history and product references: archive instead of hard-delete.
      const id = Number(payload?.id);
      if (!Number.isSafeInteger(id) || id <= 0) throw new Error("رقم المنتج غير صالح.");
      const { data, error } = await admin.from("products").update({ active: false }).eq("id", id).select("id,active").maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("المنتج غير موجود أو تم حذفه بالفعل.");
      return { ok: true, archived: true, product: data };
    }
    case "order_detail": {
      const [o, i] = await Promise.all([
        admin.from("orders").select("*").eq("id", payload.id).single(),
        admin.from("order_items").select("*").eq("order_id", payload.id),
      ]);
      if (o.error) throw o.error; if (i.error) throw i.error; return { order: o.data, items: i.data ?? [] };
    }
    case "order_status": {
      const { data, error } = await admin.rpc("admin_set_order_status", { p_order_id: payload.id, p_status: payload.status });
      if (error) throw new Error(error.message || "تعذر تحديث حالة الطلب.");
      let email = { sent: false, reason: "no_change" };
      if (data?.changed) email = await sendOrderStatusEmail(data.order, data.status);
      return { ok: true, changed: !!data?.changed, stockRestored: !!data?.stock_restored, email };
    }
    case "message_detail": {
      const { data, error } = await admin.from("contact_messages").select("*").eq("id", payload.id).single(); if (error) throw error; return { message: data };
    }
    case "message_status": {
      if (!["new", "read", "resolved"].includes(payload.status)) throw new Error("حالة الرسالة غير صحيحة.");
      const { error } = await admin.from("contact_messages").update({ status: payload.status }).eq("id", payload.id); if (error) throw error; return { ok: true };
    }
    default: throw new Error("طلب إدارة غير معروف.");
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin") || "";
  // Fail closed for browser calls until FLORA_DASHBOARD_ORIGIN is configured.
  if (origin && (!configuredDashboardOrigin || origin !== configuredDashboardOrigin)) return json({ error: "Origin not allowed" }, 403, origin);
  if (req.method === "OPTIONS") return new Response(null, { status: origin && (!configuredDashboardOrigin || origin !== configuredDashboardOrigin) ? 403 : 204, headers: corsHeadersFor(origin) });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);
  if (req.headers.has("x-flora-dashboard-key")) return await handleDashboardKeyRequest(req, origin);
  try {
    const body = await req.json();
    if (body?.action === "login") {
      const response = await loginWithUsername(body.payload || {});
      return new Response(response.body, { status: response.status, headers: { ...Object.fromEntries(response.headers), ...corsHeadersFor(origin) } });
    }
    if (body?.action === "setup_status") {
      const { data, error } = await admin.from("flora_dashboard_admin_usernames").select("user_id").limit(1);
      if (error) return json({ error: "جدول إعداد الإدارة غير جاهز. شغّل ملف SQL المرفق مرة واحدة." }, 500, origin);
      return json({ setupComplete: (data || []).length > 0 }, 200, origin);
    }
    if (body?.action === "setup_admin") {
      const response = await setupFirstAdmin(req, body.payload || {});
      return new Response(response.body, { status: response.status, headers: { ...Object.fromEntries(response.headers), ...corsHeadersFor(origin) } });
    }
    const auth = await authorized(req);
    if (!auth.ok) return json({ error: auth.user ? "حسابك لا يملك صلاحية الإدارة." : "جلسة الدخول غير صالحة. سجّل الدخول مرة أخرى." }, auth.user ? 403 : 401, origin);
    return json(await handle(body.action, body.payload || {}, auth.user), 200, origin);
  }
  catch (error) {
    console.error("Flora admin request failed", error);
    return json({ error: "تعذر تنفيذ الطلب. راجع البيانات وحاول مرة أخرى." }, 400, origin);
  }
});
