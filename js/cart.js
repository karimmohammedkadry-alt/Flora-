document.addEventListener("DOMContentLoaded", async () => {
  const itemsEl = document.getElementById("cartItems");
  const emptyEl = document.getElementById("emptyCart");
  const format = n => Number(n || 0).toLocaleString("ar-EG");
  let cart = [];

  const summary = () => {
    const count = cart.reduce((s, x) => s + Number(x.quantity || 0), 0);
    const subtotal = cart.reduce((s, x) => s + Number(x.price || 0) * Number(x.quantity || 0), 0);
    document.getElementById("cartCount")?.replaceChildren(String(count));
    document.getElementById("itemsCount")?.replaceChildren(`${count} ${count === 1 ? "منتج" : "منتجات"}`);
    document.getElementById("summaryItems")?.replaceChildren(String(count));
    document.getElementById("subtotal")?.replaceChildren(format(subtotal));
    document.getElementById("shipping")?.replaceChildren(subtotal ? "مجاني" : "مجاني");
    document.getElementById("total")?.replaceChildren(format(subtotal));
    const checkout = document.getElementById("checkoutButton");
    if (checkout) checkout.disabled = !cart.length;
  };

  async function render() {
    cart = await FloraStore.getCart();
    itemsEl.innerHTML = "";
    emptyEl?.classList.toggle("hidden", cart.length > 0);

    cart.forEach(item => {
      const q = Number(item.quantity) || 1;
      const price = Number(item.price) || 0;
      const stock = Math.max(0, Number(item.stock_quantity) || 0);
      const unavailable = item.active === false || stock === 0;
      const overStock = q > stock;
      const el = document.createElement("article");
      el.className = "cart-item";
      el.innerHTML = `
        <div class="cart-item-image"><img src="${item.image_path || "../assets/product-1.jpg"}" alt=""></div>
        <div class="cart-item-info">
          <span class="cart-item-category">${item.category || "حجاب"}</span>
          <h3 class="cart-item-name"></h3>
          <span class="cart-item-color"></span>
          <span class="cart-item-price">${format(price)} ج.م</span>
          ${unavailable ? '<span class="cart-stock-warning">هذا المنتج غير متوفر حاليًا</span>' : overStock ? `<span class="cart-stock-warning">المتاح حاليًا: ${stock}</span>` : ""}
        </div>
        <div class="cart-item-actions">
          <strong class="item-total">${format(price * q)} ج.م</strong>
          <div class="quantity-control">
            <button type="button" class="increase" ${unavailable || q >= stock ? "disabled" : ""}>+</button>
            <span>${q}</span>
            <button type="button" class="decrease" ${q <= 1 ? "disabled" : ""}>−</button>
          </div>
          <button type="button" class="remove-item">حذف</button>
        </div>`;

      el.querySelector(".cart-item-name").textContent = item.name || "منتج";
      el.querySelector(".cart-item-color").textContent = `اللون: ${item.color_name || "الأساسي"}`;

      el.querySelector(".increase").onclick = async () => {
        try { await FloraStore.setCartQuantity(item.cartItemId, q + 1); await render(); }
        catch (e) { console.error(e); FloraUI.showToast(FloraUI.errorMessage(e, "لا يمكن زيادة الكمية.")); }
      };
      el.querySelector(".decrease").onclick = async () => {
        if (q <= 1) return;
        try { await FloraStore.setCartQuantity(item.cartItemId, q - 1); await render(); }
        catch (e) { console.error(e); FloraUI.showToast(FloraUI.errorMessage(e, "لا يمكن تعديل الكمية.")); }
      };
      el.querySelector(".remove-item").onclick = async () => {
        try { await FloraStore.removeCartItem(item.cartItemId); await render(); }
        catch (e) { console.error(e); FloraUI.showToast(FloraUI.errorMessage(e, "تعذر حذف المنتج.")); }
      };
      itemsEl.appendChild(el);
    });

    summary();
    await FloraStore.updateCartCount();
  }

  document.getElementById("checkoutButton")?.addEventListener("click", () => {
    if (cart.length) location.href = "checkout.html";
  });

  try {
    await render();
  } catch (e) {
    console.error(e);
    emptyEl?.classList.remove("hidden");
    FloraUI.showToast(FloraUI.errorMessage(e, "تعذر تحميل السلة. حاول تحديث الصفحة."));
  }
});
