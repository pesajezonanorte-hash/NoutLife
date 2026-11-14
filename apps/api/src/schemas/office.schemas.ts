// Oficina de la Libreta: documentos, hojas de cálculo y presentaciones. El contenido depende del tipo.
import { z } from 'zod';

export const OFFICE_KINDS = ['doc', 'sheet', 'slides'] as const;
export type OfficeKind = (typeof OFFICE_KINDS)[number];
export const MAX_OFFICE_FILES = 100;

const title = z.string().trim().min(1, 'Ponle un nombre.').max(80);

const docContent = z.object({
  /** HTML ya saneado en el cliente (lib de la Libreta); solo lo lee su dueño. */
  html: z.string().max(300_000),
}).strict();

export const SHEET_MAX_ROWS = 300;
export const SHEET_MAX_COLS = 26;
const cellRef = /^[A-Z][1-9]\d{0,2}$/;
const sheetContent = z.object({
  rows: z.number().int().min(1).max(SHEET_MAX_ROWS),
  cols: z.number().int().min(1).max(SHEET_MAX_COLS),
  /** Solo las celdas con algo: { "B2": "=SUM(A1:A5)" }. */
  cells: z.record(z.string().regex(cellRef), z.string().max(500)).refine((cells) => Object.keys(cells).length <= 4000, 'La hoja tiene demasiadas celdas.'),
  chart: z.object({ type: z.enum(['bar', 'line', 'pie']), range: z.string().regex(/^[A-Z][1-9]\d{0,2}:[A-Z][1-9]\d{0,2}$/) }).strict().nullable().optional(),
}).strict();

const slide = z.object({
  id: z.string().min(1).max(40),
  layout: z.enum(['title', 'bullets', 'quote', 'number']),
  title: z.string().max(160),
  body: z.string().max(2000),
  notes: z.string().max(2000).optional(),
}).strict();
const slidesContent = z.object({
  theme: z.enum(['jade', 'ink', 'paper']),
  slides: z.array(slide).min(1).max(100),
}).strict();

export const CONTENT_SCHEMAS = { doc: docContent, sheet: sheetContent, slides: slidesContent } as const;

export const createOfficeSchema = z.object({ kind: z.enum(OFFICE_KINDS), title, content: z.unknown().optional() }).strict();
export const updateOfficeSchema = z.object({ title: title.optional(), content: z.unknown().optional() }).strict()
  .refine((value) => value.title !== undefined || value.content !== undefined, 'Nada que guardar.');

export const OFFICE_AI_ACTIONS = ['write', 'improve', 'summarize', 'analyze', 'slides'] as const;
export const officeAiSchema = z.object({
  action: z.enum(OFFICE_AI_ACTIONS),
  /** Lo que pide la persona («un ensayo sobre…», «¿en qué gasto más?»). */
  prompt: z.string().trim().max(1000).optional(),
  /** El texto, la tabla (CSV) o las notas sobre las que trabaja. */
  context: z.string().max(14_000).optional(),
  locale: z.enum(['es', 'en']).default('es'),
}).strict().refine((v) => Boolean(v.prompt || v.context?.trim()), 'Escribe qué necesitas o dale algo sobre lo que trabajar.');

export type CreateOfficeInput = z.infer<typeof createOfficeSchema>;
export type UpdateOfficeInput = z.infer<typeof updateOfficeSchema>;
export type OfficeAiInput = z.infer<typeof officeAiSchema>;
export type SlidesContent = z.infer<typeof slidesContent>;

/** Contenido con el que nace cada tipo de archivo. */
export const BLANK: { [K in OfficeKind]: () => z.infer<(typeof CONTENT_SCHEMAS)[K]> } = {
  doc: () => ({ html: '' }),
  sheet: () => ({ rows: 30, cols: 8, cells: {}, chart: null }),
  slides: () => ({ theme: 'jade', slides: [{ id: 's1', layout: 'title', title: '', body: '' }] }),
};
