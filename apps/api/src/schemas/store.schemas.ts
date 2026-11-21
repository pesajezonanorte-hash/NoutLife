import { z } from 'zod';
import { STORE_STATUSES } from '../lib/store';

const text = (max: number) => z.string().trim().max(max);
const cop = (max: number) => z.number().int().min(0).max(max);

// ─── Tienda (pública) ────────────────────────────────────────────────────────

export const createOrderSchema = z.object({
  slug: z.string().trim().min(1).max(120),
  name: z.string().trim().min(2, 'Escribe tu nombre.').max(80),
  whatsapp: z.string().trim().min(7, 'Escribe tu WhatsApp.').max(20),
  accept: z.literal(true, { errorMap: () => ({ message: 'Debes aceptar las condiciones del acceso compartido.' }) }),
}).strict();

export const proofSchema = z.object({
  method: z.enum(['nequi', 'transferencia']),
  reference: text(80).optional().default(''),
  /** Archivo en base64, máximo 2 MB ya decodificado (se revisa en el servicio). */
  data: z.string().min(16).max(2_900_000),
}).strict();

export const findOrderSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^VT-[A-Z0-9]{6}$/, 'El código tiene la forma VT-XXXXXX.'),
  whatsapp: z.string().trim().min(7).max(20),
}).strict();

export const wompiConfirmSchema = z.object({
  transactionId: z.string().trim().min(3).max(64).regex(/^[A-Za-z0-9_-]+$/),
}).strict();

// ─── Panel ──────────────────────────────────────────────────────────────────

export const sessionSchema = z.object({ token: z.string().min(20).max(4096) }).strict();

export const transitionSchema = z.object({
  status: z.enum(STORE_STATUSES),
  note: text(500).optional().default(''),
  providerId: z.string().trim().min(1).max(40).optional(),
  costCop: cop(50_000_000).optional(),
}).strict();

export const orderPatchSchema = z.object({
  notes: text(5000).optional(),
  providerId: z.string().trim().min(1).max(40).nullable().optional(),
  costCop: cop(50_000_000).nullable().optional(),
  feeCop: cop(50_000_000).nullable().optional(),
  providerRefunded: z.boolean().optional(),
}).strict();

const productFields = {
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Solo minúsculas, números y guiones (ej. grand-theft-auto-vi).'),
  name: z.string().trim().min(1).max(120),
  platform: z.string().trim().min(1).max(80),
  accessMode: z.string().trim().min(1).max(80),
  category: z.string().trim().min(1).max(60),
  shortDescription: text(300),
  description: text(5000),
  conditions: text(5000),
  setupSteps: text(5000),
  coverage: text(2000).nullable(),
  deliveryEstimate: text(300).nullable(),
  ageRating: text(40).nullable(),
  priceCop: z.number().int().min(1000).max(20_000_000),
  compareAtCop: z.number().int().min(1000).max(20_000_000).nullable(),
  availability: z.enum(['por_confirmar', 'disponible', 'agotado']),
  images: z.array(z.string().trim().url().startsWith('https://', 'Las imágenes deben empezar por https://').max(500)).max(8),
  active: z.boolean(),
  featured: z.boolean(),
};

const emptyToNull = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? null : value);
const nullableText = (schema: z.ZodTypeAny) => z.preprocess(emptyToNull, schema);

export const productCreateSchema = z.object({
  ...productFields,
  shortDescription: productFields.shortDescription.default(''),
  description: productFields.description.default(''),
  conditions: productFields.conditions.default(''),
  setupSteps: productFields.setupSteps.default(''),
  coverage: nullableText(productFields.coverage).default(null),
  deliveryEstimate: nullableText(productFields.deliveryEstimate).default(null),
  ageRating: nullableText(productFields.ageRating).default(null),
  compareAtCop: productFields.compareAtCop.default(null),
  availability: productFields.availability.default('por_confirmar'),
  images: productFields.images.default([]),
  active: productFields.active.default(true),
  featured: productFields.featured.default(false),
}).strict();

export const productUpdateSchema = z.object({
  ...productFields,
  coverage: nullableText(productFields.coverage),
  deliveryEstimate: nullableText(productFields.deliveryEstimate),
  ageRating: nullableText(productFields.ageRating),
}).partial().strict();

export const providerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  whatsapp: text(20).default(''),
  notes: text(2000).default(''),
  active: z.boolean().default(true),
}).strict();

export const providerUpdateSchema = providerSchema.partial().strict();

export const providerProductSchema = z.object({
  costCop: cop(50_000_000),
  available: z.boolean(),
  isDefault: z.boolean(),
}).strict();

export const paymentMethodSchema = z.object({
  id: z.string().trim().min(1).max(40).regex(/^[a-z0-9-]+$/),
  kind: z.enum(['nequi', 'transferencia']),
  label: z.string().trim().min(1).max(60),
  holder: text(120),
  number: text(60),
  bank: text(80),
  accountType: text(40),
  instructions: text(500),
  active: z.boolean(),
}).strict();

export const settingsSchema = z.object({
  legalName: text(160),
  documentId: text(40),
  city: text(80),
  address: text(200),
  email: z.union([z.literal(''), z.string().trim().email('El correo no es válido.').max(160)]),
  whatsapp: text(20),
  supportHours: text(200),
  deliveryEstimate: text(300),
  siteUrl: z.string().trim().url().startsWith('https://').max(200),
  paymentMethods: z.array(paymentMethodSchema).max(6),
  wompiEnabled: z.boolean(),
  wompiMerchantName: text(120),
  wompiFeeBps: z.number().int().min(0).max(2000),
  wompiFeeFixedCop: cop(100_000),
}).strict();
