// Folio offline cache, version 1.1.28 (made by scripts/make-web.mjs)
const CACHE = 'folio-1.1.28', CORE = ["folio-layout.js","folio-licence.js","folio-web-licence.js","fonts/caveat-latin-600-normal.woff2","fonts/caveat-latin-ext-600-normal.woff2","fonts/dancing-script-latin-600-normal.woff2","fonts/dancing-script-latin-ext-600-normal.woff2","fonts/fonts.css","fonts/homemade-apple-latin-400-normal.woff2","fonts/inter-latin-400-normal.woff2","fonts/inter-latin-500-normal.woff2","fonts/inter-latin-600-normal.woff2","fonts/inter-latin-700-normal.woff2","fonts/inter-latin-ext-400-normal.woff2","fonts/inter-latin-ext-500-normal.woff2","fonts/inter-latin-ext-600-normal.woff2","fonts/inter-latin-ext-700-normal.woff2","icons/icon-256.png","icons/icon-32.png","icons/icon-512.png","index.html","manifest.webmanifest","vendor/pdf-lib.min.js","vendor/pdf.min.js","vendor/pdf.worker.min.js","./"];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('folio-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(r => {
    if (r.ok && u.pathname.includes('/ocr/')) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  }).catch(() => e.request.mode === 'navigate' ? caches.match('./') : Response.error())));
});
