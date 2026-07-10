const CACHE = 'ork-inventory-mobile-v7';
const ASSETS = ['./', './index.html', './manifest.json', './assets/styles.css', './assets/app.js', './assets/icon.svg', './assets/favicon.ico', './assets/app-icon-192.png', './assets/app-icon-512.png'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // فایل اطلاعات روزانه نباید کش شود؛ همیشه نسخه تازه از سرور خوانده می‌شود.
  if (url.pathname.endsWith('/data/latest.json')) {
    e.respondWith(fetch(e.request, { cache: 'no-store' }));
    return;
  }

  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
