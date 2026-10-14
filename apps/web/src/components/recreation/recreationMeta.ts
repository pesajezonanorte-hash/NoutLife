import { Clapperboard, Gamepad2, Music, Palette, Sparkles, Ticket, Tv, type LucideIcon } from 'lucide-react';
import type { Tone } from '@/components/ui/lq';
import type { RecreationEntry, RecreationKind } from '@/services/recreation.service';

export const KINDS: { value: RecreationKind; label: string; icon: LucideIcon; tone: Exclude<Tone, 'muted'> }[] = [
  { value: 'MOVIE', label: 'Película', icon: Clapperboard, tone: 'error' },
  { value: 'SERIES', label: 'Serie', icon: Tv, tone: 'info' },
  { value: 'GAME', label: 'Videojuego', icon: Gamepad2, tone: 'success' },
  { value: 'OUTING', label: 'Salida', icon: Ticket, tone: 'warning' },
  { value: 'HOBBY', label: 'Hobby', icon: Palette, tone: 'forest' },
  { value: 'MUSIC', label: 'Música', icon: Music, tone: 'secondary' },
  { value: 'OTHER', label: 'Otro', icon: Sparkles, tone: 'primary' },
];

export const kindOf = (kind: string) => KINDS.find((k) => k.value === kind) ?? KINDS[KINDS.length - 1];

/** «1 h 20 min» */
export function minutesLabel(minutes: number | null | undefined): string {
  if (!minutes) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
}

/** «vie 10 oct» para el talón de la boleta. */
export function stubDate(iso: string) {
  const d = new Date(iso);
  return {
    weekday: d.toLocaleDateString('es-CO', { weekday: 'short' }).replace('.', ''),
    day: d.toLocaleDateString('es-CO', { day: 'numeric' }),
    month: d.toLocaleDateString('es-CO', { month: 'short' }).replace('.', ''),
  };
}

/** YYYY-MM-DD local (para <input type="date">). */
export const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const DAY_MS = 86_400_000;

/** Resumen de la semana: funciones vividas, minutos, nota media, XP y el tipo que más se repite. */
export function weekSummary(entries: RecreationEntry[], now = Date.now()) {
  const week = entries.filter((e) => e.status === 'DONE' && now - new Date(e.date).getTime() < 7 * DAY_MS);
  const rated = week.filter((e) => e.rating);
  return {
    count: week.length,
    minutes: week.reduce((sum, e) => sum + (e.minutes ?? 0), 0),
    rating: rated.length ? rated.reduce((sum, e) => sum + (e.rating ?? 0), 0) / rated.length : null,
    xp: week.reduce((sum, e) => sum + e.xpEarned, 0),
  };
}

/** Reparto de los últimos 30 días por tipo (para la barra de balance). */
export function kindBalance(entries: RecreationEntry[], now = Date.now()) {
  const month = entries.filter((e) => e.status === 'DONE' && now - new Date(e.date).getTime() < 30 * DAY_MS);
  return KINDS.map((k) => ({ ...k, count: month.filter((e) => e.kind === k.value).length })).filter((k) => k.count > 0);
}
