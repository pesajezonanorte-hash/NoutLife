// El mapa de tu vida (Misiones): un pergamino donde un sendero sube desde el
// inicio de tu viaje. Abajo, los lugares que ya visitaste (misiones cumplidas,
// con su sello de viaje, su banderín y la fecha), agrupados por mes como regiones
// del mapa; en medio, tú («estás aquí»); arriba, los destinos por explorar
// (misiones activas, con su progreso) y, al fondo, la niebla de lo que aún no
// conoces, donde marcas un destino nuevo. Al llegar, el mapa se despliega desde
// donde estás: das un paso por el sendero, el camino recorrido se entinta hacia
// atrás y el que falta se punta hacia la niebla; cada lugar aparece cuando el
// trazo lo alcanza. Lo decorativo es aria-hidden; los lugares forman una lista
// ordenada (de lo que viene a lo que ya pasó) con sus botones.
import { useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Quest } from '@noutlife/shared';
import { Check, Plus, Tent, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion';
import { categoryMeta } from '@/lib/lifeMeta';
import { InkPath, ZoneAmbience, seeded } from '@/components/ambience';
import { Badge, Button } from '@/components/ui/lq';
import { borderTone, fillTone, strokeTone, textTone } from '@/components/ui/lq/tones';
import { Lettering } from '@/components/layout/Lettering';
import { deadlineInfo, isReady, questProgress } from './questMeta';

type Stop =
  | { kind: 'frontier'; key: string }
  | { kind: 'quest'; key: string; q: Quest }
  | { kind: 'you'; key: string }
  | { kind: 'region'; key: string; label: string }
  | { kind: 'origin'; key: string };

interface Placed { stop: Stop; top: number; h: number; x: number; side: 'l' | 'r'; order: number }
interface Pt { x: number; y: number }

const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
const xp = (n: number) => n.toLocaleString('es-CO');

/** Curva suave (Catmull-Rom) que pasa por todos los puntos. */
function smooth(p: Pt[]) {
  if (p.length < 2) return '';
  const f = (n: number) => n.toFixed(1);
  let d = `M${f(p[0].x)} ${f(p[0].y)}`;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i - 1] ?? p[i], b = p[i], c = p[i + 1], e = p[i + 2] ?? c;
    d += `C${f(b.x + (c.x - a.x) / 6)} ${f(b.y + (c.y - a.y) / 6)} ${f(c.x - (e.x - b.x) / 6)} ${f(c.y - (e.y - b.y) / 6)} ${f(c.x)} ${f(c.y)}`;
  }
  return d;
}

/** Entre dos lugares el sendero da un rodeo: un desvío lateral estable (semilla). */
function wander(pts: Pt[], seed: number) {
  const r = seeded(seed);
  return pts.flatMap((p, i) => {
    const n = pts[i + 1];
    if (!n) return [p];
    const dx = n.x - p.x, dy = n.y - p.y, len = Math.hypot(dx, dy) || 1;
    const off = (r() * 2 - 1) * Math.min(28, len * 0.2);
    return [p, { x: (p.x + n.x) / 2 + (-dy / len) * off, y: (p.y + n.y) / 2 + (dx / len) * off }];
  });
}

/** Colinas del mapa: curvas de nivel concéntricas, irregulares y estables. */
function contour(cx: number, cy: number, r: number, seed: number) {
  const rnd = seeded(seed);
  const ph = [rnd() * 6, rnd() * 6];
  const ring = (k: number) => smooth(Array.from({ length: 19 }, (_, i) => {
    const t = (i / 18) * Math.PI * 2;
    const rr = r * k * (1 + 0.13 * Math.sin(3 * t + ph[0]) + 0.07 * Math.sin(5 * t + ph[1]));
    return { x: cx + Math.cos(t) * rr * 1.35, y: cy + Math.sin(t) * rr };
  }));
  return [ring(1), ring(0.68), ring(0.38)];
}

/** Pequeños hitos dibujados a tinta junto al sendero (pinos, montes, lago, cabaña, torre). */
const LANDMARKS = [
  'M11 31V26M4 26h14L11 13ZM6 18h10L11 8ZM29 31v-4M23 27h12L29 16Z',
  'M2 31L14 11l7 10 5-6 12 16M10 17.5l4-6.5 3.5 5',
  'M3 13c4-4 8 4 12 0s8 4 12 0 8 4 12 0M9 22c4-4 8 4 12 0s8 4 12 0',
  'M6 31V17L18 7l12 10v14ZM14 31v-8h8v8',
  'M13 31V13h-2V7h4v3h4V7h4v3h4V7h4v6h-2v18Z',
] as const;

/** Destino por explorar: un círculo punteado y, alrededor, el progreso de sus pasos. */
function Destination({ q, delay }: { q: Quest; delay: number }) {
  const cat = categoryMeta(q.category);
  const ready = isReady(q);
  const pct = questProgress(q).pct;
  const tone = ready ? 'success' : cat.tone;
  const Icon = ready ? Check : cat.icon;
  return (
    <span className={cn('relative flex size-12 items-center justify-center rounded-full', ready && 'lq-halo')}>
      <svg viewBox="0 0 48 48" className="absolute inset-0 size-full -rotate-90 overflow-visible">
        <circle cx="24" cy="24" r="20" className="fill-surface stroke-on-background/25" strokeWidth="2.5" strokeDasharray="3 4.5" />
        {pct > 0 && (
          <motion.circle
            cx="24" cy="24" r="20" fill="none" className={strokeTone[tone]} strokeWidth="3.5" strokeLinecap="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: pct / 100 }} transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: delay + 0.25 }}
          />
        )}
      </svg>
      <Icon aria-hidden className={cn('relative size-5', textTone[tone])} strokeWidth={2} />
    </span>
  );
}

/** Lugar visitado: un sello de viaje con el ícono y un banderín clavado que se mece al pasar el cursor. */
function Stamp({ q }: { q: Quest }) {
  const cat = categoryMeta(q.category);
  const tilt = (hash(q.id) % 15) - 7;
  return (
    <span className="relative block size-12" style={{ rotate: `${tilt}deg` }}>
      <span className={cn('absolute inset-0 rounded-full border-[2.5px] bg-surface shadow-sm', borderTone[cat.tone])} />
      <span className={cn('absolute inset-[5px] rounded-full border border-dashed opacity-60', borderTone[cat.tone])} />
      <cat.icon aria-hidden className={cn('absolute inset-0 m-auto size-5', textTone[cat.tone])} strokeWidth={2} />
      <svg aria-hidden viewBox="0 0 22 30" className="absolute -right-2.5 -top-5 h-[30px] w-[22px] overflow-visible" style={{ rotate: `${-tilt}deg` }}>
        <path d="M3 29V3" className="stroke-secondary-text" strokeWidth="2" strokeLinecap="round" fill="none" />
        <path className={cn('lq-flag', fillTone[cat.tone])} d="M4 3.5c4-1.6 7 1.4 12 0v8c-5 1.4-8-1.6-12 0Z" />
      </svg>
    </span>
  );
}

/** Camino que no se recorrió (misión fallida): una marca tenue. */
function Closed() {
  return (
    <span className="flex size-10 items-center justify-center rounded-full border-2 border-dashed border-on-surface-light/50 bg-surface/80 text-on-surface-light">
      <X aria-hidden className="size-4" strokeWidth={2.25} />
    </span>
  );
}

const bloom = (delay: number) => ({
  initial: { opacity: 0, scale: 0.3, rotate: -18 },
  animate: { opacity: 1, scale: 1, rotate: 0, transition: { ...springs.heavy, delay, opacity: { duration: 0.2, delay } } },
  exit: { opacity: 0, scale: 0.6, transition: { duration: 0.18 } },
});

export interface AdventureMapProps {
  /** Destinos por explorar, del más cercano al más lejano. */
  ahead: Quest[];
  /** Lugares visitados (y caminos cerrados), del más reciente al más antiguo. */
  behind: Quest[];
  /** Tu avatar para «estás aquí». */
  traveler: ReactNode;
  /** Inicio del viaje (alta de la cuenta). */
  startedAt?: string;
  onOpen: (q: Quest) => void;
  onComplete: (q: Quest) => void;
  /** Marcar un destino nuevo en la niebla (sin él no hay frontera). */
  onNew?: () => void;
  className?: string;
}

export function AdventureMap({ ahead, behind, traveler, startedAt, onOpen, onComplete, onNew, className }: AdventureMapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const uid = useId().replace(/:/g, '');

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    // Un ancho 0 (contenedor oculto un instante) no deshace el mapa: se queda el último.
    const ro = new ResizeObserver(([e]) => { const next = Math.round(e.contentRect.width); if (next > 0) setW(next); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const compact = w < 640;

  const stops = useMemo<Stop[]>(() => {
    const out: Stop[] = [];
    if (onNew) out.push({ kind: 'frontier', key: 'frontier' });
    [...ahead].reverse().forEach((q) => out.push({ kind: 'quest', key: q.id, q }));
    out.push({ kind: 'you', key: 'you' });
    const now = new Date();
    let month = '';
    behind.forEach((q) => {
      const d = new Date(q.completedAt ?? q.updatedAt);
      const m = d.toLocaleDateString('es-ES', d.getFullYear() === now.getFullYear() ? { month: 'long' } : { month: 'long', year: 'numeric' });
      if (m !== month) { out.push({ kind: 'region', key: `region-${m}`, label: m }); month = m; }
      out.push({ kind: 'quest', key: q.id, q });
    });
    out.push({ kind: 'origin', key: 'origin' });
    return out;
  }, [ahead, behind, onNew]);

  const { placed, height, you } = useMemo(() => {
    const rowH = (s: Stop) => {
      if (s.kind === 'quest') return s.q.status === 'ACTIVE' ? (compact ? 150 : 150) : (compact ? 112 : 120);
      return { frontier: compact ? 132 : 156, you: compact ? 124 : 136, region: compact ? 60 : 76, origin: compact ? 112 : 124 }[s.kind];
    };
    let top = compact ? 4 : 12;
    let m = 0;
    const column = (side: 'l' | 'r') => (compact ? (side === 'l' ? 0.11 : 0.2) : side === 'l' ? 0.39 : 0.61);
    const out: Placed[] = stops.map((stop, order) => {
      const h = rowH(stop);
      const t = top;
      top += h;
      const side: 'l' | 'r' = m % 2 === 0 ? 'l' : 'r';
      // Un mes rotula la región del lugar que lo sigue: va de su lado.
      if (stop.kind === 'region') return { stop, top: t, h, x: column(side) * w, side, order };
      m += 1;
      const jitter = stop.kind === 'quest' && !compact ? ((hash(stop.q.id) % 100) / 100 - 0.5) * 0.04 : 0;
      const edge = stop.kind === 'frontier' || stop.kind === 'origin';
      const fx = edge ? (compact ? 0.155 : 0.5) : column(side) + jitter;
      return { stop, top: t, h, x: fx * w, side, order };
    });
    return { placed: out, height: top + (compact ? 8 : 20), you: out.find((p) => p.stop.kind === 'you')! };
  }, [stops, compact, w]);

  // El sendero, de arriba abajo: lo que falta (de la niebla hasta ti) y lo recorrido (de ti hasta el inicio).
  const { aheadD, behindD } = useMemo(() => {
    const pts = placed.filter((p) => p.stop.kind !== 'region').map((p) => ({ x: p.x, y: p.top + p.h / 2, kind: p.stop.kind }));
    const yi = pts.findIndex((p) => p.kind === 'you');
    return {
      aheadD: smooth(wander(pts.slice(0, yi + 1), 11)),
      behindD: smooth(wander(pts.slice(yi), 29)),
    };
  }, [placed]);

  // Decoración de fondo: colinas, en sitios estables según el alto del mapa.
  const hills = useMemo(() => {
    if (!w) return [];
    const r = seeded(Math.round(height / 50) + 3);
    const n = Math.max(2, Math.min(6, Math.round(height / 420)));
    return Array.from({ length: n }, (_, i) => {
      const left = i % 2 === 0;
      const cx = (left ? 0.06 + r() * 0.12 : 0.82 + r() * 0.12) * w;
      const cy = ((i + 0.6) / n) * height;
      return contour(cx, cy, compact ? 26 : 34 + r() * 18, i * 7 + 5);
    });
  }, [w, height, compact]);

  const visited = behind.filter((q) => q.status === 'COMPLETED').length;
  const markerCol = 0.2 * w;
  // El mapa se despliega de arriba abajo, como se lee: cada lugar aparece cuando el trazo lo alcanza
  // (una lista larga no tarda más de ~2,5 s en desplegarse entera).
  const step = Math.min(0.11, 2.2 / Math.max(1, stops.length));
  const delayOf = (p: Placed) => 0.25 + p.order * step;
  const reach = { you: delayOf(you), end: 0.25 + (stops.length - 1) * step };

  /** Caja de texto de un lugar: hacia fuera en escritorio, a la derecha en móvil. */
  const labelBox = (p: Placed, wide = 320): CSSProperties => {
    if (compact) return { left: markerCol + 32, right: 10, top: '50%' };
    if (p.stop.kind === 'frontier' || p.stop.kind === 'origin') return { left: p.x + 40, width: Math.min(wide, w - p.x - 52), top: '50%' };
    return p.side === 'l'
      ? { right: w - p.x + 38, width: Math.min(wide, p.x - 50), top: '50%' }
      : { left: p.x + 38, width: Math.min(wide, w - p.x - 50), top: '50%' };
  };
  const outward = (p: Placed) => !compact && p.side === 'l' && p.stop.kind !== 'frontier' && p.stop.kind !== 'origin';

  return (
    <div ref={ref} className={cn('lq-map relative overflow-hidden rounded-2xl', className)} style={{ height: w ? height : 640 }}>
      {w > 0 && (
        <>
          <ZoneAmbience zone="quests-map" scope="local">
            {/* Curvas de nivel de las colinas */}
            <svg className="absolute inset-0 overflow-visible text-warning-text opacity-[.13] dark:opacity-[.2]" width={w} height={height}>
              {hills.map((rings, i) => rings.map((d, k) => <path key={`${i}-${k}`} d={d} fill="none" stroke="currentColor" strokeWidth={1.2} />))}
            </svg>
            {/* Rosa de los vientos: la aguja se mece despacio */}
            <svg viewBox="0 0 64 64" className="absolute right-5 top-5 hidden size-16 overflow-visible text-on-surface-light opacity-60 md:block">
              <InkPath d="M32 9.5a22.5 22.5 0 1 0 .1 0" delay={0.5} duration={1} strokeWidth={1.4} />
              <InkPath d="M32 3v6M32 55v6M3 32h6M55 32h6" delay={0.9} duration={0.5} strokeWidth={1.4} />
              <g className="lq-amb-sway" style={{ ['--r' as string]: '7deg', ['--d' as string]: '6s', ['--o' as string]: '50% 50%' }}>
                <path d="M32 14l4.5 18L32 50l-4.5-18Z" className="fill-error/70" />
                <path d="M32 32l4.5 0L32 50l-4.5-18Z" className="fill-on-surface-light/60" />
              </g>
            </svg>
          </ZoneAmbience>

          {/* El sendero: lo que falta punteado, lo recorrido entintado; se despliega de arriba abajo */}
          <svg aria-hidden className="pointer-events-none absolute inset-0 overflow-visible" width={w} height={height}>
            <defs>
              <mask id={`${uid}-b`} maskUnits="userSpaceOnUse" x={0} y={0} width={w} height={height}>
                <motion.path d={behindD} fill="none" stroke="#fff" strokeWidth={20} strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: Math.max(0.3, reach.end - reach.you), ease: 'linear', delay: reach.you }} />
              </mask>
              <mask id={`${uid}-a`} maskUnits="userSpaceOnUse" x={0} y={0} width={w} height={height}>
                <motion.path d={aheadD} fill="none" stroke="#fff" strokeWidth={20} strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: Math.max(0.3, reach.you - 0.25), ease: 'linear', delay: 0.25 }} />
              </mask>
            </defs>
            <path d={behindD} mask={`url(#${uid}-b)`} className="lq-trail lq-trail-past" />
            <path d={aheadD} mask={`url(#${uid}-a)`} className="lq-trail lq-trail-ahead" />
            {/* Hitos junto al sendero (en escritorio, en el pasillo central) */}
            {!compact && placed.map((p) => {
              if (p.stop.kind !== 'quest' || hash(p.stop.q.id) % 3 === 0) return null;
              const lm = LANDMARKS[hash(p.stop.q.id) % LANDMARKS.length];
              const lx = p.side === 'l' ? p.x + 0.12 * w : p.x - 0.12 * w;
              return (
                <svg key={`lm-${p.stop.key}`} viewBox="0 0 42 34" x={lx - 21} y={p.top + p.h / 2 - 17} width={42} height={34} className="overflow-visible text-on-surface-light opacity-50">
                  <InkPath d={lm} delay={delayOf(p) + 0.3} duration={0.9} strokeWidth={1.5} />
                </svg>
              );
            })}
          </svg>

          {/* La niebla de lo inexplorado, arriba */}
          {onNew && (
            <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 block h-48">
              <span className="lq-fog absolute inset-0 block" />
              <span className="lq-amb-wander lq-fog-puff absolute -left-[10%] top-2 block h-28 w-[55%] [--d:24s]" />
              <span className="lq-amb-wander lq-fog-puff absolute -right-[8%] top-10 block h-24 w-[50%] [--d:31s] [animation-direction:alternate-reverse]" />
            </span>
          )}

          <ol aria-label="Mapa de tus misiones" className="relative" style={{ height }}>
            {placed.map((p) => {
              const delay = delayOf(p);
              const s = p.stop;
              const marker = { left: p.x, top: p.h / 2 };
              const labelMotion = {
                initial: { opacity: 0, x: outward(p) ? 10 : -10, y: '-50%' },
                animate: { opacity: 1, x: 0, y: '-50%', transition: { ...springs.natural, delay: delay + 0.1 } },
              };

              if (s.kind === 'region') {
                return (
                  <li key={s.key} className="absolute inset-x-0" style={{ top: p.top, height: p.h }}>
                    <motion.span
                      className={cn('absolute text-heading-lg text-on-surface-light/80 md:text-display-sm', outward(p) && 'text-right')}
                      style={labelBox(p, 360)}
                      initial={{ ...labelMotion.initial, rotate: -2 }}
                      animate={{ ...labelMotion.animate, rotate: -2 }}
                    >
                      <Lettering text={s.label} delay={delay + 0.1} />
                    </motion.span>
                  </li>
                );
              }

              if (s.kind === 'frontier') {
                return (
                  <li key={s.key} className="absolute inset-x-0" style={{ top: p.top, height: p.h }}>
                    <span className="absolute -translate-x-1/2 -translate-y-1/2" style={marker}>
                      <motion.span className="block" {...bloom(delay)}>
                      <button
                        type="button" onClick={onNew}
                        className="group flex size-14 items-center justify-center rounded-full border-2 border-dashed border-on-surface-light/60 bg-surface/70 text-on-surface transition-colors duration-300 hover:border-primary hover:text-primary-text"
                      >
                        <Plus aria-hidden className="size-6 transition-transform duration-500 ease-[var(--lq-ease-natural)] group-hover:rotate-90" strokeWidth={2} />
                        <span className="sr-only">Marcar un destino nuevo</span>
                      </button>
                      </motion.span>
                    </span>
                    <motion.div aria-hidden className="absolute flex flex-col gap-0.5" style={labelBox(p)} {...labelMotion}>
                      <span className="text-label-lg text-on-background">Tierra por explorar</span>
                      <span className="text-body-sm text-on-surface-light">{ahead.length ? 'Marca otro destino en el mapa.' : 'Marca tu primer destino en el mapa.'}</span>
                    </motion.div>
                  </li>
                );
              }

              if (s.kind === 'you') {
                const below = placed[placed.indexOf(p) + 1];
                const from = below && below.stop.kind !== 'region' ? below : placed[placed.indexOf(p) + 2];
                return (
                  <li key={s.key} className="absolute inset-x-0" style={{ top: p.top, height: p.h }}>
                    {/* Das un paso por el sendero: desde el último lugar hasta donde estás */}
                    <span className="absolute -translate-x-1/2 -translate-y-1/2" style={marker}>
                    <motion.span
                      className="block"
                      initial={from ? { opacity: 0, x: from.x - p.x, y: from.top + from.h / 2 - (p.top + p.h / 2) } : { opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, x: 0, y: 0, scale: 1, transition: { ...springs.gentle, delay: Math.max(0.1, reach.you - 0.35), opacity: { duration: 0.25, delay: Math.max(0.1, reach.you - 0.35) } } }}
                    >
                      <span className="relative flex size-16 items-center justify-center">
                        <span aria-hidden className="lq-you-ring absolute inset-0 rounded-full" />
                        <span className="relative size-14 overflow-hidden rounded-full border-[3px] border-primary bg-surface shadow-md">{traveler}</span>
                      </span>
                    </motion.span>
                    </span>
                    <motion.div className={cn('absolute flex flex-col gap-0.5', outward(p) && 'items-end text-right')} style={labelBox(p)} {...labelMotion}>
                      <span className="text-heading-md text-primary-text"><Lettering text="Estás aquí" delay={reach.you + 0.15} /></span>
                      <span className="text-body-sm text-on-surface-light">
                        <span className="font-mono tabular-nums">{visited}</span> {visited === 1 ? 'lugar visitado' : 'lugares visitados'} · <span className="font-mono tabular-nums">{ahead.length}</span> por explorar
                      </span>
                    </motion.div>
                  </li>
                );
              }

              if (s.kind === 'origin') {
                return (
                  <li key={s.key} className="absolute inset-x-0" style={{ top: p.top, height: p.h }}>
                    <span aria-hidden className="absolute -translate-x-1/2 -translate-y-1/2" style={marker}>
                      <motion.span className="flex size-12 items-center justify-center rounded-full bg-surface text-secondary-text shadow-sm ring-2 ring-secondary/45" {...bloom(delay)}>
                        <Tent className="size-5" strokeWidth={1.75} />
                      </motion.span>
                    </span>
                    <motion.div className="absolute flex flex-col gap-0.5" style={labelBox(p)} {...labelMotion}>
                      <span className="text-label-lg text-on-background">Aquí empezó tu viaje</span>
                      {startedAt && <span className="text-body-sm text-on-surface-light">{new Date(startedAt).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</span>}
                    </motion.div>
                  </li>
                );
              }

              const q = s.q;
              const active = q.status === 'ACTIVE';
              const failed = q.status === 'FAILED';
              const ready = isReady(q);
              const prog = questProgress(q);
              const deadline = active ? deadlineInfo(q.deadline) : null;
              const out = outward(p);
              return (
                <motion.li key={s.key} layout="position" transition={{ layout: springs.gentle }} className="group absolute inset-x-0" style={{ top: p.top, height: p.h }}>
                  <span aria-hidden className="absolute -translate-x-1/2 -translate-y-1/2 transition-transform duration-500 ease-[var(--lq-ease-natural)] group-hover:-translate-y-[calc(50%+3px)] [.reduce-motion_&]:group-hover:-translate-y-1/2" style={marker}>
                    <AnimatePresence mode="wait">
                      <motion.span key={q.status} className="block" {...bloom(delay)}>
                        {active ? <Destination q={q} delay={delay} /> : failed ? <Closed /> : <Stamp q={q} />}
                      </motion.span>
                    </AnimatePresence>
                  </span>
                  <motion.div className={cn('absolute flex flex-col gap-1', out && 'items-end text-right', failed && 'opacity-70')} style={labelBox(p)} {...labelMotion}>
                    <button type="button" aria-haspopup="dialog" onClick={() => onOpen(q)} className={cn('group/place relative max-w-full rounded-md', out ? 'text-right' : 'text-left')}>
                      {/* Marcador: subraya el nombre al pasar el cursor o al enfocar */}
                      <span aria-hidden className={cn('pointer-events-none absolute inset-x-[-4px] bottom-0.5 top-[48%] scale-x-0 rounded-[3px] bg-warning/25 transition-transform duration-[560ms] ease-[var(--lq-ease-natural)] group-hover/place:scale-x-100 group-focus-visible/place:scale-x-100', out ? 'origin-right' : 'origin-left')} />
                      <span className={cn('relative line-clamp-2 text-label-lg md:text-heading-sm', failed ? 'text-on-surface-light line-through decoration-on-surface-light/50' : 'text-on-background')}>{q.title}</span>
                    </button>
                    <span className="text-body-sm text-on-surface-light">
                      {active
                        ? <>{prog.total ? prog.text : categoryMeta(q.category).label} · <span className="font-mono tabular-nums">+{xp(q.xpReward)} XP</span></>
                        : failed
                          ? <>Camino cerrado · {fmtDate(q.updatedAt)}</>
                          : <>{q.completedAt ? fmtDate(q.completedAt) : 'Visitado'} · <span className="font-mono tabular-nums">+{xp(q.xpReward)} XP</span></>}
                    </span>
                    {active && (
                      <span className={cn('mt-1 flex flex-wrap items-center gap-2', out && 'justify-end')}>
                        <Button size="sm" variant={ready ? 'primary' : 'secondary'} aria-label={`Completar ${q.title}`} onClick={() => onComplete(q)}>
                          Completar
                        </Button>
                        {deadline && <Badge variant={deadline.variant}>{deadline.text}</Badge>}
                      </span>
                    )}
                  </motion.div>
                </motion.li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}
