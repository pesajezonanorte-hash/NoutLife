// Lo que una zona que se prepara oculta (layout/RouteStage) le dice al relevo: «aún no estoy lista».
// Hay dos señales: un cargador montado y una lectura de la API en curso, para las zonas que no
// pintan cargador y solo se rellenan al llegar los datos.
import { createContext, useContext, useLayoutEffect } from 'react';

export interface RoutePending {
  /** Retiene el relevo hasta llamar a la función que devuelve. */
  hold: () => () => void;
}

export const RoutePendingContext = createContext<RoutePending | null>(null);

/** Mientras `active`, la zona que se prepara no se revela (fuera de una preparación no hace nada). */
export function useRoutePending(active = true) {
  const stage = useContext(RoutePendingContext);
  useLayoutEffect(() => (active && stage ? stage.hold() : undefined), [active, stage]);
}

/** Lecturas de fondo: no son de la pantalla que se abre, así que no la retienen. */
const BACKGROUND = /^\/?(?:auth|social\/live|social\/pulse|notifications|sleep\/activity|billing|notebooks\/[^/]+\/pages)\b/;

const running = new Set<object>();
const watchers = new Set<{ since: Set<object>; onChange: () => void }>();

/** Avisa de una lectura que empieza; llama a lo que devuelve al terminar. */
export function trackRead(url: string): () => void {
  const path = url.replace(/^https?:\/\/[^/]+/, '').replace(/^\/?api\/v1/, '');
  if (BACKGROUND.test(path)) return () => undefined;
  const token = {};
  running.add(token);
  return () => {
    running.delete(token);
    watchers.forEach((w) => { if (w.since.delete(token)) w.onChange(); });
  };
}

/** Observa las lecturas que empiecen desde ahora (las de antes son de la zona que se va). */
export function watchReads(onChange: () => void) {
  const before = new Set(running);
  const since = new Set<object>();
  const watcher = { since, onChange };
  watchers.add(watcher);
  const collect = () => { running.forEach((t) => { if (!before.has(t)) since.add(t); }); };
  return {
    pending: () => { collect(); return since.size; },
    stop: () => { watchers.delete(watcher); },
  };
}
