// La fogata del Gremio: al anochecer (de noche, con estrellas) el fuego se enciende
// entre piedras y leños, sus llamas titilan y suben brasas; los miembros llegan y se
// sientan alrededor, balanceándose apenas. Al fondo, dos tiendas con su puerta y
// sus vientos, y el banderín con el emblema. El tamaño del fuego es el progreso del
// gremio: crece cuando el gremio avanza. Tocar el fuego lo aviva y suelta chispas.
// Todo es decorativo salvo el fuego (un botón); los miembros se leen en la lista.
import { useState, type CSSProperties, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion';
import { Particles, ZoneAmbience, seeded, useParticleBudget } from '@/components/ambience';
import { useMediaQuery } from '@/hooks/useMediaQuery';

export interface Camper { id: string; name: string; lead?: boolean; you?: boolean; avatar: (size: number) => ReactNode }

function Tent({ className, flip }: { className?: string; flip?: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 140 90" className={cn('block overflow-visible', flip && '-scale-x-100', className)}>
      {/* Vientos y estacas */}
      <path d="M70 6L4 86M70 6L136 86" className="stroke-jade-50/25" strokeWidth={1} fill="none" />
      <path d="M2 86h5M133 86h5" className="stroke-jade-50/40" strokeWidth={2} />
      {/* Lona: cara iluminada por el fuego y cara en sombra */}
      <path d="M70 6L20 86H70Z" className="lq-tent-lit" />
      <path d="M70 6L120 86H70Z" className="lq-tent-shade" />
      {/* Puerta abierta */}
      <path d="M70 34L52 86H88Z" className="lq-tent-door" />
      <path d="M70 34L60 86" className="stroke-black/25" strokeWidth={1.2} />
      <path d="M68 2v8M72 2v8" className="stroke-secondary-text" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

/** Banderín con el emblema del gremio en lo alto de un mástil. */
function Pennant({ icon: Icon, tone }: { icon: LucideIcon; tone: string }) {
  return (
    <span aria-hidden="true" className="relative block h-32 w-16">
      <span className="absolute bottom-0 left-1 block h-full w-1 rounded-full bg-secondary-text" />
      <span className="lq-amb-sway absolute left-2 top-1 block origin-left [--d:4.5s] [--o:0%_50%] [--r:4deg]">
        <span className="lq-pennant flex h-10 w-14 items-center pl-2" style={{ '--pen': `var(--lq-${tone})` } as CSSProperties}>
          <Icon className="size-4 text-jade-50" strokeWidth={2} />
        </span>
      </span>
    </span>
  );
}

/** Las llamas, en tres capas que titilan a destiempo. `size` 0–1 escala el fuego. */
function Flames() {
  return (
    <svg aria-hidden="true" viewBox="0 0 80 100" className="absolute inset-x-0 bottom-3 mx-auto block h-[9.5rem] w-28 overflow-visible">
      <path className="lq-flame-a fill-error" d="M40 4C52 26 66 38 66 62a26 26 0 0 1-52 0C14 38 28 26 40 4Z" />
      <path className="lq-flame-b fill-warning" d="M40 22C49 38 58 48 58 66a18 18 0 0 1-36 0C22 48 31 38 40 22Z" />
      <path className="lq-flame-c fill-secondary" d="M40 44C45 54 50 60 50 70a10 10 0 0 1-20 0C30 60 35 54 40 44Z" />
      <path className="lq-flame-c fill-white/80" d="M40 60c2 4 4 6 4 10a4 4 0 0 1-8 0c0-4 2-6 4-10Z" />
    </svg>
  );
}

export function Campfire({ campers, progress, prevProgress, emblem, emblemTone, className }: {
  campers: Camper[]; progress: number; prevProgress?: number | null; emblem: LucideIcon; emblemTone: string; className?: string;
}) {
  const wide = useMediaQuery('(min-width: 768px)');
  const budget = useParticleBudget();
  const [sparks, setSparks] = useState(0);
  const size = (p: number) => 0.62 + Math.max(0, Math.min(100, p)) / 100 * 0.55;
  const grew = prevProgress != null && progress > prevProgress;
  const stars = seeded(5);
  // Asientos en un óvalo alrededor del fuego: de la derecha, por delante, a la izquierda.
  const n = campers.length;
  const seats = campers.map((c, i) => {
    const deg = n === 1 ? 90 : -18 + (i * 216) / (n - 1);
    const a = (deg * Math.PI) / 180;
    return { c, x: 50 + Math.cos(a) * (wide ? 30 : 36), y: 64 + Math.sin(a) * (wide ? 18 : 16), s: 0.82 + (Math.sin(a) + 1) / 2 * 0.28, out: { x: Math.cos(a) * 60, y: Math.sin(a) * 30 } };
  });
  return (
    <div className={cn('lq-camp relative isolate overflow-hidden rounded-3xl', className)}>
      <ZoneAmbience zone="guild-camp" scope="local">
        {/* Cielo: estrellas que titilan */}
        <span className="absolute inset-x-0 top-0 block h-1/2">
          {Array.from({ length: 22 }, (_, k) => (
            <span key={k} className="lq-twinkle absolute block rounded-full bg-jade-50" style={{ left: `${stars() * 100}%`, top: `${stars() * 90}%`, width: 1.5 + stars() * 1.5, height: 1.5 + stars() * 1.5, animationDelay: `${-stars() * 3}s` }} />
          ))}
        </span>
        {/* Siluetas de árboles al fondo */}
        <svg viewBox="0 0 400 60" preserveAspectRatio="none" className="absolute inset-x-0 top-[34%] block h-[22%] w-full">
          <path d="M0 60V40l12-22 10 18 10-30 14 34 10-16 12 20 16-36 12 30 14-14 10 18 18-34 14 30 12-16 14 20 16-30 12 26 14-20 12 24 18-36 14 34 12-18 10 20 16-28 12 30 14-12 12 16 14-30 12 28 10-12V60Z" className="lq-treeline" />
        </svg>
        {/* Resplandor del fuego sobre el suelo: titila y crece con el progreso */}
        <motion.span
          className="lq-fire-glow absolute left-[10%] top-[31%] block h-[70%] w-[80%] rounded-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.55 + Math.min(100, progress) / 250, transition: { duration: 1.2, delay: 0.3 } }}
        />
        {/* Brasas que suben */}
        <span className="absolute inset-x-[38%] bottom-[24%] top-[6%] block">
          <Particles count={budget(Math.round(6 + progress / 12))} kind="rise" seed={13} x={[30, 70]} y={[78, 96]} duration={[3.4, 5.6]} alpha={[0.6, 0.95]} size={[2, 3.5]} sx={[-26, 26]} h={[160, 260]}
            render={(sz) => <span className="block rounded-full bg-warning shadow-[0_0_6px_2px_rgb(var(--lq-warning)/.6)]" style={{ width: sz, height: sz }} />} />
        </span>
      </ZoneAmbience>

      {/* El suelo del claro */}
      <span aria-hidden="true" className="lq-camp-ground pointer-events-none absolute inset-x-0 bottom-0 block h-[48%]" />

      {/* Tiendas y banderín */}
      <Tent className="pointer-events-none absolute left-[5%] top-[30%] w-[22%] max-w-[180px] md:left-[9%]" />
      <Tent flip className="pointer-events-none absolute right-[5%] top-[33%] hidden w-[18%] max-w-[150px] sm:block md:right-[12%]" />
      <span className="pointer-events-none absolute right-[4%] top-[18%] hidden md:block"><Pennant icon={emblem} tone={emblemTone} /></span>

      {/* Los miembros llegan y se sientan alrededor */}
      {seats.filter((s) => s.y < 64).map((s, i) => <Seat key={s.c.id} seat={s} i={i} />)}

      {/* El fuego: un botón que lo aviva */}
      <button
        type="button"
        onClick={() => setSparks((k) => k + 1)}
        aria-label="Avivar el fuego"
        className="group absolute left-1/2 top-[66%] -ml-16 -mt-[7.5rem] flex h-40 w-32 items-end justify-center rounded-full"
      >
        <motion.span
          className="relative block size-full origin-bottom"
          initial={{ scale: prevProgress != null ? size(prevProgress) : 0.1, opacity: 0 }}
          animate={{ scale: size(progress), opacity: 1, transition: { scale: { ...springs.heavy, delay: grew ? 1.1 : 0.35 }, opacity: { duration: 0.3, delay: 0.3 } } }}
        >
          <Flames />
        </motion.span>
        {/* Leños cruzados y el círculo de piedras */}
        <span aria-hidden="true" className="absolute bottom-1 left-1/2 block h-4 w-20 -translate-x-1/2">
          <span className="lq-log absolute left-0 top-1 block h-3.5 w-20 -rotate-12 rounded-full" />
          <span className="lq-log absolute left-0 top-1 block h-3.5 w-20 rotate-12 rounded-full" />
        </span>
        <span aria-hidden="true" className="absolute -bottom-2 left-1/2 flex w-32 -translate-x-1/2 justify-between">
          {Array.from({ length: 6 }, (_, k) => <span key={k} className="lq-ring-stone block h-3.5 w-5 rounded-[50%]" />)}
        </span>
        {sparks > 0 && (
          <span key={sparks} aria-hidden="true" className="pointer-events-none absolute left-1/2 top-6">
            {Array.from({ length: 12 }, (_, k) => {
              const a = -Math.PI / 2 + ((k / 11) - 0.5) * 2.4;
              const r = 40 + (k % 3) * 22;
              return <span key={k} className="lq-burst absolute -ml-1 -mt-1 block size-1.5 rounded-full bg-warning shadow-[0_0_6px_2px_rgb(var(--lq-warning)/.7)]" style={{ '--tx': `${Math.cos(a) * r}px`, '--ty': `${Math.sin(a) * r}px`, '--delay': `${(k % 4) * 0.03}s` } as CSSProperties} />;
            })}
          </span>
        )}
      </button>
      {seats.filter((s) => s.y >= 64).map((s, i) => <Seat key={s.c.id} seat={s} i={i + 3} />)}
    </div>
  );
}

function Seat({ seat, i }: { seat: { c: Camper; x: number; y: number; s: number; out: { x: number; y: number } }; i: number }) {
  const size = Math.round(46 * seat.s);
  return (
    <motion.span
      aria-hidden="true"
      className="pointer-events-none absolute flex flex-col items-center"
      style={{ left: `${seat.x}%`, top: `${seat.y}%`, marginLeft: -size / 2, marginTop: -size / 2 }}
      initial={{ x: seat.out.x, y: seat.out.y, opacity: 0 }}
      animate={{ x: 0, y: 0, opacity: 1, transition: { ...springs.gentle, delay: 0.7 + i * 0.12, opacity: { duration: 0.4, delay: 0.7 + i * 0.12 } } }}
    >
      <span className="lq-camper block" style={{ animationDelay: `${-i * 0.7}s` }}>
        <span className={cn('relative block overflow-hidden rounded-full ring-2 ring-offset-2 ring-offset-jade-900', seat.c.you ? 'ring-success' : seat.c.lead ? 'ring-secondary' : 'ring-warning/50')} style={{ width: size, height: size }}>
          {seat.c.avatar(size)}
        </span>
      </span>
      <span className="mt-1.5 max-w-[6rem] truncate rounded-full bg-jade-900/70 px-2 text-[0.6875rem] font-semibold leading-5 text-jade-50">{seat.c.you ? 'Tú' : seat.c.name}</span>
    </motion.span>
  );
}
