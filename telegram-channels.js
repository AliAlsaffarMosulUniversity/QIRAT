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
  conflict: 'توجد عملية أخرى. حدّث السجل لمعرفة النتيجة.'
};
const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
export async function openTelegramChannels(request, announcements) {
  const overlay = document.getElementById('overlay');
  overlay.innerHTML = '<div class="modal"><section class="dialog" style="width:min(900px,100%)"><div class="dialoghead"><h2>قنوات Telegram</h2><button class="btn" id="tgClose">إغلاق</button></div><p class="notice">أضف @QiratMosulAlertsBot مشرفاً مع صلاحيات النشر والتعديل والحذف. حوّل رسالة من القناة إلى البوت لاكتشاف معرّفها، ثم اربطها هنا. النشر إلى كل قناة يتم باختيار صريح.</p><div id="tgStatus" class="notice" role="status" aria-live="polite"></div><div id="tgBody"></div></section></div>';
  const root = overlay.querySelector('.dialog'), body = root.querySelector('#tgBody'), status = root.querySelector('#tgStatus');
  let busy = false, active = '', channels = [], candidates = [], deliveries = [];
  const alive = () => overlay.contains(root);
  root.querySelector('#tgClose').onclick = () => { if (!busy) overlay.replaceChildren(); };
  async function run(task) {
    if (busy || !alive()) return;
    busy = true; status.textContent = 'جارٍ تنفيذ العملية…';
    root.querySelectorAll('button,input,select').forEach(control => control.disabled = true);
    try { await task(); if (alive()) status.textContent = 'تم تحديث الحالة.'; }
    catch (error) { if (alive()) status.textContent = errors[error.message] || 'تعذر إكمال العملية. حدّث السجل وتحقق من الاتصال.'; }
    finally { busy = false; if (alive()) root.querySelectorAll('button,input,select').forEach(control => control.disabled = false); }
  }
  async function load() {
    const data = await request({ action:'list' });
    channels = data.channels; candidates = data.candidates;
    if (active) deliveries = (await request({ action:'deliveries', chat_id:active })).deliveries;
    if (alive()) render();
  }
  const call = async (action, extra = {}) => { await request({ action, chat_id:active, ...extra }); await load(); };
  function render() {
    body.innerHTML = `<form id="tgConnect"><label for="tgId">معرّف القناة الرقمي</label><input class="field" id="tgId" dir="ltr" placeholder="-100…" required><button class="btn gold" type="submit">التحقق وربط القناة</button></form>
      ${candidates.length ? '<p class="notice">القنوات المكتشفة (لم تُفعّل تلقائياً):</p>' + candidates.map(c => `<button class="btn" data-candidate="${escape(c.chat_id)}">${escape(c.title)} · <bdi>${escape(c.chat_id)}</bdi></button>`).join(' ') : ''}
      <hr><label for="tgChannels">القناة المستهدفة</label><select class="field" id="tgChannels"><option value="">اختر قناة</option>${channels.map(c => `<option value="${escape(c.chat_id)}" ${c.chat_id === active ? 'selected' : ''}>${escape(c.title)} (${escape(c.chat_id)}) — ${c.enabled ? 'مفعّلة' : 'متوقفة'}</option>`).join('')}</select><button class="btn" id="tgRefresh">تحديث السجل</button>
      ${active ? `<div class="actions"><button class="btn" id="tgVerify">فحص الصلاحيات</button><button class="btn" id="tgToggle">${channels.find(c => c.chat_id === active)?.enabled ? 'إيقاف النشر الجديد' : 'تفعيل النشر'}</button></div>
      <section class="panel"><h3>اختبار تقني</h3><p>اختبار تقني لنظام قيراط – ليس إعلان وفاة حقيقياً</p><button class="btn gold" id="tgTest">نشر رسالة الاختبار في هذه القناة</button></section>
      <section class="panel"><h3>نشر إعلان من قيراط</h3><select class="field" id="tgAnnouncement"><option value="">اختر إعلاناً حقيقياً للنشر</option>${announcements.map(a => `<option value="${escape(a.id)}">${escape(a.name)} · ${escape(a.mosque)} · ${escape(String(a.datetime).slice(0,10))}</option>`).join('')}</select><button class="btn" id="tgPublish">نشر الإعلان المختار في هذه القناة</button><p class="notice">تعديل الإعلان أو حذفه داخل قيراط لا يغيّر رسالة Telegram تلقائياً. استخدم أزرار الرسالة أدناه؛ التعديل يجلب أحدث نص محفوظ للإعلان.</p></section>
      <h3>سجل الرسائل</h3>${deliveries.slice().sort((a,b)=>b.attemptedAt-a.attemptedAt).map(d => `<article class="card"><strong>${d.test ? 'اختبار تقني' : 'إعلان قيراط'}</strong><p class="small">الحالة: ${d.state === 'sent' ? 'منشورة' : d.state === 'deleted' ? 'محذوفة' : 'غير مؤكدة — افحص القناة؛ لا تعِد النشر'} · معرّف الرسالة: <bdi>${escape(d.message_id || 'لم يُحفظ بعد')}</bdi><br>معرّف العملية: <bdi>${escape(d.delivery_id)}</bdi></p>${d.state === 'sent' ? `<button class="btn" data-edit="${escape(d.delivery_id)}">${d.test ? 'تعديل الاختبار' : 'تحديث الرسالة من الإعلان'}</button> <button class="btn" data-delete="${escape(d.delivery_id)}">حذف الرسالة من Telegram</button>` : ''}</article>`).join('') || '<p>لا توجد رسائل محفوظة لهذه القناة.</p>'}` : ''}`;
    body.querySelector('#tgConnect').onsubmit = event => {
      event.preventDefault(); const id = body.querySelector('#tgId').value.trim();
      run(async () => { await request({ action:'connect', chat_id:id }); active=id; await load(); });
    };
    body.querySelectorAll('[data-candidate]').forEach(button => button.onclick = () => { body.querySelector('#tgId').value = button.dataset.candidate; });
    body.querySelector('#tgChannels').onchange = event => { active=event.target.value; deliveries=[]; run(load); };
    body.querySelector('#tgRefresh').onclick = () => run(load);
    if (!active) return;
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
      if (action === 'delete' && !confirm('حذف هذه الرسالة المحفوظة من قناة Telegram؟')) return;
      run(() => call((delivery.test ? 'test-' : '') + action, { delivery_id:id }));
    });
  }
  await run(load);
}
