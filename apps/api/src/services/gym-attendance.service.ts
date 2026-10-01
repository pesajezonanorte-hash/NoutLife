import { prisma } from '../lib/prisma';
import { DEFAULT_TIMEZONE, getCalendarDay, parseCalendarDate } from '../lib/calendar';

/**
 * Attendance is a calendar-day fact, separate from a detailed Workout. One
 * attendance per user/date lets a habit completion and a finished workout point
 * at the same visit without double-counting it.
 */
export async function recordHabitGymAttendance(userId: string, habitId: string, date: Date) {
  return prisma.gymAttendance.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, source: 'HABIT', habitId },
    // A manual visit remains manual. Do not replace a prior linked habit either:
    // the first completed gym habit is retained as the provenance for the day.
    update: {},
  });
}

export async function recordManualGymAttendance(userId: string, inputDate?: string | Date) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  const timezone = user?.timezone ?? DEFAULT_TIMEZONE;
  const calendarDate = typeof inputDate === 'string'
    ? parseCalendarDate(inputDate)
    : getCalendarDay(timezone, inputDate ?? new Date());
  if (!calendarDate) throw new Error('INVALID_ATTENDANCE_DATE');
  const today = getCalendarDay(timezone);
  if (calendarDate.getTime() > today.getTime()) throw new Error('ATTENDANCE_FUTURE_DATE');

  return prisma.gymAttendance.upsert({
    where: { userId_date: { userId, date: calendarDate } },
    create: { userId, date: calendarDate, source: 'MANUAL' },
    update: { source: 'MANUAL', habitId: null },
  });
}

export async function recordWorkoutGymAttendance(userId: string, workoutDate: Date) {
  const attendance = await recordManualGymAttendance(userId, workoutDate);
  return attendance;
}

export async function listGymAttendances(userId: string, from?: string, to?: string) {
  return prisma.gymAttendance.findMany({
    where: {
      userId,
      ...(from || to ? {
        date: {
          ...(from ? { gte: parseCalendarDate(from) ?? undefined } : {}),
          ...(to ? { lte: parseCalendarDate(to) ?? undefined } : {}),
        },
      } : {}),
    },
    orderBy: { date: 'asc' },
    include: { habit: { select: { id: true, title: true, icon: true } } },
  });
}
