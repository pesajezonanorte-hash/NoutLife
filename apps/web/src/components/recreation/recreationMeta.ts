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

// ─── Duración: minutos u horas ────────────────────────────────────────────────

export type DurationUnit = 'min' | 'h';
export const MAX_MINUTES = 24 * 60;
/** Bloques de un toque en el formulario. */
export const QUICK_BLOCKS = [30, 60, 120, 180, 240] as const;

/** Minutos de lo escrito («1,5» horas = 90). null: vacío; NaN: no es un número. */
export function toMinutes(text: string, unit: DurationUnit): number | null {
  const clean = text.trim().replace(',', '.');
  if (!clean) return null;
  const n = Number(clean);
  return Number.isFinite(n) ? Math.round(unit === 'h' ? n * 60 : n) : NaN;
}

/** Cómo mostrar unos minutos guardados para editarlos: en horas si son horas exactas o medias. */
export function fromMinutes(minutes: number | null | undefined): { text: string; unit: DurationUnit } {
  if (!minutes) return { text: '', unit: 'min' };
  return minutes % 30 === 0 && minutes >= 60 ? { text: String(minutes / 60), unit: 'h' } : { text: String(minutes), unit: 'min' };
}

// ─── Bienestar digital ────────────────────────────────────────────────────────

/** Ocio frente a una pantalla. La música, las salidas y los hobbies cuentan como tiempo sin pantalla. */
export const SCREEN_KINDS: readonly RecreationKind[] = ['MOVIE', 'SERIES', 'GAME'];
/** A partir de aquí el ocio de pantalla de un día ya es mucho (media diaria, en minutos). */
export const SCREEN_DAILY_LIMIT = 180;

export interface DigitalBalance {
  screenMinutes: number;
  offlineMinutes: number;
  /** Parte del ocio con duración que fue de pantalla (0–1); null sin datos. */
  screenShare: number | null;
  /** Media diaria de pantalla en el periodo. */
  dailyScreen: number;
  /** El bloque de pantalla más largo. */
  longest: { title: string; minutes: number } | null;
  /** Funciones vividas sin duración: no entran en la cuenta. */
  untimed: number;
  /** empty: sin datos · balanced · screenHeavy: casi todo es pantalla · long: demasiadas horas de pantalla al día */
  status: 'empty' | 'balanced' | 'screenHeavy' | 'long';
}

/** Reparto del ocio de los últimos `days` días entre pantalla y sin pantalla. */
export function digitalBalance(entries: RecreationEntry[], now = Date.now(), days = 7): DigitalBalance {
  const recent = entries.filter((e) => e.status === 'DONE' && now - new Date(e.date).getTime() < days * DAY_MS && now - new Date(e.date).getTime() > -DAY_MS);
  const timed = recent.filter((e) => e.minutes);
  const screen = timed.filter((e) => SCREEN_KINDS.includes(e.kind));
  const screenMinutes = screen.reduce((sum, e) => sum + (e.minutes ?? 0), 0);
  const offlineMinutes = timed.reduce((sum, e) => sum + (e.minutes ?? 0), 0) - screenMinutes;
  const total = screenMinutes + offlineMinutes;
  const dailyScreen = Math.round(screenMinutes / days);
  const top = [...screen].sort((a, b) => (b.minutes ?? 0) - (a.minutes ?? 0))[0];
  const screenShare = total ? screenMinutes / total : null;
  return {
    screenMinutes, offlineMinutes, screenShare, dailyScreen,
    longest: top ? { title: top.title, minutes: top.minutes ?? 0 } : null,
    untimed: recent.length - timed.length,
    status: !total ? 'empty' : dailyScreen > SCREEN_DAILY_LIMIT ? 'long' : screenShare! >= 0.75 && total >= 120 ? 'screenHeavy' : 'balanced',
  };
}

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
