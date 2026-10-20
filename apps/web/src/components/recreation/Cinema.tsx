// Piezas de la sala de cine (Recreación). El momento memorable es uno solo: al
// entrar, el telón de terciopelo se recoge y el proyector ilumina la pantalla.
// Lo demás (boletas, cartelera) queda quieto hasta que la persona actúa. Solo se
// anima transform y opacity; con «Reducir movimiento» el telón ya está abierto y
// las bombillas, el haz y el grano se quedan quietos. Fuera de pantalla, todo se pausa.
import { useState, type CSSProperties, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs, useMotionReduced } from '@/lib/motion';
import { usePaused } from '@/components/ambience';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useToastStore } from '@/hooks/useToast';
import * as recreationService from '@/services/recreation.service';
import type { RecreationEntry } from '@/services/recreation.service';
import { kindOf, minutesLabel, seriesPosition, seriesProgress, stubDate } from './recreationMeta';

const CURTAIN_EASE = [0.65, 0, 0.35, 1] as const;

/** Telón: dos paños que se recogen hacia los lados. Al encogerse, los pliegues se juntan como tela real. */
function Curtains() {
  const reduce = useMotionReduced();
  const wide = useMediaQuery('(min-width: 768px)');
  const open = { scaleX: wide ? 0.12 : 0.07 };
  const transition = reduce ? { duration: 0 } : { duration: 1.2, ease: CURTAIN_EASE, delay: 0.2 };
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[2] overflow-hidden rounded-[inherit]">
      <motion.span className="lq-cine-curtain absolute inset-y-0 left-0 block w-1/2 origin-left" initial={reduce ? open : { scaleX: 1 }} animate={open} transition={transition} />
      <motion.span className="lq-cine-curtain lq-cine-curtain-r absolute inset-y-0 right-0 block w-1/2 origin-right" initial={reduce ? open : { scaleX: 1 }} animate={open} transition={transition} />
      <span className="lq-cine-valance absolute inset-x-0 top-0 block h-5 md:h-7" />
    </div>
  );
}

/** Hilera de bombillas de la marquesina. */
export function Bulbs({ count = 14, className }: { count?: number; className?: string }) {
  return (
    <span aria-hidden="true" className={cn('flex items-center justify-between', className)}>
      {Array.from({ length: count }, (_, i) => <span key={i} className="lq-bulb" style={{ '--i': i } as CSSProperties} />)}
    </span>
  );
}

/** La sala: oscuridad, haz del proyector, grano de película, telón y la pantalla al centro. */
export function Theater({ children, className }: { children: ReactNode; className?: string }) {
  const { ref, paused } = usePaused<HTMLDivElement>();
  return (
    <div ref={ref} data-paused={paused || undefined} className={cn('lq-cine-room relative isolate overflow-hidden rounded-[28px] px-8 pb-7 pt-10 md:px-[14%] md:pb-10 md:pt-14', className)}>
      <span aria-hidden="true" className="lq-cine-beam pointer-events-none absolute left-1/2 top-0 block h-[120%] w-[160%] -translate-x-1/2" />
      <span aria-hidden="true" className="lq-cine-grain pointer-events-none absolute inset-[-12%] block" />
      <Curtains />
      <div className="relative z-[1] flex flex-col gap-5">{children}</div>
    </div>
  );
}

/** Pantalla plateada: lo que se proyecta encima se lee con tinta oscura. */
export function Screen({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('lq-cine-screen relative w-full rounded-[10px] px-5 py-7 text-center md:px-10 md:py-10', className)}>{children}</div>;
}

/** Estrellas: lectura (sin onChange) o selector accesible de 1 a 5. */
export function Stars({ value, onChange, className }: { value: number | null; onChange?: (v: number | null) => void; className?: string }) {
  const reduce = useMotionReduced();
  if (!onChange) {
    if (!value) return null;
    return (
      <span role="img" aria-label={`${value} de 5 estrellas`} className={cn('flex items-center gap-0.5 text-secondary', className)}>
        {Array.from({ length: 5 }, (_, i) => <Star key={i} aria-hidden className={cn('size-3.5', i < value ? 'fill-current' : 'opacity-30')} strokeWidth={1.75} />)}
      </span>
    );
  }
  return (
    <div role="radiogroup" aria-label="Calificación" className={cn('flex items-center gap-1', className)}>
      {Array.from({ length: 5 }, (_, i) => {
        const n = i + 1;
        const on = (value ?? 0) >= n;
        return (
          <motion.button
            key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} ${n === 1 ? 'estrella' : 'estrellas'}`}
            // Tocar la estrella marcada la quita: calificar es opcional.
            onClick={() => onChange(value === n ? null : n)}
            whileTap={reduce ? undefined : { scale: 0.82 }}
            animate={reduce ? undefined : { scale: on ? 1 : 0.92 }}
            transition={springs.snappy}
            className="flex size-11 items-center justify-center rounded-full text-secondary"
          >
            <Star aria-hidden className={cn('size-7 transition-[fill-opacity] duration-200', on ? 'fill-current' : 'fill-transparent opacity-50')} strokeWidth={1.5} />
          </motion.button>
        );
      })}
    </div>
  );
}

/** Boleta de una función vivida: talón perforado con la fecha y el tipo de ocio. Las series traen su capítulo al día y un botón para sumar uno. */
export function Ticket({ entry, onOpen, onUpdated }: { entry: RecreationEntry; onOpen: () => void; onUpdated: (entry: RecreationEntry) => void }) {
  const kind = kindOf(entry.kind);
  const d = stubDate(entry.date);
  const position = seriesPosition(entry);
  const progress = seriesProgress(entry);
  const series = entry.kind === 'SERIES';
  const finished = progress === 100;
  const [advancing, setAdvancing] = useState(false);

  async function nextEpisode() {
    setAdvancing(true);
    try { onUpdated(await recreationService.advanceRecreationSeries(entry.id, 'episode')); }
    catch { useToastStore.getState().error('No se pudo avanzar el capítulo', entry.title); }
    finally { setAdvancing(false); }
  }

  return (
    <div className="relative">
      <button
        type="button" aria-haspopup="dialog" onClick={onOpen}
        aria-label={`${entry.title}, ${kind.label}, ${d.weekday} ${d.day} ${d.month}${position ? `, ${position}` : ''}${entry.rating ? `, ${entry.rating} estrellas` : ''}`}
        className="lq-ticket grid w-full grid-cols-[var(--stub)_minmax(0,1fr)] text-left transition-transform duration-[325ms] ease-[var(--lq-ease-snappy)] active:scale-[.985]"
      >
        <span aria-hidden="true" className="lq-ticket-stub flex flex-col items-center justify-center gap-0.5 py-3">
          <kind.icon className="mb-0.5 size-5" strokeWidth={1.75} />
          <span className="text-label-md">{d.weekday}</span>
          <span className="font-mono text-heading-sm leading-none tabular-nums">{d.day}</span>
          <span className="text-label-md">{d.month}</span>
        </span>
        <span className={cn('flex min-w-0 flex-col justify-center gap-1 px-4 py-3', series && 'pr-44')}>
          <span className="truncate text-body-lg font-semibold">{entry.title}</span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-on-surface-light">
            <span>{kind.label}</span>
            {position && <span>{position}</span>}
            {entry.minutes ? <span className="font-mono tabular-nums">{minutesLabel(entry.minutes)}</span> : null}
            <Stars value={entry.rating} />
            {entry.xpEarned > 0 && <span className="font-mono text-secondary-text tabular-nums">+{entry.xpEarned} XP</span>}
          </span>
          {progress !== null && (
            <span className="flex items-center gap-3 pt-1 text-label-md text-on-surface-light">
              <span role="progressbar" aria-label={`Capítulos vistos de ${entry.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="relative h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-surface-variant">
                <span className="absolute inset-y-0 left-0 rounded-full bg-secondary" style={{ width: `${progress}%` }} />
              </span>
              <span className="font-mono tabular-nums">{entry.episodesWatched} de {entry.totalEpisodes}</span>
            </span>
          )}
        </span>
      </button>
      {series && entry.status === 'DONE' && (
        <button
          type="button" onClick={() => void nextEpisode()} disabled={advancing || finished}
          className="absolute right-3 top-1/2 inline-flex min-h-11 -translate-y-1/2 items-center rounded-full bg-secondary/[var(--lq-soft-alpha)] px-4 text-body-sm font-semibold text-secondary-text transition-opacity disabled:opacity-50"
        >
          {finished ? 'Serie terminada' : 'Siguiente capítulo'}
        </button>
      )}
    </div>
  );
}

/** Póster de la cartelera (algo por ver). */
export function Poster({ entry, onOpen, index }: { entry: RecreationEntry; onOpen: () => void; index: number }) {
  const kind = kindOf(entry.kind);
  const reduce = useMotionReduced();
  return (
    <motion.button
      type="button" aria-haspopup="dialog" onClick={onOpen} aria-label={`${entry.title}, ${kind.label}, por ver`}
      initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ ...springs.natural, delay: reduce ? 0 : 0.05 * index }}
      whileTap={reduce ? undefined : { scale: 0.97 }}
      style={{ '--tone': `rgb(var(--lq-${kind.tone}))` } as CSSProperties}
      className="lq-poster flex aspect-[2/3] w-32 flex-col justify-between rounded-2xl p-3 text-left md:w-36"
    >
      <kind.icon aria-hidden className="size-6 opacity-90" strokeWidth={1.5} />
      <span className="flex flex-col gap-1">
        <span className="line-clamp-3 text-body-md font-semibold leading-snug">{entry.title}</span>
        <span className="text-label-md opacity-80">{kind.label}</span>
      </span>
    </motion.button>
  );
}
