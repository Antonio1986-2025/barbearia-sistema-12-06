// Service Worker — Barbearia Status
// Estratégia: network-first para navegação/HTML, cache-first para assets estáticos.
const CACHE = 'barbearia-status-v2';
const ASSETS = ['/agenda', '/login', '/agendar', '/manifest.json', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Não interceptar chamadas a APIs externas (Supabase, Evolution, etc)
  if (url.origin !== self.location.origin) return;

  const isAsset = url.pathname.startsWith('/assets/') ||
    /\.(?:js|css|svg|png|jpg|jpeg|woff2?|ttf|ico)$/.test(url.pathname);

  if (isAsset) {
    // cache-first
    event.respondWith(
      caches.match(req).then((cached) =>
        cached ||
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
      )
    );
    return;
  }

  // network-first para navegação/HTML
  event.respondWith(
    fetch(req).catch(() => caches.match(req).then((c) => c || caches.match('/agenda')))
  );
});
