// Raíz de una zona ambientada: escalona la entrada de sus hijos, sale con la
// salida común de zona y pone su capa de ambiente detrás del contenido sin
// crear un contexto de apilamiento (los diálogos sin portal siguen encima).
import type { CSSProperties, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { stagger, zoneExit } from '@/lib/motion';
import { ZoneAmbience } from './ZoneAmbience';

export function ZoneShell({ zone, ambience, view, className, contentClassName, children }: {
  zone: string;
  /** Ambiente que recorre toda la zona. */
  ambience?: ReactNode;
  /** Ambiente que acompaña al scroll (sticky). */
  view?: ReactNode;
  className?: string;
  /** Clases del contenedor del contenido (por defecto la columna con gap de las páginas). */
  contentClassName?: string;
  children: ReactNode;
}) {
  return (
    <motion.div variants={stagger} initial="initial" animate="animate" exit={zoneExit} className={cn('relative', className)}>
      {(ambience || view) && <ZoneAmbience zone={zone} view={view}>{ambience}</ZoneAmbience>}
      <div className={cn('relative flex flex-col gap-6 md:gap-12', contentClassName)}>{children}</div>
    </motion.div>
  );
}

type LightTone = 'primary' | 'warning' | 'secondary' | 'info' | 'error' | 'success' | 'jade-200' | 'jade-300' | 'jade-400';

/**
 * Luz de ambiente: un halo radial de un token que respira despacio. `alpha` y
 * `darkAlpha` fijan su intensidad en claro y en oscuro. Posición y tamaño por clases.
 */
export function AmbientLight({ tone = 'warning', alpha = 0.1, darkAlpha, d = 14, className, breathe = true }: {
  tone?: LightTone; alpha?: number; darkAlpha?: number; d?: number; className?: string; breathe?: boolean;
}) {
  return (
    <span
      className={cn('lq-light absolute block rounded-full', breathe && 'lq-amb-breathe', className)}
      style={{ '--lt': `var(--lq-${tone})`, '--a-l': alpha, '--a-d': darkAlpha ?? alpha * 0.6, '--d': `${d}s`, '--hi': 1, '--lo': 0.6 } as CSSProperties}
    />
  );
}
