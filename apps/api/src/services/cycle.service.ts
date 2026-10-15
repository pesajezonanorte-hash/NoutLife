// Ciclo Menstrual: ajustes, periodos, registro diario y analítica de cada usuaria,
// con su fase de hoy, las predicciones y los consejos que leen el Coliseo y
// Hábitos. Solo para cuentas con gender = 'female' (routes/cycle.routes). Nada de
// esto entra en el contexto del Sabio: son datos de salud y se quedan aquí.
import { prisma } from '../lib/prisma';
import { addCalendarDays, getCalendarDay, parseCalendarDate } from '../lib/calendar';
import {
  BLEEDING, adviceFor, analytics, averages, dayKey, diffDays, patterns, periodBefore, snapshot,
  type Contraceptive, type DayLogRow, type Flow, type Mood, type PeriodRow, type SexualActivity, type Symptom,
} from '../lib/cycle';

/** Se ignoran registros con más de un año para promedios y patrones. */
const HISTORY_DAYS = 365;
/** Lo que el calendario de la zona muestra hacia atrás. */
const SHOWN_LOG_DAYS = 120;
/** Flujo anotado tan cerca del periodo anterior lo continúa en vez de abrir otro. */
const SAME_PERIOD_GAP = 2;
const MAX_PERIOD_DAYS = 15;

export class CycleError extends Error {}

const todayOf = async (userId: string) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { timezone: true } });
  return getCalendarDay(user.timezone);
};

/** Fecha de un registro: válida, no futura y de este último año. */
function dayFrom(value: string, today: Date): Date {
  const date = parseCalendarDate(value);
  if (!date) throw new CycleError('La fecha no es válida.');
  if (date.getTime() > today.getTime()) throw new CycleError('No se puede anotar un día que aún no llega.');
  if (diffDays(today, date) > HISTORY_DAYS) throw new CycleError('Solo se puede anotar el último año.');
  return date;
}

const serPeriod = (p: { id: string; startDate: Date; endDate: Date | null }) => ({
  id: p.id,
  startDate: dayKey(p.startDate),
  endDate: p.endDate ? dayKey(p.endDate) : null,
  length: p.endDate ? diffDays(p.endDate, p.startDate) + 1 : null,
});

type LogRow = {
  date: Date; flow: string | null; energy: number | null; symptoms: string[]; notes: string | null;
  moods: string[]; sexualActivity: string | null; contraception: string | null;
  sleepQuality: number | null; stress: number | null; waterGlasses: number | null;
};
const serLog = (l: LogRow) => ({
  date: dayKey(l.date),
  flow: l.flow,
  moods: l.moods,
  energy: l.energy,
  symptoms: l.symptoms,
  sexualActivity: l.sexualActivity as SexualActivity | null,
  contraception: l.contraception as Contraceptive | null,
  sleepQuality: l.sleepQuality,
  stress: l.stress,
  waterGlasses: l.waterGlasses,
  notes: l.notes,
});

/** Días con flujo del periodo abierto (para no darlo por terminado antes de tiempo). */
function bleedDaysOf(today: Date, periods: PeriodRow[], logs: DayLogRow[]): number {
  const current = periodBefore(today, periods);
  if (!current || current.endDate) return 0;
  return logs
    .filter((l) => l.date.getTime() >= current.startDate.getTime() && BLEEDING.includes(l.flow as Flow))
    .reduce((max, l) => Math.max(max, diffDays(l.date, current.startDate) + 1), 0);
}

async function load(userId: string) {
  const today = await todayOf(userId);
  const [settings, periods, logs] = await Promise.all([
    prisma.menstrualSettings.findUnique({ where: { userId } }),
    prisma.menstrualPeriod.findMany({ where: { userId }, orderBy: { startDate: 'desc' }, take: 24 }),
    prisma.menstrualLog.findMany({ where: { userId, date: { gte: addCalendarDays(today, -HISTORY_DAYS) } }, orderBy: { date: 'desc' } }),
  ]);
  const fallback = { cycleLength: settings?.cycleLength ?? 28, periodLength: settings?.periodLength ?? 5 };
  const avg = averages(periods, fallback);
  const snap = snapshot(today, periods, avg, bleedDaysOf(today, periods, logs));
  const todayLog = logs.find((l) => l.date.getTime() === today.getTime()) ?? null;
  const advice = snap ? adviceFor(snap, todayLog, patterns(logs, periods, avg)) : null;
  return { today, settings, periods, logs, avg, snap, todayLog, advice };
}

/** Todo lo que pinta la zona. */
export async function getCycle(userId: string) {
  const { today, settings, periods, logs, avg, snap, todayLog, advice } = await load(userId);
  const shownFrom = addCalendarDays(today, -SHOWN_LOG_DAYS);
  return {
    today: dayKey(today),
    settings: settings ? { cycleLength: settings.cycleLength, periodLength: settings.periodLength } : null,
    averages: avg,
    periods: periods.slice(0, 12).map(serPeriod),
    logs: logs.filter((l) => l.date.getTime() >= shownFrom.getTime()).map(serLog),
    todayLog: todayLog ? serLog(todayLog) : null,
    snapshot: snap,
    advice,
    analytics: analytics(logs, periods, avg),
  };
}

/** Solo el consejo del día (Coliseo y Hábitos). */
export async function getCycleAdvice(userId: string) {
  const { snap, advice } = await load(userId);
  return { advice, snapshot: snap ? { phase: snap.phase, cycleDay: snap.cycleDay, onPeriod: snap.onPeriod, daysUntilNextPeriod: snap.daysUntilNextPeriod, lateDays: snap.lateDays } : null };
}

/**
 * Ajustes y primer arranque: con `lastPeriodStart` se anota su último periodo
 * (cerrado con su duración típica si ya debió terminar).
 */
export async function saveSettings(userId: string, input: { cycleLength?: number; periodLength?: number; lastPeriodStart?: string }) {
  const today = await todayOf(userId);
  const settings = await prisma.menstrualSettings.upsert({
    where: { userId },
    create: { userId, cycleLength: input.cycleLength ?? 28, periodLength: input.periodLength ?? 5 },
    update: {
      ...(input.cycleLength !== undefined ? { cycleLength: input.cycleLength } : {}),
      ...(input.periodLength !== undefined ? { periodLength: input.periodLength } : {}),
    },
  });
  if (input.lastPeriodStart) {
    const start = dayFrom(input.lastPeriodStart, today);
    const end = addCalendarDays(start, settings.periodLength - 1);
    await addPeriod(userId, { startDate: dayKey(start), endDate: end.getTime() < today.getTime() ? dayKey(end) : undefined });
  }
  return getCycle(userId);
}

/**
 * Un periodo nuevo, también de meses pasados (historial retroactivo). Si hay
 * otro abierto antes, se cierra en su duración típica. Cada periodo cambia los
 * promedios, la regularidad y la próxima regla: todo se recalcula al leer.
 */
export async function addPeriod(userId: string, input: { startDate: string; endDate?: string | null }) {
  const today = await todayOf(userId);
  const start = dayFrom(input.startDate, today);
  const end = input.endDate ? dayFrom(input.endDate, today) : null;
  if (end && (end.getTime() < start.getTime() || diffDays(end, start) + 1 > MAX_PERIOD_DAYS)) throw new CycleError('Revisa las fechas: el fin va después del inicio y un periodo dura como mucho 15 días.');

  const periods = await prisma.menstrualPeriod.findMany({ where: { userId }, orderBy: { startDate: 'desc' }, take: 24 });
  // Un periodo abierto anterior no choca: se cierra justo abajo.
  const last = (end ?? start).getTime();
  const overlaps = periods.some((p) => (p.endDate
    ? start.getTime() <= p.endDate.getTime() && last >= p.startDate.getTime()
    : p.startDate.getTime() >= start.getTime() && p.startDate.getTime() <= last));
  if (overlaps) throw new CycleError('Ya hay un periodo anotado en esas fechas.');

  const settings = await prisma.menstrualSettings.findUnique({ where: { userId } });
  const open = periods.find((p) => !p.endDate && p.startDate.getTime() < start.getTime());
  if (open) {
    const typical = addCalendarDays(open.startDate, (settings?.periodLength ?? 5) - 1);
    const dayBefore = addCalendarDays(start, -1);
    await prisma.menstrualPeriod.update({ where: { id: open.id }, data: { endDate: typical.getTime() < dayBefore.getTime() ? typical : dayBefore } });
  }
  if (!settings) await prisma.menstrualSettings.create({ data: { userId } });
  return serPeriod(await prisma.menstrualPeriod.create({ data: { userId, startDate: start, endDate: end } }));
}

export async function updatePeriod(userId: string, id: string, input: { startDate?: string; endDate?: string | null }) {
  const today = await todayOf(userId);
  const period = await prisma.menstrualPeriod.findFirst({ where: { id, userId } });
  if (!period) return null;
  const start = input.startDate ? dayFrom(input.startDate, today) : period.startDate;
  const end = input.endDate === null ? null : input.endDate ? dayFrom(input.endDate, today) : period.endDate;
  if (end && (end.getTime() < start.getTime() || diffDays(end, start) + 1 > MAX_PERIOD_DAYS)) throw new CycleError('Revisa las fechas: el fin va después del inicio y un periodo dura como mucho 15 días.');
  const clash = await prisma.menstrualPeriod.findFirst({ where: { userId, id: { not: id }, startDate: start } });
  if (clash) throw new CycleError('Ya hay un periodo que empieza ese día.');
  return serPeriod(await prisma.menstrualPeriod.update({ where: { id }, data: { startDate: start, endDate: end } }));
}

export async function deletePeriod(userId: string, id: string) {
  const { count } = await prisma.menstrualPeriod.deleteMany({ where: { id, userId } });
  return count > 0;
}

export interface DayLogInput {
  flow?: Flow | null;
  moods?: Mood[];
  energy?: number | null;
  symptoms?: Symptom[];
  sexualActivity?: SexualActivity | null;
  contraception?: Contraceptive | null;
  sleepQuality?: number | null;
  stress?: number | null;
  waterGlasses?: number | null;
  notes?: string | null;
}

/**
 * Guarda el registro de un día. Anotar sangrado fuera de un periodo lo abre (o
 * alarga el que acaba de terminar): así el ciclo se sigue sin pasos extra.
 */
export async function logDay(userId: string, dateKey: string, input: DayLogInput) {
  const today = await todayOf(userId);
  const date = dayFrom(dateKey, today);
  const data = {
    ...(input.flow !== undefined ? { flow: input.flow } : {}),
    ...(input.moods !== undefined ? { moods: [...new Set(input.moods)] } : {}),
    ...(input.energy !== undefined ? { energy: input.energy } : {}),
    ...(input.symptoms !== undefined ? { symptoms: [...new Set(input.symptoms)] } : {}),
    ...(input.sexualActivity !== undefined ? { sexualActivity: input.sexualActivity } : {}),
    ...(input.contraception !== undefined ? { contraception: input.contraception } : {}),
    ...(input.sleepQuality !== undefined ? { sleepQuality: input.sleepQuality } : {}),
    ...(input.stress !== undefined ? { stress: input.stress } : {}),
    ...(input.waterGlasses !== undefined ? { waterGlasses: input.waterGlasses } : {}),
    ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
  };
  const log = await prisma.menstrualLog.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, ...data },
    update: data,
  });

  let period: 'started' | 'extended' | null = null;
  if (input.flow && BLEEDING.includes(input.flow)) {
    const periods = await prisma.menstrualPeriod.findMany({ where: { userId, startDate: { lte: date } }, orderBy: { startDate: 'desc' }, take: 1 });
    const last = periods[0];
    const inside = last && (!last.endDate || last.endDate.getTime() >= date.getTime()) && diffDays(date, last.startDate) < MAX_PERIOD_DAYS;
    if (!inside) {
      if (last?.endDate && diffDays(date, last.endDate) <= SAME_PERIOD_GAP) {
        await prisma.menstrualPeriod.update({ where: { id: last.id }, data: { endDate: date } });
        period = 'extended';
      } else {
        await addPeriod(userId, { startDate: dayKey(date) });
        period = 'started';
      }
    }
  }
  return { log: serLog(log), period };
}

export async function clearDay(userId: string, dateKey: string) {
  const today = await todayOf(userId);
  const date = dayFrom(dateKey, today);
  await prisma.menstrualLog.deleteMany({ where: { userId, date } });
}
