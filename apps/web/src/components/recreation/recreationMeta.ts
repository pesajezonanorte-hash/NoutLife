import { Clapperboard, Gamepad2, Music, Palette, Sparkles, Ticket, Tv, type LucideIcon } from 'lucide-react';
import type { Tone } from '@/components/ui/lq';
import type { RecreationEntry, RecreationKind } from '@/services/recreation.service';
import { INTL_LOCALE, type Locale } from '@/lib/locale';

const KIND_STYLE: { value: RecreationKind; icon: LucideIcon; tone: Exclude<Tone, 'muted'> }[] = [
  { value: 'MOVIE', icon: Clapperboard, tone: 'error' },
  { value: 'SERIES', icon: Tv, tone: 'info' },
  { value: 'GAME', icon: Gamepad2, tone: 'success' },
  { value: 'OUTING', icon: Ticket, tone: 'warning' },
  { value: 'HOBBY', icon: Palette, tone: 'forest' },
  { value: 'MUSIC', icon: Music, tone: 'secondary' },
  { value: 'OTHER', icon: Sparkles, tone: 'primary' },
];

const KIND_LABEL: Record<Locale, Record<RecreationKind, string>> = {
  es: { MOVIE: 'Película', SERIES: 'Serie', GAME: 'Videojuego', OUTING: 'Salida', HOBBY: 'Hobby', MUSIC: 'Música', OTHER: 'Otro' },
  en: { MOVIE: 'Movie', SERIES: 'Series', GAME: 'Video game', OUTING: 'Outing', HOBBY: 'Hobby', MUSIC: 'Music', OTHER: 'Other' },
};

/** Tipos de ocio con su nombre en el idioma indicado. */
export function kindsFor(locale: Locale) {
  return KIND_STYLE.map((k) => ({ ...k, label: KIND_LABEL[locale][k.value] }));
}

/** Lista con los nombres en español (compatibilidad con los diálogos aún sin traducir). */
export const KINDS = kindsFor('es');

export const kindOf = (kind: string, locale: Locale = 'es') => {
  const all = kindsFor(locale);
  return all.find((k) => k.value === kind) ?? all[all.length - 1];
};

const TEXT: Record<Locale, { min: string; hour: string; season: string; episode: string }> = {
  es: { min: 'min', hour: 'h', season: 'Temporada', episode: 'capítulo' },
  en: { min: 'min', hour: 'h', season: 'Season', episode: 'episode' },
};

/** «1 h 20 min» */
export function minutesLabel(minutes: number | null | undefined, locale: Locale = 'es'): string {
  if (!minutes) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const w = TEXT[locale];
  return h ? `${h} ${w.hour}${m ? ` ${m} ${w.min}` : ''}` : `${m} ${w.min}`;
}

/** «Temporada 2, capítulo 5», o solo la temporada si no hay capítulo. */
export function seriesPosition(entry: RecreationEntry, locale: Locale = 'es'): string | null {
  if (entry.kind !== 'SERIES') return null;
  const w = TEXT[locale];
  if (entry.episode !== null) return `${w.season} ${entry.season ?? 1}, ${w.episode} ${entry.episode}`;
  return entry.season !== null ? `${w.season} ${entry.season}` : null;
}

/** Porcentaje de capítulos vistos (0–100) si la serie tiene el total; null si no. */
export function seriesProgress(entry: RecreationEntry): number | null {
  if (entry.kind !== 'SERIES' || !entry.totalEpisodes) return null;
  return Math.min(100, Math.round((entry.episodesWatched / entry.totalEpisodes) * 100));
}

/** «vie 10 oct» para el talón de la boleta. */
export function stubDate(iso: string, locale: Locale = 'es') {
  const d = new Date(iso);
  const loc = INTL_LOCALE[locale];
  return {
    weekday: d.toLocaleDateString(loc, { weekday: 'short' }).replace('.', ''),
    day: d.toLocaleDateString(loc, { day: 'numeric' }),
    month: d.toLocaleDateString(loc, { month: 'short' }).replace('.', ''),
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
export function kindBalance(entries: RecreationEntry[], now = Date.now(), locale: Locale = 'es') {
  const month = entries.filter((e) => e.status === 'DONE' && now - new Date(e.date).getTime() < 30 * DAY_MS);
  return kindsFor(locale).map((k) => ({ ...k, count: month.filter((e) => e.kind === k.value).length })).filter((k) => k.count > 0);
}
