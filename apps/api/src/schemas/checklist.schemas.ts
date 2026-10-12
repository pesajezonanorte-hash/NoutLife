import { z } from 'zod';

const name = z.string().trim().min(1, 'Ponle un nombre a la lista.').max(80);
const category = z.string().trim().min(1).max(40);
const itemText = z.string().trim().min(1, 'Escribe algo.').max(200);
const permission = z.enum(['VIEW', 'EDIT']);

export const createChecklistSchema = z.object({
  name,
  category: category.default('General'),
  items: z.array(itemText).max(300).optional(),
}).strict();

export const updateChecklistSchema = z.object({ name: name.optional(), category: category.optional() }).strict();
export const addItemSchema = z.object({ text: itemText }).strict();
export const updateItemSchema = z.object({ text: itemText.optional(), done: z.boolean().optional() }).strict();
export const reorderItemsSchema = z.object({ ids: z.array(z.string().min(1)).max(300) }).strict();
export const shareLinkSchema = z.object({ permission }).strict();
export const shareUserSchema = z.object({ user: z.string().trim().min(1).max(60), permission }).strict();
export const updateShareSchema = z.object({ permission }).strict();
