// Service worker de Noutlife: avisos push (recordatorios) y caché del shell.

const XP_ONLY_PUSH_TYPES = new Set(['xp', 'xp_gained', 'level_up', 'levelup']);

async function foregroundClients() {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  return windows.filter((client) => client.visibilityState === 'visible');
}

async function foregroundChatIsOpen(clients, chatKey) {
  if (!chatKey || clients.length === 0) return false;
  const responses = await Promise.all(clients.map((client) => new Promise((resolve) => {
    const channel = new MessageChannel();
    let settled = false;
    const finish = (matches) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      channel.port1.close();
      resolve(matches);
    };
    const timeout = setTimeout(() => finish(false), 350);
    channel.port1.onmessage = (message) => finish(message.data?.matches === true);
    try {
      client.postMessage({ type: 'lq:query-chat-focus', chatKey }, [channel.port2]);
    } catch {
      finish(false);
    }
  })));
  return responses.some(Boolean);
}

async function shouldSilencePush(payload) {
  const data = payload?.data ?? {};
  const type = String(data.type ?? '').toLowerCase();
  const visible = await foregroundClients();
  // Level/XP-only banners add no new information while Noutlife is already open.
  if (visible.length && (data.silentForeground === true || XP_ONLY_PUSH_TYPES.has(type))) return true;
  // Keep notifications from other conversations: suppress only the exact open chat.
  if (data.chatKey && await foregroundChatIsOpen(visible, data.chatKey)) return true;
  return false;
}

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

  // Se silencia solo XP cuando la app está en primer plano, y solo el chat exacto
  // que la persona está viendo; las demás conversaciones conservan su aviso.
  event.waitUntil((async () => {
    try { if (await shouldSilencePush(payload)) return; } catch { /* si falla la consulta, no perder el aviso */ }
    await self.registration.showNotification(payload.title ?? 'Noutlife', options);
  })());
});

// Al entrar a un chat, retira avisos del sistema que ya quedaron obsoletos.
self.addEventListener('message', (event) => {
  const data = event.data;
  if (data?.type !== 'lq:close-chat-notifications' || typeof data.chatKey !== 'string') return;
  event.waitUntil(self.registration.getNotifications().then((notifications) => {
    for (const notification of notifications) {
      const reply = notification.data?.reply;
      const chatKey = notification.data?.chatKey ?? (reply ? `${reply.type}:${reply.id}` : null);
      if (chatKey === data.chatKey) notification.close();
    }
  }));
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
