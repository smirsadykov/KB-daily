// Офлайн-кэш. Меняешь код — подними версию, и обновление приедет само.
const VERSION = 'kbd-v66';
// Версия в адресе файла — единственный способ гарантированно пробить
// старый кэш на уже установленном приложении. Меняешь css или app.js —
// подними ?v= здесь и в index.html.
const ASSETS = [
  './',
  './index.html',
  './css/styles.css?v=66',
  './js/app.js?v=66',
  './js/data.js?v=66',
  './js/store.js?v=66',
  './js/progression.js?v=66',
  './js/timer.js?v=66',
  './js/charts.js?v=66',
  './js/assessment.js?v=66',
  './js/supplements.js?v=66',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// cache: 'reload' — берём файлы с сервера, а не из обычного кэша браузера,
// иначе в офлайн-копию может попасть уже устаревшая версия.
const freshRequest = (url) => new Request(url, { cache: 'reload' });

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(ASSETS.map(freshRequest)))
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
      fetch(new Request(req, { cache: 'no-cache' }))
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
      // no-cache — спрашиваем сервер, изменился ли файл, а не верим сроку годности
      const fresh = fetch(new Request(req, { cache: 'no-cache' })).then(res => {
        if (res.ok) {
          const copy = res.clone();
          return caches.open(VERSION).then(c => c.put(req, copy)).then(() => res);
        }
        return res;
      }).catch(() => hit || new Response('', { status: 504, statusText: 'offline' }));
      // держим фоновое обновление живым, иначе воркер может уснуть на полпути
      e.waitUntil(fresh.catch(() => {}));
      return hit || fresh;
    })
  );
});
