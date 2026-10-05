import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { item } from '@/lib/motion';
import { TitleText } from './Lettering';

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Texto pequeño en color primario sobre el título (zona, fecha…). */
  eyebrow?: ReactNode;
  /** Contenido a la derecha (controles, anillo, SegmentedControl). */
  aside?: ReactNode;
  /** @deprecated usa `aside`. */
  actions?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

/** Cabecera de zona del rediseño (prototipos *Desktop: eyebrow + t-dl + t-bl).
 *  Es un hijo `item` del stagger de la página: entra con blur-in v3. */
export function PageHeader({ title, description, eyebrow, aside, actions, className }: PageHeaderProps) {
  const right = aside ?? actions;
  return (
    <motion.section variants={item} className={cn('flex flex-wrap items-end justify-between gap-6', className)}>
      <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-2">
        {eyebrow && <span className="text-label-lg text-primary-text">{eyebrow}</span>}
        <h1 className="text-display-sm [text-wrap:balance] md:text-display-md lg:text-display-lg"><TitleText>{title}</TitleText></h1>
        {description && <p className="max-w-[560px] text-body-lg text-on-surface-light">{description}</p>}
      </div>
      {right && <div className="flex min-w-0 flex-wrap items-center gap-3">{right}</div>}
    </motion.section>
  );
}
