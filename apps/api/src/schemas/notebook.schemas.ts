// Libreta: libretas, páginas e imágenes. Las coordenadas de una página van en
// unidades de página (1000 de ancho × 1414 de alto, proporción A5) para que se vea
// igual en cualquier pantalla.
import { z } from 'zod';

export const NOTEBOOK_CATEGORIES = ['personal', 'trabajo', 'ideas', 'proyectos', 'estudio'] as const;
export const NOTEBOOK_COLORS = ['jade', 'ambar', 'oceano', 'coral', 'bosque', 'oro'] as const;
export const NOTEBOOK_PAPERS = ['ruled', 'grid', 'dots', 'plain'] as const;
export const MAX_NOTEBOOKS = 50;
export const MAX_PAGES = 200;
export const MAX_IMAGES_PER_NOTEBOOK = 200;
/** Números de trazo por página (pares x, y): unos 1,2 MB de JSON como mucho. */
export const MAX_STROKE_NUMBERS = 200_000;

export const PAGE_W = 1000;
export const PAGE_H = 1414;

const title = z.string().trim().min(1, 'Ponle un nombre a la libreta.').max(60);

export const createNotebookSchema = z.object({
  title,
  category: z.enum(NOTEBOOK_CATEGORIES).default('personal'),
  color: z.enum(NOTEBOOK_COLORS).default('jade'),
  paper: z.enum(NOTEBOOK_PAPERS).default('ruled'),
  pageCount: z.number().int().min(1).max(MAX_PAGES).default(20),
}).strict();

export const updateNotebookSchema = z.object({
  title: title.optional(),
  category: z.enum(NOTEBOOK_CATEGORIES).optional(),
  color: z.enum(NOTEBOOK_COLORS).optional(),
  paper: z.enum(NOTEBOOK_PAPERS).optional(),
  pageCount: z.number().int().min(1).max(MAX_PAGES).optional(),
}).strict();

const x = z.number().finite().min(-PAGE_W).max(PAGE_W * 2);
const y = z.number().finite().min(-PAGE_H).max(PAGE_H * 2);
const id = z.string().min(1).max(40);

const strokeSchema = z.object({
  /** pen | marker (resaltador translúcido) | eraser (borra tinta). */
  t: z.enum(['pen', 'marker', 'eraser']),
  c: z.string().regex(/^#[0-9a-f]{6}$/i),
  w: z.number().min(0.5).max(80),
  /** x0, y0, x1, y1… */
  p: z.array(z.number().finite().min(-PAGE_H).max(PAGE_H * 2)).min(2).max(8000),
}).strict();

const stickySchema = z.object({
  id,
  x, y,
  text: z.string().max(1000),
  color: z.enum(['yellow', 'pink', 'blue', 'green', 'orange']),
  rot: z.number().min(-12).max(12),
}).strict();

const imageRefSchema = z.object({
  id,
  x, y,
  w: z.number().min(40).max(PAGE_W),
  /** Alto / ancho de la imagen. */
  ratio: z.number().min(0.05).max(20),
}).strict();

export const pageContentSchema = z.object({
  /** Texto enriquecido (HTML ya saneado en el cliente; solo lo lee su dueño). */
  html: z.string().max(200_000),
  strokes: z.array(strokeSchema).max(6000),
  stickies: z.array(stickySchema).max(100),
  images: z.array(imageRefSchema).max(60),
}).strict().superRefine((page, ctx) => {
  const numbers = page.strokes.reduce((n, s) => n + s.p.length, 0);
  if (numbers > MAX_STROKE_NUMBERS) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['strokes'], message: 'La página tiene demasiados trazos. Sigue en la página siguiente.' });
  if (page.strokes.some((s) => s.p.length % 2 !== 0)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['strokes'], message: 'Trazo incompleto.' });
});

export const notebookImageSchema = z.object({
  mime: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  /** Base64 sin el prefijo data: (≈ 500 kB como mucho). */
  data: z.string().min(16).max(700_000).regex(/^[A-Za-z0-9+/]+={0,2}$/),
}).strict();

export type CreateNotebookInput = z.infer<typeof createNotebookSchema>;
export type UpdateNotebookInput = z.infer<typeof updateNotebookSchema>;
export type PageContent = z.infer<typeof pageContentSchema>;
export type NotebookImageInput = z.infer<typeof notebookImageSchema>;

/** Una página sin nada escrito, dibujado ni pegado no se guarda (y si existía, se borra). */
export function isEmptyPage(page: PageContent): boolean {
  const text = page.html.replace(/<br\s*\/?>/gi, '').replace(/<\/?(div|p|span|b|i|u|s|strong|em|mark|ul|ol|li|h3)[^>]*>/gi, '').replace(/&nbsp;/g, '').trim();
  return !text && page.strokes.length === 0 && page.stickies.length === 0 && page.images.length === 0;
}
