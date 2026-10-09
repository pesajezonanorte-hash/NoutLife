// Física compartida de las zonas ambientadas. Cada nombre describe cómo se
// siente algo al moverse, no cuánto dura:
//
//   gentle  lento y sin rebote (ζ≈1.1): biblioteca, rituales, glow up, ambiente
//   natural respuesta normal de UI, apenas se asienta (ζ≈0.8)
//   heavy   objetos con peso que se pasan un poco y asientan (ζ≈0.6): libros, trofeos, tarjetas
//   snappy  feedback inmediato (asienta en ~325 ms): completar un hábito, toques
//
// Las mismas físicas existen en CSS como curvas `linear()` (--lq-ease-*, --lq-dur-*
// en styles/ambience.css), generadas simulando estos muelles, para que una
// animación CSS y una de Framer con el mismo nombre se sientan iguales.
import type { Transition, Variants } from 'framer-motion';
import { useMotionStore } from '@/store/motionStore';

export const springs = {
  gentle: { type: 'spring', stiffness: 70, damping: 20, mass: 1.2 },
  natural: { type: 'spring', stiffness: 260, damping: 26, mass: 1 },
  heavy: { type: 'spring', stiffness: 170, damping: 19, mass: 1.5 },
  snappy: { type: 'spring', stiffness: 620, damping: 32, mass: 0.7 },
} as const satisfies Record<string, Transition>;

export type SpringName = keyof typeof springs;

/** Duraciones con nombre (s) para lo que no es un muelle: fundidos, trazos, ambiente. */
export const durations = {
  instant: 0.12,
  quick: 0.22,
  base: 0.36,
  slow: 0.7,
  settle: 1.1,
  /** Un ciclo de ambiente (luz que respira, polvo que flota). */
  ambient: 14,
} as const;

/** Curvas y duraciones CSS equivalentes a cada muelle (para style={{ transition }}). */
export const cssEase = (name: SpringName) => `var(--lq-ease-${name})`;
export const cssDur = (name: SpringName) => `var(--lq-dur-${name})`;

/** Curva de salida rápida y limpia (todas las zonas salen igual de suave). */
export const exitEase = [0.4, 0, 1, 1] as const;

/** Preferencia del sistema (prefers-reduced-motion), leída al vuelo. */
export const systemReduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
/**
 * «Reducir movimiento» activo: ajuste de la app o preferencia del sistema.
 * En ese modo las entradas quedan en un fundido de opacidad: sin desplazamientos,
 * escalas ni filtros de desenfoque (la interfaz se mantiene totalmente nítida).
 */
export const reduced = () => useMotionStore.getState().reduce || systemReduced();
const fade = { opacity: 0 };

/** Contenedor que escalona a sus hijos. */
export function staggerVariants(stagger = 0.07, delay = 0.05): Variants {
  return {
    initial: {},
    animate: { transition: { staggerChildren: stagger, delayChildren: delay } },
    exit: { transition: { staggerChildren: 0.03, staggerDirection: -1 } },
  };
}

/** Entradas reutilizables. Con «Reducir movimiento» todas quedan en un fundido de opacidad. */
export const enter = {
  /** Sube y aparece con respuesta normal. */
  rise: {
    initial: () => (reduced() ? fade : { opacity: 0, y: 16 }),
    animate: { opacity: 1, y: 0, transition: springs.natural },
    exit: { opacity: 0, y: -6, transition: { duration: durations.quick, ease: exitEase } },
  },
  /** Cae con peso y se asienta (libros, trofeos, tarjetas). */
  settle: {
    initial: () => (reduced() ? fade : { opacity: 0, y: -28, rotate: -1.2 }),
    animate: { opacity: 1, y: 0, rotate: 0, transition: { ...springs.heavy, opacity: { duration: durations.quick } } },
    exit: { opacity: 0, y: 8, transition: { duration: durations.quick, ease: exitEase } },
  },
  /** Emerge de la niebla: se enfoca despacio (citas, espejo). Con «Reducir movimiento», solo opacidad. */
  emerge: {
    initial: () => (reduced() ? fade : { opacity: 0, scale: 0.985, filter: 'blur(10px)' }),
    animate: () => (reduced()
      ? { opacity: 1, transition: { duration: durations.quick } }
      : {
          opacity: 1, scale: 1, filter: 'blur(0px)',
          transition: { ...springs.gentle, opacity: { duration: durations.slow } }, transitionEnd: { filter: 'none' },
        }),
    exit: { opacity: 0, transition: { duration: durations.quick, ease: exitEase } },
  },
  /** Se sirve: baja sobre la mesa con una pizca de escala (platos, artículos). */
  serve: {
    initial: () => (reduced() ? fade : { opacity: 0, y: 10, scale: 0.96 }),
    animate: { opacity: 1, y: 0, scale: 1, transition: { ...springs.heavy, opacity: { duration: durations.base } } },
    exit: { opacity: 0, scale: 0.98, transition: { duration: durations.quick, ease: exitEase } },
  },
  /** Brota: crece desde su base (flores, chispas, sellos). */
  bloom: {
    initial: () => (reduced() ? fade : { opacity: 0, scale: 0.4, rotate: -14 }),
    animate: { opacity: 1, scale: 1, rotate: 0, transition: springs.heavy },
    exit: { opacity: 0, scale: 0.8, transition: { duration: durations.quick, ease: exitEase } },
  },
} satisfies Record<string, Variants>;

/** Salida de zona: el contenido se aparta un poco y se desvanece (≤ 220 ms). */
export const zoneExit = { opacity: 0, y: -8, transition: { duration: durations.quick, ease: exitEase } };
