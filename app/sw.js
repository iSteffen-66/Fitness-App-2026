// Service Worker: alles beim ersten Laden zwischenspeichern, danach offline.
// Bei jeder Änderung an App-Dateien die Versionsnummer erhöhen.
const CACHE = 'training-v8';
const ASSETS = [
  './',
  'index.html',
  'style.css',
  'manifest.webmanifest',
  'js/app.js',
  'js/logic.js',
  'js/db.js',
  'js/seed.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'img/01.webp', 'img/02.webp', 'img/03.webp', 'img/04.webp', 'img/05.webp', 'img/06.webp', 'img/07.webp',
  'img/08.webp', 'img/09.webp', 'img/10.webp', 'img/11.webp', 'img/13.webp', 'img/14.webp',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Aus dem Cache antworten, im Hintergrund aktualisieren.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then((r) => { if (r && r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
    return hit || (await net) || (req.mode === 'navigate' ? c.match('index.html') : Response.error());
  }));
});
