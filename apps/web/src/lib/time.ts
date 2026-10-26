import { INTL_LOCALE, type Locale } from './locale';

const PHRASES: Record<Locale, {
  now: string; minutes: (n: number) => string; hours: (n: number) => string; yesterday: string;
  days: (n: number) => string; week: string; weeks: (n: number) => string; months: (n: number) => string; years: (n: number) => string;
}> = {
  es: {
    now: 'hace un momento',
    minutes: (n) => `hace ${n} ${n === 1 ? 'minuto' : 'minutos'}`,
    hours: (n) => `hace ${n} ${n === 1 ? 'hora' : 'horas'}`,
    yesterday: 'ayer',
    days: (n) => `hace ${n} días`,
    week: 'hace una semana',
    weeks: (n) => `hace ${n} semanas`,
    months: (n) => `hace ${n} ${n === 1 ? 'mes' : 'meses'}`,
    years: (n) => `hace ${n} ${n === 1 ? 'año' : 'años'}`,
  },
  en: {
    now: 'just now',
    minutes: (n) => `${n} ${n === 1 ? 'minute' : 'minutes'} ago`,
    hours: (n) => `${n} ${n === 1 ? 'hour' : 'hours'} ago`,
    yesterday: 'yesterday',
    days: (n) => `${n} days ago`,
    week: 'a week ago',
    weeks: (n) => `${n} weeks ago`,
    months: (n) => `${n} ${n === 1 ? 'month' : 'months'} ago`,
    years: (n) => `${n} ${n === 1 ? 'year' : 'years'} ago`,
  },
};

export function relativeTime(iso: string, locale: Locale = 'es'): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;
  const p = PHRASES[locale];

  const s = Math.floor(diff / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);

  if (s < 60)  return p.now;
  if (m < 60)  return p.minutes(m);
  if (h < 24)  return p.hours(h);
  if (d === 1) return p.yesterday;
  if (d < 7)   return p.days(d);
  if (d < 14)  return p.week;
  if (d < 30)  return p.weeks(Math.floor(d / 7));
  if (d < 365) return p.months(Math.floor(d / 30));
  return p.years(Math.floor(d / 365));
}

export function formatNumber(n: number, locale: Locale = 'es'): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale]).format(n);
}

export function formatCOP(n: number, locale: Locale = 'es'): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}
