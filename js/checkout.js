document.addEventListener("DOMContentLoaded", async () => {
  const $ = id => document.getElementById(id);
  const format = n => Number(n || 0).toLocaleString("ar-EG");
  const safeImageUrl = value => {
    const fallback = new URL("../assets/product-1.jpg", window.location.href).href;
    try { const url = new URL(String(value || "../assets/product-1.jpg"), window.location.href); return ["https:", "http:"].includes(url.protocol) ? url.href : fallback; }
    catch (_) { return fallback; }
  };
  const message = (text, type = "error") => { const el = $("formMessage"); if (el) { el.textContent = text; el.className = `form-message show ${type}`; } };
  const authMessage = (text, type = "") => { const el = $("customerAuthMessage"); if (el) { el.textContent = text; el.className = `form-message show ${type}`; } };
  let cart = [], emailOtpSent = false, verifiedEmail = "", orderSubmissionLocked = false;
  try {
    cart = await FloraStore.getCart();
    const box = $("checkoutItems");
    if (!cart.length) { message("السلة فارغة. ارجع للمتجر وأضف المنتجات أولاً.", "error"); return; }
    box.innerHTML = "";
    cart.forEach(item => { const el = document.createElement("div"); el.className = "checkout-item"; el.innerHTML = `<div class="checkout-item-image"><img alt=""></div><div><div class="checkout-item-name"></div><div class="checkout-item-meta"></div></div><div class="checkout-item-price">${format(item.price * item.quantity)} ج.م</div>`; el.querySelector(".checkout-item-image img").src = safeImageUrl(item.image_path); el.querySelector(".checkout-item-name").textContent = item.name || "منتج"; el.querySelector(".checkout-item-meta").textContent = `${item.color_name || "اللون الأساسي"} × ${item.quantity}`; box.appendChild(el); });
    const subtotal = cart.reduce((s, x) => s + Number(x.price) * Number(x.quantity), 0);
    $("checkoutSubtotal").textContent = format(subtotal);
    $("checkoutShipping").textContent = window.FLORA_PRODUCTION?.shipping?.note || "مجاني";
    $("checkoutTotal").textContent = format(subtotal);
  } catch (e) { console.error(e); message("تعذر تحميل السلة.", "error"); return; }

  const sb = await FloraSupabase.init();
  const sendBtn = $("sendCustomerOtp"), verifyBtn = $("verifyCustomerOtp");
  const otpDigits = [...document.querySelectorAll("#checkoutOtpDigits input")];
  const readOtp = () => otpDigits.map(i => i.value.replace(/\D/g, "").slice(-1)).join("");
  otpDigits.forEach((input, index) => {
    input.addEventListener("input", () => { input.value = input.value.replace(/\D/g, "").slice(-1); input.classList.toggle("filled", !!input.value); $("customerOtp").value = readOtp(); if (input.value && index < otpDigits.length - 1) otpDigits[index + 1].focus(); });
    input.addEventListener("keydown", e => { if (e.key === "Backspace" && !input.value && index > 0) otpDigits[index - 1].focus(); if (e.key === "Enter") { e.preventDefault(); verifyBtn?.click(); } });
    input.addEventListener("paste", e => { const value = (e.clipboardData || window.clipboardData).getData("text").replace(/\D/g, "").slice(0, 6); if (value) { e.preventDefault(); otpDigits.forEach((el, i) => { el.value = value[i] || ""; el.classList.toggle("filled", !!el.value); }); $("customerOtp").value = readOtp(); otpDigits[Math.min(value.length, 5)].focus(); } });
  });
  sendBtn?.addEventListener("click", async () => {
    const email = $("customerEmail").value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { authMessage("اكتب بريد إلكتروني صحيح الأول.", "error"); return; }
    sendBtn.disabled = true;
    try {
      const currentCart = await FloraStore.getCart();
      sessionStorage.setItem("flora_pending_guest_cart", JSON.stringify(currentCart.map(x => ({ product_id: x.id, quantity: x.quantity }))));
      const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
      if (error) throw error;
      emailOtpSent = true;
      $("customerOtpGroup").hidden = false;
      otpDigits.forEach(i => { i.value = ""; i.classList.remove("filled"); }); $("customerOtp").value = ""; otpDigits[0]?.focus();
      authMessage("بعتنالك كود تحقق على الإيميل. افتحه واكتب الكود هنا.", "success");
    } catch (e) { console.error(e); authMessage("تعذر إرسال الكود. تأكد من إعداد Email OTP في Supabase وحاول تاني.", "error"); }
    finally { sendBtn.disabled = false; }
  });

  $("resendCustomerOtp")?.addEventListener("click", async () => {
    const email = $("customerEmail").value.trim().toLowerCase();
    const resendBtn = $("resendCustomerOtp");
    resendBtn.disabled = true; resendBtn.textContent = "جارٍ إعادة الإرسال…";
    try {
      const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
      if (error) throw error;
      authMessage("تم إرسال رمز جديد. استخدم أحدث رمز وصلك على الإيميل.", "success");
      otpDigits.forEach(i => { i.value = ""; i.classList.remove("filled"); }); $("customerOtp").value = ""; otpDigits[0]?.focus();
    } catch (e) { console.error(e); authMessage("تعذر إعادة إرسال الرمز. انتظر قليلًا وحاول مرة أخرى.", "error"); }
    finally { resendBtn.disabled = false; resendBtn.textContent = "إعادة إرسال الرمز"; }
  });

  verifyBtn?.addEventListener("click", async () => {
    const email = $("customerEmail").value.trim().toLowerCase();
    const token = $("customerOtp").value.trim();
    if (!emailOtpSent) { authMessage("اطلب كود التحقق الأول.", "error"); return; }
    if (!token || token.length !== 6) { authMessage("اكتب الأرقام الستة اللي وصلتك في الإيميل.", "error"); otpDigits.find(i => !i.value)?.focus(); return; }
    verifyBtn.disabled = true;
    try {
      const { data, error } = await sb.auth.verifyOtp({ email, token, type: "email" });
      if (error || !data.session || !data.user) throw error || new Error("OTP verification failed");
      verifiedEmail = (data.user.email || "").toLowerCase();
      if (verifiedEmail !== email) throw new Error("البريد اللي اتأكد مش مطابق.");
      const saved = JSON.parse(sessionStorage.getItem("flora_pending_guest_cart") || "[]");
      if (saved.length) {
        const rows = saved.map(x => ({ user_id: data.user.id, product_id: Number(x.product_id), quantity: Number(x.quantity) }));
        const { error: cartError } = await sb.from("cart_items").upsert(rows, { onConflict: "user_id,product_id" });
        if (cartError) console.warn("Guest cart transfer warning:", cartError.message);
        sessionStorage.removeItem("flora_pending_guest_cart");
        cart = await FloraStore.getCart();
      }
      $("customerEmail").readOnly = true; $("customerOtp").readOnly = true; otpDigits.forEach(i => i.readOnly = true);
      sendBtn.disabled = true; verifyBtn.hidden = true;
      authMessage("تم تأكيد بريدك بنجاح. كمّل بيانات التوصيل واضغط تأكيد الطلب.", "success");
    } catch (e) { console.error(e); authMessage("الكود غير صحيح أو انتهت صلاحيته. اطلب كود جديد وجرب تاني.", "error"); }
    finally { verifyBtn.disabled = false; }
  });

  const form = $("checkoutForm");
  form?.addEventListener("submit", async e => {
    e.preventDefault();
    if (orderSubmissionLocked) return;
    if (!verifiedEmail) { authMessage("لازم تأكد بريدك الإلكتروني بالكود قبل إرسال الطلب.", "error"); $("customerEmail").focus(); return; }
    const { data: { user } } = await sb.auth.getUser();
    if (!user || (user.email || "").toLowerCase() !== verifiedEmail) { authMessage("جلسة تأكيد البريد انتهت. أكد البريد مرة تانية.", "error"); return; }
    orderSubmissionLocked = true;
    const btn = $("confirmOrder");
    const name = $("fullName").value.trim();
    const phone = $("phone").value.replace(/\s+/g, "").replace(/-/g, "");
    const governorate = $("governorate").value;
    const city = $("city").value.trim();
    const address = $("address").value.trim();
    const landmark = $("landmark").value.trim();
    const payment = document.querySelector('input[name="payment"]:checked')?.value || "cash";
    if (name.length < 3) { orderSubmissionLocked = false; return message("من فضلك اكتب الاسم بالكامل.", "error"); }
    if (!/^01[0125][0-9]{8}$/.test(phone)) { orderSubmissionLocked = false; return message("من فضلك أدخل رقم هاتف مصري صحيح.", "error"); }
    if (!governorate) { orderSubmissionLocked = false; return message("من فضلك اختر المحافظة.", "error"); }
    if (city.length < 2) { orderSubmissionLocked = false; return message("من فضلك اكتب المدينة أو المنطقة.", "error"); }
    if (address.length < 8) { orderSubmissionLocked = false; return message("من فضلك اكتب العنوان بالتفصيل.", "error"); }
    if (payment !== "cash") { orderSubmissionLocked = false; return message("الدفع عند الاستلام هو المتاح حالياً.", "error"); }
    btn.disabled = true; btn.textContent = "جاري إرسال الطلب للمراجعة...";
    try {
      const { data, error } = await sb.rpc("create_order", { p_name: name, p_phone: phone, p_governorate: governorate, p_city: city, p_address: address, p_landmark: landmark || null, p_payment: payment });
      if (error) throw error;
      const orderId = data?.order_id || data;
      message("تم استلام طلبك، وجاري مراجعته.", "success");
      setTimeout(() => location.href = `order-success.html?id=${encodeURIComponent(orderId)}`, 500);
    } catch (err) {
      console.error(err); btn.disabled = false; btn.textContent = "تأكيد الطلب";
      message(FloraUI.errorMessage(err, "تعذر إنشاء الطلب. حاول مرة أخرى."), "error"); orderSubmissionLocked = false;
    }
  });
});
