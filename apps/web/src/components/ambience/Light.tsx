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
 *
 * Los valores no saltan: persiguen su objetivo con un muelle amortiguado. Al
 * salir el cursor la tarjeta vuelve a plano pero los reflejos se quedan donde
 * estaban; al volver a entrar, se deslizan desde ahí hasta el cursor.
 * `frozen` (p. ej. con la tarjeta girada) aplana la inclinación y deja la luz quieta.
 */
export function useHoloTilt<T extends HTMLElement>(maxTilt = 6, { frozen = false }: { frozen?: boolean } = {}) {
  const ref = useRef<T>(null);
  const frame = useRef(0);
  const last = useRef(0);
  const reduce = useMotionStore((s) => s.reduce);
  // Luz (x, y en 0–1) e inclinación (grados): estado actual y objetivo.
  const cur = useRef({ x: 0.3, y: 0.2, rx: 0, ry: 0 });
  const tgt = useRef({ x: 0.3, y: 0.2, rx: 0, ry: 0 });
  const live = !reduce && !frozen;

  const paint = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const c = cur.current;
    el.style.setProperty('--mx', `${(c.x * 100).toFixed(1)}%`);
    el.style.setProperty('--my', `${(c.y * 100).toFixed(1)}%`);
    el.style.setProperty('--hx', `${((c.x - 0.5) * 40).toFixed(1)}%`);
    el.style.setProperty('--rx', `${c.rx.toFixed(2)}deg`);
    el.style.setProperty('--ry', `${c.ry.toFixed(2)}deg`);
  }, []);

  const step = useCallback((t: number) => {
    const dt = Math.min(64, last.current ? t - last.current : 16);
    last.current = t;
    const c = cur.current, g = tgt.current;
    // Constantes de tiempo: la luz se desliza (≈180 ms), la inclinación responde algo antes.
    const kl = 1 - Math.exp(-dt / 180);
    const kt = 1 - Math.exp(-dt / 120);
    c.x += (g.x - c.x) * kl; c.y += (g.y - c.y) * kl;
    c.rx += (g.rx - c.rx) * kt; c.ry += (g.ry - c.ry) * kt;
    paint();
    const done = Math.abs(g.x - c.x) < 0.0008 && Math.abs(g.y - c.y) < 0.0008 && Math.abs(g.rx - c.rx) < 0.01 && Math.abs(g.ry - c.ry) < 0.01;
    if (done) { Object.assign(c, g); paint(); frame.current = 0; last.current = 0; return; }
    frame.current = requestAnimationFrame(step);
  }, [paint]);

  const kick = useCallback(() => {
    if (!frame.current) frame.current = requestAnimationFrame(step);
  }, [step]);

  const aim = useCallback((x: number, y: number) => {
    Object.assign(tgt.current, { x, y, rx: (0.5 - y) * maxTilt, ry: (x - 0.5) * maxTilt });
    kick();
  }, [maxTilt, kick]);

  // La tarjeta vuelve a plano; la luz se queda donde estaba.
  const reset = useCallback(() => {
    Object.assign(tgt.current, { rx: 0, ry: 0 });
    kick();
  }, [kick]);

  const onPointerMove = useCallback((e: PointerEvent<T>) => {
    if (!live || e.pointerType !== 'mouse' || !finePointer()) return;
    const r = e.currentTarget.getBoundingClientRect();
    aim((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  }, [live, aim]);

  useEffect(() => { if (!live) reset(); }, [live, reset]);
  useEffect(() => { paint(); }, [paint]);

  // Inclinación del móvil (solo donde no hace falta pedir permiso).
  useEffect(() => {
    if (!live || finePointer() || typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return;
    const needsPermission = typeof (DeviceOrientationEvent as unknown as { requestPermission?: unknown }).requestPermission === 'function';
    if (needsPermission) return;
    const on = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return;
      // beta ~ 20–70° sosteniendo el móvil; gamma −30…30°.
      const x = Math.min(1, Math.max(0, 0.5 + e.gamma / 60));
      const y = Math.min(1, Math.max(0, 0.5 + (e.beta - 45) / 60));
      aim(x, y);
    };
    window.addEventListener('deviceorientation', on);
    return () => window.removeEventListener('deviceorientation', on);
  }, [live, aim]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  return { ref, onPointerMove, onPointerLeave: reset };
}
