(() => {
  const A = window.FloraAdmin;
  A.$('sharedNav').innerHTML = A.nav('products'); A.identity();
  const KEY_NAME = 'flora.dashboard.editKey.v1';
  let rows = [], editKey = sessionStorage.getItem(KEY_NAME) || '', previewUrl = '';
  const esc = A.esc;
  const notice = (message, type='') => { const n=A.$('pageNotice'); n.hidden=!message; n.className='notice'+(type?' '+type:''); n.textContent=message||''; };
  function askKey(force=false) {
    if (!editKey || force) {
      const value = window.prompt('أدخل رمز إدارة Flora لحفظ التغييرات في الموقع. الرمز لا يُحفظ إلا في جلسة المتصفح الحالية:');
      if (!value) return '';
      editKey = value.trim();
      if (editKey) sessionStorage.setItem(KEY_NAME, editKey);
    }
    return editKey;
  }
  async function keyRequest(action, payload={}) {
    let key = askKey();
    if (!key) throw new Error('يلزم رمز الإدارة لتنفيذ التعديلات على الموقع.');
    const send = () => fetch(`${window.FLORA_SUPABASE_URL.replace(/\/$/,'')}/functions/v1/flora-admin`, {
      method:'POST', headers:{'Content-Type':'application/json','apikey':window.FLORA_SUPABASE_KEY,'x-flora-dashboard-key':key}, body:JSON.stringify({action,payload})
    });
    let response = await send();
    if (response.status === 401) {
      sessionStorage.removeItem(KEY_NAME); editKey='';
      key = askKey(true);
      if (!key) throw new Error('رمز الإدارة مطلوب.');
      response = await send();
    }
    const data = await response.json().catch(()=>({}));
    if (!response.ok || data.error) throw new Error(data.error || `خطأ خادم (${response.status})`);
    return data;
  }
  async function uploadImage(file) {
    let key = askKey(); if (!key) throw new Error('يلزم رمز الإدارة لرفع الصورة.');
    const send = () => { const form=new FormData(); form.append('file',file,file.name); return fetch(`${window.FLORA_SUPABASE_URL.replace(/\/$/,'')}/functions/v1/flora-admin`, {method:'POST',headers:{'apikey':window.FLORA_SUPABASE_KEY,'x-flora-dashboard-key':key},body:form}); };
    let response=await send();
    if(response.status===401){sessionStorage.removeItem(KEY_NAME);editKey='';key=askKey(true);if(!key)throw new Error('رمز الإدارة مطلوب لرفع الصورة.');response=await send();}
    const data=await response.json().catch(()=>({}));if(!response.ok||data.error)throw new Error(data.error||'تعذر رفع الصورة.');return data.publicUrl;
  }
  async function load() {
    try {
      if (askKey()) {
        const d=await keyRequest('products_list'); rows=d.products||[];
        notice('متصل بقاعدة بيانات المتجر: الإضافة والتعديل والصور تُحفظ على Supabase وتظهر في الموقع.');
      } else {
        const c=await A.client();const {data,error}=await c.from('products').select('id,name,category,price,image_path,description,color_name,color_hex,group_key,active,stock_quantity,featured,sort_order,created_at').eq('active',true).order('sort_order',{ascending:true});if(error)throw error;rows=data||[];
        notice('وضع عرض فقط. لإضافة أو تعديل منتج، اضغط إضافة منتج وأدخل رمز الإدارة.');
      }
      render();
    } catch(e) { notice(e.message||String(e),'error'); render(); }
  }
  function render() {
    const q=A.$('search').value.trim().toLowerCase(), f=A.$('filter').value;
    const list=rows.filter(p=>(!q||`${p.name} ${p.category} ${p.color_name||''}`.toLowerCase().includes(q))&&(f==='all'||(f==='active'&&p.active)||(f==='inactive'&&!p.active)||(f==='low'&&Number(p.stock_quantity)<=5)));
    A.$('productsTable').innerHTML=list.length?`<table><thead><tr><th>الصورة</th><th>المنتج</th><th>التصنيف</th><th>السعر</th><th>المخزون</th><th>الحالة</th><th>الإجراءات</th></tr></thead><tbody>${list.map(p=>`<tr><td>${p.image_path?`<img class="product-image" src="${esc(p.image_path)}" alt="">`:'—'}</td><td><strong>${esc(p.name)}</strong><br><small>${esc(p.color_name||'')}</small></td><td>${esc(p.category)}</td><td>${A.money(p.price)}</td><td>${Number(p.stock_quantity||0)}</td><td><span class="product-status ${p.active?'is-active':'is-hidden'}">${p.active?'نشط':'مخفي'}</span></td><td><div class="row-actions"><button class="secondary" data-edit="${esc(p.id)}">تعديل</button> <button class="secondary" data-toggle="${esc(p.id)}">${p.active?'إخفاء':'تفعيل'}</button> <button class="danger" data-delete="${esc(p.id)}">أرشفة</button></div></td></tr>`).join('')}</tbody></table>`:'<div class="empty">لا توجد منتجات مطابقة. يمكنك إضافة منتج جديد.</div>';
  }
  function open(p) {
    A.$('productForm').reset(); A.$('productId').value=p?.id||''; A.$('dialogTitle').textContent=p?'تعديل منتج':'إضافة منتج';
    for(const [id,k] of [['name','name'],['category','category'],['price','price'],['stock','stock_quantity'],['colorName','color_name'],['colorHex','color_hex'],['groupKey','group_key'],['sortOrder','sort_order'],['description','description']]) A.$(id).value=p?.[k]??(id==='sortOrder'?0:'');
    A.$('active').checked=p?.active??true; A.$('featured').checked=!!p?.featured; A.$('imageFile').value='';
    A.$('imagePreview').hidden=!p?.image_path; A.$('imagePreview').src=p?.image_path||''; A.$('imagePreview').dataset.path=p?.image_path||''; A.$('imagePreview').dataset.new='';
    A.$('productDialog').showModal();
  }
  A.$('productsTable').addEventListener('click',async e=>{
    const b=e.target.closest('button');if(!b)return;const p=rows.find(x=>String(x.id)===String(b.dataset.edit||b.dataset.toggle||b.dataset.delete));if(!p)return;
    try {
      if(b.dataset.edit){if(!askKey())return;open(p);return;}
      if(b.dataset.toggle){await keyRequest('product_toggle',{id:p.id});A.notify('تم تحديث حالة المنتج على الموقع.');await load();return;}
      if(b.dataset.delete&&confirm('أرشفة المنتج وإخفاؤه من المتجر؟ سيظل محفوظًا للطلبات السابقة.')){await keyRequest('product_delete',{id:p.id});A.notify('تمت أرشفة المنتج وإخفاؤه من المتجر.');await load();}
    } catch(err){A.showError(err)}
  });
  A.$('search').addEventListener('input',render);A.$('filter').addEventListener('change',render);
  A.$('addBtn').onclick=()=>{if(askKey())open(null)};A.$('closeDialog').onclick=()=>A.$('productDialog').close();A.$('refreshBtn')?.addEventListener('click',load);
  A.$('imageFile').addEventListener('change',()=>{const f=A.$('imageFile').files?.[0];if(!f)return;if(!['image/jpeg','image/png','image/webp','image/avif'].includes(f.type)||f.size>5*1024*1024){A.$('imageFile').value='';return A.notify('اختر صورة JPG أو PNG أو WebP أو AVIF بحجم أقل من 5 ميجابايت.','error')}if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=URL.createObjectURL(f);A.$('imagePreview').src=previewUrl;A.$('imagePreview').hidden=false;A.$('imagePreview').dataset.new='1';});
  A.$('productForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const saveButton=A.$('productForm').querySelector('button[type="submit"]');
    try {
      if(!askKey())throw new Error('أدخل رمز الإدارة أولًا.');
      saveButton.disabled=true; saveButton.dataset.originalText=saveButton.textContent; saveButton.textContent='جارٍ الحفظ…';
      const id=A.$('productId').value,file=A.$('imageFile').files?.[0];
      const d={...(id?{id:Number(id)}:{}),name:A.$('name').value.trim(),category:A.$('category').value.trim(),price:Number(A.$('price').value),stock_quantity:Number(A.$('stock').value),color_name:A.$('colorName').value.trim(),color_hex:A.$('colorHex').value.trim()||null,group_key:A.$('groupKey').value.trim(),sort_order:Number(A.$('sortOrder').value||0),image_path:A.$('imagePreview').dataset.path||null,description:A.$('description').value.trim()||null,active:A.$('active').checked,featured:A.$('featured').checked};
      if(!d.name||!d.category||!d.color_name||!d.group_key||!Number.isFinite(d.price)||d.price<0||!Number.isInteger(d.stock_quantity)||d.stock_quantity<0)throw new Error('راجع الاسم والتصنيف واللون ومفتاح المجموعة والسعر والمخزون.');
      if(file)d.image_path=await uploadImage(file);
      const result=await keyRequest('product_upsert',{data:d});
      if(!result.product)throw new Error('الخادم لم يؤكد حفظ المنتج.');
      A.$('productDialog').close();A.notify('تم حفظ المنتج وصورته في قاعدة بيانات المتجر.');await load();
    }catch(err){A.showError(err)}finally{saveButton.disabled=false;saveButton.textContent=saveButton.dataset.originalText||'حفظ المنتج'}
  });
  A.$('exportBtn').onclick=()=>{const csv='\ufeff'+['اسم المنتج,التصنيف,السعر,المخزون,الحالة',...rows.map(p=>[p.name,p.category,p.price,p.stock_quantity,p.active?'نشط':'مخفي'].map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(','))].join('\r\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='flora-products.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
  load();
})();
