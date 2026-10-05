import { useEffect, useRef } from 'react';
import { motion, useAnimationControls, type HTMLMotionProps } from 'framer-motion';
import { thud } from '@/lib/motion';

type ThudProps = Omit<HTMLMotionProps<'div'>, 'animate'> & {
  /** Cada vez que cambia, el bloque acusa un golpe seco (y 0→3→−1→0). */
  trigger: number | string;
  as?: 'div' | 'section' | 'article';
};

/** Bloque con peso: cuando algo cae dentro (una serie, un movimiento, un disco), lo acusa. */
export function Thud({ trigger, as = 'div', children, ...rest }: ThudProps) {
  const controls = useAnimationControls();
  const prev = useRef(trigger);
  useEffect(() => {
    if (trigger !== prev.current) void controls.start(thud);
    prev.current = trigger;
  }, [trigger, controls]);
  const Tag = as === 'section' ? motion.section : as === 'article' ? motion.article : motion.div;
  const Any = Tag as typeof motion.div;
  return <Any animate={controls} {...rest}>{children}</Any>;
}
