const ADMIN_OWNER_EMAIL = 'ali_alsaffar@uomosul.edu.iq';
const adminUiError = error => ({
  administrator_required:'هذه العملية متاحة للمديرين المفعّلين فقط.',
  google_sign_in_required:'سجّل الدخول ببريد Google موثّق.',
  owner_protected:'حساب المدير الأصلي محمي ولا يمكن حذفه أو تعطيله.',
  cannot_revoke_self:'لا يمكنك سحب صلاحيتك من هذه النافذة.',
  invalid_email:'أدخل بريداً إلكترونياً صحيحاً.',
  invalid_phone:'أدخل رقم الهاتف دولياً، مثل +9647701234567.',
  already_invited:'هذا البريد مضاف بالفعل.',
  invitation_required:'لا توجد دعوة معلّقة لهذا البريد.',
  verification_not_configured:'التحقق الآلي غير مهيّأ بعد. تبقى الدعوة بلا صلاحيات.',
  conflict:'تغيرت البيانات أثناء الحفظ. حدّث القائمة وأعد المحاولة.'
}[error.message] || 'إدارة الأدمنات غير متاحة حالياً. يلزم نشر خادم الإدارة وقواعد الصلاحيات الجديدة.');
async function openAdministratorManagement() {
  if(!isAdmin())return;
  modal('<section id="adminRoster"><h2>إدارة الأدمنات</h2><p role="status">جارٍ التحميل…</p></section>');
  const root=$('#adminRoster');
  let busy=false;
  async function load(){
    const result=await cloud.administratorRequest({action:'list'});
    if(!isAdmin()||!root.isConnected)return;
    root.innerHTML=`<h2>إدارة الأدمنات</h2>
      <p class="notice">كل مدير مفعّل يستطيع إضافة وحذف مديرين آخرين. حساب المدير الأصلي محمي.</p>
      <p><bdi>${ADMIN_OWNER_EMAIL}</bdi> <span class="pill">المدير الأصلي — محمي</span></p>
      ${result.verificationReady?'':'<p class="notice">التحقق الآلي بواتساب وتليكرام غير مهيّأ بعد؛ يمكن حفظ الدعوات، ولن تحصل على صلاحيات حتى يكتمل الربط والتحقق.</p>'}
      <form id="adminInviteForm" class="formgrid">
        <div><label for="adminEmail">بريد Google للمدير الجديد</label><input class="field" id="adminEmail" type="email" maxlength="254" required autocomplete="off"></div>
        <div><label for="adminPhone">رقم واتساب وتليكرام نفسه</label><input class="field" id="adminPhone" type="tel" dir="ltr" maxlength="24" placeholder="+9647701234567" required autocomplete="off"></div>
        <div class="span2"><button class="btn gold" type="submit">إضافة دعوة أدمن</button></div>
      </form>
      <p class="notice">يجب على المدعو الدخول بالبريد أعلاه، ثم فتح «دعوة الإدارة» وإثبات الرقم نفسه عبر واتساب وتليكرام رسمياً. لا يكفي إدخال الرقم، ولا تُرسل دعوة بالبريد تلقائياً.</p>
      <p id="adminRosterStatus" role="status" aria-live="polite"></p>
      <div class="admin-list">${result.items.filter(d=>d.email!==ADMIN_OWNER_EMAIL).map(d=>`<article class="card admin-item"><div><bdi>${esc(d.email)}</bdi><div><bdi dir="ltr">${esc(d.phone)}</bdi></div><span class="pill">${d.active?'مدير مفعّل':d.status==='revoked'?'تم سحب الصلاحية':'بانتظار التحقق الآلي'}</span></div>${d.status!=='revoked'&&d.email!==currentUser.email.toLowerCase()?`<button class="btn" data-revoke-admin="${esc(d.email)}">حذف الأدمن</button>`:''}</article>`).join('')||'<p class="notice">لا توجد دعوات بعد.</p>'}</div>`;
    root.querySelector('#adminInviteForm').onsubmit=event=>{
      event.preventDefault();
      run({action:'add',email:root.querySelector('#adminEmail').value,phone:root.querySelector('#adminPhone').value});
    };
    root.querySelectorAll('[data-revoke-admin]').forEach(button=>button.onclick=()=>{
      if(confirm('سحب صلاحية الإدارة من '+button.dataset.revokeAdmin+'؟ يبقى حسابه وإعلاناته موجودين.'))run({action:'revoke',email:button.dataset.revokeAdmin});
    });
  }
  async function run(body){
    if(busy||!isAdmin())return;busy=true;
    root.querySelectorAll('button').forEach(b=>b.disabled=true);
    try{await cloud.administratorRequest(body);await load();}
    catch(error){if(root.isConnected)root.querySelector('#adminRosterStatus').textContent=adminUiError(error);}
    finally{busy=false;root.querySelectorAll('button').forEach(b=>b.disabled=false);}
  }
  try{await load();}catch(error){if(root.isConnected)root.innerHTML='<h2>إدارة الأدمنات</h2><p role="status">'+esc(adminUiError(error))+'</p>';}
}
async function openAdministratorVerification(){
  if(!currentUser)return;
  modal('<section id="adminVerify"><h2>دعوة الإدارة</h2><p role="status">جارٍ فحص الدعوة…</p></section>');
  const root=$('#adminVerify'),uid=currentUser.uid;
  try{
    const result=await cloud.administratorRequest({action:'status'});
    if(currentUser?.uid!==uid||!root.isConnected)return;
    const d=result.invitation;
    root.innerHTML=`<h2>دعوة الإدارة</h2>
      <p><bdi>${esc(currentUser.email)}</bdi></p>
      <p class="notice">${result.administrator?'صلاحياتك مفعّلة.':!d||d.status==='revoked'?'لا توجد دعوة فعّالة لهذا البريد.':'دعوتك معلّقة. يجب إثبات الرقم نفسه في واتساب وتليكرام.'}</p>
      ${d&&d.status==='pending'?`<p>رقم الدعوة: <bdi dir="ltr">${esc(d.phone)}</bdi></p>
      <p class="notice">واتساب: ${d.whatsappVerified?'تم التحقق':'لم يتم التحقق'} · تليكرام: ${d.telegramVerified?'تم التحقق':'لم يتم التحقق'}</p>
      ${result.verificationReady?'<button class="btn gold" id="beginAdminVerification">بدء التحقق الآلي (30 دقيقة)</button>':'<p class="notice">التحقق الرسمي غير مهيّأ بعد. لم تُمنح أي صلاحية.</p>'}`:''}
      <div id="adminVerificationLinks"></div><p id="adminVerifyStatus" role="status" aria-live="polite"></p>
      <button class="btn" id="refreshAdminVerification">تحديث الحالة</button>`;
    root.querySelector('#refreshAdminVerification').onclick=openAdministratorVerification;
    const begin=root.querySelector('#beginAdminVerification');
    if(begin)begin.onclick=async()=>{
      begin.disabled=true;
      try{
        const links=await cloud.administratorRequest({action:'start-verification'});
        if(currentUser?.uid!==uid||!root.isConnected)return;
        root.querySelector('#adminVerificationLinks').innerHTML=`<p class="notice">افتح الرابطين بنفسك. في تليكرام اضغط Start ثم «مشاركة رقمي». في واتساب أرسل نص التحقق الجاهز إلى رقم قيراط، ثم عد وحدّث الحالة. بدء تحقق جديد يلغي الطلب السابق.</p><div class="actions"><a class="btn" target="_blank" rel="noopener noreferrer" href="${esc(links.telegramUrl)}">التحقق عبر تليكرام</a><a class="btn" target="_blank" rel="noopener noreferrer" href="${esc(links.whatsappUrl)}">التحقق عبر واتساب</a></div>`;
      }catch(error){if(root.isConnected)root.querySelector('#adminVerifyStatus').textContent=adminUiError(error);}
      finally{begin.disabled=false;}
    };
  }catch(error){if(root.isConnected)root.innerHTML='<h2>دعوة الإدارة</h2><p role="status">'+esc(adminUiError(error))+'</p>';}
}


