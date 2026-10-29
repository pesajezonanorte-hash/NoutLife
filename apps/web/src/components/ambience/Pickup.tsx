// Objetos que se levantan y se arrastran (libretas, libros, pósteres) con física:
// inercia al soltar, rebote contra los bordes y una inclinación 3D que sigue a la
// velocidad, como un objeto real que se lleva por el aire.
//
// En el móvil se levanta con una pulsación larga (~0,25 s): un deslizamiento normal
// sigue desplazando la página. Con ratón o lápiz se arrastra al instante. Un toque
// sin arrastre llega como clic normal a lo que haya dentro (abrir, ajustes…).
//
// Modos: `snapBack` vuelve a su sitio al soltar (estantes, cartelera); sin él, se
// queda donde cae dentro de `bounds` y avisa con `onDrop` cuando la inercia termina.
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react';
import { motion, useDragControls, useMotionValue, useSpring, useTransform, useVelocity } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useMotionStore } from '@/store/motionStore';

const HOLD_MS = 260;
const SLOP_PX = 9;

export interface PickupProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Vuelve a su sitio al soltar. */
  snapBack?: boolean;
  /** Contenedor que limita el arrastre (modo libre). */
  bounds?: RefObject<Element>;
  /** Límites en px alrededor de su sitio (un libro que asoma del estante sin salir de él). */
  limits?: { top: number; right: number; bottom: number; left: number };
  /** Posición inicial (modo libre), en px dentro de `bounds`. */
  at?: { x: number; y: number };
  /** Modo libre: posición final, cuando la inercia se detiene. */
  onDrop?: (pos: { x: number; y: number }) => void;
  /** Al levantarlo (para traerlo al frente o abrir hueco en un estante). */
  onLift?: () => void;
  onRelease?: () => void;
  /** Inclinación máxima (grados) al moverlo rápido. */
  tilt?: number;
}

export function Pickup({ children, className, style, snapBack, bounds, limits, at, onDrop, onLift, onRelease, tilt = 9 }: PickupProps) {
  const reduce = useMotionStore((s) => s.reduce);
  const controls = useDragControls();
  const x = useMotionValue(at?.x ?? 0);
  const y = useMotionValue(at?.y ?? 0);
  const [held, setHeld] = useState(false);
  /** Lo mismo que `held`, pero se lee sin esperar al render (el bloqueo del scroll no puede llegar tarde). */
  const holding = useRef(false);
  const dragged = useRef(false);
  const hold = useRef<{ timer: number; x: number; y: number } | null>(null);
  const root = useRef<HTMLDivElement>(null);

  // La posición guardada puede llegar después (otro tamaño de escritorio, «ordenar»).
  useEffect(() => {
    if (!at || held) return;
    x.set(at.x);
    y.set(at.y);
  }, [at?.x, at?.y]); // eslint-disable-line react-hooks/exhaustive-deps

  // Inclinación por velocidad, con muelle para que no tiemble.
  const vx = useVelocity(x);
  const vy = useVelocity(y);
  const spring = { stiffness: 260, damping: 26, mass: 0.6 };
  const rotateZ = useSpring(useTransform(vx, [-2200, 2200], [-tilt, tilt], { clamp: true }), spring);
  const rotateY = useSpring(useTransform(vx, [-2200, 2200], [-tilt * 1.6, tilt * 1.6], { clamp: true }), spring);
  const rotateX = useSpring(useTransform(vy, [-2200, 2200], [tilt * 1.6, -tilt * 1.6], { clamp: true }), spring);

  // Mientras se sostiene con el dedo, la página no se desplaza (touchmove no pasivo).
  useEffect(() => {
    const el = root.current;
    if (!el) return undefined;
    const block = (e: TouchEvent) => { if (holding.current) e.preventDefault(); };
    el.addEventListener('touchmove', block, { passive: false });
    return () => el.removeEventListener('touchmove', block);
  }, []);
  const setHolding = (on: boolean) => { holding.current = on; setHeld(on); };

  const cancelHold = () => {
    if (hold.current) window.clearTimeout(hold.current.timer);
    hold.current = null;
  };

  const start = (e: ReactPointerEvent) => {
    controls.start(e, { snapToCursor: false });
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    dragged.current = false;
    if (e.button !== 0) return;
    if (e.pointerType !== 'touch') { start(e); return; }
    const native = e.nativeEvent;
    cancelHold();
    hold.current = {
      x: e.clientX,
      y: e.clientY,
      timer: window.setTimeout(() => {
        hold.current = null;
        setHolding(true);
        navigator.vibrate?.(8);
        controls.start(native, { snapToCursor: false });
      }, HOLD_MS),
    };
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    const h = hold.current;
    if (h && Math.hypot(e.clientX - h.x, e.clientY - h.y) > SLOP_PX) cancelHold();
  };
  const end = () => {
    cancelHold();
    if (holding.current) setHolding(false);
  };

  const lifted = { scale: reduce ? 1 : 1.06, zIndex: 60 };
  return (
    <motion.div
      ref={root}
      drag
      dragListener={false}
      dragControls={controls}
      dragSnapToOrigin={snapBack}
      dragConstraints={limits ?? bounds}
      dragElastic={snapBack ? 0.55 : 0.14}
      dragMomentum={!snapBack}
      dragTransition={snapBack ? { bounceStiffness: 420, bounceDamping: 24 } : { power: 0.28, timeConstant: 260, bounceStiffness: 320, bounceDamping: 26 }}
      whileDrag={lifted}
      onDragStart={() => { dragged.current = true; setHolding(true); onLift?.(); }}
      onDragEnd={() => { setHolding(false); onRelease?.(); }}
      onDragTransitionEnd={() => { if (!snapBack) onDrop?.({ x: x.get(), y: y.get() }); }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      // Un arrastre no es un clic: lo de dentro no se abre al soltar.
      onClickCapture={(e) => { if (dragged.current) { e.preventDefault(); e.stopPropagation(); dragged.current = false; } }}
      onContextMenu={(e) => { if (held || hold.current) e.preventDefault(); }}
      style={{ x, y, touchAction: 'pan-x pan-y', ...style }}
      data-held={held || undefined}
      className={cn('lq-pickup', className)}
    >
      <motion.div className="lq-pickup-body" style={reduce ? undefined : { rotateX, rotateY, rotateZ }}>
        {children}
      </motion.div>
    </motion.div>
  );
}
