// El motor sin conexión vive en el adaptador de axios: las 39 capas de servicios y las páginas siguen
// llamando a la API igual, y aquí se decide si la respuesta sale de la red, de lo guardado o de la cola.
//
//   Lectura   → sin conexión, lo guardado. Con conexión, según policy: al instante desde lo guardado y la
//               red por detrás (si algo cambió, avisa a la pantalla), o red primero con lo guardado de respaldo.
//   Escritura → si admite cola (writes.ts) y no hay conexión, entra en la cola y responde ya, con la misma
//               forma que la API. Se envía en orden en cuanto vuelve la conexión.
import axios, { AxiosError, AxiosHeaders, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../../store/authStore';
import { lifeZoneOf } from '../lifeSync';
import { Lru } from '../lru';
import { trackRead } from '../routeStage';
import { isOnline, markOffline, markOnline, useConnectivity } from './connectivity';
import { announceFresh } from './fresh';
import {
  FRESH_MS, READ_DEADLINE_MS, SWR_MAX_AGE_MS, WRITE_DEADLINE_MS, isPersistable, maxBodyBytes, pathnameOf, readMode, toPath, zoneOfPath,
} from './policy';
import * as store from './store';
import {
  bodyForSend, createdIdOf, fallbackFrom, findWrite, forNewDay, overlayWrites, type QueuedWrite, type WriteContext,
} from './writes';

declare module 'axios' {
  export interface AxiosRequestConfig {
    /** Reenvío de una escritura de la cola: va directo a la red. */
    offlineReplay?: boolean;
  }
}

interface Hooks {
  /** Reenvía una escritura por el cliente normal (con su sesión y sus reintentos). */
  send: (request: { method: string; url: string; data?: unknown; headers?: Record<string, string>; offlineReplay: true }) => Promise<AxiosResponse>;
  /** Antes de salir a la red: espera a que la sesión esté lista y pone el token. */
  beforeNetwork: (config: InternalAxiosRequestConfig) => Promise<void>;
  /** Renueva la sesión y devuelve el token nuevo (para lo que va por detrás, sin pasar por los interceptores). */
  renew: () => Promise<string>;
}

let hooks: Hooks | null = null;
export const configureOffline = (next: Hooks) => { hooks = next; };

const userId = () => {
  const id = useAuthStore.getState().user?.id;
  return id ? String(id) : null;
};
const newId = () => `offline-${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
const newKey = () => newId().replace('offline-', '');
const OFFLINE_ID = /offline-[0-9a-z]{8}[0-9a-z-]*/gi;
const hasOfflineId = (text: string) => text.search(OFFLINE_ID) >= 0;

const pathOf = (config: InternalAxiosRequestConfig) => toPath(axios.getUri({ url: config.url, params: config.params, paramsSerializer: config.paramsSerializer }));
const networkFailed = (error: unknown) => axios.isAxiosError(error) && !error.response && error.code !== AxiosError.ERR_CANCELED;
const parse = (body: string): unknown => { try { return JSON.parse(body); } catch { return undefined; } };

function respond(config: InternalAxiosRequestConfig, data: unknown, status = 200, header?: string): AxiosResponse {
  const headers = new AxiosHeaders({ 'content-type': 'application/json' });
  if (header) headers.set(header, '1');
  return { data: JSON.stringify(data ?? null), status, statusText: 'OK', headers, config, request: {} };
}

/* ─── Lecturas guardadas ─── */

const recent = new Lru<store.StoredRead>(200);

async function saved(key: string): Promise<store.StoredRead | undefined> {
  const hit = recent.get(key);
  if (hit) return hit;
  const entry = await store.getRead(key);
  if (entry) recent.set(key, entry);
  return entry;
}

function keep(user: string, path: string, body: unknown, at: number) {
  if (typeof body !== 'string' || body.length > maxBodyBytes(path)) return;
  const entry: store.StoredRead = { key: store.readKey(user, path), userId: user, path, body, at };
  recent.set(entry.key, entry);
  if (isPersistable(path)) void store.putRead(entry);
}

/** Lo que ve la persona: lo guardado, ajustado si ya es otro día, y lo pendiente encima. */
function view(path: string, entry: store.StoredRead | undefined, now = Date.now()): unknown {
  const data = entry ? forNewDay(path, parse(entry.body), entry.at, now) : undefined;
  return overlayWrites(path, data, queue, now);
}

/** Sin conexión: la copia exacta o, si no la hay, armada con otras de la misma colección. */
async function offlineView(user: string, path: string, entry: store.StoredRead | undefined): Promise<unknown> {
  if (entry) return view(path, entry);
  const others = await store.scanReads(user, `${pathnameOf(path)}?`);
  const built = fallbackFrom(path, others.map((o) => ({ path: o.path, data: parse(o.body) })));
  if (built !== undefined) return overlayWrites(path, built, queue, Date.now());
  // Sin nada guardado, lo pendiente puede bastar (lo recién creado sin conexión).
  return overlayWrites(path, undefined, queue, Date.now());
}

/* ─── Escrituras recientes ─── */

/** Cuándo se escribió por última vez en cada zona: una lectura anterior ya no sirve para mostrarla al instante. */
let lastWrites: Record<string, number> = {};
const BACKGROUND_WRITE = /^\/(?:sleep\/activity|sleep\/suggestion|social\/presence|notifications\/event)/;

function noteWrite(path: string) {
  if (BACKGROUND_WRITE.test(path)) return;
  const now = Date.now();
  lastWrites[zoneOfPath(path)] = now;
  if (lifeZoneOf(path)) lastWrites['*'] = now;
  void store.setMeta('lastWrites', lastWrites);
}

const staleByWrite = (path: string, entry: store.StoredRead) => entry.at < (lastWrites[zoneOfPath(path)] ?? 0);

/* ─── Cola ─── */

/** Más que esto sin poder enviarse (una cuenta que no volvió a este dispositivo): se descarta. */
const MAX_QUEUED_MS = 30 * 24 * 60 * 60_000;
let queue: QueuedWrite[] = [];
let queueOwner: string | null = null;
let queueReady: Promise<void> | null = null;
let idMap: Record<string, string> = {};
const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('lq-offline');

const publish = () => useConnectivity.setState({ pending: queue.length });

function ensureQueue(user: string): Promise<void> {
  if (queueOwner === user && queueReady) return queueReady;
  queueOwner = user;
  queueReady = (async () => {
    const [items, map, writes] = await Promise.all([store.listWrites(user), store.getMeta<Record<string, string>>(`idMap:${user}`), store.getMeta<Record<string, number>>('lastWrites')]);
    const expired = items.filter((w) => Date.now() - w.at > MAX_QUEUED_MS);
    for (const write of expired) if (write.id !== undefined) void store.deleteWrite(write.id);
    queue = items.filter((w) => !expired.includes(w));
    idMap = map ?? {};
    lastWrites = { ...writes, ...lastWrites };
    publish();
  })();
  return queueReady;
}

// Otra pestaña cambió la cola: se relee para que sus cambios también se vean aquí.
if (channel) {
  channel.onmessage = () => {
    if (!queueOwner) return;
    void store.listWrites(queueOwner).then((items) => { queue = items; publish(); announceFresh(null); });
  };
}

const swapIds = (text: string) => text.replace(OFFLINE_ID, (id) => idMap[id] ?? id);

async function enqueue(config: InternalAxiosRequestConfig, user: string, path: string, body: Record<string, unknown> | null, key = newKey()): Promise<AxiosResponse> {
  const found = findWrite(String(config.method).toLowerCase(), path)!;
  const now = Date.now();
  const context: WriteContext = {
    user: useAuthStore.getState().user as unknown as Record<string, unknown> | null,
    queue,
    now,
    newId,
    read: async (p) => view(p, await saved(store.readKey(user, p)), now),
  };
  const plan = await found.def.plan(context, found.match, body ?? {});

  for (const gone of plan.removes ?? []) {
    queue = queue.filter((w) => w !== gone);
    if (gone.id !== undefined) void store.deleteWrite(gone.id);
  }
  if (plan.merges) {
    const { into, body: merged } = plan.merges;
    into.body = merged;
    if (into.extra?.entity) into.extra = { ...into.extra, entity: { ...(into.extra.entity as object), ...merged } };
    void store.putWrite(into);
  }
  if (plan.write) {
    const write: QueuedWrite = {
      userId: user, kind: found.def.kind, method: found.def.method, path, at: now, key,
      target: plan.write.target, body: plan.write.body, extra: plan.write.extra,
    };
    const stored = await store.addWrite(write);
    queue = [...queue, stored];
  }
  noteWrite(path);
  publish();
  channel?.postMessage('queue');
  return respond(config, plan.response, plan.status ?? 200, 'x-offline-queued');
}

/* ─── Sincronización ─── */

/** Espera antes de reintentar lo que no se pudo enviar (servidor caído, red que va y viene). */
const RETRY_MS = [15_000, 60_000, 300_000];
let retryStep = 0;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let flushing: Promise<void> | null = null;

function scheduleRetry() {
  if (retryTimer !== undefined) clearTimeout(retryTimer);
  retryTimer = setTimeout(() => { retryTimer = undefined; void flushWrites(); }, RETRY_MS[Math.min(retryStep, RETRY_MS.length - 1)]);
  retryStep += 1;
}

async function applyIds(temp: string, real: string, user: string) {
  idMap[temp] = real;
  void store.setMeta(`idMap:${user}`, idMap);
  // Lo que seguía en la cola con el id temporal ya puede enviarse con el real.
  await Promise.all(queue.map((write) => {
    const text = JSON.stringify(write);
    if (!text.includes(temp)) return undefined;
    const next = JSON.parse(text.split(temp).join(real)) as QueuedWrite;
    Object.assign(write, next);
    return store.putWrite(write);
  }));
}

async function sendQueue(user: string) {
  queue = await store.listWrites(user);
  publish();
  if (!queue.length) return;
  useConnectivity.setState({ syncing: true });
  let progressed = false;
  for (const write of [...queue]) {
    if (!isOnline()) break;
    const headers: Record<string, string> = {};
    // Si la respuesta se perdió y se reenvía, el servidor no la aplica dos veces.
    if (write.method === 'post') headers['Idempotency-Key'] = write.key;
    const body = bodyForSend(write, Date.now());
    try {
      const response = await hooks!.send({ method: write.method, url: write.path, data: body ?? undefined, headers, offlineReplay: true });
      queue = queue.filter((w) => w !== write);
      if (write.id !== undefined) await store.deleteWrite(write.id);
      const created = createdIdOf(write.kind, typeof response.data === 'string' ? parse(response.data) : response.data);
      if (created && write.target) await applyIds(write.target, created, user);
      progressed = true;
      retryStep = 0;
      publish();
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      // La sesión, el servidor o la red: se reintenta después, sin perder nada.
      if (status === undefined || status === 401 || status === 403 || status === 408 || status === 425 || status === 429 || status >= 500) {
        scheduleRetry();
        break;
      }
      // Rechazada de verdad (ya no existe, límite del plan): no se reintenta para no bloquear las demás.
      // Borrar lo que ya no existe no es un fallo: es lo que se quería (el primer intento llegó y se perdió la respuesta).
      queue = queue.filter((w) => w !== write);
      if (write.id !== undefined) await store.deleteWrite(write.id);
      if (!(write.method === 'delete' && status === 404)) useConnectivity.setState((s) => ({ rejected: s.rejected + 1 }));
      progressed = true;
      publish();
    }
  }
  useConnectivity.setState({ syncing: false });
  if (progressed) {
    channel?.postMessage('queue');
    announceFresh(null);
  }
}

/** Envía lo pendiente, en orden, una sola pestaña a la vez. */
export function flushWrites(): Promise<void> {
  if (flushing) return flushing;
  const user = userId();
  if (!user || !hooks || !isOnline()) return Promise.resolve();
  const job = (): Promise<void> => ensureQueue(user).then(() => sendQueue(user));
  // Una sola pestaña envía: si otra ya está en ello, esta no hace nada.
  const running: Promise<void> = navigator.locks
    ? navigator.locks.request('lq-offline-flush', { ifAvailable: true }, async (lock) => { if (lock) await job(); }).then(() => undefined)
    : job();
  const current: Promise<void> = running.catch(() => undefined).finally(() => { flushing = null; });
  flushing = current;
  return current;
}

/* ─── Adaptador ─── */

export function offlineAdapter(base: AxiosAdapter): AxiosAdapter {
  const network: AxiosAdapter = async (config) => {
    await hooks?.beforeNetwork(config);
    try {
      const response = await base(config);
      markOnline();
      return response;
    } catch (error) {
      if (axios.isAxiosError(error) && error.code === AxiosError.ERR_NETWORK && readMode(pathOf(config)) !== 'none') markOffline();
      else if (axios.isAxiosError(error) && error.response) markOnline();
      throw error;
    }
  };

  const revalidating = new Set<string>();
  /** Pide a la red y guarda. Con `previous`, avisa a la pantalla si llegó algo distinto de lo que muestra. */
  async function fetchAndKeep(config: InternalAxiosRequestConfig, user: string, path: string, previous?: store.StoredRead) {
    const startedAt = Date.now();
    const response = await network(config);
    if (response.status === 200) keep(user, path, response.data, startedAt);
    if (previous && response.data !== previous.body) announceFresh(pathnameOf(path));
    return response;
  }

  function revalidate(config: InternalAxiosRequestConfig, user: string, path: string, previous: store.StoredRead) {
    if (revalidating.has(previous.key)) return;
    revalidating.add(previous.key);
    const copy = { ...config, signal: undefined };
    void fetchAndKeep(copy, user, path, previous)
      .catch(async (error: unknown) => {
        // Sesión vencida: lo que se muestra sigue siendo válido; se renueva y se pregunta otra vez.
        if (!axios.isAxiosError(error) || error.response?.status !== 401 || !hooks) return undefined;
        copy.headers.set('Authorization', `Bearer ${await hooks.renew()}`);
        return fetchAndKeep(copy, user, path, previous);
      })
      .catch(() => undefined)
      .finally(() => revalidating.delete(previous.key));
  }

  const withPending = (config: InternalAxiosRequestConfig, path: string, response: AxiosResponse) => {
    if (!queue.length || typeof response.data !== 'string') return response;
    return { ...response, data: JSON.stringify(overlayWrites(path, parse(response.data), queue, Date.now())) };
  };

  async function read(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
    const user = userId();
    const mode = readMode(pathOf(config));
    if (mode === 'none' || !user) return network(config);
    await ensureQueue(user);

    // Creado sin conexión y ya sincronizado: la pantalla aún puede tener el id temporal.
    if (hasOfflineId(String(config.url))) config.url = swapIds(String(config.url));
    const path = pathOf(config);
    const entry = await saved(store.readKey(user, path));

    // Creado sin conexión y aún sin sincronizar: el servidor todavía no lo conoce.
    if (hasOfflineId(path)) return respond(config, view(path, entry) ?? {});

    if (!isOnline()) {
      const data = await offlineView(user, path, entry);
      if (data !== undefined) return respond(config, data);
      throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config);
    }

    const now = Date.now();
    if (mode === 'swr' && entry && !staleByWrite(path, entry) && now - entry.at < SWR_MAX_AGE_MS) {
      if (now - entry.at >= FRESH_MS || entry.at < (lastWrites['*'] ?? 0)) revalidate(config, user, path, entry);
      return respond(config, view(path, entry));
    }

    const request = fetchAndKeep(config, user, path);
    try {
      if (!entry) return withPending(config, path, await request);
      // Red lenta: con algo guardado no se espera para siempre; lo que llegue después actualiza la pantalla.
      const slow = Symbol('slow');
      const winner = await Promise.race([request, new Promise<symbol>((r) => { setTimeout(() => r(slow), READ_DEADLINE_MS); })]);
      if (winner === slow) {
        request.then((late) => { if (late.data !== entry.body) announceFresh(pathnameOf(path)); }, () => undefined);
        return respond(config, view(path, entry));
      }
      return withPending(config, path, winner as AxiosResponse);
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      if (networkFailed(error) || (status !== undefined && status >= 500)) {
        const data = await offlineView(user, path, entry);
        if (data !== undefined) return respond(config, data);
      }
      throw error;
    }
  }

  async function write(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
    const method = String(config.method).toLowerCase();
    const raw = pathOf(config);
    // Lo creado sin conexión que ya se sincronizó: la pantalla aún puede tener el id temporal.
    const path = hasOfflineId(raw) ? swapIds(raw) : raw;
    if (path !== raw) config.url = swapIds(String(config.url));
    if (typeof config.data === 'string' && hasOfflineId(config.data)) config.data = swapIds(config.data);

    const user = userId();
    const found = user && !config.offlineReplay ? findWrite(method, path) : null;
    const body = found && config.data !== undefined ? parse(String(config.data)) : null;
    if (!found || !user || body === undefined) {
      const response = await network(config);
      noteWrite(path);
      return response;
    }

    await ensureQueue(user);
    const data = body as Record<string, unknown> | null;
    // Nunca adelantar a lo que ya está en la cola: el servidor debe verlo en el orden en que pasó.
    if (!isOnline() || queue.length > 0 || hasOfflineId(path) || (typeof config.data === 'string' && hasOfflineId(config.data))) {
      if (isOnline()) void flushWrites();
      return enqueue(config, user, path, data);
    }

    const stop = new AbortController();
    const direct = config.signal ? config : { ...config, signal: stop.signal };
    const timer = config.signal ? undefined : setTimeout(() => stop.abort(), WRITE_DEADLINE_MS);
    const key = newKey();
    if (found.def.method === 'post') direct.headers.set('Idempotency-Key', key);
    try {
      const response = await network(direct);
      noteWrite(path);
      return response;
    } catch (error) {
      // Mismo identificador en el reenvío: si este intento sí llegó, el servidor no lo aplica dos veces.
      if (networkFailed(error) || (stop.signal.aborted && !config.signal)) return enqueue(config, user, path, data, key);
      throw error;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  return async (config) => {
    if (String(config.method).toLowerCase() !== 'get') return write(config);
    // La zona que se prepara espera sus lecturas antes de revelarse (layout/RouteStage).
    const done = trackRead(pathOf(config));
    try { return await read(config); } finally { done(); }
  };
}

/* ─── Mantenimiento ─── */

// Al salir de la cuenta, lo guardado no se queda para la siguiente persona (lo avisa authStore).
if (typeof window !== 'undefined') window.addEventListener('lq:signed-out', () => void wipeReads());

/** Borra lo guardado de esta cuenta (al cerrar sesión o reiniciarla). La cola se conserva por si vuelve a entrar. */
export async function wipeReads(): Promise<void> {
  recent.clear();
  try { localStorage.removeItem('lq-offline-warmed'); localStorage.removeItem('lq-offline-warmed-wide'); } catch { /* sin storage */ }
  queue = [];
  queueOwner = null;
  queueReady = null;
  lastWrites = {};
  publish();
  await store.clearReads();
  await store.setMeta('lastWrites', {});
}

/** ¿Hay copia reciente de esta lectura? Para no volver a pedir lo que ya está guardado. */
export async function hasRecentCopy(path: string, maxAgeMs: number): Promise<boolean> {
  const user = userId();
  if (!user) return false;
  const entry = await saved(store.readKey(user, path));
  return Boolean(entry) && Date.now() - entry!.at < maxAgeMs;
}
