// Vínculo entre zonas. Toda escritura que cambia la vida de la persona (hábitos,
// Coliseo, comidas, Recreación, sueño, finanzas…) pasa por lib/api, que la anuncia
// aquí. El HUD y el perfil se resincronizan y las vistas que resumen varias zonas
// (Inicio, Estadísticas, Life Score) se recargan solas, venga el cambio de la zona,
// del botón rápido, de la paleta de comandos o del Sabio.
import { useEffect, useRef } from 'react';

const EVENT = 'lq:life-changed';
/** Escrituras que no tocan las zonas de vida: sesión, chat del Sabio, avisos, red social, pagos, la Libreta (se guarda sola al escribir)… */
const NOT_LIFE = new Set(['auth', 'sage', 'notifications', 'social', 'billing', 'cron', 'feedback', 'search', 'export', 'shares', 'notebooks']);
/** Latidos en segundo plano (actividad para detectar el sueño): no son registros de la persona. */
const BACKGROUND = /^\/?sleep\/(?:activity|suggestion)\b/;
const ALIAS: Record<string, string> = { gym: 'coliseo', workouts: 'coliseo', meals: 'nutrition' };

let generation = 0;

/** Zona de una URL de la API (`/habits/1/log` → `habits`), o null si no es de vida. */
export function lifeZoneOf(url: string): string | null {
  const path = url.replace(/^https?:\/\/[^/]+/, '').replace(/^\/?api\/v1/, '');
  if (BACKGROUND.test(path)) return null;
  const segment = path.split(/[/?#]/).find(Boolean);
  if (!segment || NOT_LIFE.has(segment)) return null;
  return ALIAS[segment] ?? segment;
}

/** Sube cada vez que algo cambia: quien lee datos sabe si su lectura ya es vieja. */
export const lifeGeneration = () => generation;

export function announceLifeChange(zone: string): void {
  generation += 1;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { zone } }));
}

/** Llama a `onChange` cuando cambia cualquier zona, agrupando ráfagas de escrituras. */
export function useLifeChange(onChange: (zone: string) => void, delayMs = 350): void {
  const ref = useRef(onChange);
  ref.current = onChange;
  useEffect(() => {
    let timer: number | undefined;
    const handler = (event: Event) => {
      const zone = (event as CustomEvent<{ zone: string }>).detail?.zone ?? '';
      window.clearTimeout(timer);
      timer = window.setTimeout(() => ref.current(zone), delayMs);
    };
    window.addEventListener(EVENT, handler);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.clearTimeout(timer);
    };
  }, [delayMs]);
}
