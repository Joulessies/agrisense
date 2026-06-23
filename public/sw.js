// AgriSense Service Worker — Cache-first strategy for the app shell
const CACHE_NAME = 'agrisense-v1';

// Static assets to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Remove old caches
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never cache API calls, Supabase, or external resources
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('supabase') ||
    url.hostname.includes('openweathermap') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('cdnjs') ||
    request.method !== 'GET'
  ) {
    return; // fall through to network
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((networkRes) => {
        // Cache successful navigation and static responses
        if (networkRes.ok && (request.destination === 'document' || request.destination === 'script' || request.destination === 'style')) {
          const clone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return networkRes;
      });
    })
  );
});
