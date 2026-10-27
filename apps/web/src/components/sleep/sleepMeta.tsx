import type { SleepLog } from '@noutlife/shared';
import { cn } from '@/lib/utils';
import { dayKey } from '@/lib/lifeMeta';
import type { Tone } from '@/components/ui/lq';
import { INTL_LOCALE, type Locale } from '@/lib/locale';

// TODO(api): no existe una meta de sueño por usuario; se usa 7 h como en el prototipo.
export const SLEEP_GOAL_H = 7;

type QualityTone = Exclude<Tone, 'muted'>;
const QUALITY_STYLE: { n: number; tone: QualityTone; mouth: string }[] = [
  { n: 1, tone: 'error', mouth: 'M8.5 16.5q3.5-3 7 0' },
  { n: 2, tone: 'warning', mouth: 'M9 16q3-1.2 6 0' },
  { n: 3, tone: 'info', mouth: 'M9 15.5h6' },
  { n: 4, tone: 'success', mouth: 'M9 14.5q3 2 6 0' },
  { n: 5, tone: 'success', mouth: 'M8 14q4 4 8 0' },
];
const QUALITY_NAME: Record<Locale, string[]> = {
  es: ['Muy mala', 'Mala', 'Regular', 'Buena', 'Excelente'],
  en: ['Very poor', 'Poor', 'Fair', 'Good', 'Excellent'],
};

/** Calidad del sueño (1–5) con su nombre en el idioma indicado. */
export function qualityList(locale: Locale = 'es') {
  return QUALITY_STYLE.map((q, i) => ({ ...q, name: QUALITY_NAME[locale][i] }));
}

export const quality = (q: number, locale: Locale = 'es') => qualityList(locale)[Math.min(5, Math.max(1, Math.round(q) || 1)) - 1];

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

/** Hora HH:MM (o AM/PM en inglés) del idioma activo. */
export const clock = (iso: string | Date, locale: Locale = 'es') => new Date(iso).toLocaleTimeString(INTL_LOCALE[locale], { hour: '2-digit', minute: '2-digit' });

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

/** Siesta: suma al descanso del día pero no cuenta como noche. */
export const isNap = (l: Pick<SleepLog, 'isNap'>) => Boolean(l.isNap);

/** Duraciones rápidas de siesta (min), con sus pistas en el idioma indicado. */
const NAP_HINT: Record<Locale, string[]> = {
  es: ['Energizante', 'Media', 'Ciclo completo'],
  en: ['Energizing', 'Medium', 'Full cycle'],
};
export function napPresets(locale: Locale = 'es') {
  return [20, 45, 90].map((min, i) => ({ min, label: `${min} min`, hint: NAP_HINT[locale][i] }));
}

/** Consejo según la duración de la siesta (ciclos de sueño de ~90 min). */
export function napAdvice(hours: number, locale: Locale = 'es') {
  const m = hours * 60;
  const en = locale === 'en';
  if (m <= 30) return { tone: 'success' as const, text: en ? 'Energizing nap: you wake up without grogginess.' : 'Siesta energizante: despiertas sin aturdimiento.' };
  if (m < 70) return { tone: 'warning' as const, text: en ? 'It may leave you a bit groggy: you reached deep sleep.' : 'Puede dejarte algo aturdido: llegaste al sueño profundo.' };
  if (m <= 110) return { tone: 'info' as const, text: en ? 'Close to a full cycle (~90 min): ideal for recovery.' : 'Cerca de un ciclo completo (~90 min): ideal para recuperar.' };
  return { tone: 'warning' as const, text: en ? 'Long nap: it may make it harder to sleep tonight.' : 'Siesta larga: puede costarte dormir esta noche.' };
}

/** Minuto del día (0–1439) de una fecha. */
export const minuteOfDay = (iso: string | Date) => { const d = new Date(iso); return d.getHours() * 60 + d.getMinutes(); };
