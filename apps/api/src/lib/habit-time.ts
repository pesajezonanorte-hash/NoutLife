import type { Habit } from '@prisma/client';
import { addCalendarDays, getCalendarDay } from './calendar';

/**
 * Bloque horario de un hábito: va de reminderTime (inicio) a reminderEndTime (fin),
 * ambos HH:mm en la hora local de la persona. Sin fin, el bloque dura 30 min,
 * como antes de existir la hora de fin.
 */
export const DEFAULT_HABIT_BLOCK_MINUTES = 30;

/**
 * Primer día del calendario en que el hábito cae (startDay es una clave UTC de día).
 * Google trata DTSTART como una ocurrencia aunque no encaje con BYDAY: la serie debe
 * empezar en un día seleccionado, si no aparecería un día de más.
 */
export function firstHabitDay(startDay: Date, frequency: unknown): Date {
  const value = frequency as { type?: string; days?: unknown } | null;
  if (value?.type !== 'days_per_week' || !Array.isArray(value.days)) return startDay;
  const days = new Set(value.days.filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6));
  if (days.size === 0) return startDay;

  let day = startDay;
  for (let i = 0; i < 7 && !days.has(day.getUTCDay()); i += 1) day = addCalendarDays(day, 1);
  return day;
}

const HHMM = /^(\d{2}):(\d{2})$/;

/** Minutos desde medianoche, o null si no es una hora HH:mm válida. */
export function hhmmToMinutes(value: string | null | undefined): number | null {
  const match = value ? HHMM.exec(value) : null;
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

/** Código de error si la hora de fin no es posterior a la de inicio (ambas presentes). */
export function habitTimeRangeError(start: string | null | undefined, end: string | null | undefined): 'HABIT_END_BEFORE_START' | null {
  const startMin = hhmmToMinutes(start);
  const endMin = hhmmToMinutes(end);
  if (startMin === null || endMin === null) return null;
  return endMin > startMin ? null : 'HABIT_END_BEFORE_START';
}

/**
 * Inicio y fin del bloque en minutos desde medianoche. El fin puede pasar de 1440
 * (un bloque nocturno): quien lo exporte debe sumar un día.
 */
export function habitBlockMinutes(start: string | null | undefined, end: string | null | undefined): { start: number; end: number } | null {
  const startMin = hhmmToMinutes(start);
  if (startMin === null) return null;
  const endMin = hhmmToMinutes(end);
  return { start: startMin, end: endMin !== null && endMin > startMin ? endMin : startMin + DEFAULT_HABIT_BLOCK_MINUTES };
}

const GOOGLE_WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;

/** Fecha YYYY-MM-DD de una clave de calendario (medianoche UTC). */
export function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function habitRecurrenceRule(frequency: Habit['frequency']): string[] {
  const value = frequency as { type?: string; days?: unknown } | null;
  if (value?.type === 'days_per_week' && Array.isArray(value.days) && value.days.length > 0) {
    const days = [...new Set(value.days)]
      .filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6)
      .sort((a, b) => a - b)
      .map((day) => GOOGLE_WEEKDAYS[day]);

    if (days.length > 0) return [`RRULE:FREQ=WEEKLY;BYDAY=${days.join(',')}`];
  }

  return ['RRULE:FREQ=DAILY'];
}

export function habitGoogleEventBody(habit: Habit, timezone: string) {
  const startDay = firstHabitDay(getCalendarDay(timezone), habit.frequency);
  const startDate = dateKey(startDay);
  const recurrence = habitRecurrenceRule(habit.frequency);
  const description = [habit.description?.trim(), 'Hábito creado y administrado desde Noutlife.']
    .filter(Boolean)
    .join('\n\n');

  const base = {
    summary: habit.title,
    description,
    recurrence,
    extendedProperties: {
      private: {
        lifequestSource: 'habit',
        lifequestHabitId: habit.id,
        lifequestHabitCategory: habit.category,
      },
    },
  };

  if (!habit.reminderTime) {
    return {
      ...base,
      start: { date: startDate },
      end: { date: dateKey(addCalendarDays(startDay, 1)) },
    };
  }

  // Inicio y fin del bloque: la hora de fin del hábito, o 30 min si no tiene.
  const block = habitBlockMinutes(habit.reminderTime, habit.reminderEndTime) ?? { start: 9 * 60, end: 9 * 60 + 30 };
  const endDay = block.end >= 24 * 60 ? addCalendarDays(startDay, 1) : startDay;
  const pad = (value: number) => String(value).padStart(2, '0');
  const clock = (minutes: number) => `${pad(Math.floor((minutes % (24 * 60)) / 60))}:${pad(minutes % 60)}`;

  return {
    ...base,
    start: { dateTime: `${startDate}T${clock(block.start)}:00`, timeZone: timezone },
    end: { dateTime: `${dateKey(endDay)}T${clock(block.end)}:00`, timeZone: timezone },
    reminders: {
      useDefault: false,
      overrides: [{ method: 'popup', minutes: 0 }],
    },
  };
}

