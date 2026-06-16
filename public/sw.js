// Service Worker — Barbearia Status
// Network-first para TUDO (deploys sempre frescos). Cache só como fallback offline.
const CACHE = 'barbearia-status-v3';
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

  // Network-first: sempre busca a versão mais recente; usa cache só se offline.
  event.respondWith(
    fetch(req)
      .then((res) => {
        // Atualiza o cache em background
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((c) => c || caches.match('/agenda')))
  );
});
