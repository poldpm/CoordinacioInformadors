const CACHE_NAME = 'panell-dades-v4';
const ARXIUS = [
  './', './index.html', './style.css', './app.js', './config.js',
  './manifest.json', './icons/icon-192.png', './icons/icon-512.png'
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ARXIUS)));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  const url = e.request.url;
  // les crides als fulls sempre a la xarxa (dades fresques)
  if (url.includes('script.google.com') || url.includes('cloudflare')) return;
  e.respondWith(
    caches.match(e.request).then(c => c || fetch(e.request).then(r => {
      return caches.open(CACHE_NAME).then(ca => { ca.put(e.request, r.clone()); return r; });
    }).catch(() => c))
  );
});
