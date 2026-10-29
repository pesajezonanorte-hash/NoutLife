// Mapa muscular del Coliseo: el cuerpo en 3D (o de frente y de espalda en plano)
// pintado según la fatiga de cada músculo (lib/coliseo muscleStates). Verde =
// recuperado (0–30 %), ámbar = fatiga moderada (31–70 %), rojo = fatiga alta
// (71–100 %), gris = sin trabajo esta semana. La lectura de la derecha da el
// detalle y las listas de abajo son la alternativa sin color (y con dianas
// grandes) al dibujo, también para el teclado.
import { Fragment, Suspense, lazy, useEffect, useMemo, useState, type ComponentType, type KeyboardEvent } from 'react';
import { BatteryFull, BatteryLow, BatteryMedium, ChevronDown, CircleDashed, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FATIGUE_BANDS, MUSCLE_IDS, muscleLabelFor, type Muscle, type MuscleState, type Recovery } from '@/lib/coliseo';
import { INTL_LOCALE, useLocale, useText, type Copy } from '@/lib/i18n';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useAuthStore } from '@/store/authStore';
import { lookFrom } from '@/components/character/pixel/look';
import { Badge, Card, ProgressBar, SegmentedControl, Skeleton, chipClasses, type BadgeVariant } from '@/components/ui/lq';
import type { MuscleViewer3DProps } from './muscle3d/MuscleViewer3D';
import type { Body } from './muscle3d/figure';

/** Si three.js no llega a descargarse (sin red), la tarjeta vuelve al mapa plano en vez de romper la zona. */
function Unavailable({ onUnavailable }: MuscleViewer3DProps) {
  useEffect(() => { onUnavailable(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
// three.js solo se descarga si se abre la vista 3D.
const MuscleViewer3D = lazy<ComponentType<MuscleViewer3DProps>>(() => import('./muscle3d/MuscleViewer3D').catch(() => ({ default: Unavailable })));

const es = {
  high: 'Fatiga alta',
  moderate: 'Fatiga moderada',
  fresh: 'Recuperado',
  idle: 'Sin trabajo esta semana',
  groupHigh: 'Necesitan descanso',
  groupModerate: 'Fatiga moderada',
  groupFresh: 'Listos para entrenar',
  groupIdle: 'Sin trabajo esta semana',
  flat: 'Plano',
  viewLabel: 'Vista del mapa',
  legend: 'Leyenda',
  front: 'Frente',
  back: 'Espalda',
  title: 'Recuperación muscular',
  introThree: 'Según tus series de los últimos 7 días. Gira el cuerpo y toca un músculo para ver cuándo se recupera.',
  introFlat: 'Según tus series de los últimos 7 días. Toca un músculo para ver cuándo vuelve a estar listo.',
  fatigue: 'Fatiga',
  fullRecovery: 'Recuperación total',
  sets7: 'Series 7 días',
  fullIn: (h: number): string => `en ~${h} h`,
  full: 'completa',
  agoLess: 'hace menos de 1 h',
  agoHours: (h: number): string => `hace ${h} h`,
  yesterday: 'ayer',
  agoDays: (d: number): string => `hace ${d} días`,
  touchHint: 'Toca un músculo para ver su fatiga y cuándo se recupera.',
  idleSets: 'Sin series esta semana.',
  readyIn: (h: number): string => `Se puede volver a entrenar en ~${h} h.`,
  readyNow: 'Se puede entrenar ya.',
  lastWork: (when: string): string => `Último trabajo ${when}.`,
  allReady: 'Todo listo: ningún músculo arrastra fatiga. Toca uno para ver su semana.',
  noSets: 'Aún no hay series esta semana. Termina un entrenamiento y cada músculo se pinta según su fatiga.',
  allMuscles: 'Todos los músculos',
  fatigueOf: (name: string): string => `Fatiga de ${name}`,
  muscleAria: (name: string, status: string, pct: number): string => `${name}: ${status.toLowerCase()}, ${pct} % recuperado`,
};

const en: typeof es = {
  high: 'High fatigue',
  moderate: 'Moderate fatigue',
  fresh: 'Recovered',
  idle: 'No work this week',
  groupHigh: 'Need rest',
  groupModerate: 'Moderate fatigue',
  groupFresh: 'Ready to train',
  groupIdle: 'No work this week',
  flat: 'Flat',
  viewLabel: 'Map view',
  legend: 'Legend',
  front: 'Front',
  back: 'Back',
  title: 'Muscle recovery',
  introThree: 'Based on your sets over the last 7 days. Rotate the body and tap a muscle to see when it recovers.',
  introFlat: 'Based on your sets over the last 7 days. Tap a muscle to see when it is ready again.',
  fatigue: 'Fatigue',
  fullRecovery: 'Full recovery',
  sets7: '7-day sets',
  fullIn: (h: number): string => `in ~${h} h`,
  full: 'complete',
  agoLess: 'less than 1 h ago',
  agoHours: (h: number): string => `${h} h ago`,
  yesterday: 'yesterday',
  agoDays: (d: number): string => `${d} days ago`,
  touchHint: 'Tap a muscle to see its fatigue and when it recovers.',
  idleSets: 'No sets this week.',
  readyIn: (h: number): string => `You can train it again in ~${h} h.`,
  readyNow: 'You can train it now.',
  lastWork: (when: string): string => `Last worked ${when}.`,
  allReady: 'All set: no muscle is carrying fatigue. Tap one to see its week.',
  noSets: 'No sets this week yet. Finish a workout and each muscle will be colored by its fatigue.',
  allMuscles: 'All muscles',
  fatigueOf: (name: string): string => `${name} fatigue`,
  muscleAria: (name: string, status: string, pct: number): string => `${name}: ${status.toLowerCase()}, ${pct} % recovered`,
};

const COPY: Copy<typeof es> = { es, en };

/** Estilo por estado (el texto sale del idioma activo). */
const STATUS_STYLE: Record<Recovery, { range: string; fill: string; badge: BadgeVariant; icon: LucideIcon }> = {
  high: { range: `${FATIGUE_BANDS.moderate + 1}–100 %`, fill: 'fill-error', badge: 'error', icon: BatteryLow },
  moderate: { range: `${FATIGUE_BANDS.fresh + 1}–${FATIGUE_BANDS.moderate} %`, fill: 'fill-warning', badge: 'warning', icon: BatteryMedium },
  fresh: { range: `0–${FATIGUE_BANDS.fresh} %`, fill: 'fill-success', badge: 'success', icon: BatteryFull },
  idle: { range: '', fill: 'fill-on-surface-light/25', badge: 'neutral', icon: CircleDashed },
};
const statusOf = (r: Recovery, t: typeof es) => ({
  ...STATUS_STYLE[r],
  label: t[r],
  group: { high: t.groupHigh, moderate: t.groupModerate, fresh: t.groupFresh, idle: t.groupIdle }[r],
});
const ORDER: Recovery[] = ['high', 'moderate', 'fresh', 'idle'];

type View = '3d' | 'flat';
const VIEW_KEY = 'coliseo.muscle-view';
// Alto de la tarjeta flotante del visor en móvil (más su margen): la figura se encuadra debajo.
const FLOAT_INSET = 96;
const hasWebGL2 = () => typeof window !== 'undefined' && 'WebGL2RenderingContext' in window;
function readView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'flat' ? 'flat' : '3d';
  } catch {
    return '3d';
  }
}

/* Media figura (x < 100, viewBox 200 × 420); la otra mitad es su espejo. Curvas
   Catmull-Rom suavizadas a Bézier; las formas de la línea media cierran en recto. */
const MIRROR = 'matrix(-1 0 0 1 200 0)';
const BASE = 'M101 46C99.3 46 93 43.3 91 46C89 48.7 90.8 58.5 89 62C87.2 65.5 83.8 65.5 80 67C76.2 68.5 70.3 70 66 71C61.7 72 57.5 71.3 54 73C50.5 74.7 47.2 77.3 45 81C42.8 84.7 41.8 90.2 41 95C40.2 99.8 40.2 104.2 40 110C39.8 115.8 40.2 123.3 40 130C39.8 136.7 39.3 144.5 39 150C38.7 155.5 38.8 157.3 38 163C37.2 168.7 35.3 176.8 34 184C32.7 191.2 31 199 30 206C29 213 28.8 220 28 226C27.2 232 25 237 25 242C25 247 26.3 253.2 28 256C29.7 258.8 33 260.3 35 259C37 257.7 39.2 252.5 40 248C40.8 243.5 39.3 238.3 40 232C40.7 225.7 42.3 217.3 44 210C45.7 202.7 48 195 50 188C52 181 54.3 175 56 168C57.7 161 59 153.3 60 146C61 138.7 61.5 130 62 124C62.5 118 62.3 109.7 63 110C63.7 110.3 65 119.3 66 126C67 132.7 68.2 141.7 69 150C69.8 158.3 70.5 168.7 71 176C71.5 183.3 72.5 188.3 72 194C71.5 199.7 69 204.3 68 210C67 215.7 66.7 221 66 228C65.3 235 64 242.3 64 252C64 261.7 64.8 275.7 66 286C67.2 296.3 69.8 307.3 71 314C72.2 320.7 73.2 320.3 73 326C72.8 331.7 70.2 340.3 70 348C69.8 355.7 70.7 364 72 372C73.3 380 77.7 390 78 396C78.3 402 74 405 74 408C74 411 74.7 413 78 414C81.3 415 91.2 416 94 414C96.8 412 94.8 407.7 95 402C95.2 396.3 94.8 388.3 95 380C95.2 371.7 95.8 360.3 96 352C96.2 343.7 95.8 338.7 96 330C96.2 321.3 96.5 311.3 97 300C97.5 288.7 98.5 272 99 262C99.5 252 99.7 243.7 100 240C100.3 236.3 100.8 240 101 240Z';
const DELT_OUTER = 'M60 72C59 71.7 52.8 74 50 76C47.2 78 44.7 80.7 43 84C41.3 87.3 40.5 92 40 96C39.5 100 39.5 104.3 40 108C40.5 111.7 41.8 117.3 43 118C44.2 118.7 46 115 47 112C48 109 48.2 104 49 100C49.8 96 50.8 91.7 52 88C53.2 84.3 54.7 80.7 56 78C57.3 75.3 61 72.3 60 72Z';
const DELT_INNER = 'M62 72C59.8 72.7 58.7 75 57 78C55.3 81 53.3 85.7 52 90C50.7 94.3 49.5 99.7 49 104C48.5 108.3 48.5 113 49 116C49.5 119 50.5 122.3 52 122C53.5 121.7 56 117.3 58 114C60 110.7 62 106 64 102C66 98 68.3 93.7 70 90C71.7 86.3 74 82.7 74 80C74 77.3 72 75.3 70 74C68 72.7 64.2 71.3 62 72Z';
const FOREARM = 'M54 171C52.2 170.5 47.7 171.5 45 174C42.3 176.5 40 181.3 38 186C36 190.7 34.3 196.8 33 202C31.7 207.2 30.5 212.8 30 217C29.5 221.2 28.8 224.8 30 227C31.2 229.2 35 231.5 37 230C39 228.5 40.3 222.7 42 218C43.7 213.3 45.3 207 47 202C48.7 197 50.5 192.2 52 188C53.5 183.8 55.7 179.8 56 177C56.3 174.2 55.8 171.5 54 171Z';

const FRONT: Partial<Record<Muscle, string[]>> = {
  traps: ['M91 56C90.3 54.8 88.5 61 86 63C83.5 65 79.3 66.5 76 68C72.7 69.5 66.3 70.8 66 72C65.7 73.2 71 74.8 74 75C77 75.2 81.3 73.8 84 73C86.7 72.2 88.8 72.8 90 70C91.2 67.2 91.7 57.2 91 56Z'],
  sideDelts: [DELT_OUTER],
  frontDelts: [DELT_INNER],
  chest: ['M100 80C98 79.7 92 78.3 88 78C84 77.7 79 77 76 78C73 79 71.7 81 70 84C68.3 87 66.8 92 66 96C65.2 100 64.7 104.3 65 108C65.3 111.7 66.2 115.3 68 118C69.8 120.7 72.7 122.7 76 124C79.3 125.3 84 126 88 126C92 126 98 124.3 100 124Z'],
  biceps: ['M52 124C49.8 124.7 47.7 128.7 46 132C44.3 135.3 42.7 140.2 42 144C41.3 147.8 41.5 151.8 42 155C42.5 158.2 43.5 161 45 163C46.5 165 49 167.3 51 167C53 166.7 55.5 164 57 161C58.5 158 59.3 153 60 149C60.7 145 61.2 140.5 61 137C60.8 133.5 60.5 130.2 59 128C57.5 125.8 54.2 123.3 52 124Z'],
  forearms: [FOREARM],
  abs: [130, 149, 168].map((y) => `M92 ${y}h4a3 3 0 0 1 3 3v10a3 3 0 0 1 -3 3h-4a3 3 0 0 1 -3 -3v-10a3 3 0 0 1 3 -3Z`)
    .concat('M92 187h4a3 3 0 0 1 3 3v19a3 3 0 0 1 -3 3h-4a3 3 0 0 1 -3 -3v-19a3 3 0 0 1 3 -3Z'),
  obliques: ['M86 132C84.7 128.7 80.3 133.7 78 136C75.7 138.3 73.3 141.7 72 146C70.7 150.3 70.2 156.3 70 162C69.8 167.7 70.3 174.3 71 180C71.7 185.7 72.5 192 74 196C75.5 200 77.8 202.3 80 204C82.2 205.7 85.8 210 87 206C88.2 202 87.2 188.3 87 180C86.8 171.7 86.2 164 86 156C85.8 148 87.3 135.3 86 132Z'],
  quads: ['M70 226C68 228.2 66.8 234.3 66 240C65.2 245.7 65 253 65 260C65 267 65.3 275.3 66 282C66.7 288.7 67.7 294.7 69 300C70.3 305.3 71.8 311 74 314C76.2 317 79.3 317.3 82 318C84.7 318.7 87.8 319 90 318C92.2 317 93.8 316.3 95 312C96.2 307.7 96.5 299.3 97 292C97.5 284.7 97.8 275.7 98 268C98.2 260.3 98.7 251.3 98 246C97.3 240.7 96 238.7 94 236C92 233.3 88.7 231.5 86 230C83.3 228.5 80.7 227.7 78 227C75.3 226.3 72 223.8 70 226Z'],
  calves: [
    'M74 338C73 339.7 71.5 345.7 71 350C70.5 354.3 70.7 359.3 71 364C71.3 368.7 72 374.3 73 378C74 381.7 75.8 385.7 77 386C78.2 386.3 79.5 383.7 80 380C80.5 376.3 80.2 369 80 364C79.8 359 79.5 354 79 350C78.5 346 77.8 342 77 340C76.2 338 75 336.3 74 338Z',
    'M94 338C93.3 338 92.5 345.3 92 350C91.5 354.7 91 361 91 366C91 371 91.3 377 92 380C92.7 383 94.3 386.3 95 384C95.7 381.7 95.8 371.7 96 366C96.2 360.3 96.3 354.7 96 350C95.7 345.3 94.7 338 94 338Z',
  ],
};
const BACK: Partial<Record<Muscle, string[]>> = {
  traps: ['M100 48C98.5 48.5 93.3 49 91 51C88.7 53 88.5 57.2 86 60C83.5 62.8 79.7 65.7 76 68C72.3 70.3 64.3 72 64 74C63.7 76 70.7 77.3 74 80C77.3 82.7 81.2 86 84 90C86.8 94 89 99 91 104C93 109 94.5 114.7 96 120C97.5 125.3 99.3 133.3 100 136Z'],
  sideDelts: [DELT_OUTER],
  rearDelts: [DELT_INNER],
  triceps: ['M51 122C48.8 122.8 46.7 126.7 45 130C43.3 133.3 41.7 137.8 41 142C40.3 146.2 40.5 151.3 41 155C41.5 158.7 42.3 161.8 44 164C45.7 166.2 48.8 168.3 51 168C53.2 167.7 55.3 165.2 57 162C58.7 158.8 60.2 153.5 61 149C61.8 144.5 62.5 139 62 135C61.5 131 59.8 127.2 58 125C56.2 122.8 53.2 121.2 51 122Z'],
  forearms: [FOREARM],
  lats: ['M64 108C62.5 112 62.7 117 63 122C63.3 127 64.7 132.3 66 138C67.3 143.7 69 150.3 71 156C73 161.7 75.7 167 78 172C80.3 177 83 182.7 85 186C87 189.3 88.7 193.7 90 192C91.3 190.3 92 181.7 93 176C94 170.3 95.2 163.3 96 158C96.8 152.7 98.3 149 98 144C97.7 139 95.5 133.3 94 128C92.5 122.7 91 116.7 89 112C87 107.3 84.8 102.3 82 100C79.2 97.7 75 96.7 72 98C69 99.3 65.5 104 64 108Z'],
  lowerBack: ['M100 144C99.5 146.3 98.2 153 97 158C95.8 163 94 168.7 93 174C92 179.3 91.2 185 91 190C90.8 195 91.2 200.3 92 204C92.8 207.7 94.7 210.3 96 212C97.3 213.7 99.3 213.7 100 214Z'],
  glutes: ['M100 212C98.3 211.7 93.3 210 90 210C86.7 210 83.2 210.3 80 212C76.8 213.7 73.2 216.7 71 220C68.8 223.3 67.5 227.7 67 232C66.5 236.3 66.8 242 68 246C69.2 250 71.3 253.3 74 256C76.7 258.7 80.7 261 84 262C87.3 263 91.3 262.7 94 262C96.7 261.3 99 258.7 100 258Z'],
  hamstrings: ['M70 262C68 264.5 68.2 274 68 280C67.8 286 68.2 292.3 69 298C69.8 303.7 71.2 310.3 73 314C74.8 317.7 77.5 318.8 80 320C82.5 321.2 85.5 321.7 88 321C90.5 320.3 93.3 319.8 95 316C96.7 312.2 97.3 304 98 298C98.7 292 99 285.3 99 280C99 274.7 99.5 268.3 98 266C96.5 263.7 93 266.2 90 266C87 265.8 83.3 265.7 80 265C76.7 264.3 72 259.5 70 262Z'],
  calves: ['M76 334C74.2 336.3 72 341.7 71 346C70 350.3 69.8 355.3 70 360C70.2 364.7 70.8 370 72 374C73.2 378 75 382 77 384C79 386 81.8 386.3 84 386C86.2 385.7 88.3 384.7 90 382C91.7 379.3 93.2 374.7 94 370C94.8 365.3 95 359 95 354C95 349 94.8 343.5 94 340C93.2 336.5 92 334.3 90 333C88 331.7 84.3 331.8 82 332C79.7 332.2 77.8 331.7 76 334Z'],
};

const HOUR = 3_600_000;
const toneOf = (s: MuscleState) => (s.status === 'high' ? 'error' : s.status === 'moderate' ? 'warning' : 'success');

/** Texto de «hace X» y de «en ~X h», en el idioma activo. */
function agoText(t: number, now: number, copy: typeof es) {
  const h = Math.floor((now - t) / HOUR);
  return h < 1 ? copy.agoLess : h < 24 ? copy.agoHours(h) : h < 48 ? copy.yesterday : copy.agoDays(Math.floor(h / 24));
}
const fullText = (s: MuscleState, copy: typeof es) => (s.fullIn > 0 ? copy.fullIn(s.fullIn) : copy.full);

/** Tarjeta flotante del visor 3D en móvil: lo que dice el panel lateral, en una línea, junto al dedo. */
function FloatingReadout({ muscle, state }: { muscle: Muscle | null; state: MuscleState | null }) {
  const t = useText(COPY);
  const locale = useLocale();
  const sets = (n: number) => n.toLocaleString(INTL_LOCALE[locale], { maximumFractionDigits: 1 });
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-3 top-3 h-[84px] rounded-xl border border-border bg-background/90 px-3 py-2.5 shadow-sm md:hidden">
      {muscle && state ? (
        <div className="flex h-full flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-label-lg text-on-background">{muscleLabelFor(muscle, locale)}</span>
            <Badge variant={statusOf(state.status, t).badge} icon={statusOf(state.status, t).icon}>{statusOf(state.status, t).label}</Badge>
          </div>
          <dl className="grid grid-cols-[auto_1fr_auto] gap-x-4 text-caption text-on-surface-light">
            <div><dt>{t.fatigue}</dt><dd className="font-mono text-label-lg tabular-nums text-on-background">{state.fatiguePct} %</dd></div>
            <div><dt>{t.fullRecovery}</dt><dd className="font-mono text-label-lg tabular-nums text-on-background">{fullText(state, t)}</dd></div>
            <div><dt>{t.sets7}</dt><dd className="font-mono text-label-lg tabular-nums text-on-background">{sets(state.weekSets)}</dd></div>
          </dl>
        </div>
      ) : (
        <p className="flex h-full items-center text-body-sm text-on-surface">{t.touchHint}</p>
      )}
    </div>
  );
}

/** Mientras llega three.js: el mismo hueco que el visor, para que nada salte. */
function ViewerFallback() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-[460px] rounded-2xl sm:h-[480px] md:h-[500px]" />
      <Skeleton className="h-[52px] w-48 rounded-[0.875rem]" />
    </div>
  );
}

function Figure({ shapes, label, states, selected, onSelect }: {
  shapes: Partial<Record<Muscle, string[]>>;
  label: string;
  states: Record<Muscle, MuscleState>;
  selected: Muscle | null;
  onSelect: (m: Muscle) => void;
}) {
  const t = useText(COPY);
  const locale = useLocale();
  // El seleccionado se dibuja el último para que su contorno quede encima.
  const muscles = (Object.keys(shapes) as Muscle[]).sort((a, b) => Number(a === selected) - Number(b === selected));
  const onKey = (e: KeyboardEvent, m: Muscle) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    onSelect(m);
  };
  return (
    <figure className="flex min-w-0 flex-1 flex-col items-center gap-2">
      <svg viewBox="0 0 200 420" role="group" aria-label={label} className="h-auto w-full max-w-[210px] overflow-visible">
        <g aria-hidden className="fill-surface-variant">
          <ellipse cx="100" cy="30" rx="16" ry="21" />
          <path d={BASE} />
          <path d={BASE} transform={MIRROR} />
        </g>
        {muscles.map((m) => {
          const s = states[m];
          const on = m === selected;
          return (
            <g
              key={m} role="button" tabIndex={0} aria-pressed={on}
              aria-label={t.muscleAria(muscleLabelFor(m, locale), statusOf(s.status, t).label, s.recovered)}
              onClick={() => onSelect(m)} onKeyDown={(e) => onKey(e, m)}
              className={cn(
                'cursor-pointer outline-none transition-[fill,stroke,opacity] duration-700 [stroke-linejoin:round] hover:opacity-80',
                STATUS_STYLE[s.status].fill,
                on ? 'stroke-on-background [stroke-width:2.5]' : 'stroke-surface [stroke-width:1.5] focus-visible:stroke-primary focus-visible:[stroke-width:3]',
              )}
            >
              {shapes[m]!.map((d) => (
                <Fragment key={d}>
                  <path d={d} />
                  <path d={d} transform={MIRROR} />
                </Fragment>
              ))}
            </g>
          );
        })}
      </svg>
      <figcaption className="text-label-md text-on-surface-light">{label}</figcaption>
    </figure>
  );
}

/** Figura del perfil: mujer u hombre según el género; si no lo indicó, el cuerpo de su personaje. */
function useBody(): Body {
  const gender = useAuthStore((s) => s.user?.gender);
  const avatar = useAuthStore((s) => s.user?.avatarConfig);
  if (gender === 'female' || gender === 'male') return gender;
  return lookFrom(avatar, 'male').body;
}

export function MuscleMap({ states, now }: { states: Record<Muscle, MuscleState>; now: number }) {
  const t = useText(COPY);
  const body = useBody();
  const locale = useLocale();
  const views: Array<{ value: View; label: string }> = [{ value: '3d', label: '3D' }, { value: 'flat', label: t.flat }];
  const worst = useMemo(
    () => MUSCLE_IDS.filter((m) => states[m].status === 'high' || states[m].status === 'moderate')
      .sort((a, b) => states[b].fatigue - states[a].fatigue)[0] ?? null,
    [states],
  );
  const [picked, setPicked] = useState<Muscle | null>(null);
  const selected = picked ?? worst;
  const s = selected ? states[selected] : null;
  const trained = MUSCLE_IDS.some((m) => states[m].status !== 'idle');
  const compact = !useMediaQuery('(min-width: 768px)');
  const [view, setView] = useState<View>(readView);
  // Sin WebGL 2 (o si el navegador no da el contexto) solo queda el mapa plano.
  const [can3d, setCan3d] = useState(hasWebGL2);
  const show3d = can3d && view === '3d';
  const changeView = (next: View) => {
    setView(next);
    try { localStorage.setItem(VIEW_KEY, next); } catch { /* sin almacenamiento: vale para esta visita */ }
  };
  const groups = ORDER.map((status) => ({ status, muscles: MUSCLE_IDS.filter((m) => states[m].status === status) }))
    .filter((g) => g.muscles.length > 0);
  // Lista de músculos por estado: alternativa sin color al dibujo, con dianas de 44 px para los músculos pequeños.
  const group = ({ status, muscles }: (typeof groups)[number]) => (
    <div key={status} className="flex flex-col gap-2">
      <h3 className="text-label-lg text-on-surface">{statusOf(status, t).group}</h3>
      <ul className="flex flex-wrap gap-2">
        {muscles.map((m) => (
          <li key={m}>
            <button type="button" aria-pressed={m === selected} onClick={() => setPicked(m)} className={chipClasses(m === selected)}>
              {muscleLabelFor(m, locale)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <Card as="section" aria-labelledby="coliseo-map" padding="lg" className="flex flex-col gap-5 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-1">
          <h2 id="coliseo-map" className="text-heading-sm">{t.title}</h2>
          <p className="text-body-sm text-on-surface-light">
            {show3d ? t.introThree : t.introFlat}
          </p>
        </div>
        {can3d && <SegmentedControl options={views} value={view} onChange={changeView} label={t.viewLabel} role="radiogroup" className="w-40" />}
      </div>

      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
        <div className="flex flex-col gap-4">
          {show3d ? (
            <Suspense fallback={<ViewerFallback />}>
              <MuscleViewer3D
                body={body} states={states} selected={selected} onSelect={setPicked} onUnavailable={() => setCan3d(false)}
                topInset={compact ? FLOAT_INSET : 0} overlay={<FloatingReadout muscle={selected} state={s} />}
              />
            </Suspense>
          ) : (
            <div className="flex justify-center gap-2 sm:gap-6">
              <Figure shapes={FRONT} label={t.front} states={states} selected={selected} onSelect={setPicked} />
              <Figure shapes={BACK} label={t.back} states={states} selected={selected} onSelect={setPicked} />
            </div>
          )}
          <ul className="flex flex-wrap justify-center gap-x-4 gap-y-2" aria-label={t.legend}>
            {ORDER.map((status) => (
              <li key={status} className="flex items-center gap-1.5 text-label-md text-on-surface">
                <svg aria-hidden viewBox="0 0 10 10" className={cn('size-3', STATUS_STYLE[status].fill)}><circle cx="5" cy="5" r="5" /></svg>
                {statusOf(status, t).label}
                {STATUS_STYLE[status].range && <span className="font-normal tabular-nums text-on-surface-light">{STATUS_STYLE[status].range}</span>}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-5">
          <div aria-live="polite" className="flex min-h-[12.5rem] flex-col gap-3 rounded-2xl border border-border bg-background p-4">
            {s && selected ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-heading-md">{muscleLabelFor(selected, locale)}</h3>
                  <Badge variant={statusOf(s.status, t).badge} icon={statusOf(s.status, t).icon}>{statusOf(s.status, t).label}</Badge>
                </div>
                <ProgressBar
                  key={selected} value={s.fatiguePct} tone={toneOf(s)}
                  label={t.fatigueOf(muscleLabelFor(selected, locale))} valueText={`${s.fatiguePct} %`}
                />
                <dl className="grid grid-cols-3 gap-2 text-center">
                  {([
                    [t.fatigue, `${s.fatiguePct} %`],
                    [t.fullRecovery, fullText(s, t)],
                    [t.sets7, s.weekSets.toLocaleString(INTL_LOCALE[locale], { maximumFractionDigits: 1 })],
                  ] as const).map(([k, v]) => (
                    <div key={k} className="flex flex-col justify-between gap-0.5 rounded-xl bg-surface-variant/60 px-1 py-2">
                      <dt className="text-label-md text-on-surface-light">{k}</dt>
                      <dd className="font-mono text-label-lg tabular-nums">{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="text-body-sm text-on-surface-light">
                  {s.status === 'idle' ? t.idleSets : [
                    s.readyIn > 0 ? t.readyIn(s.readyIn) : t.readyNow,
                    s.lastTrained ? t.lastWork(agoText(s.lastTrained, now, t)) : '',
                  ].filter(Boolean).join(' ')}
                </p>
              </>
            ) : (
              <p className="text-body-sm text-on-surface">
                {trained ? t.allReady : t.noSets}
              </p>
            )}
          </div>

          {trained && groups.filter((g) => g.status === 'high' || g.status === 'moderate').map(group)}
          {trained && (
            <details className="group/all">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-label-lg text-primary-text [&::-webkit-details-marker]:hidden">
                {t.allMuscles}
                <ChevronDown aria-hidden className="size-4 transition-transform duration-300 group-open/all:rotate-180" />
              </summary>
              <div className="flex flex-col gap-5 pt-2">{groups.filter((g) => g.status === 'fresh' || g.status === 'idle').map(group)}</div>
            </details>
          )}
        </div>
      </div>
    </Card>
  );
}
