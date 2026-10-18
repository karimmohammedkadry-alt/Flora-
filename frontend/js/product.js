document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(location.search);
  const productId = params.get("id");
  const image = document.getElementById("productImage");
  const name = document.getElementById("productName");
  const category = document.getElementById("productCategory");
  const price = document.getElementById("productPrice");
  const description = document.getElementById("productDescription");
  const selectedColor = document.getElementById("selectedColor");
  const colors = document.querySelector(".colors");
  const quantityEl = document.getElementById("quantity");
  const add = document.getElementById("addToCart");
  const buy = document.getElementById("buyNow");
  let current = null;
  let quantity = 1;

  const setText = (el, value) => { if (el) el.textContent = value ?? ""; };
  const format = n => Number(n || 0).toLocaleString("ar-EG") + " جنيه";
  const safeImageUrl = value => {
    const fallback = new URL("../images/product-1.jpg", window.location.href).href;
    try { const url = new URL(String(value || fallback), window.location.href); return ["https:", "http:"].includes(url.protocol) ? url.href : fallback; }
    catch (_) { return fallback; }
  };

  function renderProduct(p) {
    current = p;
    quantity = Math.min(Math.max(1, quantity), Math.max(1, Number(p.stock_quantity || 0)));
    if (quantityEl) quantityEl.textContent = quantity;
    if (image) { image.src = safeImageUrl(p.image_path); image.alt = p.name; image.onerror = () => { image.onerror = null; image.src = safeImageUrl(null); }; }
    setText(name, p.name);
    setText(category, p.category);
    setText(price, format(p.price));
    setText(description, p.description);
    setText(selectedColor, p.color_name || "");
    document.title = `${p.name} | Flora Fashion Hijab`;
    const unavailable = Number(p.stock_quantity || 0) <= 0 || p.active === false;
    if (add) add.disabled = unavailable;
    if (buy) buy.disabled = unavailable;
    colors?.querySelectorAll(".color").forEach(btn => btn.classList.toggle("active", btn.dataset.id === String(p.id)));
  }

  const tabs = [...document.querySelectorAll(".description-tab")];
  const descriptionContent = document.querySelector(".description-content");
  const renderTab = index => {
    tabs.forEach((tab, i) => { tab.classList.toggle("active", i === index); tab.setAttribute("aria-selected", i === index ? "true" : "false"); });
    if (!descriptionContent || !current) return;
    const contents = [
      { title: "وصف المنتج", text: current.description || "منتج من Flora Fashion Hijab بخامة مختارة وتصميم عملي.", },
      { title: "التفاصيل", text: `التصنيف: ${current.category || "غير محدد"} — اللون: ${current.color_name || "غير محدد"}. المخزون المتاح: ${Math.max(0, Number(current.stock_quantity || 0))}.` },
      { title: "الشحن والاسترجاع", text: "الشحن متاح لجميع المحافظات حسب سياسة المتجر. تفاصيل الاستبدال والاسترجاع تعتمد على السياسة المنشورة للمتجر." }
    ];
    const safeText = String(contents[index].text).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[c]));
    descriptionContent.innerHTML = `<h2>${contents[index].title}</h2><p>${safeText}</p>`;
  };
  tabs.forEach((tab, index) => { tab.addEventListener("click", () => renderTab(index)); tab.setAttribute("aria-selected", index === 0 ? "true" : "false"); });

  try {
    const sb = await FloraSupabase.init();
    let { data: p, error } = await sb.from("products").select("*").eq("id", productId).eq("active", true).single();
    if (error) throw error;
    renderProduct(p);

    const { data: variants, error: variantError } = await sb.from("products")
      .select("id, name, category, price, image_path, color_name, color_hex, description, group_key, stock_quantity, active")
      .eq("group_key", p.group_key).eq("active", true).order("id");
    if (variantError) throw variantError;
    if (colors) {
      colors.innerHTML = "";
      (variants || []).forEach(v => {
        const btn = document.createElement("button");
        btn.type = "button"; btn.className = "color"; btn.dataset.id = v.id;
        btn.dataset.color = v.color_name; btn.setAttribute("aria-label", v.color_name);
        btn.style.background = v.color_hex || "#ddd";
        btn.title = v.color_name || "";
        btn.addEventListener("click", () => renderProduct(v));
        colors.appendChild(btn);
      });
    }

    renderTab(0);
    document.getElementById("increaseQuantity")?.addEventListener("click", () => { const max = Math.max(1, Number(current?.stock_quantity || 0)); quantity = Math.min(max, quantity + 1); quantityEl.textContent = quantity; });
    document.getElementById("decreaseQuantity")?.addEventListener("click", () => { quantity = Math.max(1, quantity - 1); quantityEl.textContent = quantity; });

    async function addCurrent() {
      if (!current) return;
      await FloraStore.addToCart(current.id, quantity);
      const old = add.textContent; add.textContent = "تمت الإضافة للسلة ✓"; add.disabled = true;
      setTimeout(() => { add.textContent = old; add.disabled = false; }, 1200);
    }
    add?.addEventListener("click", async () => { try { await addCurrent(); } catch (e) { console.error(e); FloraUI.showToast(FloraUI.errorMessage(e, "تعذر إضافة المنتج للسلة.")); } });
    buy?.addEventListener("click", async () => { try { await addCurrent(); location.href = "cart.html"; } catch (e) { console.error(e); FloraUI.showToast(FloraUI.errorMessage(e, "تعذر إضافة المنتج للسلة.")); } });
  } catch (e) {
    console.error(e); setText(name, "تعذر تحميل المنتج"); setText(description, "تعذر تحميل المنتج الآن. حاول تحديث الصفحة."); FloraUI.showToast(FloraUI.errorMessage(e, "تعذر تحميل المنتج الآن.")); if (add) add.disabled = true;
  }
});
