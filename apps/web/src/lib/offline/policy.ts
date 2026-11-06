// Qué se guarda en el dispositivo y cómo se lee. Lógica pura: sin red ni almacenamiento.

/** none: siempre a la red. network: red primero, y lo guardado si no hay red. swr: lo guardado al instante y la red por detrás. */
export type ReadMode = 'none' | 'network' | 'swr';

/** La ruta de la API sin el dominio ni el prefijo: `/habits?days=7`. */
export function toPath(url: string): string {
  const path = url.replace(/^https?:\/\/[^/]+/, '').replace(/^\/?api\/v1(?=\/|$)/, '');
  return path.startsWith('/') ? path : `/${path}`;
}

export const pathnameOf = (path: string) => path.split('?')[0];
export const queryOf = (path: string) => new URLSearchParams(path.split('?')[1] ?? '');

/** Sesión, pagos y lo que depende del servidor al momento: una copia vieja aquí engañaría. */
const NEVER = /^\/(?:auth|billing|rewards|admin|social\/live|social\/pulse|sage|search|export|cron|feedback|nutrition\/ai-|notifications\/(?:unread-count|vapid-public-key))(?:[/?-]|$)/;

/**
 * Se muestran al instante desde lo guardado. Sus páginas se actualizan solas cuando llega lo nuevo
 * (useFreshData): añadir aquí una ruta sin eso dejaría la pantalla con datos viejos hasta la siguiente visita.
 */
const SWR = [
  /^\/dashboard$/,
  /^\/life\/score$/,
  /^\/agenda\/upcoming$/,
  /^\/agenda\?/,
  /^\/habits$/,
  /^\/habits\/[^/?]+\/heatmap\?/,
  /^\/anti-habits$/,
  /^\/rituals$/,
  /^\/social\/streaks\/revival$/,
  /^\/quests(?:\?|$)/,
  /^\/notebooks$/,
];

export function readMode(path: string): ReadMode {
  if (NEVER.test(path)) return 'none';
  return SWR.some((re) => re.test(path)) ? 'swr' : 'network';
}

/** Datos de salud: viven en memoria mientras la app está abierta, nunca en el disco del dispositivo. */
const MEMORY_ONLY = /^\/cycle(?:[/?]|$)/;
export const isPersistable = (path: string) => !MEMORY_ONLY.test(path);

/** Tope por respuesta: una imagen pegada en la libreta pesa más que todo lo demás. */
export const maxBodyBytes = (path: string) => (/^\/notebooks\/[^/]+\/images\//.test(path) ? 4_000_000 : 1_500_000);

/** Las vistas que resumen varias zonas dependen de cualquier escritura. */
const DERIVED = /^\/(?:dashboard|life|stats|history|achievements|users|season|leaderboard)(?:[/?]|$)/;

/** Zona de una ruta: una escritura obliga a releer de la red las lecturas de su misma zona. */
export function zoneOfPath(path: string): string {
  if (DERIVED.test(path)) return '*';
  return pathnameOf(path).split('/').filter(Boolean)[0] ?? '*';
}

/** Hasta aquí una lectura guardada no se vuelve a pedir: varias pantallas leen lo mismo al abrirse. */
export const FRESH_MS = 15_000;
/** Más vieja que esto, con red, no se muestra: se espera a la red (sin red se muestra lo que haya). */
export const SWR_MAX_AGE_MS = 24 * 60 * 60_000;
/** Con algo guardado, la red tiene este tiempo para responder (red lenta): después se muestra lo guardado. */
export const READ_DEADLINE_MS = 4_000;
/** Una escritura que admite cola no espera más que esto: entra en la cola y la app sigue. */
export const WRITE_DEADLINE_MS = 8_000;

export const dayKey = (at: number | Date) => {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
