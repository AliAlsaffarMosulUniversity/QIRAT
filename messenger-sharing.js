/* Manual Messenger preparation: links open only; delivery is confirmed in Messenger. */
function openMessengerGroups() {
  if (!isAdmin()) return;
  const key = 'qirat_messenger_draft_v1_' + currentUser.uid;
  let draft = 'قيراط | QIRAT — اختبار تقني لنظام نشر الإعلانات. هذه رسالة تجريبية فقط، وليست إعلان وفاة حقيقياً';
  try { draft = sessionStorage.getItem(key) ?? draft; } catch {}
  modal(`<h2>مشاركة عبر ماسنجر</h2>
    <label for="msMessage">اكتب الرسالة مرة واحدة</label>
    <textarea class="field" id="msMessage" maxlength="4000"></textarea>
    <p class="notice">اضغط اسم المحادثة لنسخ النص وفتحها، ثم الصق الرسالة وأرسلها داخل ماسنجر. كرّر للمحادثة الثانية.</p>
    <div class="actions">
      <a class="btn gold" id="msFirst" href="https://m.me/ch/AbYDrlPhf0crYRu4/" target="_blank" rel="noopener noreferrer">الصلاة على الجنازة ↗</a>
      <a class="btn gold" id="msSecond" href="https://m.me/ch/AbZ5SY-OJ1wllO79/" target="_blank" rel="noopener noreferrer">الصلاة على الجنازة 2 ↗</a>
    </div>
    <p id="msStatus" class="notice" role="status" aria-live="polite">المسودة محفوظة لهذه الجلسة في هذا المتصفح. فتح المحادثة لا يعني إرسال الرسالة.</p>`);
  const input = $('#msMessage'), status = $('#msStatus');
  input.value = draft;
  input.oninput = () => {
    try { sessionStorage.setItem(key, input.value); status.textContent = 'تم حفظ المسودة لهذه الجلسة.'; }
    catch { status.textContent = 'تعذر حفظ المسودة؛ انسخ النص قبل الإغلاق.'; }
  };
  for (const selector of ['#msFirst', '#msSecond']) {
    $(selector).onclick = event => {
      if (!isAdmin()) { event.preventDefault(); return; }
      const text = input.value.trim();
      if (!text) {
        event.preventDefault(); status.textContent = 'اكتب الرسالة أولاً.'; input.focus(); return;
      }
      try { sessionStorage.setItem(key, input.value); } catch {}
      const manualCopy = () => {
        status.textContent = 'تعذر النسخ التلقائي. عد إلى قيراط وحدد النص وانسخه، ثم الصقه داخل ماسنجر.';
        input.focus(); input.select();
      };
      status.textContent = 'جارٍ نسخ النص وفتح المحادثة…';
      try {
        if (!navigator.clipboard?.writeText) { manualCopy(); return; }
        navigator.clipboard.writeText(text).then(() => {
          status.textContent = 'تم نسخ النص. الصقه وأكّد الإرسال داخل ماسنجر؛ لم يؤكد قيراط التسليم.';
        }, manualCopy);
      } catch { manualCopy(); }
      // Keep the native anchor navigation synchronous to avoid popup blocking.
    };
  }
}
