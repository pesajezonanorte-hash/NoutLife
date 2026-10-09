// src/lib/motion — Framer Motion 11 presets for Noutlife (docs/redesign/tokens/motion.ts, Motion v3).
// La física con nombre de las zonas ambientadas (gentle/natural/heavy/snappy) vive en ./presets.
// main.tsx envuelve la app en <MotionConfig>: solo el ajuste "Reducir movimiento"
// de la app la apaga (la preferencia del sistema no, por decisión de producto).
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { animate, useReducedMotionConfig, type Transition, type Variants } from 'framer-motion';
import { useMotionStore } from '@/store/motionStore';
import { reduced, springs } from './presets';

export * from './presets';

/* ───────── Motion v3: curvas ───────── */
export const expo = [0.16, 1, 0.3, 1] as const;         // --ease-expo: entradas
export const softOut = [0.22, 1, 0.36, 1] as const;     // --ease-soft
/** Muelle suave con ligero rebote: botones, switches, checks, píldoras, diálogos, toasts. */
export const springSoft: Transition = { type: 'spring', stiffness: 300, damping: 24, mass: 0.9 };

/**
 * Entrada v3: y 24 + scale .985 + blur 6 px → 0 (con «Reducir movimiento», solo
 * opacidad). La blur es solo de entrada y termina en `filter: none` (un filtro
 * residual crearía containing block para los fixed). Se lee al resolver la variante.
 */
const blurIn = () => (reduced() ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.985, filter: 'blur(6px)' });

/**
 * «Reducir movimiento» en React: ajuste de la app o `prefers-reduced-motion`
 * del sistema. Úsalo para quitar blur/desplazamientos de las animaciones
 * hechas a mano; con él activo la interfaz debe quedar nítida y legible.
 */
export function useMotionReduced() {
  const appReduce = useMotionStore((s) => s.reduce);
  const systemReduce = useReducedMotionConfig() ?? false;
  return appReduce || Boolean(systemReduce);
}

export const ease = [0.22, 1, 0.36, 1] as const;     // ease-out suave (out-quint)
export const spring: Transition = { type: 'spring', stiffness: 420, damping: 30 };
/** Muelle para apariciones: llega sin rebote visible pero con inercia natural. */
export const softSpring: Transition = { type: 'spring', stiffness: 220, damping: 26, mass: 0.9 };
/** Muelle rápido para pulsaciones y hover de botones. */
export const pressSpring: Transition = { type: 'spring', stiffness: 520, damping: 30, mass: 0.6 };

/* ───────── Peso (lenguaje del gimnasio, usado en toda la app) ─────────
   Masa alta = arranca lento, se pasa un poco y asienta, como un disco que se carga. */
/** Muelle pesado: indicadores, barras y bloques que «se cargan». */
export const heavy: Transition = springs.heavy;
/** Impacto: algo que cae y golpea (sellos, PR, discos). */
export const slam: Transition = { type: 'spring', stiffness: 520, damping: 20, mass: 1.1 };
/** Pulsación con peso: se hunde y rebota al soltar. */
export const weightPress: Transition = { type: 'spring', stiffness: 460, damping: 22, mass: 0.95 };
/** Golpe seco que recorre un bloque cuando algo cae dentro (keyframes de y). */
export const thud = { y: [0, 3, -1, 0], transition: { duration: 0.45, ease: expo, times: [0, 0.25, 0.6, 1] } };

/** Transición de ruta (page3): AnimatePresence mode="wait" alrededor de las rutas. */
export const page3: Variants = {
  initial: blurIn,
  animate: () => (reduced()
    ? { opacity: 1, transition: { duration: 0.2, staggerChildren: 0.06 } }
    : {
        opacity: 1, y: 0, scale: 1, filter: 'blur(0px)',
        transition: { duration: 0.8, ease: expo, staggerChildren: 0.06 },
        transitionEnd: { filter: 'none' },
      }),
  exit: { opacity: 0, transition: { duration: 0.2 } },
};
export const page = page3;

/** Stagger lists/grids: parent = stagger, children = item (item3) */
export const stagger: Variants = { animate: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } } };
export const item3: Variants = {
  initial: blurIn,
  animate: () => (reduced()
    ? { opacity: 1, transition: { duration: 0.2 } }
    : {
        opacity: 1, y: 0, scale: 1, filter: 'blur(0px)',
        transition: { duration: 0.7, ease: expo },
        transitionEnd: { filter: 'none' },
      }),
};
export const item = item3;
export const pop3: Variants = { initial: { opacity: 0, scale: 0.88 }, animate: { opacity: 1, scale: 1, transition: springSoft } };

/** Buttons (v3: muelle suave) */
export const tap3 = { whileHover: { y: -1 }, whileTap: { y: 0, scale: 0.97 }, transition: springSoft };
export const tap = tap3;

/** Cards: lift −6 px con muelle + icon wiggle (put `variants={iconHover}` on the icon chip) */
export const cardHover3 = { whileHover: { y: -4 }, transition: springSoft };
export const cardHover = cardHover3;
export const iconHover: Variants = { hover: { scale: 1.08, rotate: -4, transition: spring } };

/** Progress bar fill: animate scaleX, never width */
export const barFill3 = (value: number): any => ({
  initial: { scaleX: 0 }, animate: { scaleX: value / 100 },
  transition: { duration: 1.1, ease: expo, delay: 0.2 }, style: { originX: 0 },
});
export const barFill = barFill3;

/** Chart bar rising (index for stagger) */
export const rise = (i: number): any => ({
  initial: { scaleY: 0 }, animate: { scaleY: 1 },
  transition: { duration: 1, ease: expo, delay: 0.2 + i * 0.07 }, style: { originY: 1 },
});

/** Ring / line chart drawing: use on <motion.circle pathLength> or <motion.path> */
export const draw3 = (progress = 1): any => ({
  initial: { pathLength: 0 }, animate: { pathLength: progress },
  transition: { duration: 1.6, ease: expo, delay: 0.15 },
});
export const draw = draw3;

/** Modal / dialog */
export const scrim: Variants = { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.2 } }, exit: { opacity: 0, transition: { duration: 0.2 } } };
export const dialog: Variants = {
  initial: { opacity: 0, y: 20, scale: 0.96 },
  animate: { opacity: 1, y: 0, scale: 1, transition: springSoft },
  exit: { opacity: 0, y: 10, scale: 0.98, transition: { duration: 0.2, ease } },
};
export const sheet: Variants = { initial: { y: '100%' }, animate: { y: 0, transition: { type: 'spring', stiffness: 340, damping: 34 } }, exit: { y: '100%', transition: { duration: 0.22, ease } } };

/** Toast: bottom-center mobile, bottom-right desktop, 4 s */
export const toast: Variants = {
  // Sube desde detrás de la barra inferior y se asienta; sale hundiéndose.
  initial: { opacity: 0, y: 40, scale: 0.94 }, animate: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 380, damping: 26, mass: 0.8 } },
  exit: { opacity: 0, y: 24, scale: 0.96, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } },
};

/** Habit check: rotate 360 + fill */
export const check = { animate: (on: boolean) => ({ rotate: on ? 360 : 0, transition: { duration: 0.2 } }) };

/** Animated number (balances, streaks, kcal). Respects reduced motion. */
export function useCountUp(target: number, duration = 1.1) {
  const reduce = useReducedMotionConfig();
  const [v, setV] = useState(reduce ? target : 0);
  // Parte del último valor mostrado: un saldo que baja anima desde el anterior, no desde 0.
  const from = useRef(reduce ? target : 0);
  useEffect(() => {
    if (reduce) { setV(target); from.current = target; return; }
    const c = animate(from.current, target, { duration, ease: [0.25, 1, 0.5, 1], onUpdate: (x) => { from.current = x; setV(x); } }); // easeOutQuart
    return () => c.stop();
  }, [target, duration, reduce]);
  return v;
}

export const fmtNumber = (n: number) => Math.round(n).toLocaleString('es-CO');

/** Dígito de cuenta atrás: key por valor dentro de AnimatePresence. */
export const tick: Variants = {
  initial: { opacity: 0, y: -12 }, animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: expo } },
  exit: { opacity: 0, y: 12, transition: { duration: 0.2 } },
};

/** Puntero fino (ratón): el tilt 3D solo existe ahí. */
const finePointer = () => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/** Spotlight + tilt 3D (`.lq-spot`): fija --mx/--my y, si procede, --rx/--ry (máx. 3°).
 *  Sin tilt con «Reducir movimiento» y en pantallas táctiles (pointer: coarse). */
export function useSpotlight<T extends HTMLElement>() {
  const reduce = useReducedMotionConfig();
  const onPointerMove = (e: PointerEvent<T>) => {
    const el = e.currentTarget, r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    el.style.setProperty('--mx', `${x * 100}%`); el.style.setProperty('--my', `${y * 100}%`);
    if (!reduce && e.pointerType === 'mouse' && finePointer()) {
      el.style.setProperty('--rx', `${(0.5 - y) * 6}deg`); el.style.setProperty('--ry', `${(x - 0.5) * 6}deg`);
    }
  };
  const onPointerLeave = (e: PointerEvent<T>) => {
    const el = e.currentTarget; el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg');
  };
  return { onPointerMove, onPointerLeave };
}
