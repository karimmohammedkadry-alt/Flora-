(() => {
  let cartCount = 0;

  async function client() {
    return window.FloraSupabase.init();
  }

  async function ensureUser() {
    const sb = await client();
    const { data: { session } } = await sb.auth.getSession();
    if (session?.user) return session.user;
    const { data, error } = await sb.auth.signInAnonymously();
    if (error) throw error;
    return data.user;
  }

  async function getCart() {
    const sb = await client();
    const user = await ensureUser();
    const { data, error } = await sb
      .from("cart_items")
      .select("id, product_id, quantity, products(id, name, category, price, image_path, color_name, color_hex, group_key, stock_quantity, active)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data || []).map(row => ({
      id: row.product_id,
      cartItemId: row.id,
      quantity: row.quantity,
      ...(row.products || {})
    }));
  }

  async function getCount() {
    const cart = await getCart();
    return cart.reduce((sum, item) => sum + Math.max(0, Number(item.quantity) || 0), 0);
  }

  function paintCartCount(count, animate = false) {
    cartCount = Number(count) || 0;
    document.querySelectorAll("#cartCount, [data-cart-count]").forEach(el => {
      el.textContent = cartCount;
      if (animate) {
        el.classList.remove("bump");
        void el.offsetWidth;
        el.classList.add("bump");
      }
    });
  }

  async function updateCartCount(animate = false) {
    try { paintCartCount(await getCount(), animate); }
    catch (error) { console.error("Cart count error:", error); paintCartCount(0); }
  }

  async function addToCart(productId, quantity = 1) {
    const sb = await client();
    const user = await ensureUser();
    const amount = Math.min(99, Math.max(1, Number(quantity) || 1));
    const { data: product, error: productError } = await sb
      .from("products").select("id, stock_quantity, active").eq("id", productId).eq("active", true).maybeSingle();
    if (productError) throw productError;
    if (!product) throw new Error("PRODUCT_NOT_AVAILABLE");
    if (Number(product.stock_quantity) <= 0) throw new Error("OUT_OF_STOCK");

    const { data: existing, error: findError } = await sb
      .from("cart_items").select("id, quantity").eq("user_id", user.id).eq("product_id", productId).maybeSingle();
    if (findError) throw findError;
    const nextQuantity = Math.min(99, (existing?.quantity || 0) + amount);
    if (nextQuantity > Number(product.stock_quantity)) throw new Error("INSUFFICIENT_STOCK");
    if (existing) {
      const { error } = await sb.from("cart_items").update({ quantity: nextQuantity }).eq("id", existing.id).eq("user_id", user.id);
      if (error) throw error;
    } else {
      const { error } = await sb.from("cart_items").insert({ user_id: user.id, product_id: productId, quantity: amount });
      if (error) throw error;
    }
    await updateCartCount(true);
  }

  async function setCartQuantity(cartItemId, quantity) {
    const sb = await client();
    const user = await ensureUser();
    const amount = Math.min(99, Math.max(1, Number(quantity) || 1));
    const { data: row, error: rowError } = await sb.from("cart_items")
      .select("id, products(stock_quantity, active)").eq("id", cartItemId).eq("user_id", user.id).maybeSingle();
    if (rowError) throw rowError;
    if (!row) throw new Error("CART_ITEM_NOT_FOUND");
    const stock = Number(row.products?.stock_quantity ?? 0);
    if (!row.products?.active || stock <= 0) throw new Error("OUT_OF_STOCK");
    if (amount > stock) throw new Error("INSUFFICIENT_STOCK");
    const { error } = await sb.from("cart_items").update({ quantity: amount }).eq("id", cartItemId).eq("user_id", user.id);
    if (error) throw error;
    await updateCartCount();
  }

  async function removeCartItem(cartItemId) {
    const sb = await client();
    const user = await ensureUser();
    const { error } = await sb.from("cart_items").delete().eq("id", cartItemId).eq("user_id", user.id);
    if (error) throw error;
    await updateCartCount();
  }

  window.FloraStore = {
    getCart, getCount, updateCartCount, addToCart, setCartQuantity, removeCartItem, ensureUser,
    async notifyCartChanged() { await updateCartCount(true); window.dispatchEvent(new CustomEvent("floraCartChanged")); }
  };

  document.addEventListener("DOMContentLoaded", () => {
    // Keep the same active/hover navigation treatment on every page.
    const currentFile = (window.location.pathname.split("/").pop() || "home.html").toLowerCase();
    document.querySelectorAll(".site-header .main-nav a[href]").forEach(link => {
      try {
        const linkFile = new URL(link.href, window.location.href).pathname.split("/").pop().toLowerCase();
        const isActive = linkFile === currentFile || ((currentFile === "index.html" || currentFile === "") && linkFile === "home.html");
        link.classList.toggle("active", isActive);
        if (isActive) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current");
      } catch (_) {}
    });
    updateCartCount();
    document.querySelectorAll(".search-button").forEach(button => {
      button.addEventListener("click", () => {
        const current = new URL(window.location.href);
        const currentQuery = current.searchParams.get("q") || "";
        const value = window.prompt("ابحث عن منتج أو لون أو تصنيف:", currentQuery);
        if (value === null) return;
        const query = value.trim();
        const base = window.location.pathname.includes("/pages/")
          ? `${window.location.origin}${window.location.pathname.split("/pages/")[0]}/pages/`
          : `${window.location.origin}/pages/`;
        const shopUrl = new URL("shop.html", base);
        if (query) shopUrl.searchParams.set("q", query);
        window.location.href = shopUrl.href;
      });
    });
  });
})();
