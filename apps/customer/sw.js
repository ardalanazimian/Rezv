// ═════════════════════════════════════════════════════════
//  Service Worker رزرونو — اپِ نسل‌Z: نصب‌شدنی، آفلاین، بارگذاریِ آنی
// ═════════════════════════════════════════════════════════
const CACHE_VERSION = 'rezervno-v52';   // Web Push: table-ready + survey click-through + private API network-only
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('push', (event) => {
  let data = { title: 'رزرونو', body: '', url: '/', tag: 'rezervno' };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch (_) {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'رزرونو', {
      body: data.body || '',
      tag: data.tag || 'rezervno',
      data: { url: data.url || '/' },
      lang: 'fa',
      dir: 'rtl',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const c of windows) {
        if (c.url && 'focus' in c) { c.navigate?.(target); return c.focus(); }
      }
      return self.clients.openWindow(target);
    })
  );
});

function isPrivateApi(request, url) {
  if (request.headers.get('Authorization')) return true;
  const p = url.pathname;
  return /\/(?:api\/)?v1\/me(?:\/|$)/.test(p)
    || /\/me(?:\/|$)/.test(p)
    || /\/waitlist\//.test(p)
    || /\/reservations\//.test(p);
}

self.addEventListener('message', (event) => {
  if (event.data === 'PURGE_RUNTIME') {
    event.waitUntil(
      caches.delete(RUNTIME_CACHE).then(() => caches.open(RUNTIME_CACHE)).catch(() => {})
    );
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  const isApi = url.pathname.startsWith('/api/') || url.pathname.startsWith('/v1/') || url.pathname.includes('/api/');
  if (isApi) {
    event.respondWith(isPrivateApi(request, url) ? networkOnly(request) : networkFirst(request));
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

async function networkOnly(request) {
  return fetch(request);
}

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
