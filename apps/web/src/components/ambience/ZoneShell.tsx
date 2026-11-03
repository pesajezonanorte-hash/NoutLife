// Raíz de una zona ambientada: escalona la entrada de sus hijos, sale con la
// salida común de zona y pone su capa de ambiente detrás del contenido sin
// crear un contexto de apilamiento (los diálogos sin portal siguen encima).
import { useContext, useMemo, type CSSProperties, type ReactNode } from 'react';
import { motion, PresenceContext } from 'framer-motion';
import { cn } from '@/lib/utils';
import { stagger, zoneExit } from '@/lib/motion';
import { ZoneAmbience } from './ZoneAmbience';

/**
 * Deja ver las entradas aunque haya encima un AnimatePresence con initial={false}
 * (el del router en la primera carga o un selector de vista): ese initial se queda
 * en el contexto de presencia y bloquea toda animación inicial del subárbol, incluso
 * la de lo que se monta después. Aquí se re-provee el mismo contexto sin él; el
 * registro y onExitComplete son los mismos, así que las salidas siguen funcionando.
 */
export function AllowEntrance({ children }: { children: ReactNode }) {
  const ctx = useContext(PresenceContext);
  const value = useMemo(() => (ctx && ctx.initial === false ? { ...ctx, initial: undefined } : ctx), [ctx]);
  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
}

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
    <AllowEntrance>
      <motion.div variants={stagger} initial="initial" animate="animate" exit={zoneExit} className={cn('relative', className)}>
        {(ambience || view) && <ZoneAmbience zone={zone} view={view}>{ambience}</ZoneAmbience>}
        <div className={cn('relative flex flex-col gap-6 md:gap-12', contentClassName)}>{children}</div>
      </motion.div>
    </AllowEntrance>
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
