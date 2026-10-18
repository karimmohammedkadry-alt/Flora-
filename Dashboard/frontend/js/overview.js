(() => {
 const A=window.FloraAdmin; A.$('sharedNav').innerHTML=A.nav('overview'); A.identity(); const esc=A.esc;
 const activeStatuses=['pending','confirmed','preparing','shipping'];
 const fmtInt=n=>Number(n||0).toLocaleString('ar-EG');
 const fmtDay=d=>d.toLocaleDateString('ar-EG',{weekday:'short'});
 const dateKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
 function renderChart(orders){
   const host=A.$('ordersChart'); if(!host)return;
   if(!Array.isArray(orders)){host.innerHTML='<div class="empty">الرسم البياني متاح عند الاتصال بصلاحية الإدارة لقراءة الطلبات.</div>';host.setAttribute('aria-label','بيانات الطلبات غير متاحة في وضع العرض المحدود');return}
   const today=new Date(); today.setHours(0,0,0,0);
   const days=Array.from({length:7},(_,i)=>{const d=new Date(today);d.setDate(today.getDate()-6+i);return {date:d,key:dateKey(d),label:fmtDay(d),count:0,total:0};});
   const lookup=new Map(days.map(d=>[d.key,d]));
   (orders||[]).forEach(o=>{if(!o.created_at)return;const d=new Date(o.created_at);if(Number.isNaN(d.getTime()))return;const item=lookup.get(dateKey(d));if(item&&o.status!=='cancelled'){item.count++;item.total+=Number(o.total||0)}});
   const max=Math.max(1,...days.map(d=>d.count));
   host.innerHTML=`<div class="chart-gridlines" aria-hidden="true"><span></span><span></span><span></span><span></span></div><div class="chart-bars">${days.map(d=>`<div class="chart-column" title="${esc(d.label)}: ${fmtInt(d.count)} طلب"><div class="chart-value">${fmtInt(d.count)}</div><div class="chart-track"><div class="chart-bar" style="height:${Math.max(d.count?8:2,Math.round(d.count/max*100))}%"></div></div><span class="chart-day">${esc(d.label)}</span></div>`).join('')}</div>`;
   host.setAttribute('aria-label',`عدد الطلبات غير الملغاة خلال آخر سبعة أيام: ${days.reduce((s,d)=>s+d.count,0)} طلب`);
 }
 function renderInventory(products){
   const host=A.$('inventoryAlerts'); if(!host)return;
   const low=(products||[]).filter(p=>p.active!==false && p.active!==0 && Number(p.stock_quantity??p.stock??0)<=5).sort((a,b)=>Number(a.stock_quantity??a.stock??0)-Number(b.stock_quantity??b.stock??0)).slice(0,6);
   if(!low.length){host.innerHTML='<div class="inventory-ok"><span aria-hidden="true">✓</span><div><strong>المخزون يبدو جيدًا</strong><small>لا توجد منتجات نشطة عند 5 قطع أو أقل حسب البيانات المتاحة.</small></div></div>';return}
   host.innerHTML=low.map(p=>{const stock=Number(p.stock_quantity??p.stock??0);return `<div class="inventory-row"><div class="inventory-product"><span class="inventory-dot ${stock===0?'out':''}"></span><div><strong>${esc(p.name||'منتج بدون اسم')}</strong><small>${esc(p.category||'بدون تصنيف')}</small></div></div><span class="stock-pill ${stock===0?'out':''}">${stock===0?'نفد المخزون':`${fmtInt(stock)} قطع`}</span></div>`}).join('');
 }
 function renderOrders(orders){
   const host=A.$('recentOrders'); if(!host)return;
   if(!orders?.length){host.innerHTML='<div class="empty">لا توجد طلبات متاحة حاليًا، أو أن صلاحية عرض الطلبات غير مفعّلة.</div>';return}
   host.innerHTML=`<table><thead><tr><th>رقم الطلب</th><th>العميل</th><th>التاريخ</th><th>القيمة</th><th>الحالة</th></tr></thead><tbody>${orders.slice().sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0)).slice(0,8).map(o=>`<tr><td><strong>${esc(o.order_number||o.id||'—')}</strong></td><td>${esc(o.customer_name||'—')}</td><td>${esc(A.date(o.created_at))}</td><td>${A.money(o.total)}</td><td><span class="status-pill status-${esc(o.status||'unknown')}">${esc(A.statusText[o.status]||o.status||'غير محدد')}</span></td></tr>`).join('')}</tbody></table>`;
 }
 async function load(){
   const btn=A.$('refreshBtn'),stamp=A.$('lastUpdated'),notice=A.$('dashboardNotice'); if(btn){btn.disabled=true;btn.classList.add('is-loading')}; if(notice)notice.hidden=true;
   try{
     let d,limited=false;
     try{d=await A.api('bootstrap')}catch(_){const c=await A.client();const {data,error}=await c.from('products').select('id,name,category,active,price,stock_quantity,created_at').order('created_at',{ascending:false}).limit(500);if(error)throw error;d={products:data||[],orders:[],messages:[]};limited=true;}
     const p=d.products||[],o=d.orders||[],m=d.messages||[];
     A.$('statProducts').textContent=fmtInt(p.length);A.$('statActive').textContent=fmtInt(p.filter(x=>x.active===true||x.active===1).length);
     const today=dateKey(new Date());A.$('statToday').textContent=limited?'—':fmtInt(o.filter(x=>x.created_at&&dateKey(new Date(x.created_at))===today).length);
     A.$('statPending').textContent=limited?'—':fmtInt(o.filter(x=>activeStatuses.includes(x.status)).length);
     A.$('statSales').textContent=limited?'—':A.money(o.filter(x=>x.status!=='cancelled').reduce((sum,x)=>sum+Number(x.total||0),0));
     A.$('statMessages').textContent=limited?'—':fmtInt(m.filter(x=>x.status==='new').length);
     renderChart(limited?null:o);renderInventory(p);renderOrders(limited?[]:o);
     if(limited&&notice){notice.hidden=false;notice.className='notice';notice.textContent='وضع عرض محدود: إحصاءات المنتجات والمخزون فقط. الطلبات والرسائل والمبيعات لا تظهر بدون صلاحية الإدارة، لذلك لم نعرض أرقامًا تقديرية.'}
     if(stamp)stamp.textContent=`آخر تحديث: ${new Date().toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'})}`;
   }catch(e){A.showError(e)}finally{if(btn){btn.disabled=false;btn.classList.remove('is-loading')}}
 }
 A.$('refreshBtn').onclick=load; load();
})();
