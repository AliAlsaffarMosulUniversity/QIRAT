/* Manual-only pilot. No WhatsApp API credentials, recipients or delivery claims. */
const WHATSAPP_TEST_TEXT = 'قيراط | QIRAT — اختبار تقني لنظام نشر الإعلانات. هذه رسالة تجريبية فقط، وليست إعلان وفاة حقيقياً';
function whatsappPromptEnabled() {
  try { return localStorage.getItem('qirat_whatsapp_prompt_v1') === 'on'; } catch { return false; }
}
function whatsappAfterPublication() {
  if (isAdmin() && whatsappPromptEnabled()) openWhatsAppGroups();
}
function openWhatsAppGroups() {
  if (!isAdmin()) return;
  modal(`<h2>إرسال إلى المجموعات — تجربة يدوية</h2>
    <p class="notice">التجربة لمجموعة الاختبار التي تملكها فقط. لا ترسل إلى المجموعات الـ23 الأخرى. اختر المجموعة بنفسك داخل WhatsApp وراجعها قبل الإرسال.</p>
    <label for="waPreview">النص التجريبي الثابت</label>
    <textarea class="field" id="waPreview" readonly></textarea>
    <p class="notice">رابط الدعوة لا يحدد مستلم الرسالة ولا يسمح بالنشر عبر API. فتح WhatsApp أو إغلاق نافذة المشاركة لا يثبت إرسال الرسالة.</p>
    <p><a class="btn" href="https://chat.whatsapp.com/LCs9RtmTFWZA2JvmhUay6R" target="_blank" rel="noopener noreferrer">عرض مجموعة الاختبار (دعوة فقط)</a></p>
    <label class="notice"><input id="waConfirm" type="checkbox"> سأختار مجموعة الاختبار وحدها وأراجع المستلم في WhatsApp.</label>
    <div class="actions">
      <button class="btn gold" id="waOpen" disabled>فتح WhatsApp للمشاركة اليدوية</button>
      <button class="btn" id="waShare" disabled>مشاركة عبر الجهاز</button>
      <button class="btn" id="waCopy">نسخ النص التجريبي</button>
    </div>
    <p id="waStatus" role="status" aria-live="polite" class="notice">لم تُرسل أي رسالة من قيراط.</p>
    <hr>
    <label class="notice"><input id="waPrompt" type="checkbox"> إظهار نافذة المشاركة بعد نشر إعلان جديد من هذا المتصفح (للمدير)</label>
    <p class="notice">هذا تذكير يدوي بالنص التجريبي فقط. قيراط ينشر الإعلانات مباشرة حالياً؛ لا توجد مرحلة اعتماد منفصلة.</p>
    <button class="btn" disabled>النشر التلقائي بعد الاعتماد — غير مفعّل</button>
    <p class="notice">لم نتحقق من أهلية حساب قيراط ومجموعة الاختبار لواجهة Groups API الرسمية. لن يحدث إرسال تلقائي حتى يتم ذلك وتُعتمد وجهة واحدة صراحةً.</p>`);
  $('#waPreview').value = WHATSAPP_TEST_TEXT;
  $('#waPrompt').checked = whatsappPromptEnabled();
  $('#waPrompt').onchange = e => {
    try { localStorage.setItem('qirat_whatsapp_prompt_v1', e.target.checked ? 'on' : 'off'); }
    catch { e.target.checked = false; $('#waStatus').textContent = 'تعذر حفظ التفضيل في هذا المتصفح.'; }
  };
  $('#waConfirm').onchange = e => {
    $('#waOpen').disabled = !e.target.checked;
    $('#waShare').disabled = !e.target.checked || typeof navigator.share !== 'function';
  };
  $('#waCopy').onclick = () => copy(WHATSAPP_TEST_TEXT);
  $('#waOpen').onclick = () => {
    if (!isAdmin() || !$('#waConfirm').checked) return;
    window.open('https://wa.me/?text=' + encodeURIComponent(WHATSAPP_TEST_TEXT), '_blank', 'noopener,noreferrer');
    $('#waStatus').textContent = 'طُلب فتح WhatsApp. اختر مجموعة الاختبار وحدها وأكمل الإرسال بنفسك؛ لا يمكن لقيراط تأكيد التسليم.';
  };
  $('#waShare').onclick = async () => {
    if (!isAdmin() || !$('#waConfirm').checked || !navigator.share) return;
    try {
      await navigator.share({title:'قيراط — اختبار تقني', text:WHATSAPP_TEST_TEXT});
      $('#waStatus').textContent = 'أُغلقت نافذة المشاركة؛ لا يمكن لقيراط تأكيد الإرسال أو المستلم.';
    } catch (error) {
      $('#waStatus').textContent = error.name === 'AbortError' ? 'أُلغيت المشاركة.' : 'تعذرت المشاركة. يمكنك استخدام رابط WhatsApp أو نسخ النص.';
    }
  };
}
