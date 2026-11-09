// Çevrimdışı önbellek: kartvizit ve QR ekranı internet yokken de açılır.
const CACHE = 'kartvizit-14b7f0aa64';
const FONTS = 'kartvizit-fonts';
const ASSETS = ["./","index.html","card.js","app.js","styles.css","vendor/qrcode.js","img/immoviewer.svg","img/immoviewer-white.svg","pwa/favicon.svg","pwa/icon-192.png","pwa/apple-touch-icon.png","manifest.webmanifest","tuncay-turkoglu.vcf"];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== FONTS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    const key = url.origin + url.pathname;
    e.respondWith(
      caches.open(CACHE).then(async (c) => {
        const hit = await c.match(key);
        const net = fetch(req)
          .then((res) => { if (res.ok) c.put(key, res.clone()); return res; })
          .catch(() => hit || Response.error());
        return hit || net;
      })
    );
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(FONTS).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        c.put(req, res.clone());
        return res;
      })
    );
  }
});
