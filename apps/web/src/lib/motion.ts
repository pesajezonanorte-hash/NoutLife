// src/lib/motion.ts — Framer Motion 11 presets for LifeQuest (docs/redesign/tokens/motion.ts).
// main.tsx envuelve la app en <MotionConfig>: el ajuste "Reducir movimiento" la apaga.
import { useEffect, useState } from 'react';
import { animate, useReducedMotionConfig, type Transition, type Variants } from 'framer-motion';

export const ease = [0.22, 1, 0.36, 1] as const;     // ease-out suave (out-quint)
export const spring: Transition = { type: 'spring', stiffness: 420, damping: 30 };
/** Muelle para apariciones: llega sin rebote visible pero con inercia natural. */
export const softSpring: Transition = { type: 'spring', stiffness: 220, damping: 26, mass: 0.9 };
/** Muelle rápido para pulsaciones y hover de botones. */
export const pressSpring: Transition = { type: 'spring', stiffness: 520, damping: 30, mass: 0.6 };

/** Screen enter/exit (AnimatePresence mode="wait" around <Outlet/>) */
export const page: Variants = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { y: softSpring, opacity: { duration: 0.35, ease }, staggerChildren: 0.06 } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.18, ease } },
};

/** Stagger lists/grids: parent = stagger, children = item */
export const stagger: Variants = { animate: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } } };
export const item: Variants = {
  initial: { opacity: 0, y: 18, scale: 0.985 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { y: softSpring, scale: softSpring, opacity: { duration: 0.4, ease } } },
};

/** Buttons */
export const tap = { whileHover: { y: -1, scale: 1.015 }, whileTap: { y: 0, scale: 0.96 }, transition: pressSpring };

/** Cards: lift + icon wiggle (put `variants={iconHover}` on the icon chip) */
export const cardHover = { whileHover: { y: -4 }, transition: softSpring };
export const iconHover: Variants = { hover: { scale: 1.08, rotate: -4, transition: spring } };

/** Progress bar fill: animate scaleX, never width */
export const barFill = (value: number): any => ({
  initial: { scaleX: 0 }, animate: { scaleX: value / 100 },
  transition: { duration: 0.9, ease, delay: 0.2 }, style: { originX: 0 },
});

/** Chart bar rising (index for stagger) */
export const rise = (i: number): any => ({
  initial: { scaleY: 0 }, animate: { scaleY: 1 },
  transition: { duration: 0.8, ease: [0.2, 0.8, 0.2, 1], delay: 0.2 + i * 0.07 }, style: { originY: 1 },
});

/** Ring / line chart drawing: use on <motion.circle pathLength> or <motion.path> */
export const draw = (progress = 1): any => ({
  initial: { pathLength: 0 }, animate: { pathLength: progress },
  transition: { duration: 1.3, ease, delay: 0.2 },
});

/** Modal / dialog */
export const scrim: Variants = { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.2 } }, exit: { opacity: 0, transition: { duration: 0.2 } } };
export const dialog: Variants = {
  initial: { opacity: 0, y: 20, scale: 0.96 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 380, damping: 28 } },
  exit: { opacity: 0, y: 10, scale: 0.98, transition: { duration: 0.18, ease } },
};
export const sheet: Variants = { initial: { y: '100%' }, animate: { y: 0, transition: { type: 'spring', stiffness: 340, damping: 34 } }, exit: { y: '100%', transition: { duration: 0.22, ease } } };

/** Toast: bottom-center mobile, bottom-right desktop, 4 s */
export const toast: Variants = {
  initial: { opacity: 0, y: 16, scale: 0.96 }, animate: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 420, damping: 30 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

/** Habit check: rotate 360 + fill */
export const check = { animate: (on: boolean) => ({ rotate: on ? 360 : 0, transition: { duration: 0.2 } }) };

/** Animated number (balances, streaks, kcal). Respects reduced motion. */
export function useCountUp(target: number, duration = 1.1) {
  const reduce = useReducedMotionConfig();
  const [v, setV] = useState(reduce ? target : 0);
  useEffect(() => {
    if (reduce) { setV(target); return; }
    const c = animate(0, target, { duration, ease: [0.33, 1, 0.68, 1], onUpdate: setV });
    return () => c.stop();
  }, [target, duration, reduce]);
  return v;
}

export const fmtNumber = (n: number) => Math.round(n).toLocaleString('es-CO');
