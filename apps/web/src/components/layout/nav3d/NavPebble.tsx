// Indicador de la pestaña activa, común a la barra del móvil (eje X) y a la lateral (eje Y). Es la
// pastilla esculpida en CSS (.lq-nav-clay), del mismo material que la barra, que se desliza solo con
// transform; cuando el navegador está libre se descarga el ícono con volumen, que releva al plano.
// Sin WebGL, con «Ahorro de datos» o con 2G, se queda el ícono plano. Va antes que los enlaces en el
// DOM: la pastilla queda debajo del texto y del ícono.
//
//   <nav ref={rootRef}><NavPebble root={rootRef} active={pathname} axis="x" />…<a aria-current="page"><span data-nav-slot><svg data-nav-icon/></span></a>…</nav>
import { Suspense, lazy, useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { cn } from '@/lib/utils';
import { hasWebGL2 } from '@/components/three3d/near';
import type { NavLight } from './NavPebble3D';

const NavPebble3D = lazy(() => import('./NavPebble3D'));

const PAD = 14; // px de lienzo alrededor del ícono: la luz y el estirón del viaje

interface Slot {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Ancho de la fila entera: lo que mide la pastilla con la barra lateral desplegada. */
  row: number;
  icon: SVGSVGElement | null;
}

function useSlot(root: RefObject<HTMLElement>, active: string): Slot | null {
  const [slot, setSlot] = useState<Slot | null>(null);
  // useEffect, no de layout: la ref del <nav> que nos contiene se asigna después de los efectos de
  // layout de sus hijos, y al abrir la app estaría vacía.
  useEffect(() => {
    const el = root.current;
    if (!el) return undefined;
    const measure = () => {
      const target = el.querySelector<HTMLElement>('[aria-current="page"] [data-nav-slot]');
      setSlot((prev) => {
        if (!target) return prev === null ? prev : null;
        const link = target.closest<HTMLElement>('[aria-current="page"]')!;
        const r = el.getBoundingClientRect();
        const b = target.getBoundingClientRect();
        // El ancho de la caja se mide sin escala: los íconos llevan transiciones de transform.
        const next: Slot = {
          x: b.left - r.left + el.scrollLeft,
          y: b.top - r.top + el.scrollTop,
          w: target.offsetWidth,
          h: target.offsetHeight,
          row: link.offsetWidth,
          icon: link.querySelector<SVGSVGElement>('svg[data-nav-icon]'),
        };
        return prev && prev.x === next.x && prev.y === next.y && prev.w === next.w && prev.h === next.h && prev.row === next.row && prev.icon === next.icon ? prev : next;
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
  const pebble = useRef<HTMLSpanElement>(null);
  const clay = useRef<HTMLSpanElement>(null);
  const light = useRef<NavLight | null>(null);
  const [load, setLoad] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [placed, setPlaced] = useState(false);

  // Medir fuerza un cálculo de estilo: sin esto, al cargar la pastilla llegaría volando desde la esquina.
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

  const glass = load && !failed && ready;

  // Con el 3D listo, el ícono plano de la pestaña activa cede su sitio (calm.css).
  useEffect(() => {
    const el = root.current;
    if (!el) return undefined;
    el.toggleAttribute('data-nav3d', glass);
    return () => el.removeAttribute('data-nav3d');
  }, [root, glass]);

  // La luz difusa de la pastilla sigue al cursor o al dedo sobre la pestaña activa y se enciende al presionar.
  useEffect(() => {
    const el = root.current;
    if (!el) return undefined;
    const over = (e: PointerEvent) => e.target instanceof Element && Boolean(e.target.closest('[aria-current="page"]'));
    const reach = (e: PointerEvent, press: boolean) => {
      const box = pebble.current;
      if (!box) return;
      const r = box.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      box.style.setProperty('--gx', `${x}px`);
      box.style.setProperty('--gy', `${y}px`);
      box.toggleAttribute('data-press', press);
      box.setAttribute('data-lit', '');
      // El ícono mira al punto de luz, pero sin pasarse: lejos de él, ya no cambia.
      const clamp = (v: number) => Math.max(-1, Math.min(1, v));
      light.current?.(clamp((x - r.width / 2) / 40), clamp((r.height / 2 - y) / 30), press);
    };
    const rest = () => {
      const box = pebble.current;
      if (!box) return;
      box.style.removeProperty('--gx');
      box.style.removeProperty('--gy');
      box.removeAttribute('data-press');
      box.removeAttribute('data-lit');
      light.current?.(0, 0, false);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch' && !pebble.current?.hasAttribute('data-press')) return;
      if (over(e)) reach(e, Boolean(pebble.current?.hasAttribute('data-press')));
      else if (pebble.current?.hasAttribute('data-lit')) rest();
    };
    const down = (e: PointerEvent) => { if (over(e)) reach(e, true); };
    const up = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || !over(e)) rest();
      else reach(e, false);
    };
    el.addEventListener('pointermove', move, { passive: true });
    el.addEventListener('pointerdown', down, { passive: true });
    window.addEventListener('pointerup', up, { passive: true });
    window.addEventListener('pointercancel', rest, { passive: true });
    el.addEventListener('pointerleave', rest, { passive: true });
    return () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', rest);
      el.removeEventListener('pointerleave', rest);
    };
  }, [root]);

  // Al viajar, la pastilla se estira en el sentido de la marcha y se recoge al llegar.
  const last = useRef<number | null>(null);
  const position = slot ? (axis === 'x' ? slot.x : slot.y) : 0;
  useEffect(() => {
    if (!slot) return;
    const from = last.current;
    last.current = position;
    if (from === null || from === position || document.documentElement.classList.contains('reduce-motion')) return;
    const long = axis === 'x' ? 'scale(1.16, .94)' : 'scale(.98, 1.28)';
    clay.current?.animate([{ transform: 'none' }, { transform: long, offset: 0.36 }, { transform: 'none' }], { duration: 480, easing: 'cubic-bezier(.4, 0, .2, 1)' });
  }, [slot, axis, position]);

  const size = useMemo(() => (slot ? { width: slot.w, height: slot.h } : { width: 56, height: 32 }), [slot?.w, slot?.h]); // eslint-disable-line react-hooks/exhaustive-deps
  const vars = slot ? ({ '--lq-row-w': `${slot.row}px`, '--gx0': `${slot.w / 2}px`, '--gy0': `${slot.h / 2}px` } as CSSProperties) : undefined;

  return (
    <span
      ref={pebble}
      aria-hidden
      data-ready={glass || undefined}
      data-placed={placed || undefined}
      className={cn('lq-nav-pebble pointer-events-none absolute left-0 top-0', !slot && 'opacity-0', className)}
      style={{ ...size, ...vars, transform: slot ? `translate3d(${slot.x}px, ${slot.y}px, 0)` : undefined }}
    >
      <span ref={clay} className="lq-nav-clay" />
      {load && !failed && (
        <span className="absolute" style={{ left: -PAD, top: -PAD, width: size.width + PAD * 2, height: size.height + PAD * 2 }}>
          <Suspense fallback={null}>
            <NavPebble3D
              axis={axis}
              icon={slot?.icon ?? null}
              position={position}
              light={light}
              onReady={() => setReady(true)}
              onUnavailable={() => setFailed(true)}
            />
          </Suspense>
        </span>
      )}
    </span>
  );
}
