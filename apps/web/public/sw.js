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

// Con Noutlife a la vista, los recordatorios se ven dentro de la app (una nota con
// una campana suave, components/ui/ReminderPings) en vez del aviso del sistema. Solo
// se silencia el del sistema si alguna ventana confirma que lo mostró.
const IN_APP_TYPES = new Set(['reminder', 'quest_deadline', 'daily_summary']);

async function shownInApp(clients, payload) {
  const data = payload?.data ?? {};
  if (!clients.length || data.reply || data.chatKey || !IN_APP_TYPES.has(String(data.type ?? ''))) return false;
  const alert = {
    tag: payload.tag ?? 'noutlife', title: payload.title ?? 'Noutlife', body: payload.body ?? '', link: data.link,
    quick: data.quick, quickRef: data.quickRef, day: data.day, quiet: data.priority === 'low',
  };
  const answers = await Promise.all(clients.map((client) => new Promise((resolve) => {
    const channel = new MessageChannel();
    let settled = false;
    const finish = (shown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      channel.port1.close();
      resolve(shown);
    };
    const timeout = setTimeout(() => finish(false), 350);
    channel.port1.onmessage = (message) => finish(message.data?.shown === true);
    try {
      client.postMessage({ type: 'lq:in-app-alert', alert }, [channel.port2]);
    } catch {
      finish(false);
    }
  })));
  return answers.some(Boolean);
}

// Safari retira el permiso si un push no muestra nada: ahí el aviso silenciado se
// muestra sin sonido y se cierra al instante.
const STRICT_PUSH = /Safari/.test(self.navigator.userAgent) && !/Chrome|Chromium|Android/.test(self.navigator.userAgent);

async function silence(payload, options) {
  if (!STRICT_PUSH) return;
  await self.registration.showNotification(payload.title ?? 'Noutlife', { ...options, tag: 'lq-silenced', silent: true, actions: [] });
  const shown = await self.registration.getNotifications({ tag: 'lq-silenced' });
  shown.forEach((n) => n.close());
}

async function shouldSilencePush(payload) {
  const data = payload?.data ?? {};
  const type = String(data.type ?? '').toLowerCase();
  const visible = await foregroundClients();
  // Level/XP-only banners add no new information while Noutlife is already open.
  if (visible.length && (data.silentForeground === true || XP_ONLY_PUSH_TYPES.has(type))) return true;
  // Keep notifications from other conversations: suppress only the exact open chat.
  if (data.chatKey && await foregroundChatIsOpen(visible, data.chatKey)) return true;
  // Recordatorios: la app abierta los muestra ella.
  if (await shownInApp(visible, payload)) return true;
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

  const data = payload.data ?? {};
  // Avisos sin importancia (agua, cita del día): sin sonido ni vibración, igual de visibles.
  const quiet = data.priority === 'low';
  const options = {
    body: payload.body ?? '',
    icon: payload.icon && payload.icon.startsWith('/') ? payload.icon : '/icons/icon-192.png',
    badge: '/icons/icon-96.png',
    // Misma etiqueta que el aviso local de la app: si llegan los dos, se ve uno.
    tag: payload.tag ?? 'noutlife',
    data,
    timestamp: Date.now(),
    silent: quiet,
    renotify: !quiet,
  };
  if (!quiet) options.vibrate = [100, 50, 100];
  // Acciones rápidas: contestar una carta, marcar un hábito o sumar agua sin abrir la app
  // (Android y escritorio; iPhone las omite y abre la app al tocar el aviso).
  // Hasta dos acciones: completar, sumar agua y posponer 10 min (los avisos de respuesta solo tienen «Responder»).
  const actions = [];
  if (data.reply) actions.push({ action: 'reply', type: 'text', title: 'Responder', placeholder: 'Escribe tu respuesta…' });
  if (data.quick === 'habit_done') actions.push({ action: 'habit_done', title: 'Completar' });
  if (data.quick === 'water_250') actions.push({ action: 'water_250', title: '+250 ml' });
  if (data.type === 'reminder' && !data.reply) actions.push({ action: 'snooze', title: 'Posponer 10 min' });
  if (actions.length) options.actions = actions.slice(0, 2);
  // Número en el icono de la app: avisos que siguen sin leer.
  if (typeof payload.unread === 'number') setAppBadge(payload.unread);

  // Se silencia solo XP cuando la app está en primer plano, y solo el chat exacto
  // que la persona está viendo; las demás conversaciones conservan su aviso.
  event.waitUntil((async () => {
    try { if (await shouldSilencePush(payload)) return silence(payload, options); } catch { /* si falla la consulta, no perder el aviso */ }
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

// Llama a la API desde el aviso: pide un acceso nuevo con la sesión (cookie) y lo usa.
async function apiCall(path, method, body) {
  const auth = await fetch("/api/v1/auth/refresh", { method: "POST", credentials: "include" });
  if (!auth.ok) throw new Error("sin sesión");
  const { accessToken } = await auth.json();
  const res = await fetch("/api/v1" + path, {
    method, credentials: "include",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + accessToken },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error("la API respondió " + res.status);
  return res;
}

// Responde desde el aviso: envía la carta.
async function quickReply(reply, text) {
  const path = reply.type === "guild" ? "/social/guilds/" + encodeURIComponent(reply.id) + "/messages" : "/social/messages/" + encodeURIComponent(reply.id);
  await apiCall(path, "POST", { content: text });
}

// Acciones rápidas de los avisos: marcar el hábito o sumar un vaso de agua sin abrir la app.
async function quickAction(action, data) {
  if (action === "habit_done" && data.quickRef) {
    await apiCall("/habits/" + encodeURIComponent(data.quickRef) + "/log", "POST", { status: "completed", date: data.day });
    return "Hábito marcado. Tu racha sigue viva.";
  }
  if (action === "water_250") {
    await apiCall("/meals", "POST", { name: "Agua", mealType: "WATER", waterMl: 250, date: data.day });
    return "+250 ml de agua registrados.";
  }
  throw new Error("acción desconocida");
}

// Confirma la acción en silencio y retira la confirmación poco después.
async function confirmQuick(message) {
  const tag = "lq-quick-ok";
  await self.registration.showNotification("Noutlife", { body: message, tag, icon: "/icons/icon-192.png", badge: "/icons/icon-96.png", silent: true });
  await new Promise((r) => setTimeout(r, 2500));
  const list = await self.registration.getNotifications({ tag });
  list.forEach((n) => n.close());
}

// Número en el icono de la app (Badging API): Android y iPhone con la app instalada.
function setAppBadge(count) {
  const nav = self.navigator;
  const run = count > 0 ? nav.setAppBadge : nav.clearAppBadge;
  if (typeof run !== "function") return;
  Promise.resolve().then(() => (count > 0 ? run.call(nav, count) : run.call(nav))).catch(() => undefined);
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  // Medición (T8): el clic queda contado por categoría. Si la sesión venció, no se pierde el aviso.
  if (data.category) event.waitUntil(apiCall('/notifications/event', 'POST', { event: 'clicked', category: data.category }).catch(() => {}));
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
  // Posponer 10 min: el servidor vuelve a enviar el aviso a su hora (también con la app cerrada).
  if (event.action === 'snooze') {
    const n = event.notification;
    event.waitUntil(
      apiCall('/notifications/snooze', 'POST', {
        title: n.title || 'Noutlife', body: n.body || '', tag: n.tag || 'noutlife',
        link: data.link, quick: data.quick, quickRef: data.quickRef, day: data.day, priority: data.priority,
      })
        .then(() => confirmQuick('Listo: te lo recuerdo en 10 min.'))
        .catch(() => clients.openWindow(new URL(data.link || '/', self.location.origin).href))
    );
    return;
  }
  // Acción rápida (hábito o agua): se registra desde la barra, sin abrir la app.
  if ((event.action === "habit_done" || event.action === "water_250") && data.quick) {
    event.waitUntil(
      quickAction(event.action, data)
        .then(confirmQuick)
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
const CACHE_NAME = 'noutlife-shell-v4';
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
  // Solo nuestro propio origen: un recurso de terceros con una ruta parecida no entra en la caché.
  if (url.origin !== self.location.origin) return;
  // La API (y su cookie de sesión) nunca pasa por la caché.
  if (url.pathname.startsWith('/api/')) return;
  // Navigation: network-first, fallback to cached shell
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
    return;
  }
  // Assets con hash (/assets/) e iconos: cache-first.
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached ?? fetch(event.request).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE_NAME).then((c) => c.put(event.request, copy)); }
        return res;
      }))
    );
    return;
  }
  // Logos y favicon: red primero (sin quedarse con una versión vieja) y caché si no hay conexión.
  if (url.pathname.startsWith('/brand/') || url.pathname === '/icon.svg' || url.pathname === '/favicon.ico') {
    event.respondWith(
      fetch(event.request).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE_NAME).then((c) => c.put(event.request, copy)); }
        return res;
      }).catch(() => caches.match(event.request))
    );
  }
});
