self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Noutlife', body: event.data.text() };
  }

  const options = {
    body: payload.body ?? '',
    icon: payload.icon ?? '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.tag ?? 'lifequest',
    data: payload.data ?? {},
    vibrate: [100, 50, 100],
    actions: [
      { action: 'open', title: 'Abrir Noutlife' },
      { action: 'dismiss', title: 'Ignorar' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'Noutlife', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// ─── App shell cache ─────────────────────────────────────────────────────────
const CACHE_NAME = 'lifequest-shell-v1';
const SHELL_URLS = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Navigation: network-first, fallback to cached shell
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
    return;
  }
  // Static assets: cache-first
  if (event.request.url.includes('/assets/') || event.request.url.includes('/icons/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached ?? fetch(event.request))
    );
  }
});
