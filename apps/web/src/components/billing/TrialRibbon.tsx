// La prueba como una racha: siete días con el mismo lenguaje de puntos que los
// hábitos, y el octavo, en oro champán, es el primer cobro. Es el único momento
// animado de la sección de precios: los días se marcan uno tras otro al entrar
// en pantalla. Con «Reducir movimiento» aparece ya completa.
import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMotionReduced } from '@/lib/motion';
import { TRIAL_DAYS } from '@/lib/plan';
import { useLocale } from '@/lib/i18n';

interface TrialRibbonProps {
  /** Días de prueba ya vividos (pantalla de Plan). Sin valor, se marcan los 7 (sección pública). */
  elapsed?: number;
  /** Texto bajo el punto del cobro, p. ej. «$9.900/mes» o «19 de oct.». */
  chargeLabel: string;
  /** Frase completa para lectores de pantalla. */
  summary: string;
  className?: string;
}

const STEP = 0.08;

export function TrialRibbon({ elapsed, chargeLabel, summary, className }: TrialRibbonProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useMotionReduced();
  const locale = useLocale();
  const show = inView || reduce;
  const filled = Math.min(TRIAL_DAYS, Math.max(0, elapsed ?? TRIAL_DAYS));
  const live = elapsed !== undefined;
  const days = Array.from({ length: TRIAL_DAYS }, (_, i) => i + 1);

  return (
    <div ref={ref} lang={locale} className={cn('flex flex-col gap-2', className)}>
      <p className="sr-only">{summary}</p>
      <div aria-hidden className="relative flex items-center justify-between">
        {/* Hilo que une los días: se tiende de izquierda a derecha. */}
        <motion.span
          className="absolute inset-x-4 top-1/2 h-0.5 origin-left -translate-y-1/2 rounded-full bg-border sm:inset-x-5"
          initial={reduce ? false : { scaleX: 0 }}
          animate={show ? { scaleX: 1 } : undefined}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        />
        {days.map((day, i) => {
          const done = i < filled;
          const today = live && i === filled;
          return (
            <motion.span
              key={day}
              className={cn(
                'relative flex size-8 shrink-0 items-center justify-center rounded-full text-label-md sm:size-11 sm:text-label-lg',
                done && 'bg-primary-strong text-on-primary',
                today && 'bg-background text-primary-text ring-2 ring-primary',
                !done && !today && 'bg-surface-variant text-on-surface-light',
              )}
              initial={reduce ? false : { scale: 0.5, opacity: 0 }}
              animate={show ? { scale: 1, opacity: 1 } : undefined}
              transition={{ type: 'spring', stiffness: 420, damping: 22, delay: i * STEP }}
            >
              {done ? (
                <motion.span
                  initial={reduce ? false : { scale: 0, rotate: -30 }}
                  animate={show ? { scale: 1, rotate: 0 } : undefined}
                  transition={{ type: 'spring', stiffness: 520, damping: 18, delay: 0.12 + i * STEP }}
                >
                  <Check className="size-4" strokeWidth={2.5} />
                </motion.span>
              ) : day}
            </motion.span>
          );
        })}
        <motion.span
          className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary/[var(--lq-soft-alpha)] text-label-lg text-secondary-text ring-1 ring-secondary/60 sm:size-11 sm:text-heading-sm"
          initial={reduce ? false : { scale: 0.4, opacity: 0 }}
          animate={show ? { scale: 1, opacity: 1 } : undefined}
          transition={{ type: 'spring', stiffness: 380, damping: 16, delay: TRIAL_DAYS * STEP + 0.1 }}
        >
          $
        </motion.span>
      </div>
      <div aria-hidden className="flex items-baseline justify-between gap-3 text-body-sm">
        <span className="text-on-surface-light">
          {locale === 'en'
            ? (live ? `Day ${Math.min(filled + 1, TRIAL_DAYS)} of ${TRIAL_DAYS}` : `${TRIAL_DAYS} days free`)
            : (live ? `Día ${Math.min(filled + 1, TRIAL_DAYS)} de ${TRIAL_DAYS}` : `${TRIAL_DAYS} días gratis`)}
        </span>
        <span className="font-semibold text-secondary-text">{chargeLabel}</span>
      </div>
    </div>
  );
}
