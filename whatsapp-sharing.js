/* Official manual share link only. An invite URL cannot select a recipient. */
const WHATSAPP_TEST_TEXT = 'قيراط | QIRAT — اختبار تقني لنظام نشر الإعلانات. هذه رسالة تجريبية فقط، وليست إعلان وفاة حقيقياً';
function openWhatsAppGroups() {
  if (!isAdmin()) return;
  modal(`<h2>رسالة واتساب</h2>
    <label for="waMessage">اكتب الرسالة</label>
    <textarea class="field" id="waMessage" maxlength="4000" placeholder="اكتب رسالتك هنا…"></textarea>
    <p class="notice">بعد فتح واتساب، اختر كروب الاختبار الذي تملكه فقط ثم اضغط إرسال. رابط الدعوة لا يحدد المستلم تلقائياً.</p>
    <div class="actions"><button class="btn" id="waSend" type="button" aria-label="فتح واتساب بالرسالة" title="فتح واتساب بالرسالة" style="background:#25d366;color:#052e16;display:inline-flex;align-items:center;justify-content:center;min-width:48px;min-height:48px"><svg viewBox="0 0 32 32" width="25" height="25" fill="currentColor" aria-hidden="true" focusable="false"><path d="M16 3a13 13 0 0 0-11.2 19.6L3 29l6.6-1.7A13 13 0 1 0 16 3Zm0 23.5a10.5 10.5 0 0 1-5.4-1.5l-.4-.2-3.9 1 1-3.8-.3-.4A10.5 10.5 0 1 1 16 26.5Zm5.8-7.9c-.3-.2-1.8-.9-2.1-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7 0a8.6 8.6 0 0 1-4.2-3.7c-.3-.5.3-.5.9-1.7.1-.2 0-.4 0-.6l-1-2.3c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.8.4s-1.1 1.1-1.1 2.6 1.1 2.9 1.3 3.1 2.2 3.4 5.4 4.7c2 .9 2.8 1 3.8.9.6-.1 1.8-.8 2.1-1.5s.3-1.4.2-1.5-.3-.2-.6-.3Z"/></svg></button></div>
    <p class="notice" id="waStatus" role="status" aria-live="polite"></p>`);
  $('#waMessage').value = WHATSAPP_TEST_TEXT;
  $('#waMessage').oninput = () => { $('#waStatus').textContent = ''; };
  $('#waSend').onclick = () => {
    if (!isAdmin()) return;
    const text = $('#waMessage').value.trim();
    if (!text) {
      $('#waStatus').textContent = 'اكتب الرسالة أولاً.';
      $('#waMessage').focus();
      return;
    }
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener,noreferrer');
    $('#waStatus').textContent = 'أكمل اختيار الكروب والإرسال داخل واتساب.';
  };
}
