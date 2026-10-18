document.addEventListener("DOMContentLoaded", () => {
  const form=document.getElementById("contactForm"), box=document.getElementById("contactMessageBox"); if(!form)return;
  form.addEventListener("submit", async e=>{e.preventDefault(); const name=document.getElementById("contactName").value.trim(), phone=document.getElementById("contactPhone").value.trim(), message=document.getElementById("contactMessage").value.trim(); if(name.length<2||message.length<5){box.textContent="من فضلك أكمل البيانات المطلوبة.";box.className="message error";return;}
    try{const sb=await FloraSupabase.init(); const user=await FloraStore.ensureUser(); const {error}=await sb.from("contact_messages").insert({user_id:user.id,name,phone,message}); if(error)throw error; form.reset();box.textContent="تم إرسال رسالتك بنجاح. شكرًا لتواصلك معنا.";box.className="message success";}catch(err){console.error(err);box.textContent="تعذر إرسال الرسالة حالياً. حاول مرة أخرى.";box.className="message error";}});
});
