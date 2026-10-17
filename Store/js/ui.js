window.FloraUI = (() => {
  const messages = {
    OUT_OF_STOCK: "المنتج غير متوفر حاليًا.",
    INSUFFICIENT_STOCK: "الكمية المطلوبة أكبر من المخزون المتاح.",
    PRODUCT_NOT_AVAILABLE: "هذا المنتج لم يعد متاحًا.",
    CART_ITEM_NOT_FOUND: "هذا المنتج لم يعد موجودًا في السلة.",
    "Cart is empty": "السلة فارغة.",
    "Authentication required": "تعذر التحقق من جلسة المتجر. حاول مرة أخرى."
  };

  function errorMessage(error, fallback = "حدث خطأ غير متوقع. حاول مرة أخرى.") {
    const raw = String(error?.message || error || "").trim();
    if (messages[raw]) return messages[raw];
    if (/stock|out of stock|insufficient/i.test(raw)) return "الكمية المطلوبة غير متاحة حاليًا.";
    if (/auth|authentication|jwt/i.test(raw)) return "تعذر التحقق من جلسة المتجر. حاول تحديث الصفحة.";
    return fallback;
  }

  function showToast(text, type = "error") {
    let root = document.getElementById("floraToastRoot");
    if (!root) {
      root = document.createElement("div");
      root.id = "floraToastRoot";
      root.setAttribute("aria-live", "polite");
      root.className = "flora-toast-root";
      document.body.appendChild(root);
    }
    const toast = document.createElement("div");
    toast.className = `flora-toast flora-toast-${type}`;
    toast.textContent = text;
    root.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }

  return { errorMessage, showToast };
})();
