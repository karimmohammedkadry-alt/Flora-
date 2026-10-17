document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("featuredProducts");
  if (!container) return;

  const money = value => `${Number(value || 0).toLocaleString("ar-EG")} جنيه`;
  const imageUrl = path => {
    const fallback = new URL("../assets/product-1.jpg", window.location.href).href;
    try {
      const url = new URL(String(path || "../assets/product-1.jpg"), window.location.href);
      return ["https:", "http:"].includes(url.protocol) ? url.href : fallback;
    } catch (_) { return fallback; }
  };
  const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));

  const render = products => {
    if (!products.length) {
      container.innerHTML = '<div class="products-state">لا توجد منتجات مميزة متاحة حاليًا.</div>';
      return;
    }
    container.innerHTML = products.map(p => `
      <article class="product-card" data-product-id="${p.id}">
        <div class="product-image">
          <span class="product-badge">مميز</span>
          <a href="product.html?id=${encodeURIComponent(p.id)}"><img loading="lazy" alt="${escapeHtml(p.name)}" src="${imageUrl(p.image_path)}"></a>
        </div>
        <div class="product-info">
          <h3>${escapeHtml(p.name)}</h3>
          <p>${money(p.price)}</p>
          <button class="add-to-cart" type="button" ${Number(p.stock_quantity) <= 0 ? 'disabled' : ''}>${Number(p.stock_quantity) <= 0 ? 'غير متوفر' : 'أضف إلى السلة'}</button>
        </div>
      </article>`).join("");

    container.querySelectorAll(".add-to-cart").forEach(btn => btn.addEventListener("click", async e => {
      e.preventDefault(); e.stopPropagation();
      const id = btn.closest(".product-card")?.dataset.productId;
      if (!id) return;
      try {
        await FloraStore.addToCart(id, 1);
        const old = btn.textContent;
        btn.textContent = "تمت الإضافة ✓";
        btn.disabled = true;
        setTimeout(() => { btn.textContent = old; btn.disabled = false; }, 1100);
      } catch (err) {
        console.error(err);
        FloraUI.showToast(FloraUI.errorMessage(err, "تعذر إضافة المنتج."));
      }
    }));
  };

  try {
    const sb = await FloraSupabase.init();
    const { data, error } = await sb.from("products")
      .select("id,name,price,image_path,stock_quantity,featured,sort_order")
      .eq("active", true)
      .eq("featured", true)
      .order("sort_order", { ascending: true })
      .limit(4);
    if (error) throw error;
    render(data || []);
  } catch (error) {
    console.error("Featured products error:", error);
    container.innerHTML = '<div class="products-state">تعذر تحميل المنتجات الآن. حاول تحديث الصفحة.</div>';
  }
});
