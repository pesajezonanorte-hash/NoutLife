// Avisos del sistema (push) en este dispositivo: al abrir una carta se cierran los
// suyos (ya los estás leyendo) y, si tocas un aviso con la app abierta, el service
// worker le pide a la app que vaya a la carta o zona de la que viene.

/** Cierra los avisos de este dispositivo con esa etiqueta (p. ej. "dm:<amigo>"). */
export function closeSystemNotifications(tag: string) {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.getRegistration()
    .then((reg) => reg?.getNotifications({ tag }))
    .then((list) => list?.forEach((n) => n.close()))
    .catch(() => undefined);
}

/** Escucha al service worker: "lleva a la persona a este enlace" (sin recargar la app). */
export function onNotificationNavigate(go: (link: string) => void) {
  if (!('serviceWorker' in navigator)) return () => undefined;
  const handler = (e: MessageEvent) => {
    const data = e.data as { type?: string; link?: string } | null;
    if (data?.type === 'lq:navigate' && typeof data.link === 'string' && data.link.startsWith('/')) go(data.link);
  };
  navigator.serviceWorker.addEventListener('message', handler);
  return () => navigator.serviceWorker.removeEventListener('message', handler);
}

/** Responde al service worker qué carta está abierta (para no avisar de lo que ya estás viendo). */
export function answerOpenChat(current: () => string | null) {
  if (!('serviceWorker' in navigator)) return () => undefined;
  const handler = (e: MessageEvent) => {
    if ((e.data as { type?: string } | null)?.type === 'lq:which-chat') e.ports[0]?.postMessage({ key: current() });
  };
  navigator.serviceWorker.addEventListener('message', handler);
  return () => navigator.serviceWorker.removeEventListener('message', handler);
}
