// ═══════════════════════════════════════════════════════════
//  Service Worker رزرونو — اپِ نسل‌Z: نصب‌شدنی، آفلاین، بارگذاریِ آنی
//
//  استراتژیِ کش (چند-لایه، هوشمند):
//   • App Shell (index.html, manifest) → cache-first با به‌روزرسانیِ پس‌زمینه
//     (اپ آنی باز می‌شود، حتی آفلاین)
//   • API (/api/*, /v1/*) → network-first با fallback به کش
//     (داده‌ی تازه اولویت دارد، ولی آفلاین هم چیزی نشان داده می‌شود)
//   • فونت/تصویر/استاتیک → cache-first
//     (یک‌بار دانلود، همیشه سریع)
//
//  نسخه‌بندی: با تغییرِ CACHE_VERSION، کشِ قدیمی خودکار پاک می‌شود.
// ═══════════════════════════════════════════════════════════
const CACHE_VERSION = 'rezervno-v40';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// فایل‌های اصلیِ اپ که باید همیشه در دسترس باشند (App Shell)
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
];

// ── نصب: کشِ App Shell ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => {})
  );
});

// ── فعال‌سازی: پاک‌کردنِ کشِ نسخه‌های قدیمی ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  const isApi = url.pathname.startsWith('/api/') || url.pathname.startsWith('/v1/') || url.pathname.includes('/api/');
  if (isApi) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      networkFirst(request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  event.respondWith(cacheFirst(request));
});

async function networkFirst(request) {
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.status === 200) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw new Error('offline and not cached');
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.status === 200) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch {
    return new Response('', { status: 503, statusText: 'offline' });
  }
}
