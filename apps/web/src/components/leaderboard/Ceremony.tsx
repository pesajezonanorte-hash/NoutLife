// La ceremonia del Ranking: un escenario de noche con los focos del estadio, el
// podio de mármol con filo dorado que sube desde el suelo, las medallas de oro,
// plata y bronce que caen colgadas de su cinta y se mecen, el laurel del primero
// y el marcador de resultados donde tu fila tiene su propio brillo.
// Lo decorativo es aria-hidden.
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion';
import { Particles, ZoneAmbience, useParticleBudget } from '@/components/ambience';
import { Badge } from '@/components/ui/lq';

export interface Winner { id: string; name: string; initials: string; score: ReactNode; isYou?: boolean; avatar?: (size: number) => ReactNode }

const METAL = ['lq-metal-gold', 'lq-metal-silver', 'lq-metal-bronze'] as const;
const RIBBON = ['lq-rib-gold', 'lq-rib-silver', 'lq-rib-bronze'] as const;

/** Rama de laurel (una) en dorado: hojas alternas a lo largo de un arco. */
export function LaurelBranch({ flip, className }: { flip?: boolean; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 40 90" className={cn('block overflow-visible', flip && '-scale-x-100', className)}>
      <path d="M30 88C10 70 6 40 18 6" className="fill-none stroke-secondary" strokeWidth={1.6} strokeLinecap="round" />
      {Array.from({ length: 7 }, (_, i) => {
        const t = i / 6;
        const x = 30 - 22 * Math.sin(t * 1.4) + (t > 0.7 ? 6 * (t - 0.7) : 0);
        const y = 84 - t * 76;
        return (
          <g key={i}>
            <ellipse cx={x - 6} cy={y} rx={6} ry={2.6} transform={`rotate(${-30 - t * 30} ${x - 6} ${y})`} className="fill-secondary/90" />
            <ellipse cx={x + 5} cy={y - 4} rx={5.5} ry={2.4} transform={`rotate(${40 - t * 20} ${x + 5} ${y - 4})`} className="fill-secondary/70" />
          </g>
        );
      })}
    </svg>
  );
}

/** Medalla colgada de su cinta; cae con peso y se mece al pasar el cursor. */
function Medal({ place, delay }: { place: 0 | 1 | 2; delay: number }) {
  return (
    <motion.span
      aria-hidden="true"
      className="lq-medal pointer-events-none relative -mt-1 flex origin-top flex-col items-center"
      initial={{ y: -30, rotate: -12, opacity: 0 }}
      animate={{ y: 0, rotate: 0, opacity: 1, transition: { ...springs.heavy, delay, opacity: { duration: 0.2, delay } } }}
    >
      <svg viewBox="0 0 40 26" className="block h-6 w-9"><path d="M6 0h10l8 24h-9ZM34 0H24l-8 24h9Z" className={RIBBON[place]} /></svg>
      <span className={cn('-mt-1.5 flex size-9 items-center justify-center rounded-full font-mono text-label-lg font-bold', METAL[place])}>{place + 1}</span>
    </motion.span>
  );
}

/** El podio 2 · 1 · 3 en su escenario de noche, con focos y polvo dorado en la luz. */
export function CeremonyPodium({ top }: { top: Winner[] }) {
  const budget = useParticleBudget();
  const order = [1, 0, 2].filter((i) => top[i]) as (0 | 1 | 2)[];
  const heights = [148, 108, 80];
  const rise = [0.35, 0.2, 0.5];
  return (
    <div className="lq-stage relative isolate overflow-hidden rounded-2xl px-3 pt-10 md:px-8 md:pt-12" aria-label="Podio">
      <ZoneAmbience zone="ranking-stage" scope="local">
        {/* Focos del estadio, desenfocados al fondo */}
        <span className="lq-floodlights absolute inset-x-0 top-0 block h-28" />
        {order.map((i, k) => (
          <motion.span
            key={i}
            className="lq-spotlight absolute top-0 block h-full"
            style={{ left: `${(k / order.length) * 100}%`, width: `${100 / order.length}%` }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.5, 1], transition: { duration: 0.8, times: [0, 0.3, 0.5, 1], delay: rise[i] + 0.55 } }}
          />
        ))}
        <span className="absolute inset-0 block">
          <Particles count={budget(10)} kind="drift" seed={61} y={[10, 70]} duration={[10, 16]} alpha={[0.3, 0.6]} size={[1.5, 3]} sx={[-14, 14]} sy={[-18, 10]}
            render={(sz) => <span className="block rounded-full bg-secondary" style={{ width: sz, height: sz }} />} />
        </span>
      </ZoneAmbience>
      <div className="relative flex items-end justify-center gap-2 md:gap-4">
        {order.map((i) => {
          const p = top[i];
          const first = i === 0;
          return (
            <div key={p.id} className="group flex max-w-[190px] flex-1 flex-col items-center">
              {/* Atleta: foto, laurel del primero y su medalla */}
              <span className="relative flex items-center justify-center">
                {first && (
                  <span aria-hidden="true" className="pointer-events-none absolute -inset-x-7 -bottom-1 -top-3 flex justify-between">
                    <LaurelBranch className="h-full w-6" />
                    <LaurelBranch flip className="h-full w-6" />
                  </span>
                )}
                <span className={cn('relative flex items-center justify-center overflow-hidden rounded-full font-bold ring-2 ring-offset-2 ring-offset-jade-900', first ? 'size-[68px] text-heading-sm ring-secondary' : 'size-14 text-label-lg ring-jade-50/30', p.isYou && 'ring-success', 'bg-jade-800 text-jade-50')}>
                  {p.avatar ? p.avatar(first ? 68 : 56) : p.initials}
                </span>
              </span>
              <Medal place={i} delay={rise[i] + 0.75} />
              <div className="mb-3 mt-1.5 text-center">
                <div className="flex items-center justify-center gap-1.5 text-label-lg text-jade-50 md:text-body-md md:font-semibold">{p.name}{p.isYou && <Badge variant="success">Tú</Badge>}</div>
                <div className="font-mono text-body-sm tabular-nums text-secondary">{p.score}</div>
              </div>
              {/* El bloque de mármol sube desde el suelo */}
              <span className="block w-full overflow-hidden" style={{ height: heights[i] }}>
                <motion.span
                  className="lq-marble lq-podium-block flex size-full justify-center pt-3"
                  initial={{ y: '100%' }}
                  animate={{ y: 0, transition: { ...springs.heavy, delay: rise[i] } }}
                >
                  <span className="lq-engraved-gold font-mono text-display-sm font-bold">{i + 1}</span>
                </motion.span>
              </span>
            </div>
          );
        })}
      </div>
      {/* El suelo del escenario */}
      <span aria-hidden="true" className="lq-stage-floor relative -mx-3 block h-4 md:-mx-8" />
    </div>
  );
}

/** Fila del marcador de resultados; la tuya lleva su propio brillo dorado. */
export function ResultRow({ id, position, name, initials, avatar, subtitle, score, isYou, rose }: {
  id: string; position: number; name: string; initials: string; avatar?: (size: number) => ReactNode; subtitle?: string; score: ReactNode; isYou?: boolean; rose?: number;
}) {
  return (
    <motion.li
      layout="position"
      layoutId={`row-${id}`}
      transition={{ layout: { ...springs.heavy } }}
      aria-current={isYou || undefined}
      className={cn('lq-result relative flex min-h-16 items-center gap-3 rounded-xl px-3 md:gap-4', isYou && 'lq-result-you z-10')}
    >
      <span className="lq-lane flex h-8 w-9 shrink-0 items-center justify-center rounded-md font-mono text-label-lg tabular-nums">{position}</span>
      <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-variant text-label-lg font-bold text-on-surface">{avatar ? avatar(40) : initials}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn('truncate text-label-lg md:text-body-md md:font-semibold', isYou ? 'text-secondary-text' : 'text-on-background')}>{name}</span>
          {isYou && <Badge variant="secondary">Tú</Badge>}
          {isYou && rose ? <span className="text-body-sm text-success-text">↑ {rose}</span> : null}
        </div>
        {subtitle && <div className="truncate text-body-sm text-on-surface-light">{subtitle}</div>}
      </div>
      <span className="shrink-0 font-mono text-label-lg tabular-nums text-on-background">{score}</span>
    </motion.li>
  );
}
