import { prisma } from '../lib/prisma';
import { DEFAULT_TIMEZONE } from '../lib/calendar';

const HOUR_MS = 3_600_000;
const MIN_GAP_HOURS = 3;
const MAX_GAP_HOURS = 16;
const SUGGESTION_TTL_HOURS = 20;

function localHour(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  return hour + minute / 60;
}

function isNightStart(hour: number): boolean {
  return hour >= 20 || hour < 4;
}

function isMorningEnd(hour: number): boolean {
  return hour >= 4 && hour < 12;
}

export async function recordActivity(userId: string, now = new Date()): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastActiveAt: true, timezone: true },
  });
  if (!user) return;

  const data: { lastActiveAt: Date; nightGapStartAt?: Date; nightGapEndAt?: Date } = { lastActiveAt: now };
  const previous = user.lastActiveAt;
  if (previous) {
    const gapHours = (now.getTime() - previous.getTime()) / HOUR_MS;
    const timezone = user.timezone ?? DEFAULT_TIMEZONE;
    if (
      gapHours >= MIN_GAP_HOURS &&
      gapHours <= MAX_GAP_HOURS &&
      isNightStart(localHour(previous, timezone)) &&
      isMorningEnd(localHour(now, timezone))
    ) {
      data.nightGapStartAt = previous;
      data.nightGapEndAt = now;
    }
  }
  await prisma.user.update({ where: { id: userId }, data });
}

export async function getSleepSuggestion(userId: string, now = new Date()) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { nightGapStartAt: true, nightGapEndAt: true },
  });
  const bedtime = user?.nightGapStartAt;
  const wake = user?.nightGapEndAt;
  if (!bedtime || !wake) return null;
  if (now.getTime() - wake.getTime() > SUGGESTION_TTL_HOURS * HOUR_MS) return null;

  const alreadyLogged = await prisma.sleepLog.findFirst({
    where: { userId, isNap: false, wakeTime: { gte: new Date(bedtime.getTime() + 2 * HOUR_MS) }, bedtime: { lte: wake } },
    select: { id: true },
  });
  if (alreadyLogged) return null;

  return {
    bedtime: bedtime.toISOString(),
    wake: wake.toISOString(),
    hours: Math.round(((wake.getTime() - bedtime.getTime()) / HOUR_MS) * 10) / 10,
  };
}
