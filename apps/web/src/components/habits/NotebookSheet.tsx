// Hoja de libreta para la lista de hábitos: papel con grano, margen rojo,
// perforaciones de hoja suelta, unas líneas vacías al final y garabatos
// tenues en los márgenes. Al llegar, la hoja se posa sobre la mesa, el margen
// se traza de arriba abajo y los garabatos se dibujan despacio; después el
// papel «respira» con una luz que deriva muy lenta. Todo lo decorativo va en
// <ZoneAmbience> (aria-hidden, sin eventos, en pausa fuera de pantalla).
import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion/presets';
import { InkPath, ZoneAmbience } from '@/components/ambience';

export interface NotebookTab<T extends string> { value: T; label: string; icon: LucideIcon; count?: number }

/**
 * Separadores de la libreta: pestañas de papel que asoman sobre la hoja. La
 * activa es del mismo papel que la hoja y se funde con ella; las demás quedan
 * detrás, un poco más abajo. Flechas izquierda/derecha cambian de pestaña.
 * Cada pestaña controla la hoja con id `${idOf(valor)}-panel`. En móvil van sin ícono y,
 * si aun así no caben (pantallas de 320 px), la fila se desliza con el dedo.
 */
export function NotebookTabs<T extends string>({ value, onChange, tabs, label, idOf }: {
  value: T;
  onChange: (value: T) => void;
  tabs: NotebookTab<T>[];
  label: string;
  idOf: (value: T) => string;
}) {
  const ink = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = (i + d + tabs.length) % tabs.length;
    onChange(tabs[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className="relative z-[1] -mb-px flex gap-1 overflow-x-auto [scrollbar-width:none] sm:gap-1.5 sm:overflow-visible [&::-webkit-scrollbar]:hidden">
      {tabs.map((t, i) => {
        const on = t.value === value;
        const Icon = t.icon;
        return (
          <button
            key={t.value}
            ref={(el) => (refs.current[i] = el)}
            id={`${idOf(t.value)}-tab`}
            type="button"
            role="tab"
            aria-selected={on}
            aria-controls={`${idOf(t.value)}-panel`}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              'relative inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-t-xl border border-b-0 px-2.5 text-label-lg sm:gap-2 sm:px-4',
              'transition-[transform,color,background-color] duration-[325ms] ease-[var(--lq-ease-snappy)] [.reduce-motion_&]:transition-none',
              on
                ? 'lq-tex-paper border-border text-on-background'
                : 'translate-y-1 border-transparent bg-surface-variant text-on-surface hover:translate-y-0.5 hover:text-on-background',
            )}
          >
            {/* Cinta de color en el borde del separador activo */}
            {on && <motion.span layoutId={ink} aria-hidden="true" className="absolute inset-x-3 top-0 h-[3px] rounded-b-full bg-warning" transition={springs.natural} />}
            <Icon aria-hidden className="hidden size-4 sm:block" strokeWidth={1.75} />
            {t.label}
            {t.count !== undefined && <span className="font-mono text-label-md tabular-nums text-on-surface-light">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Garabatos de margen: estrella, espiral, flecha y nube. */
const DOODLES = [
  { d: 'M12 2.5l2.6 6.1 6.6.5-5 4.3 1.6 6.5L12 16.4 6.2 19.9l1.6-6.5-5-4.3 6.6-.5z', box: '0 0 24 24', cls: 'hidden md:block left-[2.1rem] top-[1.35rem] size-6', r: '4deg', d0: 1.0 },
  { d: 'M12 12.4c.6-1.2 2.2-.7 2.1.6-.2 2.1-3.3 2.4-4.3.6-1.4-2.6 1.4-5.6 4.3-4.7 3.9 1.1 4 6.5.9 8.4-3.6 2.3-8.7.2-9.1-4', box: '0 0 24 24', cls: 'bottom-10 right-8 size-8 md:bottom-12 md:right-14 md:size-10', r: '6deg', d0: 1.25 },
  { d: 'M3 15.5c4.6-.9 9.1-3.6 12.8-7.7M12.4 6.8l3.9.6-.4 4', box: '0 0 20 20', cls: 'bottom-6 left-[3.75rem] size-6 md:left-[6rem] md:size-7', r: '3deg', d0: 1.45 },
] as const;

export function NotebookSheet({ header, children, className, lines = 3, label = 'Lista de hábitos', id, labelledBy, tabbed }: {
  header: ReactNode;
  children: ReactNode;
  className?: string;
  /** Líneas vacías al final de la hoja. */
  lines?: number;
  label?: string;
  id?: string;
  /** Hoja de un separador (NotebookTabs): la nombra su pestaña. */
  labelledBy?: string;
  /** Lleva separadores encima: la esquina superior izquierda queda recta bajo la primera pestaña. */
  tabbed?: boolean;
}) {
  return (
    <motion.section
      id={id}
      {...(labelledBy ? { role: 'tabpanel', 'aria-labelledby': labelledBy } : { 'aria-label': label })}
      className={cn('lq-tex-paper relative overflow-hidden rounded-2xl border border-border shadow-md', tabbed && 'rounded-tl-none', className)}
      initial={{ y: 14, rotate: -0.35 }}
      animate={{ y: 0, rotate: 0, transition: springs.heavy }}
      exit={{ y: -10, opacity: 0, transition: { duration: 0.2 } }}
    >
      <ZoneAmbience zone="habits-sheet" scope="local">
        {/* El papel respira: una luz suave que deriva despacio sobre la hoja */}
        <span className="lq-amb-wander absolute -left-1/4 -top-1/3 block h-[120%] w-[120%] [--d:30s]">
          <span className="lq-amb-breathe block size-full bg-[radial-gradient(40%_35%_at_40%_35%,rgb(255_255_255/.55),transparent_70%)] [--d:11s] [--hi:.95] [--lo:.5] dark:bg-[radial-gradient(40%_35%_at_40%_35%,rgb(var(--lq-jade-50)/.035),transparent_70%)]" />
        </span>
        {/* Perforaciones de hoja suelta */}
        {['top-6', 'top-1/2 -translate-y-1/2', 'bottom-6'].map((pos) => (
          <span key={pos} className={cn('absolute left-2 hidden size-2.5 rounded-full bg-background shadow-[inset_0_1px_2px_rgb(var(--lq-on-background)/.2)] md:block', pos)} />
        ))}
        {/* Garabatos de margen */}
        {DOODLES.map((g) => (
          <svg key={g.cls} viewBox={g.box} className={cn('lq-amb-sway absolute overflow-visible text-on-surface-light opacity-[.16] dark:opacity-[.22]', g.cls)} style={{ ['--r' as string]: g.r, ['--d' as string]: '11s', ['--o' as string]: '50% 50%' }}>
            <InkPath d={g.d} delay={g.d0} duration={1.1} strokeWidth={1.4} />
          </svg>
        ))}
      </ZoneAmbience>

      {/* Margen rojo: se traza de arriba abajo */}
      <motion.span
        aria-hidden="true"
        className="lq-tex-margin pointer-events-none absolute inset-y-0 left-[3rem] w-0 origin-top md:left-[5rem]"
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1, transition: { ...springs.gentle, delay: 0.15 } }}
      />

      <div className="relative">
        <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-info/25 py-4 pl-[3.75rem] pr-3 md:pl-[6rem] md:pr-4">
          {header}
        </div>
        {children}
        <div aria-hidden="true" className="lq-tex-ruled pointer-events-none" style={{ height: `calc(var(--lq-rule) * ${lines})` }} />
      </div>
    </motion.section>
  );
}

/**
 * Nota adhesiva (aside de Hábitos): se posa ligeramente torcida con un trozo
 * de cinta; al pasar el cursor se endereza y se levanta un poco.
 */
export function StickyNote({ children, tilt = -0.8, className, delay = 0 }: { children: ReactNode; tilt?: number; className?: string; delay?: number }) {
  return (
    <motion.div
      className={cn('relative', className)}
      initial={{ opacity: 0, y: -18, rotate: tilt * 2.5 }}
      animate={{ opacity: 1, y: 0, rotate: tilt, transition: { ...springs.heavy, delay, opacity: { duration: 0.2, delay } } }}
      whileHover={{ rotate: 0, y: -3, transition: springs.natural }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
    >
      <span aria-hidden="true" className="pointer-events-none absolute -top-2.5 left-1/2 z-[1] block h-5 w-16 -translate-x-1/2 rotate-[-3deg] rounded-[2px] border border-on-background/[.06] bg-on-background/[.06] dark:bg-jade-50/[.08]" />
      {children}
    </motion.div>
  );
}
