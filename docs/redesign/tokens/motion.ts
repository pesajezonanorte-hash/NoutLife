// apps/web/src/lib/motion.ts — Framer Motion 11 presets for LifeQuest.
import type React from 'react';
// Wrap the app once: <MotionConfig reducedMotion="user"> (removes transforms, keeps opacity).
import { useEffect, useState } from 'react';
import { animate, useReducedMotion, type Transition, type Variants } from 'framer-motion';

export const ease = [0, 0, 0.2, 1] as const;          // ease-out
export const spring: Transition = { type: 'spring', stiffness: 420, damping: 30 };

/** Screen enter/exit (AnimatePresence mode="wait" around <Outlet/>) */
export const page: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease, staggerChildren: 0.05 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

/** Stagger lists/grids: parent = stagger, children = item */
export const stagger: Variants = { animate: { transition: { staggerChildren: 0.06 } } };
export const item: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.45, ease } },
};

/** Buttons */
export const tap = { whileHover: { scale: 1.02 }, whileTap: { scale: 0.98 }, transition: { duration: 0.1 } };

/** Cards: lift + icon wiggle (put `variants={iconHover}` on the icon chip) */
export const cardHover = { whileHover: { y: -4 }, transition: { duration: 0.2, ease } };
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
  animate: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 380, damping: 26 } },
  exit: { opacity: 0, y: 10, transition: { duration: 0.2 } },
};
export const sheet: Variants = { initial: { y: '100%' }, animate: { y: 0, transition: { duration: 0.3, ease } }, exit: { y: '100%', transition: { duration: 0.2 } } };

/** Toast: bottom-center mobile, bottom-right desktop, 4 s */
export const toast: Variants = {
  initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

/** Duel entrance (Colosseum) */
export const fromLeft: Variants = { initial: { opacity: 0, x: -60 }, animate: { opacity: 1, x: 0, transition: spring } };
export const fromRight: Variants = { initial: { opacity: 0, x: 60 }, animate: { opacity: 1, x: 0, transition: spring } };

/** Habit check: rotate 360 + fill */
export const check = { animate: (on: boolean) => ({ rotate: on ? 360 : 0, transition: { duration: 0.2 } }) };

/** Animated number (balances, streaks, kcal). Respects reduced motion. */
export function useCountUp(target: number, duration = 1.1) {
  const reduce = useReducedMotion();
  const [v, setV] = useState(reduce ? target : 0);
  useEffect(() => {
    if (reduce) { setV(target); return; }
    const c = animate(0, target, { duration, ease: [0.33, 1, 0.68, 1], onUpdate: setV });
    return () => c.stop();
  }, [target, duration, reduce]);
  return v;
}

export const fmtNumber = (n: number) => Math.round(n).toLocaleString('es-CO');

/* ───────── Motion v3 (global upgrade) ─────────
   Replaces the default curves above for ALL screens: use `expo` for enters,
   `springSoft` for interactive elements. Exits stay 200 ms. */
export const expo = [0.16, 1, 0.3, 1] as const;          // --ease-expo
export const softOut = [0.22, 1, 0.36, 1] as const;      // --ease-soft
export const springSoft: Transition = { type: 'spring', stiffness: 300, damping: 24, mass: 0.9 }; // ≈ --ease-spring (slight overshoot)

/** Blur-in entrance (lq-in3). Blur is the only non-transform/opacity property allowed, entrance-only, ≤ 6px. */
export const page3: Variants = {
  initial: { opacity: 0, y: 24, scale: 0.985, filter: 'blur(6px)' },
  animate: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', transition: { duration: 0.8, ease: expo, staggerChildren: 0.06 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};
export const item3: Variants = {
  initial: { opacity: 0, y: 24, scale: 0.985, filter: 'blur(6px)' },
  animate: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', transition: { duration: 0.7, ease: expo } },
};
export const pop3: Variants = { initial: { opacity: 0, scale: 0.88 }, animate: { opacity: 1, scale: 1, transition: springSoft } };

/** v3 hovers: card lift −6px with spring, buttons spring scale */
export const tap3 = { whileHover: { scale: 1.02 }, whileTap: { scale: 0.97 }, transition: springSoft };
export const cardHover3 = { whileHover: { y: -6 }, transition: springSoft };

/** Bars / rings / lines on expo */
export const barFill3 = (value: number): any => ({
  initial: { scaleX: 0 }, animate: { scaleX: value / 100 },
  transition: { duration: 1.1, ease: expo, delay: 0.2 }, style: { originX: 0 },
});
export const draw3 = (progress = 1): any => ({
  initial: { pathLength: 0 }, animate: { pathLength: progress },
  transition: { duration: 1.6, ease: expo, delay: 0.15 },
});

/** Countdown digit tick (CampaignDesktop): key the element by its value inside AnimatePresence */
export const tick: Variants = {
  initial: { opacity: 0, y: -12 }, animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: expo } },
  exit: { opacity: 0, y: 12, transition: { duration: 0.2 } },
};

/** Spotlight + 3D tilt card (`.spot`). Sets CSS vars; tilt off with reduced motion.
 *  CSS: radial-gradient(480px circle at var(--mx) var(--my), rgb(var(--primary)/.10), transparent 62%) on ::before,
 *  transform: perspective(1100px) rotateX(var(--rx)) rotateY(var(--ry)). Max tilt 3°. */
export function useSpotlight<T extends HTMLElement>() {
  const reduce = useReducedMotion();
  const onPointerMove = (e: React.PointerEvent<T>) => {
    const el = e.currentTarget, r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    el.style.setProperty('--mx', `${x * 100}%`); el.style.setProperty('--my', `${y * 100}%`);
    if (!reduce) { el.style.setProperty('--rx', `${(0.5 - y) * 6}deg`); el.style.setProperty('--ry', `${(x - 0.5) * 6}deg`); }
  };
  const onPointerLeave = (e: React.PointerEvent<T>) => {
    const el = e.currentTarget; el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg');
  };
  return { onPointerMove, onPointerLeave };
}

/** Accordion (`.acc`): animate grid-template-rows 0fr→1fr (CSS, 450 ms expo) — the one allowed layout
 *  animation, because it avoids measuring height. Chevron rotates 180° with springSoft. */
