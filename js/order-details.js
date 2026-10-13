document.addEventListener("DOMContentLoaded", async () => {
  const id = new URLSearchParams(location.search).get("id");
  const set=(id,v)=>document.getElementById(id)?.replaceChildren(String(v ?? ""));
  if (!id) {
    document.getElementById("orderContent")?.classList.add("hidden");
    document.getElementById("notFound")?.classList.remove("hidden");
    return;
  }
  try {
    const sb=await FloraSupabase.init();
    const user=await FloraStore.ensureUser();
    const {data:o,error}=await sb.from("orders").select("*, order_items(*)").eq("id",id).eq("user_id",user.id).single();
    if(error) throw error;
    document.getElementById("orderContent")?.classList.remove("hidden");
    document.getElementById("notFound")?.classList.add("hidden");
    const labels={pending:"تم استلام الطلب",confirmed:"تم تأكيد الطلب",preparing:"جاري تجهيز الطلب",shipping:"جاري التوصيل",delivered:"تم التسليم",cancelled:"تم إلغاء الطلب"};
    set("orderId",o.order_number); set("orderDate",new Date(o.created_at).toLocaleString("ar-EG")); set("statusBadge",labels[o.status]||labels.pending);
    set("customerName",o.customer_name); set("customerPhone",o.phone); set("governorate",o.governorate); set("city",o.city); set("address",o.address); set("landmark",o.landmark||"-"); set("paymentMethod",o.payment === "cash" ? "الدفع عند الاستلام" : "الدفع الإلكتروني");
    set("subtotal",Number(o.subtotal).toLocaleString("ar-EG")+" ج.م"); set("shipping",Number(o.shipping||0) ? Number(o.shipping).toLocaleString("ar-EG")+" ج.م" : "مجاني"); set("total",Number(o.total).toLocaleString("ar-EG")+" ج.م");
    const products=document.getElementById("productsList");
    if(products){
      products.innerHTML="";
      (o.order_items||[]).forEach(i=>{
        const el=document.createElement("div");el.className="order-product";
        el.innerHTML=`<img src="${i.image_path||"../assets/product-1.jpg"}" alt=""><div><strong></strong><span></span></div><b>${Number(i.line_total).toLocaleString("ar-EG")} ج.م</b>`;
        el.querySelector("strong").textContent=i.product_name;
        el.querySelector("span").textContent=`${i.color_name||""} × ${i.quantity}`;
        products.appendChild(el);
      });
      set("itemsCount",`${(o.order_items||[]).reduce((s,i)=>s+Number(i.quantity||0),0)} منتجات`);
    }
    const timeline=document.getElementById("timeline");
    if(timeline){
      timeline.innerHTML="";
      const flow=["pending","confirmed","preparing","shipping","delivered"];
      const currentIndex=flow.indexOf(o.status);
      if(o.status === "cancelled") {
        const el=document.createElement("div");
        el.className="timeline-item active cancelled";
        el.innerHTML=`<span class="timeline-dot"></span><strong>${labels.cancelled}</strong>`;
        timeline.appendChild(el);
      } else {
        flow.forEach((key,i)=>{
          const el=document.createElement("div");
          el.className="timeline-item"+(i <= currentIndex ? " active" : "");
          el.innerHTML=`<span class="timeline-dot"></span><strong>${labels[key]}</strong>`;
          timeline.appendChild(el);
        });
      }
    }
  }catch(e){
    console.error(e);
    document.getElementById("orderContent")?.classList.add("hidden");
    document.getElementById("notFound")?.classList.remove("hidden");
  }
});
