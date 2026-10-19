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

/** Opciones de aviso que la librería DOM del proyecto aún no declara (vibración y volver a alertar con la misma etiqueta). */
export type NotifyOptions = NotificationOptions & { vibrate?: number[]; renotify?: boolean };

/**
 * Aviso del sistema desde la propia app (p. ej. «descanso terminado» con la pantalla apagada).
 * Usa el service worker, que es el único que puede mostrar avisos en Android y en iPhone.
 */
export async function notifyLocal(title: string, options: NotifyOptions = {}) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const full: NotifyOptions = { icon: '/icons/icon-192.png', badge: '/icons/icon-96.png', vibrate: [200, 100, 200], ...options };
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (reg) await reg.showNotification(title, full);
    else new Notification(title, full);
  } catch {
    // Sin permiso o sin soporte: el aviso dentro de la app ya se oyó y vibró.
  }
}

/** Número en el icono de la app (Badging API): Android y iPhone con la app instalada. Sin soporte, no hace nada. */
export function syncAppBadge(count: number) {
  const nav = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
  const pending = count > 0 ? nav.setAppBadge?.(count) : nav.clearAppBadge?.();
  pending?.catch(() => undefined);
}

// ─── Avisos dentro de la app ───────────────────────────────────────────────────
// Con Noutlife a la vista, un recordatorio (push del servidor o programado por la
// pestaña) se muestra como nota dentro de la app, con una campana suave, en vez del
// aviso del sistema. Lo pinta components/ui/ReminderPings.

export interface InAppAlert {
  /** Misma etiqueta que el push: si llegan los dos, se ve uno. */
  tag: string;
  title: string;
  body: string;
  link?: string;
  quick?: 'habit_done' | 'water_250';
  quickRef?: string;
  day?: string;
  /** Poca importancia (agua, cita del día): campana más baja. */
  quiet?: boolean;
}

let alertSink: ((alert: InAppAlert) => boolean) | null = null;

/** Lo registra ReminderPings: devuelve true si mostró el aviso. */
export function onInAppAlert(sink: (alert: InAppAlert) => boolean) {
  alertSink = sink;
  return () => { if (alertSink === sink) alertSink = null; };
}

/** Muestra el aviso dentro de la app. false si no hay quién lo pinte (fuera del shell). */
export function showInAppAlert(alert: InAppAlert): boolean {
  return alertSink?.(alert) ?? false;
}

/** El service worker pregunta si la app, a la vista, muestra ella el aviso (y responde por el puerto). */
export function onServiceWorkerAlert() {
  if (!('serviceWorker' in navigator)) return () => undefined;
  const handler = (e: MessageEvent) => {
    const data = e.data as { type?: string; alert?: InAppAlert } | null;
    if (data?.type !== 'lq:in-app-alert' || !data.alert) return;
    const shown = document.visibilityState === 'visible' && showInAppAlert(data.alert);
    e.ports[0]?.postMessage({ shown });
  };
  navigator.serviceWorker.addEventListener('message', handler);
  return () => navigator.serviceWorker.removeEventListener('message', handler);
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
