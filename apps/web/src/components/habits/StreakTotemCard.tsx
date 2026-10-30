// Tarjeta «Tótem de racha» de Hábitos: el cristal 3D del hábito elegido (crece, brilla y suelta
// energía con los días seguidos) y, al lado, lo mismo en texto: racha, rango, próximo hito y la
// semana. Las flechas recorren los hábitos; al completar uno, la página lo enfoca aquí y el
// cristal celebra el día. three.js solo se descarga cuando la tarjeta se acerca a la pantalla;
// sin WebGL 2 queda la parte de texto.
import { Suspense, lazy, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { ChevronLeft, ChevronRight, Flame, Hand } from 'lucide-react';
import { ProgressBar } from '@/components/ui/lq';
import { hasWebGL2, useNear } from '@/components/three3d/near';
import { useText, type Copy } from '@/lib/i18n';
import type { Habit } from '@/services/habit.service';
import { totemState } from './totemMath';
import type { StreakTotem3DProps } from './totem/StreakTotem3D';

const es = {
  eyebrow: 'Tótem de racha',
  days: (n: number) => `${n} ${n === 1 ? 'día' : 'días'}`,
  ranks: ['Chispa', 'Brote', 'Cristal', 'Prisma', 'Faro', 'Tótem', 'Monolito', 'Coloso', 'Astro', 'Leyenda'],
  dormant: 'En reposo',
  toNext: (more: number, next: number) => `${more} ${more === 1 ? 'día' : 'días'} para llegar a ${next}`,
  progressTo: (n: number) => `Progreso hacia ${n} días`,
  ofDays: (n: number, of: number) => `${n} de ${of} días`,
  week: (n: number) => `${n} de 7 días esta semana`,
  hint: 'Cada día seguido el cristal crece, brilla más y suelta más energía. Las marcas del pedestal son tus últimos 7 días.',
  prev: 'Hábito anterior',
  next: 'Hábito siguiente',
  drag: 'Arrastra para girar',
  rankAria: (rank: string) => `Rango: ${rank}`,
};
const en: typeof es = {
  eyebrow: 'Streak totem',
  days: (n) => `${n} ${n === 1 ? 'day' : 'days'}`,
  ranks: ['Spark', 'Sprout', 'Crystal', 'Prism', 'Beacon', 'Totem', 'Monolith', 'Colossus', 'Star', 'Legend'],
  dormant: 'Dormant',
  toNext: (more, next) => `${more} ${more === 1 ? 'day' : 'days'} to reach ${next}`,
  progressTo: (n) => `Progress toward ${n} days`,
  ofDays: (n, of) => `${n} of ${of} days`,
  week: (n) => `${n} of 7 days this week`,
  hint: 'Every day in a row the crystal grows, glows brighter and gives off more energy. The marks on the pedestal are your last 7 days.',
  prev: 'Previous habit',
  next: 'Next habit',
  drag: 'Drag to turn',
  rankAria: (rank) => `Rank: ${rank}`,
};
const COPY: Copy<typeof es> = { es, en };

const StreakTotem3D = lazy<ComponentType<StreakTotem3DProps>>(() => import('./totem/StreakTotem3D').catch(() => ({
  default: ({ onUnavailable }: StreakTotem3DProps) => { useEffect(onUnavailable, []); return null; },
})));

export interface StreakTotemCardProps {
  habits: Habit[];
  /** Últimos 7 días de un hábito (el más antiguo primero, hoy al final). */
  weekOf: (h: Habit) => boolean[];
  /** Hábito que la página quiere mostrar (el que se acaba de completar). */
  focusId?: string | null;
}

export function StreakTotemCard({ habits, weekOf, focusId }: StreakTotemCardProps) {
  const t = useText(COPY);
  const ref = useRef<HTMLElement>(null);
  const near = useNear(ref);
  const [ok, setOk] = useState(hasWebGL2);
  // Por defecto, el hábito con la racha más larga.
  const best = useMemo(() => habits.reduce<Habit | null>((b, h) => (!b || h.currentStreak > b.currentStreak ? h : b), null), [habits]);
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => { if (focusId) setPicked(focusId); }, [focusId]);
  const habit = habits.find((h) => h.id === picked) ?? best;
  if (!habit) return null;

  const state = totemState(habit.currentStreak);
  const week = weekOf(habit);
  const doneWeek = week.filter(Boolean).length;
  const rank = state.streak === 0 ? t.dormant : t.ranks[Math.min(t.ranks.length - 1, state.tier)];
  const cycle = (dir: 1 | -1) => {
    const i = habits.findIndex((h) => h.id === habit.id);
    setPicked(habits[(i + dir + habits.length) % habits.length].id);
  };

  return (
    <section ref={ref} aria-labelledby="totem-title" className="lq-glass3d flex flex-col">
      <div className="relative h-[250px] sm:h-[280px] lg:h-[300px]">
        <span aria-hidden className="lq-totem-aura pointer-events-none absolute inset-0" />
        {ok && near ? (
          <Suspense fallback={null}>
            <StreakTotem3D data={{ streak: habit.currentStreak, week }} onUnavailable={() => setOk(false)} />
          </Suspense>
        ) : !ok && (
          <span aria-hidden className="absolute inset-0 flex items-center justify-center text-warning-text">
            <Flame className="size-16 animate-float [.reduce-motion_&]:animate-none" strokeWidth={1.25} />
          </span>
        )}
        {ok && (
          <span aria-hidden className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-background/70 px-2.5 py-1 text-caption text-on-surface-light">
            <Hand className="size-3.5" strokeWidth={1.75} />{t.drag}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-3 border-t border-on-background/[.07] p-5">
        <div className="flex items-center justify-between gap-2">
          <span id="totem-title" className="text-label-md font-semibold uppercase tracking-[.08em] text-primary-text">{t.eyebrow}</span>
          {habits.length > 1 && (
            <span className="flex gap-1.5">
              <button type="button" className="lq-flip-chip px-2" aria-label={t.prev} onClick={() => cycle(-1)}><ChevronLeft aria-hidden className="size-4" strokeWidth={2} /></button>
              <button type="button" className="lq-flip-chip px-2" aria-label={t.next} onClick={() => cycle(1)}><ChevronRight aria-hidden className="size-4" strokeWidth={2} /></button>
            </span>
          )}
        </div>
        <div aria-live="polite" className="flex flex-col gap-2">
          <h2 className="truncate text-heading-sm">{habit.title}</h2>
          <div className="flex items-baseline justify-between gap-3">
            <span className="flex items-center gap-1.5 font-mono text-heading-md font-bold tabular-nums text-warning-text">
              <Flame aria-hidden className="size-5" strokeWidth={1.75} />{t.days(state.streak)}
            </span>
            <span className="lq-totem-rank" aria-label={t.rankAria(rank)}>{rank}</span>
          </div>
          <ProgressBar
            value={state.toNext * 100} tone="warning" shine
            label={t.progressTo(state.next)} valueText={t.ofDays(state.streak, state.next)}
          />
          <div className="flex items-center justify-between gap-3 text-body-sm text-on-surface-light">
            <span>{t.toNext(state.next - state.streak, state.next)}</span>
            <span className="flex gap-1" role="img" aria-label={t.week(doneWeek)}>
              {week.map((d, i) => <span key={i} className={d ? 'lq-totem-dot lq-totem-dot-on' : 'lq-totem-dot'} />)}
            </span>
          </div>
        </div>
        <p className="text-caption text-on-surface-light">{t.hint}</p>
      </div>
    </section>
  );
}
