// ¿Hay conexión de verdad? navigator.onLine solo sabe si hay una red, no si llega a internet (wifi sin
// salida, servidor caído): una lectura que falla también cuenta, y un sondeo liviano dice cuándo volvió.
import { create } from 'zustand';

interface ConnectivityState {
  /** La app cree que puede hablar con la API. */
  online: boolean;
  /** Escrituras esperando para sincronizarse. */
  pending: number;
  syncing: boolean;
  /** Escrituras que el servidor rechazó al sincronizar (no se pudieron guardar). */
  rejected: number;
}

const startOnline = typeof navigator === 'undefined' || navigator.onLine !== false;

export const useConnectivity = create<ConnectivityState>(() => ({ online: startOnline, pending: 0, syncing: false, rejected: 0 }));

/** Cada cuánto se sondea la API si parece caída. */
const PROBE_MS = 20_000;

let probeUrl: string | null = null;
let probeTimer: ReturnType<typeof setTimeout> | undefined;
const backListeners = new Set<() => void>();

/** Llama a `listener` cada vez que vuelve la conexión. */
export function onBackOnline(listener: () => void): () => void {
  backListeners.add(listener);
  return () => { backListeners.delete(listener); };
}

export const isOnline = () => useConnectivity.getState().online;

function stopProbing() {
  if (probeTimer !== undefined) clearTimeout(probeTimer);
  probeTimer = undefined;
}

function scheduleProbe(delay = PROBE_MS) {
  stopProbing();
  if (!probeUrl) return;
  probeTimer = setTimeout(() => {
    probeTimer = undefined;
    void probe();
  }, delay);
}

async function probe() {
  if (!probeUrl || navigator.onLine === false) { scheduleProbe(); return; }
  try {
    const res = await fetch(probeUrl, { method: 'GET', cache: 'no-store', credentials: 'omit' });
    if (res.ok || res.status < 500) { markOnline(); return; }
  } catch { /* sigue caída */ }
  scheduleProbe();
}

export function markOffline() {
  if (useConnectivity.getState().online) useConnectivity.setState({ online: false });
  if (probeTimer === undefined) scheduleProbe();
}

export function markOnline() {
  stopProbing();
  if (useConnectivity.getState().online) return;
  useConnectivity.setState({ online: true });
  backListeners.forEach((listener) => listener());
}

/** Escucha los cambios de red del sistema. `url`: una lectura pública y liviana de la API. */
export function startConnectivity(url: string) {
  if (typeof window === 'undefined') return;
  probeUrl = url;
  window.addEventListener('online', () => void probe());
  window.addEventListener('offline', markOffline);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !useConnectivity.getState().online) void probe();
  });
  if (!startOnline) scheduleProbe();
}
