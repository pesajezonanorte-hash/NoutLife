// Jardín de Relaciones: una escena viva. Cielo de atardecer (de noche, luna,
// estrellas y luciérnagas), colinas, una cerca, la tierra y el pasto que crece al
// llegar, se mece y se inclina con la brisa de tu mano. Tu pareja es el rosal del
// centro con su estaca; cada fecha especial es una flor que brota de la tierra y
// se abre más cuanto más cerca está: la próxima late, una fecha pasada queda seca.
// Mariposas de día. Cada flor es un botón que lleva a su fila en la lista.
// Lo decorativo es aria-hidden y no recibe eventos.
import { useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion';
import { InkPath, Particles, ZoneAmbience, seeded, useParticleBudget } from '@/components/ambience';
import { useMediaQuery } from '@/hooks/useMediaQuery';

export interface GardenDate { id: string; label: string; days: number }

export type Species = 'rosa' | 'margarita' | 'tulipan' | 'campanilla';
const SPECIES: Species[] = ['tulipan', 'margarita', 'rosa', 'campanilla'];
/** Color de cada especie (relleno SVG con tokens). */
const TONE: Record<Species, string> = { rosa: 'fill-error', margarita: 'fill-surface', tulipan: 'fill-warning', campanilla: 'fill-info' };

/** Cuánto se abre la flor según los días que faltan (−1: la fecha ya pasó, flor seca). */
export const bloomOf = (days: number) => (days < 0 ? -1 : days <= 7 ? 1 : days <= 30 ? 0.85 : days <= 90 ? 0.62 : days <= 180 ? 0.45 : 0.32);

const whenText = (days: number) => (days >= 0 ? `en ${days} ${days === 1 ? 'día' : 'días'}` : `hace ${-days} ${days === -1 ? 'día' : 'días'}`);
const whenShort = (days: number) => (days >= 0 ? `en ${days} d` : `hace ${-days} d`);

/** Cabeza de una flor (viewBox 52×52, centro 26,26). `open` 0–1: capullo → flor abierta. */
export function Bloom({ species, open, className }: { species: Species; open: number; className?: string }) {
  const o = Math.max(0.25, open);
  const tone = TONE[species];
  if (species === 'margarita') {
    return (
      <g className={className}>
        {Array.from({ length: 12 }, (_, k) => {
          const a = (k / 12) * 360;
          return <ellipse key={k} cx={26} cy={26 - 4 - 7 * o} rx={2.7} ry={3 + 5 * o} transform={`rotate(${a} 26 26)`} className={cn(tone, 'stroke-on-background/15')} strokeWidth={0.6} />;
        })}
        <circle cx={26} cy={26} r={3.4 + 1.6 * o} className="fill-secondary" />
        <circle cx={25} cy={25} r={1.4} className="fill-secondary-text/50" />
      </g>
    );
  }
  if (species === 'tulipan') {
    const spread = 4 + 16 * o;
    return (
      <g className={className}>
        <path d="M26 40C17 38 15 27 18 16C21 22 24 26 26 30Z" transform={`rotate(${-spread} 26 40)`} className={cn(tone, 'opacity-80')} />
        <path d="M26 40C35 38 37 27 34 16C31 22 28 26 26 30Z" transform={`rotate(${spread} 26 40)`} className={cn(tone, 'opacity-80')} />
        <path d="M26 41C19 39 19 24 26 12C33 24 33 39 26 41Z" className={tone} />
        <path d="M26 40C23 34 23 24 26 16" className="fill-none stroke-white/30" strokeWidth={1.2} />
      </g>
    );
  }
  if (species === 'campanilla') {
    // Tres campanillas que cuelgan de un tallito curvo.
    return (
      <g className={className}>
        <path d="M14 12C22 6 34 6 40 14" className="fill-none stroke-success" strokeWidth={1.6} strokeLinecap="round" />
        {[[16, 15], [27, 9], [38, 16]].map(([x, y], k) => (
          <g key={k} transform={`rotate(${(k - 1) * 12 * o} ${x} ${y})`}>
            <path d={`M${x - 4.5 - 2 * o} ${y + 10 + 3 * o}C${x - 5} ${y + 3} ${x - 3} ${y} ${x} ${y}C${x + 3} ${y} ${x + 5} ${y + 3} ${x + 4.5 + 2 * o} ${y + 10 + 3 * o}C${x + 2} ${y + 8} ${x - 2} ${y + 8} ${x - 4.5 - 2 * o} ${y + 10 + 3 * o}Z`} className={tone} />
          </g>
        ))}
      </g>
    );
  }
  // Rosa: pétalos exteriores que se separan al abrir y un corazón en espiral.
  return (
    <g className={className}>
      {Array.from({ length: 5 }, (_, k) => {
        const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
        const r = 3 + 7 * o;
        const cx = 26 + Math.cos(a) * r; const cy = 26 + Math.sin(a) * r;
        return <ellipse key={k} cx={cx} cy={cy} rx={6.5 + 1.5 * o} ry={5.5 + o} transform={`rotate(${(a * 180) / Math.PI + 90} ${cx} ${cy})`} className={cn(tone, 'opacity-75')} />;
      })}
      {Array.from({ length: 4 }, (_, k) => {
        const a = (k / 4) * Math.PI * 2 + 0.6;
        const r = 2 + 3.5 * o;
        const cx = 26 + Math.cos(a) * r; const cy = 26 + Math.sin(a) * r;
        return <ellipse key={k} cx={cx} cy={cy} rx={4.6} ry={4} className={tone} />;
      })}
      <path d="M26 23.5c2.2 0 3.2 1.6 2.6 3.1-.7 1.6-3.4 1.6-4.2.1-.6-1.2.4-2.3 1.6-2.2" className="fill-none stroke-black/25" strokeWidth={1} strokeLinecap="round" />
    </g>
  );
}

/** Una flor del jardín: tallo que se dibuja desde la tierra, hojas y la cabeza que se abre. */
function Flower({ d, x, species, delay, scale, fresh, onPick }: {
  d: GardenDate; x: number; species: Species; delay: number; scale: number; fresh: boolean; onPick: () => void;
}) {
  const [burst, setBurst] = useState(0);
  const bloom = bloomOf(d.days);
  const dry = bloom < 0;
  const soon = d.days >= 0 && d.days <= 7;
  const stem = Math.round(52 + Math.max(0, bloom) * 46);
  const h = stem + 30;
  const start = fresh ? 0.15 : delay;
  return (
    <button
      type="button"
      onClick={() => { setBurst((n) => n + 1); onPick(); }}
      aria-label={`${d.label}, ${whenText(d.days)}. Ver en la lista`}
      className="group absolute bottom-[3.1rem] flex flex-col items-center rounded-full"
      style={{ left: `${x}%`, height: h * scale, width: 56 * scale, marginLeft: -28 * scale }}
    >
      <span className="lq-lean lq-lean-half absolute inset-0 block origin-bottom">
        <svg aria-hidden="true" viewBox={`0 0 56 ${h}`} className="lq-flower absolute inset-0 size-full overflow-visible" style={{ ['--r' as string]: '3.5deg', transformOrigin: '50% 100%' }}>
          <g className={dry ? 'text-on-surface-light' : 'text-success'}>
            <InkPath d={`M28 ${h}C26 ${h - stem * 0.35} 31 ${h - stem * 0.7} 28 26`} delay={start} duration={0.8} strokeWidth={2.4} />
            <InkPath d={`M28 ${h - stem * 0.32}C35 ${h - stem * 0.4} 41 ${h - stem * 0.42} 44 ${h - stem * 0.55}`} delay={start + 0.35} duration={0.4} strokeWidth={2} />
            <InkPath d={`M28 ${h - stem * 0.55}C22 ${h - stem * 0.6} 17 ${h - stem * 0.6} 13 ${h - stem * 0.72}`} delay={start + 0.45} duration={0.4} strokeWidth={1.8} />
          </g>
          {/* La cabeza se abre al terminar de crecer; seca, se inclina y pierde el color */}
          <motion.g
            initial={{ scale: 0, rotate: -35 }}
            animate={{ scale: 1, rotate: dry ? 38 : 0, transition: { ...springs.heavy, delay: start + 0.62 } }}
            style={{ originX: '28px', originY: '26px' }}
          >
            <g className={cn(soon && 'lq-heartbeat', dry && 'opacity-55 [filter:grayscale(.8)]')} style={{ transformOrigin: '28px 26px' }} transform="translate(2 0)">
              <Bloom species={species} open={dry ? 0.5 : bloom} />
            </g>
          </motion.g>
        </svg>
      </span>
      {/* Estaca con el nombre, clavada en la tierra delante de la flor */}
      <span aria-hidden="true" className="lq-stake pointer-events-none absolute -bottom-9 z-20 left-1/2 hidden w-[6.5rem] -translate-x-1/2 flex-col items-center md:flex">
        <span className="lq-stake-tag max-w-full truncate px-2 py-0.5 text-center text-[0.6875rem] font-semibold leading-4 text-on-background">{d.label}</span>
        <span className="font-mono text-[0.625rem] leading-3 text-on-surface-light">{whenShort(d.days)}</span>
      </span>
      {/* Pétalos que salen al tocar la flor */}
      {burst > 0 && (
        <span key={burst} aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[22px]">
          {Array.from({ length: 7 }, (_, k) => {
            const a = (k / 7) * Math.PI * 2;
            return <span key={k} className={cn('lq-burst lq-petal absolute -ml-1 -mt-1 block size-2', k % 2 ? 'bg-error/70' : 'bg-warning/80')} style={{ '--tx': `${Math.cos(a) * 30}px`, '--ty': `${Math.sin(a) * 24 + 14}px`, '--delay': '0s' } as CSSProperties} />;
          })}
        </span>
      )}
    </button>
  );
}

/** El rosal de tu pareja: tres rosas sobre tallos con hojas y su estaca con el nombre y el tiempo juntos. */
function RoseBush({ x, name, together, scale }: { x: number; name: string; together?: string; scale: number }) {
  return (
    <div className="absolute bottom-[3.1rem]" style={{ left: `${x}%`, height: 168 * scale, width: 128 * scale, marginLeft: -64 * scale }}>
      <motion.span
        aria-hidden="true"
        className="absolute inset-0 block origin-bottom"
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1, transition: { ...springs.gentle, delay: 0.35 } }}
      >
        <span className="lq-lean lq-lean-half absolute inset-0 block origin-bottom">
        <svg viewBox="0 0 128 168" preserveAspectRatio="xMidYMax meet" className="lq-amb-sway absolute inset-0 size-full overflow-visible [--d:7s] [--o:50%_100%] [--r:1.2deg]">
          <g className="text-success">
            <InkPath d="M64 168C62 130 66 100 60 64" delay={0.45} duration={0.9} strokeWidth={3} />
            <InkPath d="M64 168C70 136 84 112 92 82" delay={0.55} duration={0.9} strokeWidth={2.6} />
            <InkPath d="M63 168C56 140 42 120 34 96" delay={0.6} duration={0.9} strokeWidth={2.6} />
          </g>
          {[[52, 118, -30], [80, 128, 28], [72, 100, -18], [46, 92, 24], [86, 104, -40]].map(([cx, cy, r], k) => (
            <motion.ellipse key={k} cx={cx} cy={cy} rx={9} ry={4.6} transform={`rotate(${r} ${cx} ${cy})`} className="fill-success/80"
              initial={{ scale: 0 }} animate={{ scale: 1, transition: { ...springs.heavy, delay: 0.9 + k * 0.06 } }} style={{ originX: `${cx}px`, originY: `${cy}px` }} />
          ))}
          {[[60, 56, 1.25], [94, 78, 1], [32, 90, 1.05]].map(([cx, cy, s], k) => (
            <motion.g key={k} initial={{ scale: 0, rotate: -40 }} animate={{ scale: s, rotate: 0, transition: { ...springs.heavy, delay: 1.05 + k * 0.15 } }} style={{ originX: `${cx}px`, originY: `${cy}px` }}>
              <g transform={`translate(${cx - 26} ${cy - 26})`}><Bloom species="rosa" open={0.95} /></g>
            </motion.g>
          ))}
        </svg>
        </span>
      </motion.span>
      <span aria-hidden="true" className="lq-stake pointer-events-none absolute -bottom-10 z-20 left-1/2 flex w-40 -translate-x-1/2 flex-col items-center">
        <span className="lq-stake-tag max-w-full truncate px-2.5 py-1 text-center text-label-md text-on-background">{name}</span>
        {together && <span className="max-w-full truncate text-center font-mono text-[0.625rem] leading-3 text-on-surface-light">{together}</span>}
      </span>
    </div>
  );
}

/** Mariposa: vuela por el jardín en un lazo lento; las alas aletean. */
function Butterfly({ path, tone, delay }: { path: 1 | 2; tone: string; delay: number }) {
  return (
    <span className={cn('lq-butterfly absolute block', path === 1 ? 'lq-fly-1 left-[18%] top-[38%]' : 'lq-fly-2 left-[62%] top-[30%]')} style={{ animationDelay: `${delay}s` }}>
      <span className="lq-wing lq-wing-l block" style={{ background: tone }} />
      <span className="lq-wing lq-wing-r block" style={{ background: tone }} />
    </span>
  );
}

/**
 * La escena del jardín. `partner`: el rosal del centro (si hay relación);
 * `dates`: las flores; `fresh`: la fecha recién plantada; `onPick`: al tocar una flor.
 */
export function GardenScene({ partner, dates, fresh, onPick, className }: {
  partner?: { name: string; together?: string } | null;
  dates: GardenDate[];
  fresh?: string | null;
  onPick?: (id: string) => void;
  className?: string;
}) {
  const wide = useMediaQuery('(min-width: 768px)');
  const budget = useParticleBudget();
  const scale = wide ? 1.35 : 1;
  const shown = dates.slice(0, wide ? 7 : 4);
  // Las flores más cercanas en el tiempo quedan junto al rosal, alternando lados.
  const slots = shown.length + (partner ? 1 : 0);
  const center = partner ? Math.floor(slots / 2) : -1;
  const order: number[] = [];
  for (let k = 1; order.length < shown.length; k++) {
    for (const s of [center - k, center + k]) if (s >= 0 && s < slots && s !== center && order.length < shown.length && !order.includes(s)) order.push(s);
    if (k > slots + 1) break;
  }
  if (!partner) order.splice(0, order.length, ...shown.map((_, k) => k));
  const xOf = (slot: number) => ((slot + 0.5) / Math.max(1, slots)) * 100;

  const tufts = useMemo(() => {
    const rnd = seeded(29);
    const n = wide ? 44 : 22;
    return Array.from({ length: n }, (_, k) => ({ x: ((k + rnd()) / n) * 100, h: (wide ? 30 : 24) + rnd() * (wide ? 30 : 22), blades: 4 + Math.floor(rnd() * 3), d: 3.2 + rnd() * 2.4, delay: -rnd() * 4, flip: rnd() > 0.5 }));
  }, [wide]);
  // Arbustos junto a la cerca y flores silvestres entre el pasto: el jardín se ve lleno aunque haya pocas fechas.
  const shrubs = useMemo(() => { const rnd = seeded(17); const n = wide ? 7 : 4; return Array.from({ length: n }, (_, k) => ({ x: ((k + 0.15 + rnd() * 0.7) / n) * 100, w: (wide ? 80 : 56) + rnd() * 50, h: (wide ? 44 : 32) + rnd() * 26, tone: k % 2 })); }, [wide]);
  const wild = useMemo(() => { const rnd = seeded(53); return Array.from({ length: wide ? 26 : 12 }, (_, k) => ({ x: rnd() * 100, b: 2.4 + rnd() * 1.6, s: 4 + rnd() * 3, tone: k % 4 })); }, [wide]);
  const stars = useMemo(() => { const rnd = seeded(3); return Array.from({ length: 16 }, () => ({ x: rnd() * 100, y: rnd() * 42, s: 1.5 + rnd() * 1.8, d: rnd() * 3 })); }, []);

  // Brisa: el pasto y las flores se inclinan hacia donde se mueve el cursor y vuelven.
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef<{ x: number; t: number } | null>(null);
  const idle = useRef<number>();
  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || !ref.current) return;
    const p = last.current;
    last.current = { x: e.clientX, t: e.timeStamp };
    if (!p) return;
    const v = (e.clientX - p.x) / Math.max(8, e.timeStamp - p.t);
    ref.current.style.setProperty('--lean', String(Math.max(-9, Math.min(9, v * 7))));
    window.clearTimeout(idle.current);
    idle.current = window.setTimeout(() => ref.current?.style.setProperty('--lean', '0'), 160);
  };
  const onLeave = () => { last.current = null; ref.current?.style.setProperty('--lean', '0'); };

  return (
    <div ref={ref} onPointerMove={onMove} onPointerLeave={onLeave} className={cn('lq-garden relative isolate h-[17rem] overflow-hidden rounded-3xl border border-border md:h-[22rem]', className)}>
      {/* Fondo: cielo, sol o luna, estrellas, colinas y la cerca */}
      <ZoneAmbience zone="love-garden" scope="local">
        <motion.span className="lq-sun absolute right-[10%] top-6 block size-24 rounded-full md:size-32 dark:hidden" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0, transition: { ...springs.gentle, delay: 0.15 } }} />
        <motion.span className="lq-moon absolute right-[12%] top-8 hidden size-12 rounded-full md:size-14 dark:block" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, transition: { ...springs.gentle, delay: 0.15 } }} />
        <span className="absolute inset-0 hidden dark:block">
          {stars.map((s, k) => <span key={k} className="lq-twinkle absolute block rounded-full bg-jade-50" style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, animationDelay: `${-s.d}s` }} />)}
        </span>
        <svg viewBox="0 0 1000 200" preserveAspectRatio="none" className="absolute inset-x-0 bottom-[3rem] block h-[46%] w-full">
          <path d="M0 120C120 70 230 90 330 104S560 60 690 88S880 120 1000 76V200H0Z" className="lq-hill-far" />
          <path d="M0 150C140 116 260 140 390 132S620 104 760 128S900 150 1000 128V200H0Z" className="lq-hill-near" />
        </svg>
        <span className="lq-fence absolute inset-x-0 bottom-[3rem] block h-[2.75rem] md:h-[3.25rem]" />
        {shrubs.map((b, k) => (
          <span key={k} className={cn('lq-shrub absolute bottom-[2.8rem] block', b.tone && 'lq-shrub-b')} style={{ left: `${b.x}%`, width: b.w, height: b.h, marginLeft: -b.w / 2 }} />
        ))}
        <span className="absolute inset-0 block dark:hidden">
          <Butterfly path={1} tone="rgb(var(--lq-warning) / .85)" delay={-2} />
          <Butterfly path={2} tone="rgb(var(--lq-info) / .7)" delay={-9} />
        </span>
        <span className="absolute inset-x-0 top-[20%] hidden h-[60%] dark:block">
          <Particles count={budget(9)} kind="glow" seed={41} y={[10, 90]} duration={[3.2, 5.5]} alpha={[0.55, 0.95]} size={[3, 4.5]} sx={[-12, 12]} sy={[-10, 8]}
            render={(sz) => <span className="block rounded-full bg-warning shadow-[0_0_10px_2px_rgb(var(--lq-warning)/.55)]" style={{ width: sz, height: sz }} />} />
        </span>
      </ZoneAmbience>

      {/* La tierra */}
      <span aria-hidden="true" className="lq-soil pointer-events-none absolute inset-x-0 bottom-0 block h-[3.25rem]" />

      {partner && <RoseBush x={xOf(center)} name={partner.name} together={partner.together} scale={scale} />}
      {shown.map((d, k) => (
        <Flower key={d.id} d={d} x={xOf(order[k] ?? k)} species={SPECIES[k % SPECIES.length]} delay={0.55 + k * 0.16} scale={scale} fresh={fresh === d.id} onPick={() => onPick?.(d.id)} />
      ))}

      {/* El pasto, delante de los tallos */}
      <ZoneAmbience zone="love-grass" scope="local">
        {tufts.map((t, k) => (
          <span key={k} className="lq-grass-grow absolute bottom-[2.9rem] block origin-bottom" style={{ left: `${t.x}%`, '--gd': `${0.1 + (t.x / 100) * 0.5}s` } as CSSProperties}>
            <span className="lq-lean block origin-bottom">
              <svg viewBox="0 0 30 40" preserveAspectRatio="none" className="lq-blade block w-[34px] origin-bottom" style={{ height: t.h, animationDuration: `${t.d}s`, animationDelay: `${t.delay}s`, scale: t.flip ? '-1 1' : undefined }}>
                {Array.from({ length: t.blades }, (_, b) => {
                  const bx = 6 + b * (18 / t.blades);
                  return <path key={b} d={`M${bx} 40C${bx + 1} 26 ${bx + 4 + b} 14 ${bx + 7 + b * 1.5} ${2 + (b % 2) * 6}C${bx + 3} 16 ${bx + 3} 28 ${bx + 4} 40Z`} className={b % 2 ? 'fill-jade-600' : 'fill-jade-500'} />;
                })}
              </svg>
            </span>
          </span>
        ))}
        {wild.map((w, k) => (
          <span key={k} className={cn('lq-wild absolute block rounded-full', ['bg-error/80', 'bg-warning', 'bg-surface', 'bg-info/70'][w.tone])} style={{ left: `${w.x}%`, bottom: `${w.b}rem`, width: w.s, height: w.s }} />
        ))}
      </ZoneAmbience>
    </div>
  );
}

/** Capullo de la próxima fecha: se abre a medida que se acerca el día. */
export function NextBloom({ days, className }: { days: number; className?: string }) {
  const open = Math.max(0.12, Math.min(1, 1 - days / 60));
  return (
    <svg aria-hidden="true" viewBox="0 0 80 120" className={cn('overflow-visible', className)}>
      <g className="text-success">
        <InkPath d="M40 120C38 96 43 74 40 52" delay={0.3} duration={0.8} strokeWidth={3} />
        <InkPath d="M40 96C49 90 56 88 62 78" delay={0.6} duration={0.45} strokeWidth={2.4} />
        <InkPath d="M40 84C31 80 25 78 19 68" delay={0.7} duration={0.45} strokeWidth={2.2} />
      </g>
      <motion.g initial={{ scale: 0, rotate: -25 }} animate={{ scale: 1.5, rotate: 0, transition: { ...springs.heavy, delay: 0.9 } }} style={{ originX: '40px', originY: '40px' }}>
        <g className={cn(days >= 0 && days <= 7 && 'lq-heartbeat')} style={{ transformOrigin: '40px 40px' }} transform="translate(14 14)">
          <Bloom species="tulipan" open={open} />
        </g>
      </motion.g>
    </svg>
  );
}
