import type { SleepLog } from '@lifequest/shared';
import { cn } from '@/lib/utils';
import { dayKey } from '@/lib/lifeMeta';
import type { Tone } from '@/components/ui/lq';

// TODO(api): no existe una meta de sueño por usuario; se usa 7 h como en el prototipo.
export const SLEEP_GOAL_H = 7;

export const QUALITY = [
  { n: 1, name: 'Muy mala', tone: 'error', mouth: 'M8.5 16.5q3.5-3 7 0' },
  { n: 2, name: 'Mala', tone: 'warning', mouth: 'M9 16q3-1.2 6 0' },
  { n: 3, name: 'Regular', tone: 'info', mouth: 'M9 15.5h6' },
  { n: 4, name: 'Buena', tone: 'success', mouth: 'M9 14.5q3 2 6 0' },
  { n: 5, name: 'Excelente', tone: 'success', mouth: 'M8 14q4 4 8 0' },
] as const satisfies readonly { n: number; name: string; tone: Exclude<Tone, 'muted'>; mouth: string }[];

export const quality = (q: number) => QUALITY[Math.min(5, Math.max(1, Math.round(q) || 1)) - 1];

/** Cara SVG de calidad (en vez de emojis, README · desviaciones). */
export function QualityFace({ q, className }: { q: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={cn('size-6 shrink-0', className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 10h.01M15 10h.01" strokeWidth={2.5} />
      <path d={quality(q).mouth} />
    </svg>
  );
}

/** "7 h 42 min" · `short` → "7 h 42". */
export function hm(hours: number, short = false) {
  const total = Math.round(hours * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (short) return `${h} h ${String(m).padStart(2, '0')}`;
  return !h ? `${m} min` : m ? `${h} h ${m} min` : `${h} h`;
}

export const clock = (iso: string | Date) => new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

/** Día al que pertenece la noche: el de la mañana en que despertaste. */
export const nightKey = (l: SleepLog) => dayKey(new Date(l.wakeTime));

/** Minutos desde las 12:00 del día anterior (las horas de dormir tras medianoche siguen en orden). */
export function bedMinutes(iso: string) {
  const d = new Date(iso);
  const m = d.getHours() * 60 + d.getMinutes();
  return m < 12 * 60 ? m + 24 * 60 : m;
}

export function fmtBedMinutes(m: number) {
  const v = Math.round(m) % (24 * 60);
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
}

/** Combina horas "HH:MM" en fechas: se despierta hoy; si la hora de dormir es posterior, fue ayer. */
export function nightFromTimes(bed: string, wake: string, base = new Date()) {
  const [bh, bm] = bed.split(':').map(Number);
  const [wh, wm] = wake.split(':').map(Number);
  const w = new Date(base); w.setHours(wh, wm, 0, 0);
  const b = new Date(base); b.setHours(bh, bm, 0, 0);
  if (b >= w) b.setDate(b.getDate() - 1);
  return { bedtime: b, wakeTime: w, hours: (w.getTime() - b.getTime()) / 3600000 };
}
