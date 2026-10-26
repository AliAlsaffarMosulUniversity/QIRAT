const CACHE = 'qirat-shell-whatsapp-multishare-v3';
const SHELL = ['./', './index.html', './firebase.js?v=20261026-compose', './telegram-channels.js?v=20261026-compose', './whatsapp-sharing.js?v=20261027-multishare', './install.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('qirat-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  const scope = new URL('./', self.location.href);
  const isNavigation = request.mode === 'navigate' && (url.pathname === scope.pathname || url.pathname === new URL('index.html', scope).pathname);
  const isAsset = SHELL.slice(1).some(path => new URL(path, scope).pathname === url.pathname);
  if (!isNavigation && !isAsset) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const key = isNavigation ? new URL('index.html', scope).href : url.href;
    try {
      const response = await fetch(request);
      if (response.ok) await cache.put(key, response.clone());
      return response;
    } catch (error) {
      const fallback = await cache.match(key);
      if (fallback) return fallback;
      throw error;
    }
  })());
});
