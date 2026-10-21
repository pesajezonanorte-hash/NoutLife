// Analítica del embudo (plan v3, T1): PostHog por su API HTTP de captura, sin SDK.
// Sin VITE_POSTHOG_KEY no se envía nada (en desarrollo se ve en la consola).
// Límite de privacidad: nunca va contenido de Ciclo, Diario, Libreta ni montos de
// Finanzas; los eventos llevan solo nombres de pasos, opciones y la atribución.
const KEY = import.meta.env.VITE_POSTHOG_KEY;
const HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';
const ANON_KEY = 'lq_anon_id';
const ATTR_KEY = 'lq_attr';
const ATTR_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'ref'] as const;

const read = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* sin storage */ } };

let userId: string | null = null;

function anonId(): string {
  let id = read(ANON_KEY);
  if (!id) { id = crypto.randomUUID(); write(ANON_KEY, id); }
  return id;
}

/** Atribución del primer toque (UTM y ref): se guarda la primera vez que llegan. */
export function attribution(): Record<string, string> {
  try { return JSON.parse(read(ATTR_KEY) ?? '{}'); } catch { return {}; }
}

export function captureAttribution() {
  const query = new URLSearchParams(location.search);
  const found = Object.fromEntries(ATTR_PARAMS.map((k) => [k, query.get(k)]).filter(([, v]) => v));
  if (Object.keys(found).length && !read(ATTR_KEY)) write(ATTR_KEY, JSON.stringify(found));
}

export function track(event: string, properties: Record<string, unknown> = {}) {
  const props = { ...attribution(), ...properties, $current_url: location.origin + location.pathname };
  if (!KEY) {
    if (import.meta.env.DEV) console.debug('[track]', event, props);
    return;
  }
  // text/plain evita el preflight de CORS; keepalive deja salir el evento aunque la página cambie.
  fetch(`${HOST}/i/v0/e/`, {
    method: 'POST',
    keepalive: true,
    body: JSON.stringify({ api_key: KEY, event, distinct_id: userId ?? anonId(), properties: props, timestamp: new Date().toISOString() }),
  }).catch(() => { /* la analítica nunca rompe la app */ });
}

/** Une la visita anónima con la cuenta (una vez por sesión). */
export function identify(id: string, set: Record<string, unknown> = {}) {
  if (userId === id) return;
  userId = id;
  track('$identify', { $anon_distinct_id: anonId(), $set_once: attribution(), $set: set });
}

export function resetIdentity() {
  userId = null;
}
