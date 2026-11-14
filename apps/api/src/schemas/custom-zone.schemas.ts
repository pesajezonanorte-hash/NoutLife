// Zonas personalizadas: lo que llega al crear o editar una zona. Las sugerencias de El Sabio son texto de un
// modelo: los campos de más se descartan, los textos largos se recortan y un enlace que no sea una ruta de la
// app se quita. La zona se crea igual; antes de esto la API no validaba nada de estos campos.
import { z } from 'zod';

/** Texto sin espacios y recortado al tamaño máximo (no rechaza). */
const clip = (max: number) => z.string().trim().transform((s) => s.slice(0, max));

/** Un módulo de la zona: hábitos, misiones, enfoque, música o un enlace interno (`to`, siempre una ruta de la app). */
export const zoneSectionSchema = z.object({
  type: clip(30).default(''),
  title: clip(60).default(''),
  description: clip(200).default(''),
  to: z.string().regex(/^\/[\w\-/?=&]{0,80}$/).optional().catch(undefined),
});

export const zoneActionSchema = z.object({
  label: clip(60).default(''),
  type: clip(30).default(''),
});

const zoneFields = {
  name: clip(40).refine((s) => s.length > 0, 'Ponle nombre a la zona.'),
  description: clip(200).nullable().optional(),
  icon: z.string().trim().min(1).max(40).optional(),
  accentColor: z.string().regex(/^#[0-9a-f]{6}$/i, 'El color no es válido.').optional(),
  isMeasurable: z.boolean().optional(),
  measureMetric: z.string().trim().max(40).nullable().optional(),
  weeklyXpGoal: z.number().int().min(0).max(100_000).nullable().optional(),
  sections: z.array(zoneSectionSchema).transform((list) => list.slice(0, 12)).nullable().optional(),
  actions: z.array(zoneActionSchema).transform((list) => list.slice(0, 12)).nullable().optional(),
};

export const createZoneSchema = z.object(zoneFields);
export const updateZoneSchema = z.object({ ...zoneFields, content: z.array(z.unknown()).max(200) }).partial();
export const reorderSchema = z.object({ orderedIds: z.array(z.string().min(1).max(40)).max(50) }).strict();
