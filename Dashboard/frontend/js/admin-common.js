(() => {
 const $=id=>document.getElementById(id);
 const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
 const money=v=>`${Number(v||0).toFixed(2)} ج.م`;
 const date=v=>v?new Date(v).toLocaleString('ar-EG',{dateStyle:'medium',timeStyle:'short'}):'-';
 const statusText={pending:'جديد',confirmed:'مؤكد',preparing:'جاري التجهيز',shipping:'قيد الشحن',delivered:'تم التسليم',cancelled:'ملغي'};
 const messageStatus={new:'جديدة',read:'مقروءة',resolved:'تم الحل'};
 let clientPromise;
 async function client(){if(!clientPromise)clientPromise=window.FloraSupabase.init();return clientPromise}
 async function session(){const c=await client();const {data,error}=await c.auth.getSession();if(error)throw error;return {client:c,session:data.session,user:data.session?.user||null}}
 async function api(action,payload={}){
  if(action==='admin_credentials_update'){const {session:s}=await session();if(!s?.access_token)throw new Error('تغيير بيانات الحساب يحتاج جلسة إدارة موثقة. بقية صفحات الداشبورد تستخدم رمز الإدارة.');const r=await fetch(`${window.FLORA_SUPABASE_URL.replace(/\/$/,'')}/functions/v1/flora-admin`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${s.access_token}`,'apikey':window.FLORA_SUPABASE_KEY},body:JSON.stringify({action,payload})});const d=await r.json().catch(()=>({}));if(!r.ok||d.error)throw new Error(d.error||`خطأ خادم (${r.status})`);return d;}
  const keyName='flora.dashboard.editKey.v1';
  let key=sessionStorage.getItem(keyName)||'';
  if(!key){key=(window.prompt('أدخل رمز إدارة Flora لعرض الطلبات والرسائل وتنفيذ إجراءات الإدارة. يُحفظ في جلسة المتصفح الحالية فقط:')||'').trim();if(!key)throw new Error('يلزم رمز الإدارة لعرض بيانات العملاء والطلبات.');sessionStorage.setItem(keyName,key);}
  const send=()=>fetch(`${window.FLORA_SUPABASE_URL.replace(/\/$/,'')}/functions/v1/flora-admin`,{method:'POST',headers:{'Content-Type':'application/json','apikey':window.FLORA_SUPABASE_KEY,'x-flora-dashboard-key':key},body:JSON.stringify({action,payload})});
  let r=await send();if(r.status===401){sessionStorage.removeItem(keyName);key=(window.prompt('رمز الإدارة غير صحيح أو انتهت صلاحيته. أدخل الرمز الصحيح:')||'').trim();if(!key)throw new Error('رمز الإدارة مطلوب.');sessionStorage.setItem(keyName,key);r=await send();}
  const d=await r.json().catch(()=>({}));if(!r.ok||d.error)throw new Error(d.error||`خطأ خادم (${r.status})`);return d
 }
 function notify(message,type='success'){let root=$('toastRoot');if(!root){root=document.createElement('div');root.id='toastRoot';root.className='toast-root';document.body.append(root)}const el=document.createElement('div');el.className='toast '+(type==='error'?'error':'');el.textContent=message;root.append(el);setTimeout(()=>el.remove(),4500)}
 function showError(error){const target=$('pageNotice');if(target){target.className='notice error';target.textContent=error?.message||String(error);target.hidden=false}else notify(error?.message||String(error),'error')}
 function nav(active){const links=[['overview','نظرة عامة','/dashboard/overview'],['products','المنتجات','/dashboard/products'],['orders','الطلبات','/dashboard/orders'],['messages','الرسائل','/dashboard/messages'],['account','الحساب','/dashboard/account']];return `<header class="topbar"><div class="brand"><img src="/Store/frontend/images/logo.svg" alt="Flora"><div>FLORA <small>لوحة تحكم المتجر</small></div></div><div class="top-actions"><span id="adminName" class="muted">لوحة الإدارة</span><a class="button secondary" href="/">عرض المتجر</a></div></header><nav class="navbar" aria-label="التنقل الرئيسي">${links.map(([id,label,url])=>`<a href="${url}" class="${id===active?'active':''}" ${id===active?'aria-current="page"':''}>${label}</a>`).join('')}</nav>`}
 async function identity(){const el=$('adminName');if(el)el.textContent='إدارة Flora محمية';}
 window.FloraAdmin={ $,esc,money,date,statusText,messageStatus,client,session,api,notify,showError,nav,identity};
})();
