// Indicador de la pestaña activa, común a la barra del móvil (eje X) y a la lateral (eje Y). Es una
// pieza de clay en CSS que se desliza solo con transform; cuando el navegador está libre se descarga
// el canto rodado 3D de verdad, que sube encima y lleva el ícono con volumen. Sin WebGL, con
// «Ahorro de datos», con 2G o si el modelo no carga, se queda la pieza de CSS.
//
//   <nav ref={rootRef}>…<a aria-current="page"><span data-nav-slot><svg data-nav-icon/></span></a>…</nav>
//   <NavPebble root={rootRef} active={pathname} axis="x" />
import { Suspense, lazy, useEffect, useLayoutEffect, useMemo, useState, type RefObject } from 'react';
import { cn } from '@/lib/utils';
import { hasWebGL2 } from '@/components/three3d/near';

const NavPebble3D = lazy(() => import('./NavPebble3D'));

const PAD = 18; // px de lienzo alrededor del canto: sombra y estirón del viaje

interface Slot {
  x: number;
  y: number;
  w: number;
  h: number;
  icon: SVGSVGElement | null;
}

function useSlot(root: RefObject<HTMLElement>, active: string): Slot | null {
  const [slot, setSlot] = useState<Slot | null>(null);
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return undefined;
    const measure = () => {
      const target = el.querySelector<HTMLElement>('[aria-current="page"] [data-nav-slot]');
      setSlot((prev) => {
        if (!target) return prev === null ? prev : null;
        const r = el.getBoundingClientRect();
        const b = target.getBoundingClientRect();
        // El ancho de la caja se mide sin escala: los íconos llevan transiciones de transform.
        const next: Slot = {
          x: b.left - r.left + el.scrollLeft,
          y: b.top - r.top + el.scrollTop,
          w: target.offsetWidth,
          h: target.offsetHeight,
          icon: target.closest('[aria-current="page"]')?.querySelector<SVGSVGElement>('svg[data-nav-icon]') ?? null,
        };
        return prev && prev.x === next.x && prev.y === next.y && prev.w === next.w && prev.h === next.h && prev.icon === next.icon ? prev : next;
      });
    };
    measure();
    // Las secciones que se pliegan cambian el alto del contenido, no el del contenedor.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    Array.from(el.children).forEach((child) => ro.observe(child));
    return () => ro.disconnect();
  }, [root, active]);
  return slot;
}

export interface NavPebbleProps {
  root: RefObject<HTMLElement>;
  /** Cambia con cada navegación: vuelve a medir. */
  active: string;
  axis: 'x' | 'y';
  /** La barra existe en esta medida de pantalla: si no, ni se descarga el 3D. */
  enabled?: boolean;
  className?: string;
}

export function NavPebble({ root, active, axis, enabled = true, className }: NavPebbleProps) {
  const slot = useSlot(root, active);
  const [load, setLoad] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [placed, setPlaced] = useState(false);

  // Medir fuerza un cálculo de estilo: sin esto, al cargar el canto llegaría volando desde la esquina.
  useEffect(() => {
    if (!slot || placed) return undefined;
    const id = requestAnimationFrame(() => setPlaced(true));
    return () => cancelAnimationFrame(id);
  }, [slot, placed]);

  // Después de la primera pintura y sin competir con la carga de la página.
  useEffect(() => {
    if (!enabled || load || !hasWebGL2()) return undefined;
    const net = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (net?.saveData || net?.effectiveType === '2g' || net?.effectiveType === 'slow-2g') return undefined;
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setLoad(true), { timeout: 2500 });
      return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(() => setLoad(true), 1200);
    return () => window.clearTimeout(id);
  }, [enabled, load]);

  const size = useMemo(() => (slot ? { width: slot.w, height: slot.h } : { width: 56, height: 32 }), [slot?.w, slot?.h]); // eslint-disable-line react-hooks/exhaustive-deps
  const glass = load && !failed && ready;

  return (
    <span
      aria-hidden
      data-ready={glass || undefined}
      data-placed={placed || undefined}
      className={cn('lq-nav-pebble pointer-events-none absolute left-0 top-0', !slot && 'opacity-0', className)}
      style={{ ...size, transform: slot ? `translate3d(${slot.x}px, ${slot.y}px, 0)` : undefined }}
    >
      <span className="lq-nav-clay absolute inset-0" />
      {load && !failed && (
        <span className="absolute" style={{ left: -PAD, top: -PAD, width: size.width + PAD * 2, height: size.height + PAD * 2 }}>
          <Suspense fallback={null}>
            <NavPebble3D
              axis={axis}
              width={size.width}
              height={size.height}
              icon={slot?.icon ?? null}
              position={slot ? (axis === 'x' ? slot.x : slot.y) : 0}
              onReady={() => setReady(true)}
              onUnavailable={() => setFailed(true)}
            />
          </Suspense>
        </span>
      )}
    </span>
  );
}
