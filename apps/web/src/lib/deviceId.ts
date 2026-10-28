// Id estable del dispositivo, en tres capas para que limpiar una no lo cambie:
// localStorage e IndexedDB aquí, y una cookie HttpOnly/Secure que fija la API
// (el JS no la ve). La API prefiere su cookie y devuelve el id en la cabecera
// X-Device-Id; rememberDeviceId lo copia a las capas locales. Solo sirve para
// auditar pruebas gratis: la decisión real la toma el servidor con el correo y
// el medio de pago. Settings lo conserva al reiniciar o eliminar la cuenta.
import { withTimeout } from './timeout';

const KEY = 'lq_device_id';
/** Si IndexedDB no responde (perfil bloqueado, modo privado), no se espera más: se usa un id nuevo. */
const IDB_TIMEOUT_MS = 1500;

const newId = (): string => globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

/** Una operación sobre el almacén clave-valor de IndexedDB ('noutlife' → 'kv'). */
function idb<T>(run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('noutlife', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('kv');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const req = run(db.transaction('kv', 'readwrite').objectStore('kv'));
      req.onsuccess = () => { resolve(req.result); db.close(); };
      req.onerror = () => { reject(req.error); db.close(); };
    };
  });
}

let current: Promise<string> | null = null;

export function rememberDeviceId(id: string): void {
  current = Promise.resolve(id);
  try { localStorage.setItem(KEY, id); } catch { /* sin storage */ }
  idb((s) => s.put(id, KEY)).catch(() => null);
}

export function getDeviceId(): Promise<string> {
  current ??= (async () => {
    let id: string | null = null;
    try { id = localStorage.getItem(KEY); } catch { /* sin storage */ }
    id ||= await withTimeout(idb<string | undefined>((s) => s.get(KEY)), IDB_TIMEOUT_MS).catch(() => undefined) ?? null;
    id ||= newId();
    rememberDeviceId(id); // restaura la capa que faltara
    return id;
  })();
  return current;
}
