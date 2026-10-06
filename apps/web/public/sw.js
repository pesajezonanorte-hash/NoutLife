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
  // Cartas de amigos y de gremio: se puede contestar desde el propio aviso.
  if (payload.data && payload.data.reply) {
    options.actions = [{ action: "reply", type: "text", title: "Responder", placeholder: "Escribe tu respuesta…" }];
  }

  // Siempre se muestra algo: Chrome y Safari retiran el permiso a quien recibe push sin aviso visible.
  event.waitUntil(self.registration.showNotification(payload.title ?? 'Noutlife', options));
});

// Responde desde el aviso: pide un acceso nuevo con la sesión (cookie) y envía la carta.
async function quickReply(reply, text) {
  const auth = await fetch("/api/v1/auth/refresh", { method: "POST", credentials: "include" });
  if (!auth.ok) throw new Error("sin sesión");
  const { accessToken } = await auth.json();
  const url = reply.type === "guild" ? "/api/v1/social/guilds/" + encodeURIComponent(reply.id) + "/messages" : "/api/v1/social/messages/" + encodeURIComponent(reply.id);
  const sent = await fetch(url, {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + accessToken },
    body: JSON.stringify({ content: text }),
  });
  if (!sent.ok) throw new Error("no se envió");
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const text = typeof event.reply === "string" ? event.reply.trim() : "";
  if (event.action === "reply" && text && data.reply) {
    const tag = event.notification.tag || "noutlife";
    event.waitUntil(
      quickReply(data.reply, text)
        .then(() => self.registration.showNotification("Respuesta enviada", { body: text.slice(0, 80), tag, icon: "/icons/icon-192.png", silent: true }))
        .then(() => new Promise((r) => setTimeout(r, 2500)))
        .then(() => self.registration.getNotifications({ tag }))
        .then((list) => list.forEach((n) => n.close()))
        .catch(() => clients.openWindow(new URL(data.link || "/", self.location.origin).href))
    );
    return;
  }
  // Al chat o a la zona de la que viene el aviso.
  const link = (data && data.link) || '/';
  const target = new URL(link, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (list) => {
      const mine = list.filter((c) => new URL(c.url).origin === self.location.origin);
      // Con la app abierta: que vaya ella al enlace (sin recargar). Si no responde, se navega.
      const client = mine.find((c) => c.focused) || mine.find((c) => c.visibilityState === 'visible') || mine[0];
      if (client) {
        try { await client.focus(); } catch (e) { /* algunos navegadores no dejan enfocar */ }
        client.postMessage({ type: 'lq:navigate', link: new URL(target).pathname + new URL(target).search });
        return;
      }
      if (clients.openWindow) await clients.openWindow(target);
    })
  );
});

// ─── App shell cache ─────────────────────────────────────────────────────────
const CACHE_NAME = 'noutlife-shell-v3';
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
