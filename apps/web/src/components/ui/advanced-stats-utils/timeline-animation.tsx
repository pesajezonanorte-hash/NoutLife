import { type ReactNode, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { cn } from '@/lib/utils';

interface TimelineAnimationProps {
  children: ReactNode;
  animationNum?: number;
  className?: string;
}

/**
 * Small, reusable entrance transition for the Analytics layout. It animates
 * only opacity and position, so cards retain their dimensions and never push
 * neighbouring controls while the user interacts with the page.
 */
export function TimelineAnimation({ children, animationNum = 0, className }: TimelineAnimationProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.12 });

  return (
    <motion.div
      ref={ref}
      className={cn('min-w-0', className)}
      initial={{ opacity: 0, y: 12 }}
      animate={isInView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.36, delay: Math.min(animationNum * 0.055, 0.22), ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
