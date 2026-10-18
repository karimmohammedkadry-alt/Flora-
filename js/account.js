document.addEventListener("DOMContentLoaded", async () => {
  const $ = id => document.getElementById(id);
  let sb, mode = "login", busy = false;
  const say = (text, type = "") => { const el = $("accountMessage"); el.textContent = text; el.className = `account-message ${type}`; };
  const authEndpoint = `${window.FLORA_SUPABASE_URL.replace(/\/$/, "")}/functions/v1/flora-customer-auth`;
  function setMode(next) {
    mode = next;
    $("loginMode").classList.toggle("active", mode === "login");
    $("registerMode").classList.toggle("active", mode === "register");
    $("accountTitle").textContent = mode === "login" ? "أهلًا بيك من جديد" : "خلّينا نبدأ حسابك";
    $("accountIntro").textContent = mode === "login" ? "سجّل دخولك برقم موبايلك وكلمة المرور." : "اكتب اسمك ورقم موبايلك واختار كلمة مرور.";
    $("accountFullName").hidden = mode !== "register";
    $("accountNameLabel").hidden = mode !== "register";
    $("accountFullName").required = mode === "register";
    $("accountPasswordConfirm").hidden = mode !== "register";
    $("accountPasswordConfirmLabel").hidden = mode !== "register";
    $("accountPasswordConfirm").required = mode === "register";
    $("accountPassword").autocomplete = mode === "login" ? "current-password" : "new-password";
    $("accountSubmit").querySelector("span").textContent = mode === "login" ? "تسجيل الدخول" : "إنشاء حساب";
    say("");
  }
  function loggedIn(user) {
    $("accountFormView").hidden = true; $("accountLoggedIn").hidden = false;
    $("signedEmail").textContent = user.user_metadata?.full_name || user.phone || "تم تسجيل الدخول";
  }
  function normalizePhone(value) { return value.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[^0-9]/g, ""); }
  async function submit(e) {
    e.preventDefault(); if (busy) return;
    const phone = normalizePhone($("accountPhone").value);
    const password = $("accountPassword").value;
    const fullName = $("accountFullName").value.trim();
    if (!/^01[0125][0-9]{8}$/.test(phone)) { say("اكتب رقم موبايل مصري صحيح مكوّن من 11 رقم.", "error"); $("accountPhone").focus(); return; }
    if (password.length < 8) { say("كلمة المرور لازم تكون 8 أحرف على الأقل.", "error"); return; }
    if (mode === "register" && !fullName) { say("اكتب اسمك بالكامل.", "error"); return; }
    if (mode === "register" && password !== $("accountPasswordConfirm").value) { say("كلمتا المرور مش متطابقتين.", "error"); return; }
    busy = true; const btn = $("accountSubmit"); btn.disabled = true; btn.querySelector("span").textContent = "لحظة من فضلك…";
    try {
      sb = sb || await window.FloraSupabase.init();
      let cart = [];
      try { const rows = await window.FloraStore?.getCart?.(); if (Array.isArray(rows)) cart = rows.map(x => ({ product_id: x.id, quantity: x.quantity })); } catch (_) {}
      if (cart.length) sessionStorage.setItem("flora_account_pending_cart", JSON.stringify(cart));
      const res = await fetch(authEndpoint, { method: "POST", headers: { "Content-Type": "application/json", "apikey": window.FLORA_SUPABASE_KEY }, body: JSON.stringify({ action: mode, phone, password, fullName }) });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || result.error) throw new Error(result.error || "تعذر إكمال العملية. حاول مرة أخرى.");
      if (!result.session?.access_token || !result.session?.refresh_token) throw new Error("لم يتم إنشاء جلسة آمنة. حاول مرة أخرى.");
      const { data, error } = await sb.auth.setSession({ access_token: result.session.access_token, refresh_token: result.session.refresh_token });
      if (error) throw error;
      const pending = JSON.parse(sessionStorage.getItem("flora_account_pending_cart") || "[]");
      if (pending.length) {
        const rows = pending.map(x => ({ user_id: data.user.id, product_id: Number(x.product_id), quantity: Number(x.quantity) }));
        const { error: cartError } = await sb.from("cart_items").upsert(rows, { onConflict: "user_id,product_id" });
        if (cartError) console.warn("Cart transfer warning:", cartError.message);
        sessionStorage.removeItem("flora_account_pending_cart");
      }
      say(mode === "register" ? "تم إنشاء حسابك بنجاح." : "تم تسجيل الدخول بنجاح.", "success");
      const next = new URLSearchParams(location.search).get("next");
      if (next && /^(checkout|orders|home|shop)\.html$/.test(next)) { location.href = next; return; }
      loggedIn(data.user || result.user);
    } catch (err) {
      console.error("Customer auth error:", err);
      say(err.message || "حصلت مشكلة. حاول مرة أخرى.", "error");
    } finally { busy = false; btn.disabled = false; btn.querySelector("span").textContent = mode === "login" ? "تسجيل الدخول" : "إنشاء حساب"; }
  }
  $("accountForm").addEventListener("submit", submit);
  $("loginMode").addEventListener("click", () => setMode("login"));
  $("registerMode").addEventListener("click", () => setMode("register"));
  $("accountSignOut").addEventListener("click", async () => { if (sb) await sb.auth.signOut(); $("accountLoggedIn").hidden = true; $("accountFormView").hidden = false; $("accountForm").reset(); setMode("login"); });
  setMode("login");
  try { sb = await window.FloraSupabase.init(); const { data: { session } } = await sb.auth.getSession(); if (session?.user && !session.user.is_anonymous) loggedIn(session.user); }
  catch (e) { console.error(e); say("تعذر الاتصال بخدمة الحساب. حدّث الصفحة وحاول مرة أخرى.", "error"); }
});
