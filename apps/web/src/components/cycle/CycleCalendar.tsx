// Calendario del ciclo: cada día lleva abajo el color de su fase (real o
// prevista), una gota si hubo sangrado y un punto si tiene registro. Los días
// del próximo periodo previsto llevan un borde punteado. Tocar un día abre su
// registro (o su previsión, si aún no llega).
import { useMemo, useState, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Droplet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion';
import { Button } from '@/components/ui/lq';
import type { CycleLog, CycleOverview, CyclePhase } from '@/services/cycle.service';
import { PHASE_META, cycleRanges, daysBetween, isBleeding, phaseOnDay, shiftDay } from './cycleMeta';

const DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const keyOf = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export interface DayInfo {
  key: string;
  phase: CyclePhase | null;
  /** La fase es una previsión (día futuro o próximo ciclo). */
  predicted: boolean;
  /** Día de un periodo anotado o con sangrado registrado. */
  bleeding: boolean;
  /** Día previsto del próximo periodo. */
  expectedPeriod: boolean;
  log: CycleLog | null;
}

/** Lo que se sabe (o se prevé) de cada día a partir del resumen de la API. */
export function useDayInfo(data: CycleOverview) {
  return useMemo(() => {
    const logs = new Map(data.logs.map((l) => [l.date, l]));
    const snap = data.snapshot;
    const today = data.today;
    const avg = data.averages;
    const sorted = [...data.periods].sort((a, b) => b.startDate.localeCompare(a.startDate));
    // Un periodo abierto llega hasta hoy mientras dura; si ya debió acabar, hasta su largo previsto.
    const openEnd = snap?.periodOpen ? (snap.onPeriod ? today : shiftDay(snap.periodStart, snap.shape.period - 1)) : null;
    const inPeriod = (key: string) => sorted.some((p) => key >= p.startDate && key <= (p.endDate ?? (snap && p.startDate === snap.periodStart && openEnd ? openEnd : p.startDate)));
    const nextRanges = cycleRanges(avg.cycleLength, avg.periodLength);

    return (key: string): DayInfo => {
      const log = logs.get(key) ?? null;
      const bleeding = isBleeding(log?.flow) || inPeriod(key);
      let phase: CyclePhase | null = null;
      let predicted = key > today;
      let expectedPeriod = false;
      if (snap) {
        const diff = daysBetween(snap.periodStart, key);
        const span = Math.max(snap.shape.length, snap.cycleDay);
        if (diff >= 0 && diff < span) {
          phase = phaseOnDay(diff + 1, snap.shape.ranges);
        } else if (diff >= span && snap.lateDays === 0) {
          // Ciclos siguientes: se repite el ciclo medio.
          const day = ((diff - snap.shape.length) % avg.cycleLength) + 1;
          phase = phaseOnDay(day, nextRanges);
          predicted = true;
          expectedPeriod = phase === 'menstrual';
        } else if (diff < 0) {
          const prev = sorted.find((p) => p.startDate <= key);
          if (prev) {
            const day = daysBetween(prev.startDate, key) + 1;
            if (day <= 60) phase = phaseOnDay(day, cycleRanges(avg.cycleLength, prev.length ?? avg.periodLength));
          }
        }
      }
      if (bleeding && !predicted) phase = 'menstrual';
      return { key, phase, predicted, bleeding, expectedPeriod, log };
    };
  }, [data]);
}

export function CycleCalendar({ data, onSelect, selected }: { data: CycleOverview; onSelect: (info: DayInfo) => void; selected?: string | null }) {
  const today = data.today;
  const [cursor, setCursor] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }));
  const infoOf = useDayInfo(data);
  const offset = (new Date(cursor.y, cursor.m, 1).getDay() + 6) % 7;
  const total = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const title = new Date(cursor.y, cursor.m, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
  const move = (d: number) => setCursor(({ y, m }) => { const n = new Date(y, m + d, 1); return { y: n.getFullYear(), m: n.getMonth() }; });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-heading-sm first-letter:uppercase" aria-live="polite">{title}</h3>
        <div className="flex gap-1">
          <Button variant="icon" aria-label="Mes anterior" onClick={() => move(-1)}><ChevronLeft aria-hidden className="size-5" /></Button>
          <Button variant="icon" aria-label="Mes siguiente" onClick={() => move(1)}><ChevronRight aria-hidden className="size-5" /></Button>
        </div>
      </div>
      <div aria-hidden className="grid grid-cols-7 gap-1.5">
        {DOW.map((d) => <span key={d} className="text-center text-label-md text-on-surface-light">{d}</span>)}
      </div>
      <motion.div key={`${cursor.y}-${cursor.m}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0, transition: springs.natural }} className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: offset }, (_, i) => <span key={`pad-${i}`} aria-hidden />)}
        {Array.from({ length: total }, (_, i) => {
          const key = keyOf(cursor.y, cursor.m, i + 1);
          const info = infoOf(key);
          const isToday = key === today;
          const meta = info.phase ? PHASE_META[info.phase] : null;
          const label = [
            new Date(`${key}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }),
            meta ? `${meta.name}${info.predicted ? ' (prevista)' : ''}` : null,
            info.bleeding ? 'con sangrado' : info.expectedPeriod ? 'periodo previsto' : null,
            info.log ? 'con registro' : null,
          ].filter(Boolean).join(', ');
          return (
            <button
              key={key} type="button" aria-label={label} aria-current={isToday ? 'date' : undefined} aria-pressed={selected === key}
              onClick={() => onSelect(info)}
              style={info.phase ? ({ '--tone': `var(--cy-${info.phase})` } as CSSProperties) : undefined}
              className={cn(
                'relative flex min-h-11 flex-col items-center justify-between rounded-xl py-1.5 text-center transition-[background-color,transform] duration-200 active:scale-[.96] md:aspect-square md:min-h-0',
                info.phase && 'lq-cy-day',
                selected === key ? 'bg-primary/[var(--lq-soft-alpha)]' : 'bg-surface-variant hover:bg-border',
                info.predicted && 'opacity-80',
                info.expectedPeriod && 'outline-dashed outline-[1.5px] -outline-offset-2 outline-[rgb(var(--cy-menstrual)/.7)]',
              )}
            >
              <span className={cn('inline-flex size-7 items-center justify-center rounded-full font-mono text-label-lg tabular-nums', isToday && 'bg-on-background text-background')}>{i + 1}</span>
              <span aria-hidden className="flex h-3.5 items-center gap-0.5">
                {info.bleeding && <Droplet className="size-3.5" fill="currentColor" strokeWidth={1.5} style={{ color: 'rgb(var(--cy-menstrual))' }} />}
                {info.log && !info.bleeding && <span className="size-1.5 rounded-full bg-on-surface-light" />}
              </span>
            </button>
          );
        })}
      </motion.div>
    </div>
  );
}
