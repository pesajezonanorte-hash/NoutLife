// Service worker de Noutlife: avisos push (recordatorios) y caché del shell.

self.addEventListener('push', (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { body: event.data.text() };
    }
  }

  const options = {
    body: payload.body ?? '',
    icon: payload.icon && payload.icon.startsWith('/') ? payload.icon : '/icons/icon-192.png',
    badge: '/icons/icon-96.png',
    // Misma etiqueta que el aviso local de la app: si llegan los dos, se ve uno.
    tag: payload.tag ?? 'noutlife',
    data: payload.data ?? {},
    vibrate: [100, 50, 100],
  };

  // Siempre se muestra algo: Chrome y Safari retiran el permiso a quien recibe push sin aviso visible.
  event.waitUntil(self.registration.showNotification(payload.title ?? 'Noutlife', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '/';
  const target = new URL(link, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (list) => {
      for (const client of list) {
        if (new URL(client.url).origin !== self.location.origin) continue;
        await client.focus();
        if ('navigate' in client && client.url !== target) await client.navigate(target).catch(() => undefined);
        return;
      }
      if (clients.openWindow) await clients.openWindow(target);
    })
  );
});

// ─── App shell cache ─────────────────────────────────────────────────────────
const CACHE_NAME = 'noutlife-shell-v2';
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
  const url = new URL(event.request.url);
  // La API (y su cookie de sesión) nunca pasa por la caché.
  if (url.pathname.startsWith('/api/')) return;
  // Navigation: network-first, fallback to cached shell
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
    return;
  }
  // Static assets: cache-first
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached ?? fetch(event.request).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE_NAME).then((c) => c.put(event.request, copy)); }
        return res;
      }))
    );
  }
});
