(() => {
  let pendingPrompt = null;
  const button = document.getElementById('installApp');
  const standalone = window.matchMedia('(display-mode: standalone)');
  const installed = () => standalone.matches || navigator.standalone === true;
  const update = () => { button.hidden = installed(); };
  update();
  standalone.addEventListener?.('change', update);
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    pendingPrompt = event;
    update();
  });
  window.addEventListener('appinstalled', () => {
    pendingPrompt = null;
    button.hidden = true;
    notify('تم تثبيت قيراط');
  });
  button.addEventListener('click', async () => {
    if (pendingPrompt) {
      const prompt = pendingPrompt;
      pendingPrompt = null;
      button.disabled = true;
      try { await prompt.prompt(); await prompt.userChoice; }
      catch { showInstructions(); }
      finally { button.disabled = false; update(); }
      return;
    }
    showInstructions();
  });
  function showInstructions() {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    modal('<h2>تثبيت قيراط</h2><p class="notice">' + (ios
      ? 'افتح قيراط في Safari، ثم اضغط مشاركة واختر «إضافة إلى الشاشة الرئيسية».'
      : 'من قائمة المتصفح ⋮ أو ⋯ اختر «تثبيت قيراط» أو «إضافة إلى الشاشة الرئيسية». إذا كنت داخل متصفح تطبيق آخر، افتح الرابط في Chrome أو Edge أولاً.')
      + '</p><p class="notice">تحتاج الإعلانات وتسجيل الدخول إلى اتصال بالإنترنت.</p>');
  }
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' })
        .catch(error => console.warn('QIRAT offline shell unavailable', error));
    });
  }
})();
