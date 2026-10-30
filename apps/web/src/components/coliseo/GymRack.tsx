// Rack del Coliseo: una barra olímpica, una mancuerna hexagonal y una pesa rusa en 3D (Blender)
// que flotan con acabado de metal y neón del tema. La barra lleva un disco por cada día que
// entrenaste esta semana (como la barra de la asistencia). Se agarran y se lanzan; tocar la
// barra abre «Empezar entrenamiento», la mancuerna el descanso y la pesa rusa el cardio (las
// mismas acciones que los botones de arriba). three.js solo se descarga cerca de la pantalla.
import { Suspense, lazy, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { Hand } from 'lucide-react';
import gymUrl from '@/assets/models/props-gym.glb?url';
import gymHdUrl from '@/assets/models/props-gym-hd.glb?url';
import { hasWebGL2, useNear } from '@/components/three3d/near';
import type { PropShelf3DProps } from '@/components/three3d/PropShelf3D';
import { useText, type Copy } from '@/lib/i18n';
import { platePositions } from './rack';

const es = {
  eyebrow: 'Tu rack',
  title: 'Peso de la semana',
  plates: (n: number) => (n === 1 ? 'Un disco en la barra: un día entrenado esta semana.' : `${n} discos en la barra: ${n} días entrenados esta semana.`),
  empty: 'La barra está vacía: cada día que entrenes suma un disco.',
  start: 'Empezar entrenamiento',
  rest: 'Descanso',
  cardio: 'Registrar cardio',
  drag: 'Agarra y lanza',
};
const en: typeof es = {
  eyebrow: 'Your rack',
  title: 'This week’s load',
  plates: (n) => (n === 1 ? 'One plate on the bar: one day trained this week.' : `${n} plates on the bar: ${n} days trained this week.`),
  empty: 'The bar is empty: every day you train adds a plate.',
  start: 'Start workout',
  rest: 'Rest',
  cardio: 'Log cardio',
  drag: 'Grab and throw',
};
const COPY: Copy<typeof es> = { es, en };

const PropShelf3D = lazy<ComponentType<PropShelf3DProps>>(() => import('@/components/three3d/PropShelf3D').catch(() => ({
  default: ({ onUnavailable }: PropShelf3DProps) => { useEffect(onUnavailable, []); return null; },
})));

export interface GymRackProps {
  /** Días entrenados esta semana (0–7). */
  plates: number;
  onStart: () => void;
  onRest: () => void;
  onCardio: () => void;
}

export function GymRack({ plates, onStart, onRest, onCardio }: GymRackProps) {
  const t = useText(COPY);
  const ref = useRef<HTMLElement>(null);
  const near = useNear(ref);
  const [ok, setOk] = useState(hasWebGL2);
  const at = useMemo(() => platePositions(plates), [plates]);
  // Los objetos se crean una vez; los discos cambian con `attach`.
  const items = useMemo(() => [
    { id: 'dumbbell', model: 'dumbbell', metal: 'steel' as const, rest: [0.3, 0.6, 0.12] as [number, number, number], size: 0.95, spin: 0.45, label: t.rest },
    { id: 'barbell', model: 'barbell', metal: 'steel' as const, rest: [0.12, 0.25, 0] as [number, number, number], size: 1.9, spin: 0.2, label: t.start, attach: { model: 'plate', at } },
    { id: 'kettlebell', model: 'kettlebell', metal: 'steel' as const, rest: [0.1, -0.5, 0] as [number, number, number], size: 0.8, spin: 0.4, label: t.cardio },
  ], [t]); // eslint-disable-line react-hooks/exhaustive-deps
  const latest = useRef({ onStart, onRest, onCardio });
  latest.current = { onStart, onRest, onCardio };

  if (!ok) return null;
  return (
    <section ref={ref} aria-labelledby="gym-rack-t" className="lq-glass3d flex flex-col">
      <div className="flex flex-wrap items-end justify-between gap-2 px-5 pt-5">
        <div className="flex flex-col gap-1">
          <span className="text-label-md font-semibold uppercase tracking-[.08em] text-primary-text">{t.eyebrow}</span>
          <h2 id="gym-rack-t" className="text-heading-sm">{t.title}</h2>
        </div>
        <p className="text-body-sm text-on-surface-light" aria-live="polite">{plates > 0 ? t.plates(Math.min(7, plates)) : t.empty}</p>
      </div>
      <div className="lq-shelf-stage relative h-[220px] sm:h-[250px] md:h-[270px]">
        {near && (
          <Suspense fallback={null}>
            <PropShelf3D
              url={gymUrl} hdUrl={gymHdUrl} items={items} columns={() => 3}
              attach={{ id: 'barbell', at }}
              onTap={(id) => (id === 'barbell' ? latest.current.onStart() : id === 'dumbbell' ? latest.current.onRest() : latest.current.onCardio())}
              onUnavailable={() => setOk(false)}
            />
          </Suspense>
        )}
        <span aria-hidden className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-background/70 px-2.5 py-1 text-caption text-on-surface-light">
          <Hand className="size-3.5" strokeWidth={1.75} />{t.drag}
        </span>
      </div>
    </section>
  );
}
