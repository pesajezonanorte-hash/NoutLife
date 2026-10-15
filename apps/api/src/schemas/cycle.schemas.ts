import { z } from 'zod';
import {
  CONTRACEPTIVES, CYCLE_RANGE, FLOWS, MOODS, PERIOD_RANGE, SCALE_RANGE, SEXUAL_ACTIVITY, SYMPTOMS, WATER_RANGE,
} from '../lib/cycle';

const dayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha no es válida.');
const scale = z.number().int().min(SCALE_RANGE.min).max(SCALE_RANGE.max);

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
  moods: z.array(z.enum(MOODS)).max(MOODS.length).optional(),
  energy: scale.nullable().optional(),
  symptoms: z.array(z.enum(SYMPTOMS)).max(SYMPTOMS.length).optional(),
  sexualActivity: z.enum(SEXUAL_ACTIVITY).nullable().optional(),
  contraception: z.enum(CONTRACEPTIVES).nullable().optional(),
  sleepQuality: scale.nullable().optional(),
  stress: scale.nullable().optional(),
  waterGlasses: z.number().int().min(WATER_RANGE.min).max(WATER_RANGE.max).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
}).strict();
