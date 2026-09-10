const CACHE_NAME = 'konecta-app-v1';
const APP_SHELL = [
  './',
  './index.html',
  './css/app.css',
  './js/app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // API 요청은 항상 네트워크에서 최신 데이터를 가져온다 (캐시하지 않음)
  if (request.url.includes('/api/')) {
    event.respondWith(fetch(request));
    return;
  }

  // 화면 파일은 캐시 우선, 실패 시 네트워크
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});
