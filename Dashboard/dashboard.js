(() => {
  const $ = (id) => document.getElementById(id);
  const state = { products: [], orders: [], messages: [] };
  const statusText = {pending:'جديد',confirmed:'مؤكد',preparing:'جاري التجهيز',shipping:'قيد الشحن',delivered:'تم التسليم',cancelled:'ملغي'};
  const messageStatus = {new:'جديدة',read:'مقروءة',resolved:'تم الحل'};
  const adminApi = `${window.FLORA_SUPABASE_URL.replace(/\/$/,'')}/functions/v1/flora-admin`;
  let supabaseClient = null;
  let accessToken = '';
  let currentUser = null;
  let orderPollTimer = null;
  let knownOrderIds = new Set();
  let audioContext = null;
  let alertsEnabled = false;
  let polling = false;
  const localPreview = ['localhost','127.0.0.1','[::1]'].includes(location.hostname);
  const localProductsKey = 'flora.dashboard.localPreview.products.v1';
  function readLocalProducts(){try{const raw=localStorage.getItem(localProductsKey);return raw?JSON.parse(raw):null}catch(_){return null}}
  function saveLocalProducts(){try{localStorage.setItem(localProductsKey,JSON.stringify(state.products));return true}catch(_){toast('تعذر الحفظ في المتصفح. مساحة التخزين قد تكون ممتلئة.','error');return false}}

  function toast(msg, type='success'){const el=document.createElement('div');el.className=`toast ${type}`;el.textContent=msg;$('toastRoot').appendChild(el);setTimeout(()=>el.remove(),3500)}
  function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
  function money(v){return `${Number(v||0).toFixed(2)} ج.م`}
  function date(v){return new Date(v).toLocaleString('ar-EG',{dateStyle:'medium',timeStyle:'short'})}
  function statusBadge(s){return `<span class="badge ${esc(s)}">${esc(statusText[s]||s)}</span>`}
  function setSection(name){document.querySelectorAll('.section').forEach(x=>x.hidden=x.id!==name);document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.section===name))}
  // CSV exports are generated locally from the authenticated dashboard data; no data is sent to a third party.
  function csvCell(value){
    let text=String(value??'');
    // Prevent spreadsheet formula injection for values beginning with formula markers.
    if(/^[\s\u0000-\u001f]*[=+@\-]/.test(text)) text="'"+text;
    return '"'+text.replace(/"/g,'""')+'"';
  }
  function exportCsv(filename, columns, rows){
    if(!Array.isArray(rows)||!rows.length){toast('لا توجد بيانات لتصديرها.','error');return}
    const csv='\ufeff'+[columns.map(c=>csvCell(c.label)).join(','),...rows.map(row=>columns.map(c=>csvCell(c.get(row))).join(','))].join('\r\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.hidden=true;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    toast('تم تجهيز ملف CSV. راجع عدد السجلات قبل استخدامه.');
  }
  const productExportColumns=[
    {label:'اسم المنتج',get:r=>r.name},{label:'التصنيف',get:r=>r.category},{label:'السعر',get:r=>r.price},{label:'المخزون',get:r=>r.stock_quantity},
    {label:'اللون',get:r=>r.color_name},{label:'كود اللون',get:r=>r.color_hex},{label:'نشط',get:r=>r.active?'نعم':'لا'},
    {label:'مميز',get:r=>r.featured?'نعم':'لا'},{label:'الوصف',get:r=>r.description},{label:'مسار الصورة',get:r=>r.image_path}
  ];
  const orderExportColumns=[
    {label:'رقم الطلب',get:r=>r.order_number},{label:'اسم العميل',get:r=>r.customer_name},{label:'الهاتف',get:r=>r.phone},
    {label:'البريد الإلكتروني',get:r=>r.customer_email},{label:'المحافظة',get:r=>r.governorate},{label:'المدينة',get:r=>r.city},
    {label:'العنوان',get:r=>r.address},{label:'الحالة',get:r=>statusText[r.status]||r.status},{label:'قيمة المنتجات',get:r=>r.subtotal},
    {label:'الشحن',get:r=>r.shipping},{label:'الإجمالي',get:r=>r.total},{label:'التاريخ',get:r=>r.created_at}
  ];
  const messageExportColumns=[{label:'الاسم',get:r=>r.name},{label:'الهاتف',get:r=>r.phone},{label:'الحالة',get:r=>messageStatus[r.status]||r.status},{label:'الرسالة',get:r=>r.message},{label:'التاريخ',get:r=>r.created_at}];

  function showLogin(message=''){
    $('loginView').hidden=false; $('dashboardView').hidden=true;
    $('loginError').hidden=!message; $('loginError').textContent=message;
  }
  function showSetupMode(enabled){
    $('loginForm').hidden=enabled; $('firstSetupForm').hidden=!enabled;
    $('loginHeading').textContent=enabled?'إنشاء حساب الإدارة':'تسجيل دخول الإدارة';
    $('loginIntro').textContent=enabled?'أنشئ اسم المستخدم وكلمة المرور لأول مرة.':'اكتب اسم المستخدم وكلمة المرور للدخول إلى لوحة التحكم.';
    $('showLoginBtn').classList.toggle('active',!enabled); $('showSetupBtn').classList.toggle('active',enabled);
    $('loginError').hidden=true; $('setupStatus').hidden=true;
  }
  function setupMessage(message,isError=false){$('setupStatus').hidden=!message;$('setupStatus').textContent=message;$('setupStatus').classList.toggle('error',isError);}
  async function finishFirstSetup(){
    const username=$('setupUsername').value.trim(), password=$('setupPassword').value, confirm=$('setupPasswordConfirm').value, setupSecret=$('setupSecret').value;
    if(username.length<3||username.length>64){setupMessage('اسم المستخدم لازم يكون من 3 إلى 64 حرفًا.',true);return}
    if(password.length<12||password.length>128){setupMessage('كلمة المرور لازم تكون 12 حرفًا على الأقل.',true);return}
    if(password!==confirm){setupMessage('كلمتا المرور مش متطابقتين.',true);return}
    if(setupSecret.length<24){setupMessage('اكتب رمز الإعداد السري الذي ضبطته في إعدادات الخادم.',true);return}
    $('finishSetup').disabled=true; setupMessage('جارٍ إنشاء حساب الإدارة الآمن…');
    try{
      const res=await fetch(adminApi,{method:'POST',headers:{'Content-Type':'application/json','apikey':window.FLORA_SUPABASE_KEY},body:JSON.stringify({action:'setup_admin',payload:{username,password,setupSecret}})});
      const result=await res.json().catch(()=>({}));
      if(!res.ok||result.error) throw new Error(result.error||'تعذر إنشاء حساب الإدارة.');
      $('firstSetupForm').reset();
      showSetupMode(false);
      showLogin('تم إنشاء الحساب. احذف FLORA_ADMIN_SETUP_SECRET من أسرار Edge Function ثم سجّل الدخول باسم المستخدم وكلمة المرور.');
      toast('تم إنشاء حساب الإدارة.');
    }catch(err){setupMessage(err.message||'تعذر إنشاء الحساب.',true)}
    finally{$('finishSetup').disabled=false}
  }
  function showDashboard(){ $('loginView').hidden=true; $('dashboardView').hidden=false; $('adminIdentity').textContent=currentUser?.username||currentUser?.email||'جلسة إدارة موثقة'; }
  async function api(action,payload={}){
    if(localPreview && !accessToken) throw new Error('المعاينة المحلية للقراءة فقط؛ تسجيل دخول الأدمن مطلوب لتنفيذ تغييرات حقيقية.');
    if(!accessToken) throw new Error('سجّل الدخول أولًا.');
    const res=await fetch(adminApi,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${accessToken}`,'apikey':window.FLORA_SUPABASE_KEY},body:JSON.stringify({action,payload})});
    const data=await res.json().catch(()=>({}));
    if(res.status===401||res.status===403){ await signOut(false); throw new Error(data.error||'انتهت الجلسة أو لا تملك صلاحية الإدارة.'); }
    if(!res.ok||data.error)throw new Error(data.error||'حدث خطأ في خادم الإدارة.');
    return data;
  }
  async function signOut(showMessage=true){
    try { if(supabaseClient) await supabaseClient.auth.signOut(); } catch(_) {}
    accessToken=''; currentUser=null; if(orderPollTimer)clearInterval(orderPollTimer);orderPollTimer=null;state.products=[]; state.orders=[]; state.messages=[];
    $('dashboardView').hidden=true; $('loginView').hidden=false;
    if(showMessage) showLogin('تم تسجيل الخروج.');
  }
  async function signIn(username,password){
    $('loginSubmit').disabled=true; $('loginSubmit').textContent='جارٍ التحقق…';
    $('loginError').hidden=true;
    try {
      if(!window.FloraSupabase) throw new Error('تعذر تحميل إعدادات Supabase. تحقق من الاتصال بالإنترنت.');
      supabaseClient=await window.FloraSupabase.init();
      // Username is resolved privately by the Edge Function; Supabase Auth verifies the password.
      const res=await fetch(adminApi,{method:'POST',headers:{'Content-Type':'application/json','apikey':window.FLORA_SUPABASE_KEY},body:JSON.stringify({action:'login',payload:{username,password}})});
      const result=await res.json().catch(()=>({}));
      if(!res.ok||result.error) throw new Error(result.error||'اسم المستخدم أو كلمة المرور غير صحيحة.');
      if(!result.session?.access_token||!result.session?.refresh_token) throw new Error('لم يتم إنشاء جلسة صالحة.');
      const {data,error}=await supabaseClient.auth.setSession({access_token:result.session.access_token,refresh_token:result.session.refresh_token});
      if(error) throw error;
      accessToken=data.session?.access_token||result.session.access_token; currentUser=data.user||result.user;
      // Every dashboard operation is separately verified by the Edge Function.
      const boot=await api('bootstrap');
      state.products=boot.products||[]; state.orders=boot.orders||[]; state.messages=boot.messages||[];
      showDashboard(); renderAll(); startOrderPolling();
      if(boot.limited?.orders||boot.limited?.messages) toast('يتم عرض آخر 500 سجل حاليًا.','error');
    } catch(err) {
      try { if(supabaseClient) await supabaseClient.auth.signOut(); } catch(_) {}
      accessToken=''; currentUser=null;
      showLogin(err.message||'اسم المستخدم أو كلمة المرور غير صحيحة.');
    } finally { $('loginSubmit').disabled=false; $('loginSubmit').textContent='تسجيل الدخول'; }
  }

  async function updateAccount(e){
    e.preventDefault();
    const currentPassword=$('accountCurrentPassword').value;
    const username=$('accountNewUsername').value.trim();
    const newPassword=$('accountNewPassword').value;
    const hint=$('accountHint');
    if(!username&&!newPassword){hint.textContent='اكتب تغييرًا واحدًا على الأقل.';return}
    if(username && (username.length<3||username.length>64)){hint.textContent='اسم المستخدم لازم يكون من 3 إلى 64 حرفًا.';return}
    if(newPassword && newPassword.length<12){hint.textContent='كلمة المرور الجديدة لازم تكون 12 حرفًا على الأقل.';return}
    $('accountSave').disabled=true; $('accountSave').textContent='جارٍ الحفظ…'; hint.textContent='';
    try{
      if(!currentUser?.email||!supabaseClient) throw new Error('الجلسة غير مكتملة. سجّل الدخول مرة أخرى.');
      const {data:verified,error:verifyError}=await supabaseClient.auth.signInWithPassword({email:currentUser.email,password:currentPassword});
      if(verifyError||!verified.user||verified.user.app_metadata?.role!=='admin') throw new Error('كلمة المرور الحالية غير صحيحة.');
      accessToken=verified.session.access_token; currentUser={...verified.user,username:currentUser.username};
      const result=await api('admin_credentials_update',{username,newPassword});
      if(result.username){currentUser.username=result.username;}
      $('accountForm').reset();
      hint.textContent='تم حفظ التغييرات بنجاح.'; toast('تم تحديث بيانات الحساب.'); showDashboard();
    }catch(err){hint.textContent=err.message||'تعذر حفظ التغييرات.';toast(hint.textContent,'error')}
    finally{$('accountSave').disabled=false;$('accountSave').textContent='حفظ التغييرات'}
  }

  function playOrderAlert(){
    try {
      const Ctx=window.AudioContext||window.webkitAudioContext;
      if(!Ctx) return;
      audioContext=audioContext||new Ctx();
      if(audioContext.state==='suspended') audioContext.resume();
      const now=audioContext.currentTime;
      [880,1175,880].forEach((hz,i)=>{const osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.type='sine';osc.frequency.value=hz;gain.gain.setValueAtTime(0.0001,now+i*.18);gain.gain.exponentialRampToValueAtTime(.16,now+i*.18+.025);gain.gain.exponentialRampToValueAtTime(.0001,now+i*.18+.14);osc.connect(gain);gain.connect(audioContext.destination);osc.start(now+i*.18);osc.stop(now+i*.18+.15)});
    } catch(e){console.warn('Order sound unavailable until browser interaction:',e)}
  }
  async function enableOrderAlerts(){
    try { const Ctx=window.AudioContext||window.webkitAudioContext;if(Ctx){audioContext=audioContext||new Ctx();await audioContext.resume();} if('Notification' in window&&Notification.permission==='default') await Notification.requestPermission(); alertsEnabled=true;toast('تم تفعيل تنبيهات الطلبات أثناء فتح الداشبورد.');$('enableOrderAlerts').textContent='🔔 التنبيهات مفعّلة'; }
    catch(e){toast('تعذر تفعيل التنبيهات من المتصفح. تحقق من صلاحيات الموقع.','error')}
  }
  function announceNewOrders(rows){
    const fresh=rows.filter(o=>!knownOrderIds.has(String(o.id)));
    rows.forEach(o=>knownOrderIds.add(String(o.id)));
    if(!alertsEnabled||!fresh.length)return;
    fresh.filter(o=>o.status==='pending').forEach(o=>{
      playOrderAlert();
      const message=`طلب جديد ${o.order_number||''} من ${o.customer_name||'عميل'} بإجمالي ${money(o.total)}.`;
      toast(message,'success');
      if('Notification' in window&&Notification.permission==='granted'){
        try{const n=new Notification('طلب جديد — Flora Fashion Hijab',{body:message,tag:`flora-order-${o.id}`,icon:'../Store/assets/logo.png'});n.onclick=()=>{window.focus();setSection('orders');n.close()}}catch(e){console.warn('Browser notification unavailable',e)}
      }
    });
  }
  async function pollOrders(){if(polling||!accessToken||document.hidden)return;polling=true;try{const data=await api('bootstrap');const previous=state.orders;state.products=data.products||state.products;state.orders=data.orders||[];state.messages=data.messages||state.messages;if(knownOrderIds.size===0)state.orders.forEach(o=>knownOrderIds.add(String(o.id)));else announceNewOrders(state.orders);renderAll()}catch(e){console.warn('Order refresh failed:',e.message)}finally{polling=false}}
  function startOrderPolling(){if(orderPollTimer)clearInterval(orderPollTimer);knownOrderIds=new Set(state.orders.map(o=>String(o.id)));orderPollTimer=setInterval(pollOrders,20000)}
  async function loadAll(){const data=await api('bootstrap');state.products=data.products||[];state.orders=data.orders||[];state.messages=data.messages||[];if(data.limited.orders||data.limited.messages)toast('يتم عرض آخر 500 سجل حاليًا.','error');renderAll();knownOrderIds=new Set(state.orders.map(o=>String(o.id)))}
  function renderAll(){renderStats();renderRecentOrders();renderProducts();renderOrders();renderMessages()}
  function renderStats(){const today=new Date().toDateString();$('statProducts').textContent=state.products.length;$('statActive').textContent=state.products.filter(p=>p.active).length;$('statToday').textContent=state.orders.filter(o=>new Date(o.created_at).toDateString()===today).length;$('statPending').textContent=state.orders.filter(o=>['pending','confirmed','preparing','shipping'].includes(o.status)).length;$('statSales').textContent=money(state.orders.filter(o=>o.status!=='cancelled').reduce((a,o)=>a+Number(o.total||0),0));$('statMessages').textContent=state.messages.filter(m=>m.status==='new').length}
  function tableOrders(rows){return `<table class="table"><thead><tr><th>الطلب</th><th>العميل</th><th>الإجمالي</th><th>الحالة</th><th>التاريخ</th><th></th></tr></thead><tbody>${rows.map(o=>`<tr><td>${esc(o.order_number)}</td><td>${esc(o.customer_name)}<br><small>${esc(o.phone)}</small></td><td>${money(o.total)}</td><td>${statusBadge(o.status)}</td><td>${date(o.created_at)}</td><td><button class="ghost" data-order="${o.id}">التفاصيل</button></td></tr>`).join('')}</tbody></table>`}
  function renderRecentOrders(){$('recentOrders').innerHTML=state.orders.length?tableOrders(state.orders.slice(0,8)):'<div class="empty">لا توجد طلبات حتى الآن.</div>'}
  function renderProducts(){const q=$('productSearch').value.trim().toLowerCase(),f=$('productFilter').value;const rows=state.products.filter(p=>(!q||`${p.name} ${p.category} ${p.color_name}`.toLowerCase().includes(q))&&(f==='all'||(f==='active'&&p.active)||(f==='inactive'&&!p.active)||(f==='low'&&Number(p.stock_quantity)<=3)));$('productsTable').innerHTML=rows.length?`<table class="table"><thead><tr><th>المنتج</th><th>التصنيف</th><th>السعر</th><th>المخزون</th><th>الظهور</th><th>مميز</th><th>إجراءات</th></tr></thead><tbody>${rows.map(p=>`<tr><td><strong>${esc(p.name)}</strong><br><small>${esc(p.color_name)}</small></td><td>${esc(p.category)}</td><td>${money(p.price)}</td><td>${Number(p.stock_quantity)} ${Number(p.stock_quantity)<=3?'<span class="badge pending">منخفض</span>':''}</td><td><span class="badge ${p.active?'active':'inactive'}">${p.active?'نشط':'مخفي'}</span></td><td>${p.featured?'نعم':'لا'}</td><td class="actions"><button data-edit-product="${p.id}">تعديل</button><button data-toggle-product="${p.id}">${p.active?'إخفاء':'تفعيل'}</button><button data-delete-product="${p.id}">حذف</button></td></tr>`).join('')}</tbody></table>`:'<div class="empty">لا توجد منتجات مطابقة.</div>'}
  function renderOrders(){const q=$('orderSearch').value.trim().toLowerCase(),f=$('orderFilter').value;const rows=state.orders.filter(o=>(!q||`${o.order_number} ${o.customer_name} ${o.phone}`.toLowerCase().includes(q))&&(f==='all'||o.status===f));$('ordersTable').innerHTML=rows.length?tableOrders(rows):'<div class="empty">لا توجد طلبات.</div>'}
  function renderMessages(){const f=$('messageFilter').value;const rows=state.messages.filter(m=>f==='all'||m.status===f);$('messagesTable').innerHTML=rows.length?`<table class="table"><thead><tr><th>الاسم</th><th>الهاتف</th><th>الحالة</th><th>التاريخ</th><th></th></tr></thead><tbody>${rows.map(m=>`<tr><td>${esc(m.name)}</td><td>${esc(m.phone||'-')}</td><td><span class="badge">${esc(messageStatus[m.status]||m.status)}</span></td><td>${date(m.created_at)}</td><td><button class="ghost" data-message="${m.id}">فتح</button></td></tr>`).join('')}</tbody></table>`:'<div class="empty">لا توجد رسائل.</div>'}

  function openProduct(p){$('productDialogTitle').textContent=p?'تعديل منتج':'إضافة منتج';$('productId').value=p?.id||'';$('pName').value=p?.name||'';$('pCategory').value=p?.category||'';$('pPrice').value=p?.price??'';$('pStock').value=p?.stock_quantity??0;$('pColorName').value=p?.color_name||'';$('pColorHex').value=p?.color_hex||'';$('pGroupKey').value=p?.group_key||'';$('pSort').value=p?.sort_order??0;$('pImage').value=p?.image_path||'';$('pDescription').value=p?.description||'';$('pActive').checked=p?.active!==false;$('pFeatured').checked=!!p?.featured;$('productDialog').showModal()}
  async function saveProduct(){const id=$('productId').value;const data={...(id?{id}:{}),name:$('pName').value.trim(),category:$('pCategory').value.trim(),price:Number($('pPrice').value),stock_quantity:Number($('pStock').value),color_name:$('pColorName').value.trim(),color_hex:$('pColorHex').value.trim()||null,group_key:$('pGroupKey').value.trim(),sort_order:Number($('pSort').value||0),image_path:$('pImage').value.trim()||null,description:$('pDescription').value.trim()||null,active:$('pActive').checked,featured:$('pFeatured').checked};if(localPreview){if(!data.name||!data.category||!data.color_name||!data.group_key||!Number.isFinite(data.price)||data.price<0)throw new Error('أكمل اسم المنتج والتصنيف واللون ومفتاح المجموعة وسعرًا صحيحًا.');if(id){const i=state.products.findIndex(p=>String(p.id)===String(id));if(i>=0)state.products[i]={...state.products[i],...data};else state.products.push({...data,id});}else state.products.push({...data,id:`local-${Date.now()}`,created_at:new Date().toISOString()});if(!saveLocalProducts())throw new Error('لم يتم حفظ المنتج محليًا.');$('productDialog').close();renderAll();toast('تم حفظ المنتج في المعاينة المحلية فقط. لن يظهر في المتجر حتى تسجيل دخول أدمن وربطه بقاعدة البيانات.');return}await api('product_upsert',{data});$('productDialog').close();toast('تم حفظ المنتج.');await loadAll()}
  async function toggleProduct(id){if(localPreview){const p=state.products.find(x=>String(x.id)===String(id));if(!p)return;p.active=!p.active;if(!saveLocalProducts())return;renderAll();toast('تم تحديث الظهور محليًا فقط.');return}await api('product_toggle',{id});toast('تم تحديث ظهور المنتج.');await loadAll()}
  async function deleteProduct(id){if(!confirm(localPreview?'إخفاء المنتج من المعاينة المحلية؟ لن يتأثر المتجر الحقيقي.':'إخفاء المنتج من المتجر؟ سيظل محفوظًا داخل الطلبات السابقة ويمكن إعادة تفعيله.'))return;if(localPreview){state.products=state.products.filter(p=>String(p.id)!==String(id));if(!saveLocalProducts())return;renderAll();toast('تم حذف المنتج من المعاينة المحلية فقط.');return}await api('product_delete',{id});toast('تم إخفاء المنتج مع الحفاظ على سجل الطلبات.');await loadAll()}
  async function openOrder(id){const {order:o,items}=await api('order_detail',{id});$('orderDetails').innerHTML=`<div class="detail-grid"><div><strong>رقم الطلب</strong>${esc(o.order_number)}</div><div><strong>التاريخ</strong>${date(o.created_at)}</div><div><strong>العميل</strong>${esc(o.customer_name)}</div><div><strong>البريد الإلكتروني</strong>${esc(o.customer_email||'-')}</div><div><strong>الهاتف</strong>${esc(o.phone)}</div><div><strong>المحافظة</strong>${esc(o.governorate)}</div><div><strong>المدينة</strong>${esc(o.city)}</div><div class="wide"><strong>العنوان</strong>${esc(o.address)}${o.landmark?` — ${esc(o.landmark)}`:''}</div></div><hr><label>حالة الطلب<select id="orderStatusSelect"><option value="pending">جديد</option><option value="confirmed">مؤكد</option><option value="preparing">جاري التجهيز</option><option value="shipping">قيد الشحن</option><option value="delivered">تم التسليم</option><option value="cancelled">ملغي</option></select></label><div class="order-items" style="margin-top:14px">${(items||[]).map(i=>`<div class="order-item"><strong>${esc(i.product_name)}</strong> — ${esc(i.color_name||'')}<br>${Number(i.quantity)} × ${money(i.unit_price)} = ${money(i.line_total)}</div>`).join('')}</div><div class="detail-grid" style="margin-top:14px"><div><strong>المنتجات</strong>${money(o.subtotal)}</div><div><strong>الشحن</strong>${money(o.shipping)}</div><div><strong>الإجمالي</strong>${money(o.total)}</div></div><div class="dialog-actions"><button class="primary" id="confirmOrderWhatsapp" type="button" ${!(['pending','confirmed'].includes(o.status))?'disabled title="لا يمكن تأكيد طلب وصل لمرحلة متقدمة أو تم إلغاؤه"':''}>✓ تأكيد الطلب + واتساب</button><button class="primary" id="saveOrderStatus">حفظ الحالة</button><button class="ghost" id="notifyCustomerWhatsapp" type="button">رسالة واتساب حسب الحالة</button></div>`;$('orderStatusSelect').value=o.status;$('saveOrderStatus').onclick=async()=>{const result=await api('order_status',{id,status:$('orderStatusSelect').value});let msg='تم تحديث حالة الطلب.';if(result.stockRestored)msg+=' تم إرجاع الكمية للمخزون.';if(result.email?.sent)msg+=' تم إرسال بريد للعميل.';else if(result.changed&&result.email?.reason==='email_not_configured')msg+=' البريد التلقائي غير مفعّل؛ استخدم واتساب أو اضبط Resend.';toast(msg,result.changed&&result.email?.reason==='provider_error'?'error':'success');$('orderDialog').close();await loadAll()};
    const makeWhatsappUrl=(chosen)=>{const digits=String(o.phone||'').replace(/\D/g,'');const intl=digits.startsWith('0')?'20'+digits.slice(1):digits;const labels={pending:'طلبك وصلنا وهو جاري المراجعة.',confirmed:'تم تأكيد طلبك من Flora Fashion Hijab، وهنبدأ تجهيز طلبك بكل عناية.',preparing:'طلبك جاري تجهيزه.',shipping:'طلبك خرج للشحن.',delivered:'تم تسجيل طلبك كمُسلَّم.',cancelled:'تم إلغاء الطلب. لو عندك استفسار تواصل معانا.'};const text='أهلًا '+(o.customer_name||'بك')+' 🌿\n\nنحب نبلغك إن: '+(labels[chosen]||labels[o.status])+'\nرقم الطلب: '+o.order_number+'\nالإجمالي: '+money(o.total)+'\nالدفع: عند الاستلام\n\nشكرًا لاختيارك Flora Fashion Hijab 💚';if(!intl||intl.length<11)throw new Error('رقم الهاتف غير صالح لفتح واتساب.');return 'https://wa.me/'+intl+'?text='+encodeURIComponent(text)};
    $('confirmOrderWhatsapp').onclick=async()=>{let popup=null;try{if(!['pending','confirmed'].includes(o.status))throw new Error('لا يمكن تأكيد طلب ملغي أو وصل لمرحلة متقدمة.');const url=makeWhatsappUrl('confirmed');popup=window.open('about:blank','_blank');if(o.status!=='confirmed'){const result=await api('order_status',{id:o.id,status:'confirmed'});let msg='تم تأكيد حالة الطلب.';if(result.email?.sent)msg+=' وتم إرسال بريد للعميل.';toast(msg);await loadAll()}if(popup)popup.location.href=url;else window.open(url,'_blank');$('orderDialog').close()}catch(err){if(popup)popup.close();toast(err.message||'تعذر تأكيد الطلب.','error')}};
    $('notifyCustomerWhatsapp').onclick=()=>{try{window.open(makeWhatsappUrl($('orderStatusSelect').value),'_blank','noopener')}catch(err){toast(err.message,'error')}};$('orderDialog').showModal()}
  async function openMessage(id){const {message:m}=await api('message_detail',{id});$('messageDetails').innerHTML=`<div class="detail-grid"><div><strong>الاسم</strong>${esc(m.name)}</div><div><strong>الهاتف</strong>${esc(m.phone||'-')}</div><div><strong>التاريخ</strong>${date(m.created_at)}</div><div><strong>الحالة</strong><select id="messageStatus"><option value="new">جديدة</option><option value="read">مقروءة</option><option value="resolved">تم الحل</option></select></div></div><div class="panel" style="margin-top:12px;white-space:pre-wrap">${esc(m.message)}</div><div class="dialog-actions"><button class="primary" id="saveMessageStatus">حفظ الحالة</button></div>`;$('messageStatus').value=m.status;$('saveMessageStatus').onclick=async()=>{await api('message_status',{id,status:$('messageStatus').value});toast('تم تحديث الرسالة.');$('messageDialog').close();await loadAll()};$('messageDialog').showModal()}

  $('showLoginBtn').addEventListener('click',()=>showSetupMode(false));
  $('showSetupBtn').addEventListener('click',()=>showSetupMode(true));
  $('finishSetup').addEventListener('click',finishFirstSetup);
  $('loginForm').addEventListener('submit',e=>{e.preventDefault();signIn($('loginUsername').value.trim(),$('loginPassword').value).catch(err=>showLogin(err.message))});
  $('logoutBtn').addEventListener('click',()=>{if(orderPollTimer)clearInterval(orderPollTimer);orderPollTimer=null;signOut(true)});
  $('enableOrderAlerts')?.addEventListener('click',enableOrderAlerts);
  $('exportProducts')?.addEventListener('click',()=>exportCsv(`flora-products-${new Date().toISOString().slice(0,10)}.csv`,productExportColumns,state.products));
  $('exportOrders')?.addEventListener('click',()=>exportCsv(`flora-orders-${new Date().toISOString().slice(0,10)}.csv`,orderExportColumns,state.orders));
  $('exportOverviewOrders')?.addEventListener('click',()=>exportCsv(`flora-orders-${new Date().toISOString().slice(0,10)}.csv`,orderExportColumns,state.orders));
  $('exportMessages')?.addEventListener('click',()=>exportCsv(`flora-messages-${new Date().toISOString().slice(0,10)}.csv`,messageExportColumns,state.messages));
  $('accountForm').addEventListener('submit',updateAccount);
  document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>setSection(b.dataset.section));document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>setSection(b.dataset.go));$('newProductBtn').onclick=()=>openProduct(null);$('productForm').addEventListener('submit',async e=>{e.preventDefault();try{await saveProduct()}catch(err){toast(err.message,'error')}});['productSearch','productFilter'].forEach(id=>$(id).addEventListener('input',renderProducts));['orderSearch','orderFilter'].forEach(id=>$(id).addEventListener('input',renderOrders));$('messageFilter').addEventListener('input',renderMessages);
  document.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;try{if(b.dataset.close)$(b.dataset.close).close();if(b.dataset.editProduct)openProduct(state.products.find(p=>String(p.id)===b.dataset.editProduct));if(b.dataset.toggleProduct)await toggleProduct(b.dataset.toggleProduct);if(b.dataset.deleteProduct)await deleteProduct(b.dataset.deleteProduct);if(b.dataset.order)await openOrder(b.dataset.order);if(b.dataset.message)await openMessage(b.dataset.message)}catch(err){toast(err.message,'error')}});
  (async()=>{
    try {
      supabaseClient=await window.FloraSupabase.init();
      if (localPreview) {
        // Localhost preview supports browser-local product drafts only. It never bypasses server authorization.
        $('loginView').hidden = true;
        showDashboard();
        $('adminIdentity').textContent = 'معاينة محلية — المنتجات تحفظ في هذا المتصفح فقط';
        $('logoutBtn').hidden = true;
        $('enableOrderAlerts').hidden = true;
        $('account').hidden = true;
        document.querySelector('[data-section="account"]')?.setAttribute('hidden','');
        $('newProductBtn').disabled = false;
        $('newProductBtn').title = 'إضافة منتج للمعاينة المحلية';
        const savedLocalProducts = readLocalProducts();
        try {
          const { data, error } = await supabaseClient.from('products')
            .select('id,name,category,price,image_path,description,color_name,color_hex,group_key,active,stock_quantity,featured,sort_order,created_at')
            .order('sort_order', { ascending: true });
          if (error) throw error;
          state.products = Array.isArray(savedLocalProducts) ? savedLocalProducts : (data || []);
          if (!Array.isArray(savedLocalProducts)) saveLocalProducts();
          toast(`تم تحميل ${state.products.length} منتجًا. الإضافة والتعديل هنا محليان ولا يغيران المتجر الحقيقي.`);
        } catch (err) {
          state.products = Array.isArray(savedLocalProducts) ? savedLocalProducts : [];
          const message = `تعذر تحميل المنتجات من Supabase: ${err.message || 'تحقق من الاتصال وسياسة القراءة العامة RLS.'} ${state.products.length?'تم عرض النسخة المحلية المحفوظة.':'يمكنك إضافة منتجات تجريبية وستُحفظ في هذا المتصفح فقط.'}`;
          $('productsTable').innerHTML = `<div class="empty">${esc(message)}</div>`;
          toast(message, 'error');
        }
        state.orders = [];
        state.messages = [];
        renderAll();
        document.querySelectorAll('[data-order],[data-message]').forEach(b=>{b.disabled=true;b.title='عرض الطلبات والرسائل يتطلب دخول أدمن موثّق';});
        return;
      }
      const {data:{session}}=await supabaseClient.auth.getSession();
      if(session?.access_token){
        accessToken=session.access_token; currentUser=session.user;
        const boot=await api('bootstrap'); state.products=boot.products||[]; state.orders=boot.orders||[]; state.messages=boot.messages||[];
        showDashboard(); renderAll(); startOrderPolling();
        if(boot.limited?.orders||boot.limited?.messages) toast('يتم عرض آخر 500 سجل حاليًا.','error');
      } else {
        showLogin();
        try {
          const statusRes=await fetch(adminApi,{method:'POST',headers:{'Content-Type':'application/json','apikey':window.FLORA_SUPABASE_KEY},body:JSON.stringify({action:'setup_status',payload:{}})});
          const status=await statusRes.json();
          if(statusRes.ok && status.setupComplete===false) showSetupMode(true);
          else showSetupMode(false);
        } catch(_) { showSetupMode(false); }
      }
      supabaseClient.auth.onAuthStateChange((_event,session)=>{ if(session?.access_token){accessToken=session.access_token;currentUser=session.user;} else {accessToken='';currentUser=null;} });
    } catch(err){ if(localPreview){$('loginView').hidden=true;showDashboard();$('productsTable').innerHTML=`<div class="empty">تعذر بدء المعاينة: ${esc(err.message||'تحقق من اتصال الإنترنت وإعداد Supabase.')}</div>`;} else showLogin(err.message||'تعذر الاتصال بـSupabase.'); }
  })();
})();
