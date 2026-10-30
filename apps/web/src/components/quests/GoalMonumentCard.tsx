// Tarjeta «Monumento» de Misiones: la pirámide 3D de tus metas (cada peldaño, un 10 %; cada
// misión activa, un núcleo de energía a la altura de su avance; cada cumplida, una bandera en la
// cima) y, al lado, la misión elegida en texto con su progreso. Al completar una, su núcleo sube
// a la cima. three.js solo se descarga cuando la tarjeta se acerca a la pantalla; sin WebGL 2
// queda el panel de texto.
import { Suspense, lazy, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import type { Quest } from '@noutlife/shared';
import { ChevronLeft, ChevronRight, Flag, Hand, Mountain } from 'lucide-react';
import { ProgressBar } from '@/components/ui/lq';
import { hasWebGL2, useNear } from '@/components/three3d/near';
import { INTL_LOCALE, useLocale, useText, type Copy } from '@/lib/i18n';
import { isReady, questProgress } from './questMeta';
import { monumentGoals } from './monumentMath';
import type { Monument3DProps } from './monument/Monument3D';

const es = {
  eyebrow: 'Monumento',
  title: 'Tu ascenso',
  hint: 'Cada peldaño es un 10 % de avance y cada núcleo de luz, una misión en curso. Al cumplirla, sube a la cima e iza su bandera.',
  done: 'Cumplidas',
  active: 'En curso',
  empty: 'Marca un destino en el mapa y su núcleo aparecerá al pie del monumento.',
  allDone: 'Todas tus misiones están en la cima.',
  progressOf: (t: string) => `Progreso de ${t}`,
  ready: 'Lista para completar',
  prev: 'Misión anterior',
  next: 'Misión siguiente',
  open: (t: string) => `Abrir ${t}`,
  drag: 'Arrastra para girar',
};
const en: typeof es = {
  eyebrow: 'Monument',
  title: 'Your ascent',
  hint: 'Each step is 10% of progress and each core of light is a goal in progress. When you complete it, it rises to the top and raises its flag.',
  done: 'Completed',
  active: 'In progress',
  empty: 'Mark a destination on the map and its core will appear at the foot of the monument.',
  allDone: 'All your goals are at the top.',
  progressOf: (t) => `Progress of ${t}`,
  ready: 'Ready to complete',
  prev: 'Previous goal',
  next: 'Next goal',
  open: (t) => `Open ${t}`,
  drag: 'Drag to turn',
};
const COPY: Copy<typeof es> = { es, en };

const Monument3D = lazy<ComponentType<Monument3DProps>>(() => import('./monument/Monument3D').catch(() => ({
  default: ({ onUnavailable }: Monument3DProps) => { useEffect(onUnavailable, []); return null; },
})));

export interface GoalMonumentCardProps {
  /** Misiones activas, la más cercana primero. */
  ahead: Quest[];
  /** Misiones cumplidas. */
  visited: Quest[];
  onOpen: (q: Quest) => void;
}

export function GoalMonumentCard({ ahead, visited, onOpen }: GoalMonumentCardProps) {
  const t = useText(COPY);
  const locale = useLocale();
  const ref = useRef<HTMLElement>(null);
  const near = useNear(ref);
  const [ok, setOk] = useState(hasWebGL2);
  const [picked, setPicked] = useState<string | null>(null);
  const goals = useMemo(() => monumentGoals(ahead), [ahead]);
  const selected = ahead.find((q) => q.id === picked) ?? ahead[0] ?? null;
  const completedIds = useMemo(() => visited.map((q) => q.id), [visited]);
  const data = useMemo(() => ({ goals, completedIds, selected: selected?.id ?? null }), [goals, completedIds, selected?.id]);
  const progress = selected ? questProgress(selected, locale) : null;
  const fmt = (n: number) => n.toLocaleString(INTL_LOCALE[locale]);

  const cycle = (dir: 1 | -1) => {
    if (!ahead.length) return;
    const i = selected ? ahead.findIndex((q) => q.id === selected.id) : -1;
    setPicked(ahead[(i + dir + ahead.length) % ahead.length].id);
  };

  return (
    <section ref={ref} aria-labelledby="monument-title" className="lq-glass3d grid md:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
      <div className="relative h-[250px] sm:h-[290px] md:h-auto md:min-h-[340px]">
        <span aria-hidden className="lq-monument-aura pointer-events-none absolute inset-0" />
        {ok && near ? (
          <Suspense fallback={null}>
            <Monument3D
              data={data}
              onSelect={setPicked}
              onUnavailable={() => setOk(false)}
              tag={selected && progress && <><span className="truncate">{selected.title}</span><span className="font-mono tabular-nums text-primary-text">{progress.pct}%</span></>}
            />
          </Suspense>
        ) : !ok && (
          <span aria-hidden className="absolute inset-0 flex items-center justify-center text-primary-text">
            <Mountain className="size-20" strokeWidth={1.1} />
          </span>
        )}
        {ok && (
          <span aria-hidden className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-background/70 px-2.5 py-1 text-caption text-on-surface-light">
            <Hand className="size-3.5" strokeWidth={1.75} />{t.drag}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-3 border-t border-on-background/[.07] p-5 md:border-l md:border-t-0 md:p-6">
        <span className="text-label-md font-semibold uppercase tracking-[.08em] text-primary-text">{t.eyebrow}</span>
        <h2 id="monument-title" className="text-heading-sm">{t.title}</h2>
        <dl className="grid grid-cols-2 gap-3">
          <div className="lq-well flex flex-col gap-0.5 px-3 py-2">
            <dt className="flex items-center gap-1.5 text-caption text-on-surface-light"><Flag aria-hidden className="size-3.5" strokeWidth={2} />{t.done}</dt>
            <dd className="font-mono text-heading-sm tabular-nums">{fmt(visited.length)}</dd>
          </div>
          <div className="lq-well flex flex-col gap-0.5 px-3 py-2">
            <dt className="text-caption text-on-surface-light">{t.active}</dt>
            <dd className="font-mono text-heading-sm tabular-nums">{fmt(ahead.length)}</dd>
          </div>
        </dl>
        <div aria-live="polite" className="lq-well flex min-h-[104px] flex-col justify-center gap-2 px-4 py-3">
          {selected && progress ? (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <button type="button" aria-haspopup="dialog" aria-label={t.open(selected.title)} onClick={() => onOpen(selected)} className="min-w-0 truncate text-left text-label-lg hover:underline md:text-body-md md:font-semibold">
                  {selected.title}
                </button>
                <span className="shrink-0 font-mono text-label-lg tabular-nums">{progress.pct}%</span>
              </div>
              <ProgressBar value={progress.pct} tone={isReady(selected) ? 'success' : 'primary'} label={t.progressOf(selected.title)} valueText={progress.text} />
              <span className="text-caption text-on-surface-light">{isReady(selected) ? t.ready : progress.text}</span>
            </>
          ) : (
            <span className="text-body-sm text-on-surface-light">{visited.length ? t.allDone : t.empty}</span>
          )}
        </div>
        <p className="text-caption text-on-surface-light">{t.hint}</p>
        {ahead.length > 1 && (
          <div className="mt-auto flex items-center gap-2 pt-1">
            <button type="button" className="lq-flip-chip px-2.5" aria-label={t.prev} onClick={() => cycle(-1)}><ChevronLeft aria-hidden className="size-4" strokeWidth={2} /></button>
            <button type="button" className="lq-flip-chip px-2.5" aria-label={t.next} onClick={() => cycle(1)}><ChevronRight aria-hidden className="size-4" strokeWidth={2} /></button>
          </div>
        )}
      </div>
    </section>
  );
}
