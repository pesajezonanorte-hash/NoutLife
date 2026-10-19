// Libreta: cada persona tiene sus libretas; cada libreta, sus páginas (solo se
// guardan las escritas) y las imágenes pegadas en ellas. Todo se comprueba contra
// el dueño: una libreta ajena responde como si no existiera. `lite`: la cuenta
// está en NoutLife Lite; lo que es solo de Pro responde 402 con su candado.
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { LITE_LIMITS, NOTEBOOK_LOCK_MESSAGES, type NotebookLock } from '../lib/plans';
import {
  MAX_IMAGES_PER_NOTEBOOK, MAX_NOTEBOOKS, isEmptyPage,
  type CreateNotebookInput, type NotebookImageInput, type PageContent, type UpdateNotebookInput,
} from '../schemas/notebook.schemas';

/** Error con mensaje para la persona. Con `lock` es un candado de Pro (402). */
export class NotebookError extends Error {
  constructor(message: string, readonly status = 400, readonly lock?: NotebookLock) { super(message); }
}

const locked = (lock: NotebookLock) => new NotebookError(NOTEBOOK_LOCK_MESSAGES[lock], 402, lock);

const owned = (userId: string, id: string) =>
  prisma.notebook.findFirst({ where: { id, userId }, select: { id: true, pageCount: true } });

export async function listNotebooks(userId: string) {
  const books = await prisma.notebook.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { pages: true } } },
  });
  return books.map(({ _count, ...book }) => ({ ...book, usedPages: _count.pages }));
}

/** En Lite: hasta LITE_LIMITS.notebooks libretas, de hasta LITE_LIMITS.notebookPages páginas. */
export async function createNotebook(userId: string, input: CreateNotebookInput, lite = false) {
  if (lite && input.pageCount > LITE_LIMITS.notebookPages) throw locked('notebook-pages');
  const count = await prisma.notebook.count({ where: { userId } });
  if (lite && count >= LITE_LIMITS.notebooks) throw locked('notebooks');
  if (count >= MAX_NOTEBOOKS) {
    throw new NotebookError(`Puedes tener hasta ${MAX_NOTEBOOKS} libretas. Borra alguna que ya no uses.`, 409);
  }
  const book = await prisma.notebook.create({ data: { userId, ...input } });
  return { ...book, usedPages: 0 };
}

/** null: no existe (o no es tuya). Las páginas solo se pueden aumentar por encima de la última escrita. */
export async function updateNotebook(userId: string, id: string, input: UpdateNotebookInput, lite = false) {
  const book = await owned(userId, id);
  if (!book) return null;
  if (input.pageCount !== undefined) {
    if (lite && input.pageCount > LITE_LIMITS.notebookPages && input.pageCount > book.pageCount) throw locked('notebook-pages');
    const last = await prisma.notebookPage.findFirst({ where: { notebookId: id }, orderBy: { index: 'desc' }, select: { index: true } });
    if (last && input.pageCount <= last.index) {
      throw new NotebookError(`La página ${last.index + 1} tiene contenido: la libreta necesita al menos ${last.index + 1} páginas.`, 409);
    }
  }
  const updated = await prisma.notebook.update({ where: { id }, data: input, include: { _count: { select: { pages: true } } } });
  const { _count, ...rest } = updated;
  return { ...rest, usedPages: _count.pages };
}

export async function deleteNotebook(userId: string, id: string): Promise<boolean> {
  const { count } = await prisma.notebook.deleteMany({ where: { id, userId } });
  return count > 0;
}

/** undefined: la libreta no existe; null: la página está en blanco. */
export async function getPage(userId: string, id: string, index: number) {
  const book = await owned(userId, id);
  if (!book) return undefined;
  if (index < 0 || index >= book.pageCount) throw new NotebookError('Esa página no existe en la libreta.');
  return prisma.notebookPage.findUnique({ where: { notebookId_index: { notebookId: id, index } }, select: { index: true, content: true, updatedAt: true } });
}

/** Guarda la página (una página vacía se borra). null: la libreta no existe. */
export async function savePage(userId: string, id: string, index: number, content: PageContent, lite = false) {
  const book = await owned(userId, id);
  if (!book) return null;
  if (index < 0 || index >= book.pageCount) throw new NotebookError('Esa página no existe en la libreta.');
  if (lite) await assertLiteEdit(id, index, content);
  const where = { notebookId_index: { notebookId: id, index } };
  const json = content as unknown as Prisma.InputJsonValue;
  const page = isEmptyPage(content)
    ? (await prisma.notebookPage.deleteMany({ where: { notebookId: id, index } }), null)
    : await prisma.notebookPage.upsert({ where, create: { notebookId: id, index, content: json }, update: { content: json }, select: { index: true, content: true, updatedAt: true } });
  // La libreta usada más reciente sale primero en la estantería.
  await prisma.notebook.update({ where: { id }, data: { updatedAt: new Date() } });
  return { page };
}

/**
 * En Lite se escribe, pero no se añaden trazos, imágenes ni notas de color (eso es
 * de Pro). Lo ya guardado se conserva y se puede quitar.
 */
async function assertLiteEdit(notebookId: string, index: number, content: PageContent) {
  const stored = await prisma.notebookPage.findUnique({ where: { notebookId_index: { notebookId, index } }, select: { content: true } });
  const before = (stored?.content ?? {}) as Partial<PageContent>;
  if (content.strokes.length > (before.strokes?.length ?? 0)) throw locked('notebook-draw');
  if (content.images.length > (before.images?.length ?? 0)) throw locked('notebook-images');
  const colors = new Map<string, string>((before.stickies ?? []).map((s): [string, string] => [s.id, s.color]));
  if (content.stickies.some((s) => s.color !== 'yellow' && colors.get(s.id) !== s.color)) throw locked('notebook-stickies');
}

export async function addImage(userId: string, id: string, input: NotebookImageInput, lite = false) {
  const book = await owned(userId, id);
  if (!book) return null;
  if (lite) throw locked('notebook-images');
  if ((await prisma.notebookImage.count({ where: { notebookId: id } })) >= MAX_IMAGES_PER_NOTEBOOK) {
    throw new NotebookError(`Una libreta admite hasta ${MAX_IMAGES_PER_NOTEBOOK} imágenes.`, 409);
  }
  return prisma.notebookImage.create({ data: { notebookId: id, ...input }, select: { id: true, mime: true } });
}

export function getImage(userId: string, id: string, imageId: string) {
  return prisma.notebookImage.findFirst({ where: { id: imageId, notebookId: id, notebook: { userId } }, select: { id: true, mime: true, data: true } });
}

export async function deleteImage(userId: string, id: string, imageId: string): Promise<boolean> {
  const { count } = await prisma.notebookImage.deleteMany({ where: { id: imageId, notebookId: id, notebook: { userId } } });
  return count > 0;
}
