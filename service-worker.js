// on iOS Safari
window.navigator.standalone

// on Android Chrome
window.matchMedia(
  '(display-mode: standalone)'
).matches

document.addEventListener("DOMContentLoaded", () => {
    console.log("script.js carregado!");

    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("/service-worker.js")
            .then(() => console.log("Service Worker registrado"))
            .catch(err => console.error("Erro ao registrar Service Worker:", err));
    }
});
const CACHE_NAME = 'horas-cache-v2';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/style.css',
  '/script.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;

  // ❌ nunca cachear PDF
  if (req.url.endsWith('.pdf')) return;

  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req))
  );
});
