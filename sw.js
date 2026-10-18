/* Düzen: uygulama kabuğunu önbellekte tutar; veri ve hava ağdan gelir (uygulama kendi kopyasını saklar). */
const SURUM = 'duzen-v1';
const KABUK = [
  './', 'index.html', 'app.css', 'lib.js', 'app.js', 'manifest.webmanifest',
  'vendor/marked.min.js', 'fonts/fonts.css',
  'fonts/barlow-condensed-latin-500-normal.woff2', 'fonts/barlow-condensed-latin-600-normal.woff2',
  'fonts/barlow-condensed-latin-ext-500-normal.woff2', 'fonts/barlow-condensed-latin-ext-600-normal.woff2',
  'fonts/ibm-plex-sans-latin-400-normal.woff2', 'fonts/ibm-plex-sans-latin-500-normal.woff2', 'fonts/ibm-plex-sans-latin-600-normal.woff2',
  'fonts/ibm-plex-sans-latin-ext-400-normal.woff2', 'fonts/ibm-plex-sans-latin-ext-500-normal.woff2', 'fonts/ibm-plex-sans-latin-ext-600-normal.woff2',
  'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SURUM).then(c => c.addAll(KABUK)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== SURUM).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Önce önbellek, arkada güncelle; sadece kendi dosyalarımız
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin) return;
  e.respondWith(caches.open(SURUM).then(async c => {
    const eski = await c.match(e.request, { ignoreSearch: true });
    const yeni = fetch(e.request).then(r => {
      if (r.ok) { const kopya = r.clone(); c.put(e.request, kopya); }
      return r;
    }).catch(() => eski);
    return eski || yeni;
  }));
});
