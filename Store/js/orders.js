document.addEventListener("DOMContentLoaded", async () => {
  const list = document.getElementById("ordersList");
  const format = d => new Date(d).toLocaleDateString("ar-EG", {year:"numeric",month:"long",day:"numeric"});
  const status = {pending:"تم استلام الطلب",confirmed:"تم تأكيد الطلب",preparing:"جاري تجهيز الطلب",shipping:"جاري التوصيل",delivered:"تم التسليم",cancelled:"تم إلغاء الطلب"};
  try {
    const sb = await FloraSupabase.init();
    const user = await FloraStore.ensureUser();
    const { data, error } = await sb.from("orders")
      .select("id, order_number, created_at, status, total, payment, order_items(product_name, quantity)")
      .eq("user_id", user.id)
      .order("created_at", {ascending:false});
    if (error) throw error;
    const orders = data || [];
    document.getElementById("totalOrders")?.replaceChildren(String(orders.length));
    document.getElementById("pendingOrders")?.replaceChildren(String(orders.filter(x => !["delivered","cancelled"].includes(x.status)).length));
    document.getElementById("totalSpent")?.replaceChildren(orders.filter(x=>x.status!=="cancelled").reduce((s,x)=>s+Number(x.total||0),0).toLocaleString("ar-EG"));
    if (!list) return;
    list.innerHTML = orders.length ? "" : '<div class="empty-state">لا توجد طلبات حتى الآن.</div>';
    orders.forEach(o => {
      const el=document.createElement("article");
      el.className="order-card";
      const names=(o.order_items||[]).map(i=>`${i.product_name} × ${i.quantity}`).join("، ");
      el.innerHTML=`<div class="order-card-top"><div><strong></strong><span></span></div><span class="order-status"></span></div><p></p><div class="order-card-bottom"><strong></strong><a>عرض تفاصيل الطلب</a></div>`;
      el.querySelector(".order-card-top strong").textContent=o.order_number;
      el.querySelector(".order-card-top span").textContent=format(o.created_at);
      el.querySelector(".order-status").textContent=status[o.status]||status.pending;
      el.querySelector("p").textContent=names||"طلب";
      el.querySelector(".order-card-bottom strong").textContent=`${Number(o.total).toLocaleString("ar-EG")} ج.م`;
      el.querySelector("a").href=`order-details.html?id=${encodeURIComponent(o.id)}`;
      list.appendChild(el);
    });
  } catch(e) {
    console.error(e);
    if(list) list.innerHTML='<div class="empty-state">تعذر تحميل الطلبات. حاول تحديث الصفحة.</div>';
  }
});
