document.addEventListener("DOMContentLoaded", async () => {
  const id = new URLSearchParams(location.search).get("id");
  try {
    const sb = await FloraSupabase.init(); const user = await FloraStore.ensureUser();
    const { data:o, error } = await sb.from("orders").select("id, order_number, created_at, total, subtotal, shipping, payment, status, customer_name, phone, governorate, city, address, landmark, order_items(product_name, color_name, quantity, unit_price, line_total)").eq("id", id).eq("user_id", user.id).single();
    if(error) throw error;
    document.getElementById("orderId")?.replaceChildren(o.order_number);
    const statusLabels = {pending:"جاري مراجعة الطلب",confirmed:"تم تأكيد الطلب",preparing:"جاري تجهيز الطلب",shipping:"قيد الشحن",delivered:"تم التسليم",cancelled:"تم إلغاء الطلب"};
    document.querySelector(".info-item .status")?.replaceChildren(statusLabels[o.status] || "جاري مراجعة الطلب");
    document.getElementById("orderTotal")?.replaceChildren(Number(o.total).toLocaleString("ar-EG")+" ج.م");
    document.getElementById("paymentMethod")?.replaceChildren(o.payment === "cash" ? "الدفع عند الاستلام" : "الدفع الإلكتروني");
    document.getElementById("customerName")?.replaceChildren(o.customer_name);
    document.getElementById("customerPhone")?.replaceChildren(o.phone);
    document.getElementById("customerAddress")?.replaceChildren([o.governorate,o.city,o.address,o.landmark].filter(Boolean).join("، "));
    const details=document.querySelector('[href*="order-details.html"]'); if(details) details.href=`order-details.html?id=${encodeURIComponent(o.id)}`;
    const receiptText = value => value == null || value === '' ? '—' : String(value);
    document.getElementById('receiptOrderNumber')?.replaceChildren(receiptText(o.order_number));
    document.getElementById('receiptDate')?.replaceChildren(new Date(o.created_at).toLocaleString('ar-EG',{dateStyle:'medium',timeStyle:'short'}));
    document.getElementById('receiptTotal')?.replaceChildren(Number(o.total||0).toLocaleString('ar-EG')+' ج.م');
    document.getElementById('receiptStatus')?.replaceChildren(statusLabels[o.status] || 'جاري مراجعة الطلب');
    document.getElementById('receiptBarcodeNumber')?.replaceChildren(receiptText(o.order_number));
    const receiptItems=document.getElementById('receiptItems');
    if(receiptItems){receiptItems.replaceChildren();(o.order_items||[]).forEach(item=>{const row=document.createElement('div');row.className='receipt-item';const info=document.createElement('div');const name=document.createElement('strong');name.textContent=item.product_name||'منتج';const meta=document.createElement('small');meta.textContent=[item.color_name,`الكمية: ${Number(item.quantity||0)}`].filter(Boolean).join(' · ');info.append(name,meta);const price=document.createElement('strong');price.textContent=Number(item.line_total ?? Number(item.unit_price||0)*Number(item.quantity||0)).toLocaleString('ar-EG')+' ج.م';row.append(info,price);receiptItems.append(row);});if(!receiptItems.children.length){receiptItems.textContent='تفاصيل المنتجات غير متاحة.';}}
    document.getElementById('printReceipt')?.addEventListener('click',()=>{document.body.classList.add('printing-receipt');window.print();setTimeout(()=>document.body.classList.remove('printing-receipt'),700)});
  } catch(e) { console.error(e); document.getElementById("orderId")?.replaceChildren("غير متاح"); }
});
