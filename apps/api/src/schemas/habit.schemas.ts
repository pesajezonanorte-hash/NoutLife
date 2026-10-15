import { z } from 'zod';
import { isValidCalendarDate } from '../lib/calendar';
import { withLegacyKeys } from './activity.schemas';

const LEGACY = { createsGymAttendance: 'createsColiseoAttendance' };

const CATEGORIES = ['HEALTH', 'FITNESS', 'FINANCE', 'LEARNING', 'LOVE', 'SOCIAL', 'PERSONAL', 'CREATIVE', 'HYGIENE'] as const;

// Un ritual tiene pasos ordenados; cada paso es un texto corto.
const stepsSchema = z.array(z.string().trim().min(1).max(100)).max(12);

const frequencySchema = z.object({
  type: z.enum(['daily', 'days_per_week']),
  days: z.array(z.number().int().min(0).max(6)),
});

const calendarDateSchema = z
  .string()
  .refine(isValidCalendarDate, 'La fecha debe tener el formato calendario YYYY-MM-DD y ser real.');

export const createHabitSchema = withLegacyKeys(z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(300).optional(),
  category: z.enum(CATEGORIES),
  kind: z.enum(['habit', 'ritual']).optional(),
  steps: stepsSchema.optional(),
  icon: z.string().max(10).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  xpReward: z.number().int().min(1).max(500).optional(),
  goldReward: z.number().int().min(0).max(200).optional(),
  frequency: frequencySchema.optional(),
  resetTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  reminderTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  syncToGoogleCalendar: z.boolean().optional(),
  createsColiseoAttendance: z.boolean().optional(),
}), LEGACY);

export const updateHabitSchema = withLegacyKeys(z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(300).optional(),
  category: z.enum(CATEGORIES).optional(),
  kind: z.enum(['habit', 'ritual']).optional(),
  steps: stepsSchema.optional(),
  icon: z.string().max(10).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  xpReward: z.number().int().min(1).max(500).optional(),
  goldReward: z.number().int().min(0).max(200).optional(),
  frequency: frequencySchema.optional(),
  resetTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  reminderTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  syncToGoogleCalendar: z.boolean().optional(),
  createsColiseoAttendance: z.boolean().optional(),
}), LEGACY);

export const habitStepSchema = z.object({
  completed: z.boolean(),
});

export const habitLogSchema = z.object({
  status: z.enum(['completed', 'failed', 'skipped']),
  notes: z.string().max(500).optional(),
  // Dates are explicit calendar keys, not JavaScript instants. This allows
  // intentional backfill while protecting habitId+date idempotency.
  date: calendarDateSchema.optional(),
});
