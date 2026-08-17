// Офлайн-кэш. Меняешь код — подними версию, и обновление приедет само.
const VERSION = 'kbd-v1';
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/data.js',
  './js/store.js',
  './js/progression.js',
  './js/timer.js',
  './js/charts.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // HTML — сначала сеть, чтобы не залипать на старой версии
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Остальное — отдаём из кэша сразу, а в фоне тянем свежую версию.
  // Так приложение открывается мгновенно и офлайн, но не залипает на старом коде:
  // обновление приезжает к следующему запуску.
  e.respondWith(
    caches.match(req).then(hit => {
      const fresh = fetch(req).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => hit || new Response('', { status: 504, statusText: 'offline' }));
      return hit || fresh;
    })
  );
});
