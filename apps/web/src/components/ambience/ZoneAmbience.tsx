// Capa de ambiente de una zona: vive detrás del contenido, no recibe eventos,
// es invisible para lectores de pantalla y se detiene cuando no se ve (fuera
// del viewport o con la pestaña oculta). Cada zona aporta su propio contenido:
//
//   <ZoneAmbience zone="habits" view={<Polvo />}>      ← recorre toda la zona
//     <LuzDePapel />                                    ← (texturas, luces fijas)
//   </ZoneAmbience>
//
// Con scope="page" sangra hasta el padding de <main>; el contenido de la zona
// debe ir después y posicionado (relative) para pintarse encima sin crear un
// contexto de apilamiento (los diálogos sin portal siguen por encima de todo).
// `view` es una ventana sticky de 100svh que acompaña al scroll.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useMotionStore } from '@/store/motionStore';

export interface ZoneAmbienceProps {
  /** Nombre de la zona (data-zone), útil para estilos y depuración. */
  zone: string;
  /** page: detrás de toda la zona · local: llena su contenedor posicionado. */
  scope?: 'page' | 'local';
  /** Capa que recorre toda la altura (texturas, luces sobre el contenido). */
  children?: ReactNode;
  /** Capa que acompaña al scroll (luz de ambiente, partículas). */
  view?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** Pausa por viewport y por visibilidad de la pestaña. */
function usePaused<T extends Element>() {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(true);
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || !document.hidden);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: '120px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    const on = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  return { ref, paused: !inView || !visible };
}

export function ZoneAmbience({ zone, scope = 'page', children, view, className, style }: ZoneAmbienceProps) {
  const { ref, paused } = usePaused<HTMLDivElement>();
  const reduce = useMotionStore((s) => s.reduce);
  return (
    <div
      ref={ref}
      aria-hidden="true"
      data-zone={zone}
      data-paused={paused || undefined}
      data-reduce={reduce || undefined}
      className={cn('lq-amb', scope === 'page' ? 'lq-amb-page' : 'lq-amb-local', className)}
      style={style}
    >
      {children}
      {view && <div className="lq-amb-view">{view}</div>}
    </div>
  );
}

/* ───────── Presupuesto de partículas según el dispositivo ───────── */

/** Factor 0–1 según núcleos, memoria, ahorro de datos, puntero táctil y ancho de pantalla. */
function deviceFactor() {
  if (typeof window === 'undefined') return 1;
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  let f = 1;
  if ((nav.hardwareConcurrency ?? 8) <= 4) f *= 0.5;
  if ((nav.deviceMemory ?? 8) <= 4) f *= 0.6;
  if (nav.connection?.saveData) f *= 0.4;
  if (window.matchMedia('(pointer: coarse)').matches) f *= 0.7;
  if (window.innerWidth < 640) f *= 0.75;
  return f;
}

/** `budget(18)` → cuántas partículas caben en este dispositivo (mínimo 1). */
export function useParticleBudget() {
  const [f] = useState(deviceFactor);
  return (n: number) => Math.max(1, Math.round(n * f));
}
