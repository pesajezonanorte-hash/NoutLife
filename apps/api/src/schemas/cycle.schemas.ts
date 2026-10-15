import { z } from 'zod';
import { CYCLE_RANGE, FLOWS, PERIOD_RANGE, SYMPTOMS } from '../lib/cycle';

const dayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha no es válida.');

export const cycleSettingsSchema = z.object({
  cycleLength: z.number().int().min(CYCLE_RANGE.min).max(CYCLE_RANGE.max).optional(),
  periodLength: z.number().int().min(PERIOD_RANGE.min).max(PERIOD_RANGE.max).optional(),
  /** Primer arranque: cuándo empezó su último periodo. */
  lastPeriodStart: dayKey.optional(),
}).strict();

export const cyclePeriodSchema = z.object({
  startDate: dayKey,
  endDate: dayKey.nullable().optional(),
}).strict();

export const cyclePeriodUpdateSchema = z.object({
  startDate: dayKey.optional(),
  endDate: dayKey.nullable().optional(),
}).strict();

export const cycleLogSchema = z.object({
  flow: z.enum(FLOWS).nullable().optional(),
  mood: z.number().int().min(1).max(5).nullable().optional(),
  energy: z.number().int().min(1).max(5).nullable().optional(),
  symptoms: z.array(z.enum(SYMPTOMS)).max(SYMPTOMS.length).optional(),
  notes: z.string().max(500).nullable().optional(),
}).strict();
