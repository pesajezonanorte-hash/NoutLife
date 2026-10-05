// Luz reutilizable: barrido sobre vidrio o metal (Sheen) y holograma que
// sigue al puntero o a la inclinación del móvil (useHoloTilt).
import { useCallback, useEffect, useRef, type CSSProperties, type PointerEvent } from 'react';
import { cn } from '@/lib/utils';
import { useMotionStore } from '@/store/motionStore';

/**
 * Barrido de luz que cruza la superficie cada `every` segundos y descansa el
 * resto. Va dentro de un contenedor posicionado; hereda su radio.
 */
export function Sheen({ every = 9, delay = 1.2, className }: { every?: number; delay?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('lq-sheen-sweep', className)}
      style={{ '--sheen-every': `${every}s`, '--sheen-delay': `${delay}s` } as CSSProperties}
    />
  );
}

const finePointer = () => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/**
 * Inclinación 3D + holograma: escribe --rx/--ry (máx. `maxTilt`°), --mx/--my
 * (posición de la luz, %) y --hx (desplazamiento del arcoíris) en el elemento.
 * Con ratón sigue al puntero; en móvil, la inclinación del dispositivo cuando
 * el navegador la da sin pedir permiso (Android). Apagado con «Reducir movimiento».
 */
export function useHoloTilt<T extends HTMLElement>(maxTilt = 6) {
  const ref = useRef<T>(null);
  const frame = useRef(0);
  const reduce = useMotionStore((s) => s.reduce);

  const write = useCallback((x: number, y: number) => {
    const el = ref.current;
    if (!el) return;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      el.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
      el.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
      el.style.setProperty('--hx', `${((x - 0.5) * 40).toFixed(1)}%`);
      el.style.setProperty('--rx', `${((0.5 - y) * maxTilt).toFixed(2)}deg`);
      el.style.setProperty('--ry', `${((x - 0.5) * maxTilt).toFixed(2)}deg`);
    });
  }, [maxTilt]);

  const reset = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    cancelAnimationFrame(frame.current);
    for (const p of ['--rx', '--ry']) el.style.setProperty(p, '0deg');
    el.style.setProperty('--hx', '0%');
  }, []);

  const onPointerMove = useCallback((e: PointerEvent<T>) => {
    if (reduce || e.pointerType !== 'mouse' || !finePointer()) return;
    const r = e.currentTarget.getBoundingClientRect();
    write((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  }, [reduce, write]);

  // Inclinación del móvil (solo donde no hace falta pedir permiso).
  useEffect(() => {
    if (reduce || finePointer() || typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return;
    const needsPermission = typeof (DeviceOrientationEvent as unknown as { requestPermission?: unknown }).requestPermission === 'function';
    if (needsPermission) return;
    const on = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return;
      // beta ~ 20–70° sosteniendo el móvil; gamma −30…30°.
      const x = Math.min(1, Math.max(0, 0.5 + e.gamma / 60));
      const y = Math.min(1, Math.max(0, 0.5 + (e.beta - 45) / 60));
      write(x, y);
    };
    window.addEventListener('deviceorientation', on);
    return () => window.removeEventListener('deviceorientation', on);
  }, [reduce, write]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  return { ref, onPointerMove, onPointerLeave: reset };
}
