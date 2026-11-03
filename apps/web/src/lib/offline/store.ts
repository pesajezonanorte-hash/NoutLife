// Almacén del dispositivo (IndexedDB): lecturas guardadas y escrituras pendientes. Si IndexedDB no está
// o no responde (modo privado, perfil bloqueado), todo sigue en memoria: la app funciona igual mientras
// esté abierta, solo que no sobrevive a un cierre.
import type { QueuedWrite } from './writes';

export interface StoredRead {
  key: string;
  userId: string;
  path: string;
  /** La respuesta tal cual llegó (texto): cada lectura la interpreta de nuevo, nadie comparte objetos. */
  body: string;
  /** Cuándo se pidió a la red. */
  at: number;
}

const DB_NAME = 'noutlife-offline';
const DB_VERSION = 1;
/** IndexedDB casi siempre responde en milisegundos; si no, se sigue sin él. */
const IDB_TIMEOUT_MS = 2000;
/** Tope de lecturas guardadas: al pasarse, se sueltan las más antiguas. */
const MAX_READS = 800;
const TRIM_EVERY = 40;

const memory = { reads: new Map<string, StoredRead>(), writes: new Map<number, QueuedWrite>(), meta: new Map<string, unknown>() };
let nextMemoryId = 1;
let database: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  if (database) return database;
  database = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') { resolve(null); return; }
    const timer = setTimeout(() => resolve(null), IDB_TIMEOUT_MS);
    const done = (db: IDBDatabase | null) => { clearTimeout(timer); resolve(db); };
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('reads')) db.createObjectStore('reads', { keyPath: 'key' }).createIndex('at', 'at');
        if (!db.objectStoreNames.contains('writes')) db.createObjectStore('writes', { keyPath: 'id', autoIncrement: true }).createIndex('userId', 'userId');
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
      };
      request.onerror = () => done(null);
      request.onblocked = () => done(null);
      request.onsuccess = () => {
        const db = request.result;
        // Otra pestaña con una versión nueva: se cierra para no bloquearla.
        db.onversionchange = () => { db.close(); database = null; };
        done(db);
      };
    } catch { done(null); }
  });
  return database;
}

function run<T>(name: 'reads' | 'writes' | 'meta', mode: IDBTransactionMode, job: (store: IDBObjectStore) => IDBRequest<T>, fallback: () => T): Promise<T> {
  return open().then((db) => {
    if (!db) return fallback();
    return new Promise<T>((resolve) => {
      const timer = setTimeout(() => resolve(fallback()), IDB_TIMEOUT_MS);
      try {
        const tx = db.transaction(name, mode);
        const request = job(tx.objectStore(name));
        request.onsuccess = () => { clearTimeout(timer); resolve(request.result); };
        request.onerror = () => { clearTimeout(timer); resolve(fallback()); };
        tx.onabort = () => { clearTimeout(timer); resolve(fallback()); };
      } catch {
        clearTimeout(timer);
        resolve(fallback());
      }
    });
  });
}

/* ─── Lecturas ─── */

export const readKey = (userId: string, path: string) => `${userId}|${path}`;

export const getRead = (key: string) => run<StoredRead | undefined>('reads', 'readonly', (s) => s.get(key), () => memory.reads.get(key));

let sinceTrim = 0;
export async function putRead(entry: StoredRead): Promise<void> {
  await run<IDBValidKey>('reads', 'readwrite', (s) => s.put(entry), () => { memory.reads.set(entry.key, entry); return entry.key; });
  if (++sinceTrim >= TRIM_EVERY) { sinceTrim = 0; void trimReads(); }
}

/** Las lecturas guardadas de una ruta para esa persona (`/agenda?…`). */
export function scanReads(userId: string, prefix: string): Promise<StoredRead[]> {
  const from = readKey(userId, prefix);
  return run<StoredRead[]>('reads', 'readonly', (s) => s.getAll(IDBKeyRange.bound(from, `${from}￿`)) as IDBRequest<StoredRead[]>, () => [...memory.reads.values()].filter((e) => e.key.startsWith(from)));
}

async function trimReads(): Promise<void> {
  const db = await open();
  if (!db) return;
  const total = await run<number>('reads', 'readonly', (s) => s.count(), () => 0);
  let extra = total - MAX_READS;
  if (extra <= 0) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction('reads', 'readwrite');
    const cursor = tx.objectStore('reads').index('at').openCursor();
    cursor.onsuccess = () => {
      const c = cursor.result;
      if (!c || extra <= 0) { resolve(); return; }
      c.delete();
      extra -= 1;
      c.continue();
    };
    cursor.onerror = () => resolve();
  });
}

export async function clearReads(): Promise<void> {
  memory.reads.clear();
  await run<undefined>('reads', 'readwrite', (s) => s.clear(), () => undefined);
}

/* ─── Escrituras pendientes ─── */

export function listWrites(userId: string): Promise<QueuedWrite[]> {
  return open().then((db) => {
    const fromMemory = () => [...memory.writes.values()].filter((w) => w.userId === userId);
    if (!db) return fromMemory();
    return run<QueuedWrite[]>('writes', 'readonly', (s) => s.index('userId').getAll(userId) as IDBRequest<QueuedWrite[]>, fromMemory)
      .then((items) => items.sort((a, b) => (a.id ?? 0) - (b.id ?? 0)));
  });
}

export async function addWrite(write: QueuedWrite): Promise<QueuedWrite> {
  const { id: _id, ...rest } = write;
  const db = await open();
  if (!db) {
    const id = nextMemoryId++;
    const saved = { ...rest, id };
    memory.writes.set(id, saved);
    return saved;
  }
  const id = await run<IDBValidKey>('writes', 'readwrite', (s) => s.add(rest), () => { const m = nextMemoryId++; memory.writes.set(m, { ...rest, id: m }); return m; });
  return { ...rest, id: Number(id) };
}

export async function putWrite(write: QueuedWrite): Promise<void> {
  if (write.id !== undefined && memory.writes.has(write.id)) memory.writes.set(write.id, write);
  await run<IDBValidKey>('writes', 'readwrite', (s) => s.put(write), () => write.id ?? 0);
}

export async function deleteWrite(id: number): Promise<void> {
  memory.writes.delete(id);
  await run<undefined>('writes', 'readwrite', (s) => s.delete(id), () => undefined);
}

/* ─── Datos sueltos ─── */

export const getMeta = <T>(key: string) => run<T | undefined>('meta', 'readonly', (s) => s.get(key) as IDBRequest<T | undefined>, () => memory.meta.get(key) as T | undefined);

export async function setMeta(key: string, value: unknown): Promise<void> {
  memory.meta.set(key, value);
  await run<IDBValidKey>('meta', 'readwrite', (s) => s.put(value, key), () => key);
}
