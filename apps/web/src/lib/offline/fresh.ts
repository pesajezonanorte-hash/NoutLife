// «Llegó algo más nuevo de lo que estás viendo.» Una lectura guardada se muestra al instante y la red
// responde por detrás: si cambió algo, la pantalla que la leyó se recarga sola, sin cargador.
import { useEffect, useRef } from 'react';

const EVENT = 'lq:data-fresh';

/** `path` null: puede haber cambiado todo (se acaba de sincronizar). */
export function announceFresh(path: string | null): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { path } }));
}

/** Llama a `onFresh` cuando cambian datos de esas rutas (`/habits`, `/agenda`…), agrupando ráfagas. */
export function useFreshData(prefixes: readonly string[], onFresh: () => void, delayMs = 120): void {
  const ref = useRef(onFresh);
  ref.current = onFresh;
  const key = prefixes.join();
  useEffect(() => {
    const list = key.split(',');
    let timer: number | undefined;
    const handler = (event: Event) => {
      const path = (event as CustomEvent<{ path: string | null }>).detail?.path;
      if (path !== null && !list.some((p) => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}?`))) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => ref.current(), delayMs);
    };
    window.addEventListener(EVENT, handler);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.clearTimeout(timer);
    };
  }, [key, delayMs]);
}
