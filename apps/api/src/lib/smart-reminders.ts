// Avisos inteligentes: horarios que la persona ajusta en Ajustes (Coliseo, cuidado,
// ciclo, agua, comidas, sabiduría, pausas activas y hábitos pendientes), textos
// discretos y cálculos de récords. Sin base
// de datos: lo que lee y escribe la base vive en services/smart-reminder.service.ts.
import { DEFAULT_TIMEZONE } from './calendar';

export const WINDOW_MS = 30 * 60 * 1000;

export interface SmartReminderSettings {
  /** Hora a la que avisar de la rutina programada de hoy (null: solo el aviso de las 21:00). */
  coliseo: { time: string | null };
  /** Rutinas de cuidado personal y rituales de mañana y de noche. */
  care: { enabled: boolean; morning: string; night: string };
  /** Solo usuarias con Ciclo: avisos discretos sobre el registro del día y la predicción. */
  cycle: { enabled: boolean };
  /** Aviso cada `everyHours` entre `from` y `to`, mientras no se llegue a la meta de agua. */
  hydration: { enabled: boolean; everyHours: 1 | 2 | 3 | 4; from: string; to: string };
  /** Hora de comer: si hoy no hay comida registrada, avisa en cada una de estas horas. */
  meals: { enabled: boolean; times: string[] };
  /** Cita del día, elegida según el progreso de la última semana. */
  wisdom: { enabled: boolean; time: string };
  /** Pausas activas cada `everyMinutes` entre `from` y `to` (sin la de `from`); `workdays`: solo de lunes a viernes. */
  breaks: { enabled: boolean; everyMinutes: BreakMinutes; from: string; to: string; workdays: boolean };
  /** Hábitos de hoy sin marcar: un aviso a esta hora si queda alguno. */
  /** manual: la persona eligió la hora. Sin elegirla, la hora aprendida puede reemplazar a time. */
  habits: { enabled: boolean; time: string; manual: boolean };
}

export const BREAK_MINUTES = [30, 45, 60, 90, 120] as const;
export type BreakMinutes = (typeof BREAK_MINUTES)[number];

export const DEFAULT_SMART_SETTINGS: SmartReminderSettings = {
  coliseo: { time: null },
  care: { enabled: true, morning: '08:00', night: '22:00' },
  cycle: { enabled: true },
  hydration: { enabled: false, everyHours: 2, from: '09:00', to: '21:00' },
  meals: { enabled: false, times: ['09:00', '14:00', '20:00'] },
  wisdom: { enabled: true, time: '08:00' },
  breaks: { enabled: false, everyMinutes: 60, from: '09:00', to: '18:00', workdays: true },
  // Mismo aviso que antes iba fijo a las 21:00 para todos: ahora la hora se elige.
  habits: { enabled: true, time: '21:00', manual: false },
};

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MAX_MEAL_TIMES = 4;
const HOURS = [1, 2, 3, 4] as const;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const hhmm = (v: unknown, fallback: string): string => (typeof v === 'string' && HHMM.test(v) ? v : fallback);

/** Minutos desde medianoche de una hora «HH:mm»; null si no es válida. */
export function parseHHMM(value: string | null | undefined): number | null {
  const m = HHMM.exec(value ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Normaliza lo guardado (o lo recibido) en la forma del tipo: valores ausentes o inválidos vuelven al valor por defecto. */
export function sanitizeSmartSettings(raw: unknown): SmartReminderSettings {
  const r = isObject(raw) ? raw : {};
  const sec = (key: string) => (isObject(r[key]) ? (r[key] as Record<string, unknown>) : {});
  const d = DEFAULT_SMART_SETTINGS;
  const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);

  const coliseo = sec('coliseo');
  const care = sec('care');
  const cycle = sec('cycle');
  const hydration = sec('hydration');
  const meals = sec('meals');
  const wisdom = sec('wisdom');
  const breaks = sec('breaks');
  const habits = sec('habits');
  const breakEvery = Number(breaks.everyMinutes);

  const hours = Number(hydration.everyHours);
  const times = Array.isArray(meals.times)
    ? [...new Set(meals.times.filter((t): t is string => typeof t === 'string' && HHMM.test(t)))].sort().slice(0, MAX_MEAL_TIMES)
    : d.meals.times;

  return {
    coliseo: { time: typeof coliseo.time === 'string' && HHMM.test(coliseo.time) ? coliseo.time : null },
    care: { enabled: bool(care.enabled, d.care.enabled), morning: hhmm(care.morning, d.care.morning), night: hhmm(care.night, d.care.night) },
    cycle: { enabled: bool(cycle.enabled, d.cycle.enabled) },
    hydration: {
      enabled: bool(hydration.enabled, d.hydration.enabled),
      everyHours: (HOURS as readonly number[]).includes(hours) ? (hours as 1 | 2 | 3 | 4) : d.hydration.everyHours,
      from: hhmm(hydration.from, d.hydration.from),
      to: hhmm(hydration.to, d.hydration.to),
    },
    meals: { enabled: bool(meals.enabled, d.meals.enabled), times },
    wisdom: { enabled: bool(wisdom.enabled, d.wisdom.enabled), time: hhmm(wisdom.time, d.wisdom.time) },
    breaks: {
      enabled: bool(breaks.enabled, d.breaks.enabled),
      everyMinutes: (BREAK_MINUTES as readonly number[]).includes(breakEvery) ? (breakEvery as BreakMinutes) : d.breaks.everyMinutes,
      from: hhmm(breaks.from, d.breaks.from),
      to: hhmm(breaks.to, d.breaks.to),
      workdays: bool(breaks.workdays, d.breaks.workdays),
    },
    habits: {
      enabled: bool(habits.enabled, d.habits.enabled),
      time: hhmm(habits.time, d.habits.time),
      // Lo guardado antes de este campo: si la hora ya no es la por defecto, la eligió la persona.
      manual: bool(habits.manual, hhmm(habits.time, d.habits.time) !== d.habits.time),
    },
  };
}

/** Aplica un cambio parcial (por zona) sobre lo guardado y devuelve la forma saneada. */
export function mergeSmartSettings(current: unknown, patch: unknown): SmartReminderSettings {
  const base = sanitizeSmartSettings(current) as unknown as Record<string, Record<string, unknown>>;
  const changes = isObject(patch) ? patch : {};
  const merged: Record<string, unknown> = {};
  for (const key of Object.keys(base)) {
    const part = changes[key];
    merged[key] = { ...base[key], ...(isObject(part) ? part : {}) };
  }
  // Una hora distinta de la guardada es una elección de la persona: gana siempre a la aprendida.
  const habitsPatch = isObject(changes.habits) ? changes.habits : {};
  if (habitsPatch.time !== undefined && habitsPatch.time !== base.habits.time && habitsPatch.manual === undefined) {
    (merged.habits as Record<string, unknown>).manual = true;
  }
  return sanitizeSmartSettings(merged);
}

/** Minutos locales de un instante en la zona de la persona. */
export function localMinutes(timezone: string | null | undefined, now: Date): number {
  const fmt = (tz: string) => new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  let parts: Intl.DateTimeFormatPart[];
  try { parts = fmt(timezone || DEFAULT_TIMEZONE); } catch { parts = fmt(DEFAULT_TIMEZONE); }
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

/** ¿La hora objetivo (minutos locales) cayó en la ventana de 30 min que termina ahora? */
export function inWindow(nowMinutes: number, target: number) {
  const diff = nowMinutes - target;
  return diff >= 0 && diff * 60_000 < WINDOW_MS;
}

/**
 * Minutos del día desde `from` cada `stepMinutes` hasta `to` (ambos incluidos si caen).
 * Si `to` es anterior a `from`, el rango cruza medianoche.
 */
export function slotsEvery(from: string, to: string, stepMinutes: number): number[] {
  const start = parseHHMM(from);
  const end = parseHHMM(to);
  if (start === null || end === null || stepMinutes < 1) return [];
  const span = end >= start ? end - start : end + 1440 - start;
  const out: number[] = [];
  for (let offset = 0; offset <= span; offset += stepMinutes) out.push((start + offset) % 1440);
  return out;
}

/** Minutos del día de cada aviso de agua: desde `from` cada `everyHours` horas hasta `to`. */
export function hydrationSlots(from: string, to: string, everyHours: number): number[] {
  return everyHours < 1 ? [] : slotsEvery(from, to, everyHours * 60);
}

/** Pausas activas: la primera llega un intervalo después de empezar (a la hora de empezar no hace falta). */
export function breakSlots(from: string, to: string, everyMinutes: number): number[] {
  return slotsEvery(from, to, everyMinutes).slice(1);
}

// ─── Push inteligente: presupuesto, silencio, pausa y agrupación ──────────────
// Dos clases de aviso. Los programados por la persona (su hora de hábito, de agua, de
// comida o de descanso, una cita, un posponer) salen siempre: sin tope, sin silencio
// automático, sin pausa y sin agrupar. Los automáticos o de enganche (Sabiduría, hábitos
// pendientes, avisos de zona, resumen, vencimientos y ciclo) tienen tope diario, horario
// de silencio, pausa por inactividad y se agrupan si caen en la misma pasada.

/** Claves de avisos automáticos o de enganche. Todo lo demás se trata como programado. */
export const AUTOMATIC_PREFIXES = [
  'wisdom-',
  'daily-summary-',
  'deadline-',
  'cycle-',
  'zone-reminder:habitos-pendientes:',
  'zone-reminder:comida:',
  'zone-reminder:aprendizaje:',
  'zone-reminder:diario:',
  'zone-reminder:finanzas:',
  'zone-reminder:rachas:',
  'zone-reminder:gremio:',
  'zone-reminder:gimnasio:',
] as const;
/** Avisos automáticos por día, como máximo. */
export const DAILY_AUTOMATIC_CAP = 2;
/** Sin abrir la app en estos días, los automáticos se pausan hasta que vuelva (plan v3: 21 días). */
export const INACTIVE_PAUSE_DAYS = 21;
const QUIET_FROM = 22 * 60;
const QUIET_TO = 7 * 60;

export function isAutomatic(key: string | undefined): boolean {
  return Boolean(key && AUTOMATIC_PREFIXES.some((p) => key.startsWith(p)));
}

export interface QueuedPush {
  key?: string;
  title: string;
  body: string;
  link?: string;
  category?: string;
  /** La persona lo programó (hora de un hábito, un posponer…): nunca tiene límites. */
  userScheduled?: boolean;
}

/** Un aviso sujeto a tope, silencio, pausa y agrupación: automático y no programado por la persona. */
export function isRestricted(p: QueuedPush): boolean {
  return !p.userScheduled && isAutomatic(p.key);
}

/**
 * Qué sale de lo encolado en una pasada para una persona. `sentToday`: automáticos que ya se
 * enviaron hoy; `minutes`: hora local; `inactive`: lleva INACTIVE_PAUSE_DAYS sin abrir la app;
 * `ignored`: los últimos 3 automáticos siguen sin abrir (el tope baja a la mitad).
 * `send`: los avisos que salen tal cual (todos los programados y los automáticos que caben).
 * `group`: si caen dos o más automáticos, un solo aviso («3 cosas para esta tarde») en su lugar.
 */
export function planPushes<T extends QueuedPush>(queued: T[], opts: { minutes: number; sentToday: number; inactive: boolean; ignored?: boolean }): { send: T[]; group: QueuedPush | null } {
  const quiet = opts.minutes >= QUIET_FROM || opts.minutes < QUIET_TO;
  const cap = opts.ignored ? Math.floor(DAILY_AUTOMATIC_CAP / 2) : DAILY_AUTOMATIC_CAP;
  let budget = opts.inactive || quiet ? 0 : Math.max(0, cap - opts.sentToday);
  const scheduled = queued.filter((p) => !isRestricted(p));
  const automatic = queued.filter(isRestricted).filter(() => budget-- > 0);
  if (automatic.length < 2) return { send: [...scheduled, ...automatic], group: null };
  const names = automatic.map((p) => p.title.replace(/^Hora de: /, ''));
  const part = opts.minutes < 12 * 60 ? 'esta mañana' : opts.minutes < 19 * 60 ? 'esta tarde' : 'esta noche';
  const links = new Set(automatic.map((p) => p.link?.split('?')[0]));
  return {
    send: scheduled,
    group: {
      key: `group-${automatic[0].key ?? 'x'}`,
      title: `${automatic.length} cosas para ${part}`,
      body: names.length > 3 ? `${names.slice(0, 3).join(', ')} y ${names.length - 3} más.` : `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}.`,
      link: links.size === 1 ? automatic[0].link : '/',
      category: automatic[0].category,
    },
  };
}

// ─── Textos ───────────────────────────────────────────────────────────────────
// El ciclo se avisa sin nombrarlo: la notificación se ve en la pantalla de bloqueo.
export const CYCLE_COPY = {
  check: { title: 'Un momento para ti', body: 'Registra cómo estás hoy. Te toma un minuto.', link: '/cycle' },
  upcoming: { title: 'Recordatorio personal', body: 'Revisa tus sugerencias de hoy en tu calendario.', link: '/cycle' },
  phase: { title: 'Recordatorio personal', body: 'Tus sugerencias de entrenamiento y descanso se actualizaron.', link: '/cycle' },
} as const;

/** Pausas activas: un consejo distinto en cada franja del día. */
export const BREAK_TIPS = [
  'Levántate, estira la espalda y mira a lo lejos 20 segundos.',
  'Suelta los hombros y respira hondo tres veces. Un minuto basta.',
  'Camina un poco y bebe agua antes de seguir.',
  'Estira el cuello y las muñecas: 30 segundos por lado.',
  'Cierra los ojos un momento y relaja la mandíbula.',
] as const;

export const CARE_COPY: Record<'morning' | 'night', { body: string }> = {
  morning: { body: 'Empieza el día con tu rutina. Te toma pocos minutos.' },
  night: { body: 'Cierra el día con tu rutina de cuidado personal.' },
};

// ─── Progreso: récords y categoría de sabiduría ───────────────────────────────

export interface LoggedSet { weight?: number; reps?: number; completed?: boolean; rpe?: number }

/** 1RM estimado (Epley, igual que la calculadora del Coliseo). */
export function oneRepMaxOf(weight: number, reps: number): number {
  if (!(weight > 0) || !(reps >= 1)) return 0;
  return reps === 1 ? weight : weight * (1 + reps / 30);
}

/** Mejor 1RM estimado de las series completadas. */
export function bestOneRepMax(sets: LoggedSet[]): number {
  return sets
    .filter((s) => s.completed === true)
    .reduce((best, s) => Math.max(best, oneRepMaxOf(Number(s.weight) || 0, Math.round(Number(s.reps) || 0))), 0);
}

/**
 * Récords de esta sesión: solo cuenta un ejercicio que ya se había hecho antes (el primero
 * no es un récord) y que hoy supera su mejor marca anterior.
 */
export function newRecords(
  session: Array<{ exerciseId: string; name: string; sets: LoggedSet[] }>,
  previousBest: ReadonlyMap<string, number>,
): Array<{ name: string; oneRepMax: number }> {
  const out: Array<{ name: string; oneRepMax: number }> = [];
  for (const ex of session) {
    const prev = previousBest.get(ex.exerciseId) ?? 0;
    const now = bestOneRepMax(ex.sets);
    if (prev > 0 && now > prev) out.push({ name: ex.name, oneRepMax: Math.round(now) });
  }
  return out;
}

/** Series hechas con RPE 10 (no salía ni una repetición más). */
export function maxEffortSets(session: Array<{ sets: LoggedSet[] }>): number {
  return session.reduce((n, ex) => n + ex.sets.filter((s) => s.completed === true && s.rpe === 10).length, 0);
}

const CATEGORY_RULES: Array<[RegExp, string]> = [
  [/workout|coliseo|gym|routine|attendance|sleep|meal|water|body/, 'health'],
  [/habit|ritual|care|checkin|anti|streak/, 'discipline'],
  [/quest|goal|milestone|season/, 'strategy'],
  [/finance|budget|transaction|saving|debt/, 'finance'],
  [/learning|pomodoro|focus|journal|reading/, 'growth'],
  [/social|friend|guild|dm|letter|love|gift/, 'relationships'],
];

/** Categoría de sabiduría de una fuente de XP («workout» → health…). */
export function categoryOfXpSource(source: string): string {
  const s = source.toLowerCase();
  return CATEGORY_RULES.find(([re]) => re.test(s))?.[1] ?? 'mindset';
}

/** La categoría en la que más XP sumó la persona (sin datos: disciplina). */
export function focusCategory(xpBySource: ReadonlyMap<string, number>): string {
  const totals = new Map<string, number>();
  for (const [source, xp] of xpBySource) {
    const cat = categoryOfXpSource(source);
    totals.set(cat, (totals.get(cat) ?? 0) + xp);
  }
  let best = 'discipline';
  let max = 0;
  for (const [cat, xp] of totals) {
    if (xp > max) { best = cat; max = xp; }
  }
  return best;
}

/** Hash FNV-1a: el mismo texto da siempre el mismo número (cita fija durante el día). */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** Elige una cita de la categoría para este día y esta persona; si no hay ninguna, de cualquiera. */
export function pickQuote<T extends { category: string }>(cards: T[], category: string, seed: string): T | null {
  if (cards.length === 0) return null;
  const pool = cards.filter((c) => c.category === category);
  const list = pool.length ? pool : cards;
  return list[hashString(seed) % list.length];
}

// ─── Hora aprendida (T7) ──────────────────────────────────────────────────────

/** Cumplimientos mínimos en 14 días para confiar en la hora habitual. */
export const LEARN_MIN_SAMPLES = 3;
/** El aviso sale esta antelación antes de la hora habitual. */
export const LEARN_LEAD_MIN = 30;

/**
 * Hora del aviso (minutos del día) a partir de los minutos locales de cada cumplimiento:
 * la mediana menos LEARN_LEAD_MIN. null si hay menos de LEARN_MIN_SAMPLES cumplimientos.
 */
export function learnedHabitTime(minutesOfDay: number[]): number | null {
  if (minutesOfDay.length < LEARN_MIN_SAMPLES) return null;
  const sorted = [...minutesOfDay].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  const median = sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  return (median - LEARN_LEAD_MIN + 1440) % 1440;
}
