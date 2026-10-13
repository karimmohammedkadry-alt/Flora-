import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const webhookSecret = Deno.env.get("FLORA_ORDER_WEBHOOK_SECRET") || "";
const serviceAccountRaw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON") || "";
const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function b64url(input: string | Uint8Array) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = ""; for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function pemBytes(pem: string) {
  const base64 = pem.replace(/-----BEGIN PRIVATE KEY-----/g, "").replace(/-----END PRIVATE KEY-----/g, "").replace(/\s/g, "");
  const binary = atob(base64); return Uint8Array.from(binary, c => c.charCodeAt(0));
}
async function accessToken(sa: any) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const unsigned = `${head}.${claim}`;
  const key = await crypto.subtle.importKey("pkcs8", pemBytes(sa.private_key), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)));
  const assertion = `${unsigned}.${b64url(signature)}`;
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }) });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error("تعذر الحصول على رمز Firebase OAuth.");
  return data.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!webhookSecret || req.headers.get("x-flora-webhook-secret") !== webhookSecret) return json({ error: "Unauthorized" }, 401);
  if (!serviceAccountRaw) return json({ error: "Firebase service account is not configured" }, 503);
  try {
    const body = await req.json();
    const record = body?.record ?? body?.new ?? body;
    if (!record?.id || !record?.order_number) return json({ ignored: true, reason: "not_an_order_record" });
    const { data: reserved, error: reserveError } = await admin.from("flora_order_push_events").insert({ order_id: record.id }).select("order_id").maybeSingle();
    if (reserveError?.code === "23505") return json({ ok: true, duplicate: true });
    if (reserveError) throw reserveError;
    const { data: tokens, error } = await admin.from("flora_admin_device_tokens").select("id,token").eq("active", true);
    if (error) throw error;
    if (!tokens?.length) {
      await admin.from("flora_order_push_events").update({ sent_count: 0, failed_count: 0 }).eq("order_id", record.id);
      return json({ ok: true, sent: 0, reason: "no_registered_devices" });
    }
    const sa = JSON.parse(serviceAccountRaw);
    if (!sa.project_id || !sa.client_email || !sa.private_key) throw new Error("Firebase service account JSON is missing required fields.");
    const bearer = await accessToken(sa);
    let sent = 0, failed = 0;
    for (const device of tokens) {
      const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(sa.project_id)}/messages:send`, {
        method: "POST", headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message: { token: device.token, notification: { title: "طلب جديد من Flora", body: `وصل طلب ${record.order_number} بقيمة ${Number(record.total || 0).toFixed(2)} ج.م` }, data: { type: "new_order", order_id: String(record.id), order_number: String(record.order_number) }, android: { priority: "HIGH", notification: { channel_id: "flora_new_orders", sound: "default" } } } })
      });
      if (response.ok) sent++;
      else {
        failed++;
        const detail = await response.text();
        if (response.status === 404 || /UNREGISTERED|registration-token-not-registered/i.test(detail)) {
          await admin.from("flora_admin_device_tokens").update({ active: false, updated_at: new Date().toISOString() }).eq("id", device.id);
        }
        console.error("FCM send failed", response.status, detail.slice(0, 300));
      }
    }
    await admin.from("flora_order_push_events").update({ sent_count: sent, failed_count: failed }).eq("order_id", record.id);
    return json({ ok: true, sent, failed });
  } catch (error) {
    console.error("flora-order-push failed", error);
    return json({ error: error instanceof Error ? error.message : "Push failed" }, 500);
  }
});
