// Çevrimdışı önbellek: kartvizit ve QR ekranı internet yokken de açılır.
// Sayfa (HTML) internetten taze alınır (3 sn içinde gelmezse önbellekten),
// diğer dosyalar sürüm numaralı önbellekten gelir; her yayında sürüm değişir.
const CACHE = 'kartvizit-d32e2d85c4';
const FONTS = 'kartvizit-fonts';
const ASSETS = ["./","card.js?v=d32e2d85c4","app.js?v=d32e2d85c4","styles.css?v=d32e2d85c4","vendor/qrcode.js?v=d32e2d85c4","img/immoviewer.svg","img/immoviewer-white.svg","pwa/favicon.svg","pwa/icon-192.png","pwa/apple-touch-icon.png","manifest.webmanifest","tuncay-turkoglu.vcf","tuncay-turkoglu-en.vcf","tuncay-turkoglu-de.vcf","tuncay-turkoglu-ru.vcf","tuncay-turkoglu-uk.vcf","tuncay-turkoglu-ar.vcf"];
const pageKey = (url) => url.origin + url.pathname.replace(/index\.html$/, '');

self.addEventListener('install', (e) => {
  // cache:'reload' → tarayıcının HTTP önbelleğindeki eski kopyaları atla
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== FONTS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

async function page(req) {
  const url = new URL(req.url);
  const key = pageKey(url);
  const c = await caches.open(CACHE);
  try {
    const res = await Promise.race([fetch(url.href, { cache: 'no-cache', credentials: 'same-origin' }), timeout(3000)]);
    if (res.ok) c.put(key, res.clone());
    return res;
  } catch {
    return (await c.match(key)) || (await c.match(url.origin + url.pathname)) || Response.error();
  }
}

async function asset(req) {
  const c = await caches.open(CACHE);
  const hit = await c.match(req.url);
  if (hit) return hit;
  const res = await fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' });
  if (res.ok) c.put(req.url, res.clone());
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    e.respondWith(req.mode === 'navigate' ? page(req) : asset(req));
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
