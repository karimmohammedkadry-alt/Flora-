document.addEventListener("DOMContentLoaded", async () => {
  const productsEl = document.getElementById("shopProducts");
  const categoriesEl = document.getElementById("categoriesBar");
  if (!productsEl || !categoriesEl) return;

  const money = value => `${Number(value || 0).toLocaleString("ar-EG")} جنيه`;
  const imageUrl = path => {
    if (!path) return "../assets/product-1.jpg";
    if (/^https?:\/\//i.test(path)) return path;
    return new URL(path, window.location.href).href;
  };
  const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));

  let products = [];
  const params = new URLSearchParams(window.location.search);
  const categoryAliases = { plain: "سادة", printed: "مشجر", chiffon: "شيفون", modal: "مودال" };
  let selectedCategory = categoryAliases[params.get("category")] || params.get("category") || "all";
  let searchTerm = (params.get("q") || "").trim();

  function buildCategories() {
    const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
    categoriesEl.innerHTML = '<button class="category-filter active" data-category="all" type="button">الكل</button>' +
      categories.map(c => `<button class="category-filter" data-category="${escapeHtml(c)}" type="button">${escapeHtml(c)}</button>`).join("");
    categoriesEl.querySelectorAll(".category-filter").forEach(btn => btn.addEventListener("click", () => {
      selectedCategory = btn.dataset.category || "all";
      categoriesEl.querySelectorAll(".category-filter").forEach(x => x.classList.toggle("active", x === btn));
      render();
    }));
    categoriesEl.querySelectorAll(".category-filter").forEach(btn => btn.classList.toggle("active", (btn.dataset.category || "all") === selectedCategory));
  }

  function render() {
    const visible = products.filter(p => {
      const categoryMatch = selectedCategory === "all" || p.category === selectedCategory;
      const haystack = `${p.name || ""} ${p.category || ""} ${p.color_name || ""}`.toLocaleLowerCase("ar");
      const searchMatch = !searchTerm || haystack.includes(searchTerm.toLocaleLowerCase("ar"));
      return categoryMatch && searchMatch;
    });
    if (!visible.length) {
      productsEl.innerHTML = '<div class="products-state">لا توجد منتجات مطابقة للبحث أو التصنيف.</div>';
      return;
    }
    productsEl.innerHTML = visible.map((p, i) => `
      <article class="product-card" data-product-id="${p.id}">
        <div class="product-image">
          ${p.featured ? '<span class="premium-badge">مميز</span>' : ''}
          <a href="product.html?id=${encodeURIComponent(p.id)}"><img loading="lazy" alt="${escapeHtml(p.name)}" src="${imageUrl(p.image_path)}"></a>
        </div>
        <div class="product-info">
          <span class="product-type">${escapeHtml(p.category)}</span>
          <h2>${escapeHtml(p.name)}</h2>
          <p class="price">${money(p.price)}</p>
          <button class="add-to-cart" type="button" ${Number(p.stock_quantity) <= 0 ? 'disabled' : ''}>${Number(p.stock_quantity) <= 0 ? 'غير متوفر' : 'أضف إلى السلة'}</button>
        </div>
      </article>`).join("");

    productsEl.querySelectorAll(".add-to-cart").forEach(btn => btn.addEventListener("click", async e => {
      e.preventDefault(); e.stopPropagation();
      const id = btn.closest(".product-card")?.dataset.productId;
      try {
        await FloraStore.addToCart(id, 1);
        const old = btn.textContent; btn.textContent = "تمت الإضافة ✓"; btn.disabled = true;
        setTimeout(() => { btn.textContent = old; btn.disabled = false; }, 1100);
      } catch (err) {
        console.error(err);
        FloraUI.showToast(FloraUI.errorMessage(err, "تعذر إضافة المنتج للسلة."));
      }
    }));
  }

  try {
    const sb = await FloraSupabase.init();
    const { data, error } = await sb.from("products").select("id,name,category,price,image_path,color_name,color_hex,group_key,stock_quantity,active,featured,sort_order,updated_at").eq("active", true).order("sort_order", { ascending: true });
    if (error) throw error;
    products = data || [];
    buildCategories();
    render();
  } catch (error) {
    console.error("Shop products error:", error);
    productsEl.innerHTML = '<div class="products-state">تعذر تحميل المنتجات الآن. تأكد من إعداد Supabase ثم حاول مرة أخرى.</div>';
  }
});
