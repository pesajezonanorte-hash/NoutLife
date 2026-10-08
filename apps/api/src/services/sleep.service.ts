import { prisma } from '../lib/prisma';

const MIN_NAP_HOURS = 5 / 60;
const MAX_NAP_HOURS = 4;
const MIN_NIGHT_HOURS = 0.5;
const MAX_NIGHT_HOURS = 12;

function durationHours(bedtime: Date, wakeTime: Date) {
  const elapsed = (wakeTime.getTime() - bedtime.getTime()) / 3_600_000;
  return elapsed < 0 ? elapsed + 24 : elapsed;
}

function validDuration(duration: number, isNap: boolean) {
  return Number.isFinite(duration) && (isNap
    ? duration >= MIN_NAP_HOURS && duration <= MAX_NAP_HOURS
    : duration >= MIN_NIGHT_HOURS && duration <= MAX_NIGHT_HOURS);
}

export async function listSleep(userId: string, month?: string) {
  const where: Record<string, unknown> = { userId };
  if (month) {
    const [year, m] = month.split('-').map(Number);
    where.date = { gte: new Date(year, m - 1, 1), lt: new Date(year, m, 1) };
  }
  return prisma.sleepLog.findMany({ where, orderBy: { date: 'desc' }, take: 60 });
}

function calcSleepScore(duration: number, quality: number, bedtime: Date): number {
  let score = 0;
  if (duration >= 7 && duration <= 9) score += 40;
  else if (duration >= 6) score += 30;
  else score += Math.max(0, Math.round(duration * 5));
  score += quality * 6;
  const bedHour = bedtime.getHours() + bedtime.getMinutes() / 60;
  if (bedHour >= 22 && bedHour <= 23.5) score += 30;
  else if (bedHour >= 21 || bedHour <= 0.5) score += 20;
  else score += 10;
  return Math.min(100, Math.round(score));
}

export async function createSleep(
  userId: string,
  body: { bedtime: string; wakeTime: string; quality: number; notes?: string; date?: string; caffeineLate?: boolean; screensBeforeBed?: boolean; exercisedToday?: boolean; isNap?: boolean }
) {
  const bedtime = new Date(body.bedtime);
  const wakeTime = new Date(body.wakeTime);
  const duration = durationHours(bedtime, wakeTime);
  const isNap = body.isNap ?? false;
  if (!validDuration(duration, isNap)) throw new Error('SLEEP_DURATION_INVALID');

  // Las siestas no tienen puntuación de noche (la hora de acostarse no aplica).
  const sleepScore = isNap ? null : calcSleepScore(duration, body.quality, bedtime);

  return prisma.sleepLog.create({
    data: {
      userId,
      bedtime,
      wakeTime,
      duration,
      quality: body.quality,
      notes: body.notes,
      date: body.date ? new Date(body.date) : new Date(),
      sleepScore,
      caffeineLate: body.caffeineLate,
      screensBeforeBed: body.screensBeforeBed,
      exercisedToday: body.exercisedToday,
      isNap,
    },
  });
}

export async function updateSleep(userId: string, id: string, body: Partial<{ bedtime: string; wakeTime: string; quality: number; notes: string }>) {
  const existing = await prisma.sleepLog.findFirst({ where: { id, userId } });
  if (!existing) throw new Error('SLEEP_NOT_FOUND');

  const bedtime = body.bedtime ? new Date(body.bedtime) : existing.bedtime;
  const wakeTime = body.wakeTime ? new Date(body.wakeTime) : existing.wakeTime;
  const quality = body.quality ?? existing.quality;
  const shouldRecalculate = body.bedtime !== undefined || body.wakeTime !== undefined || body.quality !== undefined;

  const duration = durationHours(bedtime, wakeTime);
  if (shouldRecalculate && !validDuration(duration, existing.isNap)) throw new Error('SLEEP_DURATION_INVALID');

  return prisma.sleepLog.update({
    where: { id },
    data: {
      ...(body.bedtime !== undefined && { bedtime }),
      ...(body.wakeTime !== undefined && { wakeTime }),
      ...(body.quality !== undefined && { quality }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(shouldRecalculate && {
        duration,
        sleepScore: existing.isNap ? null : calcSleepScore(duration, quality, bedtime),
      }),
    },
  });
}

export async function deleteSleep(userId: string, id: string) {
  const existing = await prisma.sleepLog.findFirst({ where: { id, userId }, select: { id: true } });
  if (!existing) throw new Error('SLEEP_NOT_FOUND');
  return prisma.sleepLog.delete({ where: { id } });
}

export async function getSleepStats(userId: string) {
  const now = new Date();
  const currentWeekStart = new Date(now.getTime() - 7 * 86400000);
  const previousWeekStart = new Date(now.getTime() - 14 * 86400000);

  const logs = await prisma.sleepLog.findMany({
    where: { userId, isNap: false, date: { gte: previousWeekStart, lt: now } },
    orderBy: { date: 'desc' },
  });

  if (logs.length === 0) return { avgDuration: 0, avgQuality: 0, totalLogs: 0, weeklyAvg: 0, trend: 'stable' };

  const average = (items: typeof logs, field: 'duration' | 'quality') =>
    items.length ? items.reduce((sum, item) => sum + item[field], 0) / items.length : 0;
  const weekLogs = logs.filter((log) => log.date >= currentWeekStart);
  const previousWeekLogs = logs.filter((log) => log.date < currentWeekStart);
  const weeklyAvg = average(weekLogs, 'duration');
  const previousWeeklyAvg = average(previousWeekLogs, 'duration');
  const trend = weeklyAvg > previousWeeklyAvg + 0.25
    ? 'improving'
    : weeklyAvg < previousWeeklyAvg - 0.25
      ? 'declining'
      : 'stable';

  return {
    avgDuration: average(logs, 'duration'),
    avgQuality: average(logs, 'quality'),
    totalLogs: logs.length,
    weeklyAvg,
    trend,
  };
}
