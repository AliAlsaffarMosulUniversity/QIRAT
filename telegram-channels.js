const errors = {
  numeric_channel_id_required: 'أدخل معرّف القناة الرقمي الذي يبدأ بـ ‎-100. رابط الدعوة ليس معرّفاً.',
  bot_permissions_required: 'يحتاج البوت صلاحيات النشر والتعديل والحذف في القناة.',
  channel_admin_required: 'حساب Telegram المحدد في إعدادات الخادم يجب أن يكون مالك القناة أو مشرفاً عليها.',
  wrong_bot: 'رمز الخادم لا يعود إلى @QiratMosulAlertsBot.',
  administrator_required: 'هذه الإدارة متاحة لحساب مدير قيراط فقط.',
  configuration_required: 'إعدادات الخادم غير مكتملة. راجع إعدادات Cloudflare.',
  delivery_pending_review: 'حالة العملية غير مؤكدة. افحص القناة قبل أي إجراء آخر؛ أوقفنا إعادة الإرسال لمنع التكرار.',
  saved_message_required: 'لا توجد رسالة محفوظة قابلة لهذا الإجراء.',
  channel_disabled: 'القناة متوقفة. فعّلها قبل نشر رسالة جديدة.',
  announcement_not_found: 'الإعلان لم يعد منشوراً داخل قيراط.',
  channels_unavailable: 'تعذر الاتصال بخدمة القنوات أو Telegram. تحقق من نشر تحديث الخادم وإعداداته.',
  conflict: 'توجد عملية أخرى. حدّث السجل لمعرفة النتيجة.',
  text_required:'اكتب نص الإعلان أولاً.',
  invalid_photo:'اختر صورة JPG أو PNG أو WebP صالحة. الحد الأقصى للصورة المرسلة 5 ميغابايت.',
  caption_too_long:'النص المرافق للصورة يجب ألا يتجاوز 1024 حرفاً.',
  message_too_long:'النص يجب ألا يتجاوز 4096 حرفاً.',
  too_large:'حجم الملف أكبر من المسموح.',
  photo_edit_not_supported:'هذه رسالة نصية. أرسل إعلاناً جديداً لإضافة صورة.'
};
const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
export function chooseChannel(channels, preferred, current='') {
  return [current,preferred,channels.find(c=>c.enabled)?.chat_id,channels[0]?.chat_id].find(id=>id&&channels.some(c=>c.chat_id===id))||'';
}
export async function preparePhoto(file) {
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>15*1024*1024)throw new Error('invalid_photo');
  const bitmap=await createImageBitmap(file);
  try {
    const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const photo=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.88));
    if(!photo||photo.size>5*1024*1024)throw new Error('invalid_photo');return photo;
  }finally{bitmap.close();}
}
export async function openTelegramChannels(request, announcements) {
  const overlay = document.getElementById('overlay');
  overlay.innerHTML = '<div class="modal"><section class="dialog" style="width:min(900px,100%)"><div class="dialoghead"><h2>قنوات Telegram</h2><button class="btn" id="tgClose">إغلاق</button></div><p class="notice">قناتك محفوظة في حسابك. اكتب الإعلان وأرفق الصورة، ثم اضغط إرسال. يمكنك إدارة القنوات الإضافية من الإعدادات أدناه.</p><div id="tgStatus" class="notice" role="status" aria-live="polite"></div><div id="tgBody"></div></section></div>';
  const root = overlay.querySelector('.dialog'), body = root.querySelector('#tgBody'), status = root.querySelector('#tgStatus');
  let busy=false,active='',defaultId='',channels=[],candidates=[],deliveries=[],draft={text:'',photo:null},previewUrl='',editingId='',composeId='';
  const alive = () => overlay.contains(root);
  root.querySelector('#tgClose').onclick = () => { if(!busy){if(previewUrl)URL.revokeObjectURL(previewUrl);overlay.replaceChildren();} };
  async function run(task) {
    if (busy || !alive()) return;
    busy = true; status.textContent = 'جارٍ تنفيذ العملية…';
    root.querySelectorAll('button,input,select,textarea').forEach(control => control.disabled = true);
    try { const message=await task(); if (alive()) status.textContent = typeof message==='string'?message:'تم تحديث الحالة.'; }
    catch (error) { if (alive()) status.textContent = errors[error.message] || 'تعذر إكمال العملية. حدّث السجل وتحقق من الاتصال.'; }
    finally { busy = false; if (alive()) root.querySelectorAll('button,input,select,textarea').forEach(control => control.disabled = false); }
  }
  async function load() {
    const data = await request({ action:'list' });
    channels=data.channels;defaultId=data.default_chat_id||'';candidates=data.candidates.filter(c=>!channels.some(saved=>saved.chat_id===c.chat_id));active=chooseChannel(channels,defaultId,active);
    if (active) deliveries = (await request({ action:'deliveries', chat_id:active })).deliveries;
    if (alive()) render();
  }
  const call = async (action, extra = {}) => { await request({ action, chat_id:active, ...extra }); await load(); };
  function render() {
    body.innerHTML = `<details ${channels.length?'':'open'}><summary>إعدادات القنوات — إضافة قناة جديدة</summary><p class="notice">الإعداد مرة واحدة فقط. أضف البوت مشرفاً ثم حوّل له رسالة من القناة لاكتشافها.</p><form id="tgConnect"><label for="tgId">معرّف القناة الرقمي</label><input class="field" id="tgId" dir="ltr" placeholder="-100…" required><button class="btn gold" type="submit">التحقق وربط القناة</button></form>
      ${candidates.length ? '<p class="notice">القنوات المكتشفة (لم تُفعّل تلقائياً):</p>' + candidates.map(c => `<button class="btn" data-candidate="${escape(c.chat_id)}">${escape(c.title)} · <bdi>${escape(c.chat_id)}</bdi></button>`).join(' ') : ''}
      </details><hr><label for="tgChannels">الإرسال إلى</label><select class="field" id="tgChannels"><option value="">اختر قناة محفوظة</option>${channels.map(c => `<option value="${escape(c.chat_id)}" ${c.chat_id === active ? 'selected' : ''}>${escape(c.title)}${c.chat_id===defaultId?' ★':''} — ${c.enabled ? 'مفعّلة' : 'متوقفة'}</option>`).join('')}</select><button class="btn" id="tgRefresh">تحديث السجل</button>
      ${active ? `<div class="actions"><button class="btn" id="tgDefault">${active===defaultId?'★ قناتي الافتراضية المحفوظة':'حفظ هذه القناة كافتراضية'}</button><button class="btn" id="tgVerify">فحص الصلاحيات</button><button class="btn" id="tgToggle">${channels.find(c => c.chat_id === active)?.enabled ? 'إيقاف النشر الجديد' : 'تفعيل النشر'}</button></div>
      <form id="tgCompose" class="panel"><h3>${editingId?'تعديل الرسالة المنشورة':'إرسال إعلان متكامل إلى قناتي'}</h3><label for="tgText">نص الإعلان</label><textarea class="field" id="tgText" rows="7" required maxlength="4096" placeholder="اكتب نص الإعلان كاملاً: الاسم، موعد الصلاة، الجامع، الموقع وأي تفاصيل أخرى…">${escape(draft.text)}</textarea><p class="notice" id="tgCount"></p>
      ${editingId?'<p class="notice">سيتم تعديل الرسالة المنشورة نفسها. إذا لم تختر صورة بديلة تبقى صورتها الحالية.</p>':''}${!editingId||deliveries.find(d=>d.delivery_id===editingId)?.mediaType==='photo'?'<label for="tgPhoto">صورة الإعلان (اختيارية؛ عند التعديل يمكن اختيار صورة بديلة)</label><input class="field" id="tgPhoto" type="file" accept="image/jpeg,image/png,image/webp">':''}
      ${previewUrl?`<figure><img src="${escape(previewUrl)}" alt="معاينة صورة الإعلان" style="display:block;max-width:100%;max-height:300px;margin:auto;object-fit:contain"><figcaption class="notice">معاينة الصورة التي ستُرسل إلى القناة</figcaption></figure><button class="btn" type="button" id="tgRemovePhoto">إزالة الصورة</button>`:''}
      <p class="notice">${editingId?'':draft.photo?'ستصل الصورة والنص معاً في رسالة واحدة.':'يمكن إرسال نص فقط أو إرفاق صورة مع النص.'}</p>
      <button class="btn gold" type="submit">${editingId?'حفظ تعديل الرسالة':'إرسال إلى '+escape(channels.find(c=>c.chat_id===active)?.title||'قناتي')}</button>${editingId?'<button class="btn" type="button" id="tgCancelEdit">إلغاء التعديل</button>':''}
      </form>
      <details><summary>اختبارات وإعلانات محفوظة</summary><section class="panel"><h3>اختبار تقني</h3><p>اختبار تقني لنظام قيراط – ليس إعلان وفاة حقيقياً</p><button class="btn gold" id="tgTest">نشر رسالة الاختبار في هذه القناة</button></section>
      <section class="panel"><h3>نشر إعلان من قيراط</h3><select class="field" id="tgAnnouncement"><option value="">اختر إعلاناً حقيقياً للنشر</option>${announcements.map(a => `<option value="${escape(a.id)}">${escape(a.name)} · ${escape(a.mosque)} · ${escape(String(a.datetime).slice(0,10))}</option>`).join('')}</select><button class="btn" id="tgPublish">نشر الإعلان المختار في هذه القناة</button><p class="notice">تعديل الإعلان أو حذفه داخل قيراط لا يغيّر رسالة Telegram تلقائياً. استخدم أزرار الرسالة أدناه؛ التعديل يجلب أحدث نص محفوظ للإعلان.</p></section>
      </details><h3>سجل الرسائل</h3>${deliveries.slice().sort((a,b)=>b.attemptedAt-a.attemptedAt).map(d => `<article class="card"><strong>${d.test?'اختبار تقني':d.kind==='compose'?(d.mediaType==='photo'?'إعلان نص وصورة':'إعلان نصي'):'إعلان قيراط'}</strong><p class="small">الحالة: ${d.state === 'sent' ? 'منشورة' : d.state === 'deleted' ? 'محذوفة' : 'غير مؤكدة — افحص القناة؛ لا تعِد النشر'} · معرّف الرسالة: <bdi>${escape(d.message_id || 'لم يُحفظ بعد')}</bdi><br>معرّف العملية: <bdi>${escape(d.delivery_id)}</bdi></p>${d.state === 'sent' ? `<button class="btn" data-edit="${escape(d.delivery_id)}">${d.test?'تعديل الاختبار':d.kind==='compose'?'تعديل الرسالة':'تحديث الرسالة من الإعلان'}</button> <button class="btn" data-delete="${escape(d.delivery_id)}">حذف الرسالة من Telegram</button>` : ''}</article>`).join('') || '<p>لا توجد رسائل محفوظة لهذه القناة.</p>'}` : ''}`;
    body.querySelector('#tgConnect').onsubmit = event => {
      event.preventDefault(); const id = body.querySelector('#tgId').value.trim();
      run(async () => { await request({ action:'connect', chat_id:id }); active=id; await load(); });
    };
    body.querySelectorAll('[data-candidate]').forEach(button => button.onclick = () => { body.querySelector('#tgId').value = button.dataset.candidate; });
    body.querySelector('#tgChannels').onchange = event => { active=event.target.value; deliveries=[];editingId='';composeId=''; run(load); };
    body.querySelector('#tgRefresh').onclick = () => run(load);
    if (!active) return;
    body.querySelector('#tgDefault').onclick=()=>run(()=>call('set-default'));
    const textInput=body.querySelector('#tgText');
    const updateCount=()=>{draft.text=textInput.value;const photo=draft.photo||deliveries.find(d=>d.delivery_id===editingId)?.mediaType==='photo';body.querySelector('#tgCount').textContent=draft.text.length+' / '+(photo?1024:4096)+' حرف'+(photo?' — النص مع الصورة':'');};
    textInput.oninput=updateCount;updateCount();
    const photoInput=body.querySelector('#tgPhoto');if(photoInput)photoInput.onchange=()=>{const file=photoInput.files[0];if(file)run(async()=>{const photo=await preparePhoto(file);if(previewUrl)URL.revokeObjectURL(previewUrl);draft.photo=photo;previewUrl=URL.createObjectURL(photo);render();});};
    const removePhoto=body.querySelector('#tgRemovePhoto');if(removePhoto)removePhoto.onclick=()=>{URL.revokeObjectURL(previewUrl);previewUrl='';draft.photo=null;render();};
    body.querySelector('#tgCompose').onsubmit=event=>{event.preventDefault();const text=textInput.value.trim(),id=editingId||(composeId ||= crypto.randomUUID());run(async()=>{const result=await request({action:editingId?'compose-edit':'compose-publish',chat_id:active,delivery_id:id,text,...(draft.photo?{photo:draft.photo}:{})});if(result.delivery?.state!=='sent')throw new Error('delivery_pending_review');draft={text:'',photo:null};editingId='';composeId='';if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl='';await load();return 'تم حفظ الإعلان في Telegram وتحديث سجل الرسالة.';});};
    const cancelEdit=body.querySelector('#tgCancelEdit');if(cancelEdit)cancelEdit.onclick=()=>{editingId='';draft={text:'',photo:null};if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl='';render();};
    body.querySelector('#tgVerify').onclick = () => run(() => call('verify'));
    body.querySelector('#tgToggle').onclick = () => run(() => call('toggle', { enabled:!channels.find(c => c.chat_id === active).enabled }));
    body.querySelector('#tgTest').onclick = () => run(() => call('test-publish', { delivery_id:crypto.randomUUID() }));
    body.querySelector('#tgPublish').onclick = () => {
      const id = body.querySelector('#tgAnnouncement').value;
      if (id && confirm('نشر هذا الإعلان الحقيقي في قناة Telegram المختارة؟')) run(() => call('publish', { delivery_id:id }));
    };
    body.querySelectorAll('[data-edit], [data-delete]').forEach(button => button.onclick = () => {
      const id = button.dataset.edit || button.dataset.delete, delivery = deliveries.find(d => d.delivery_id === id);
      const action = button.dataset.edit ? 'edit' : 'delete';
      if(action==='delete'&&!button.dataset.confirmed){button.dataset.confirmed='true';button.textContent='تأكيد حذف الرسالة';return;}
      if(action==='edit'&&delivery.kind==='compose'){editingId=id;draft={text:delivery.text||'',photo:null};if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl='';render();root.scrollTop=0;return;}
      run(() => call((delivery.test?'test-':delivery.kind==='compose'?'compose-':'') + action, { delivery_id:id }));
    });
  }
  await run(load);
}
