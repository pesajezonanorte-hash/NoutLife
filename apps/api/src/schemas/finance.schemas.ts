import { z } from 'zod';
import { isValidCalendarDate } from '../lib/calendar';

export const TRANSACTION_TYPES = ['INCOME', 'EXPENSE'] as const;
export const TRANSACTION_CATEGORIES = [
  'FOOD',
  'TRANSPORT',
  'ENTERTAINMENT',
  'SAVINGS',
  'INVESTMENT',
  'HEALTH',
  'EDUCATION',
  'CLOTHING',
  'CLOTHING_FOR_ME',
  'UTILITIES',
  'HOUSING',
  'SUBSCRIPTIONS',
  'SALARY',
  'FREELANCE',
  'BUSINESS',
  'SALES',
  'GIFT',
  'RENTAL',
  'OTHER',
] as const;

const positiveMoney = z
  .number({ invalid_type_error: 'El importe debe ser un número válido.' })
  .finite('El importe debe ser un número válido.')
  .positive('El importe debe ser mayor que cero.')
  .max(999_999_999_999.99, 'El importe excede el límite permitido.');

const validDateTime = z.string().refine((value) => {
  if (isValidCalendarDate(value)) return true;
  // The API also accepts ISO timestamps used by integrations/export restores.
  return /^\d{4}-\d{2}-\d{2}T/.test(value) && isValidCalendarDate(value.slice(0, 10)) && !Number.isNaN(Date.parse(value));
}, 'La fecha debe ser una fecha calendario o ISO válida.');

const transactionFields = {
  type: z.enum(TRANSACTION_TYPES),
  amount: positiveMoney,
  category: z.enum(TRANSACTION_CATEGORIES),
  description: z.string().trim().max(500).optional(),
  date: validDateTime.optional(),
};

export const createTransactionSchema = z.object(transactionFields).strict();

export const updateTransactionSchema = z
  .object({
    type: transactionFields.type.optional(),
    amount: transactionFields.amount.optional(),
    category: transactionFields.category.optional(),
    description: z.string().trim().max(500).optional(),
    date: validDateTime.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Incluye al menos un campo para actualizar.');

const monthSchema = z.number().int().min(1).max(12);
const yearSchema = z.number().int().min(2000).max(2100);

export const createBudgetSchema = z.object({
  category: z.enum(TRANSACTION_CATEGORIES),
  amount: positiveMoney,
  month: monthSchema.optional(),
  year: yearSchema.optional(),
}).strict();

export const updateBudgetSchema = z.object({
  amount: positiveMoney,
}).strict();

export const createFinancialGoalSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  targetAmount: positiveMoney,
  deadline: validDateTime.optional(),
}).strict();

export const updateFinancialGoalSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(500).optional(),
    targetAmount: positiveMoney.optional(),
    deadline: validDateTime.nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Incluye al menos un campo para actualizar.');

export const contributeToGoalSchema = z.object({
  amount: positiveMoney,
}).strict();

export const savingsMoveSchema = z.object({
  kind: z.enum(['DEPOSIT', 'WITHDRAW']),
  counterpart: z.enum(['GENERAL', 'EXTRA', 'OUT']),
  amount: positiveMoney,
  note: z.string().trim().max(120).optional(),
}).strict().refine(
  (v) => (v.kind === 'DEPOSIT' ? v.counterpart !== 'OUT' : v.counterpart !== 'EXTRA'),
  'Origen o destino no válido para este movimiento.',
);
