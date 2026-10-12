import { prisma } from '../lib/prisma';

const checklistInclude = { items: { orderBy: { order: 'asc' as const } } };

export async function listChecklists(userId: string) {
  return prisma.checklist.findMany({
    where: { userId },
    include: checklistInclude,
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
  });
}

export async function getChecklist(userId: string, id: string) {
  const checklist = await prisma.checklist.findFirst({ where: { id, userId }, include: checklistInclude });
  if (!checklist) throw new Error('CHECKLIST_NOT_FOUND');
  return checklist;
}

export async function createChecklist(userId: string, input: {
  title: string; description?: string; category?: string; isTemplate?: boolean;
  items?: Array<{ title: string }>;
}) {
  return prisma.checklist.create({
    data: {
      userId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      category: input.category?.trim() || 'personal',
      isTemplate: input.isTemplate ?? false,
      items: input.items?.length ? {
        create: input.items.map((item, order) => ({ title: item.title.trim(), order })),
      } : undefined,
    },
    include: checklistInclude,
  });
}

export async function updateChecklist(userId: string, id: string, input: {
  title?: string; description?: string | null; category?: string; isTemplate?: boolean;
}) {
  const checklist = await prisma.checklist.findFirst({ where: { id, userId }, select: { id: true } });
  if (!checklist) throw new Error('CHECKLIST_NOT_FOUND');
  return prisma.checklist.update({
    where: { id },
    data: {
      ...(input.title !== undefined && { title: input.title.trim() }),
      ...(input.description !== undefined && { description: input.description?.trim() || null }),
      ...(input.category !== undefined && { category: input.category.trim() }),
      ...(input.isTemplate !== undefined && { isTemplate: input.isTemplate }),
    },
    include: checklistInclude,
  });
}

export async function deleteChecklist(userId: string, id: string) {
  const result = await prisma.checklist.deleteMany({ where: { id, userId } });
  if (!result.count) throw new Error('CHECKLIST_NOT_FOUND');
  await prisma.resourceShare.updateMany({
    where: { ownerId: userId, resourceType: 'CHECKLIST', resourceId: id },
    data: { isActive: false },
  });
}

export async function duplicateChecklist(userId: string, id: string) {
  const original = await getChecklist(userId, id);
  return prisma.checklist.create({
    data: {
      userId,
      title: `${original.title} (copia)`.slice(0, 100),
      description: original.description,
      category: original.category,
      isTemplate: false,
      items: { create: original.items.map((item, order) => ({ title: item.title, order, isDone: false })) },
    },
    include: checklistInclude,
  });
}

export async function addChecklistItem(userId: string, checklistId: string, title: string) {
  const checklist = await prisma.checklist.findFirst({ where: { id: checklistId, userId }, select: { id: true } });
  if (!checklist) throw new Error('CHECKLIST_NOT_FOUND');
  const order = await prisma.checklistItem.count({ where: { checklistId } });
  return prisma.checklistItem.create({ data: { checklistId, title: title.trim(), order } });
}

export async function updateChecklistItem(userId: string, itemId: string, input: { title?: string; isDone?: boolean; order?: number }) {
  const item = await prisma.checklistItem.findFirst({ where: { id: itemId, checklist: { userId } }, select: { id: true } });
  if (!item) throw new Error('CHECKLIST_ITEM_NOT_FOUND');
  return prisma.checklistItem.update({
    where: { id: itemId },
    data: {
      ...(input.title !== undefined && { title: input.title.trim() }),
      ...(input.isDone !== undefined && { isDone: input.isDone }),
      ...(input.order !== undefined && { order: input.order }),
    },
  });
}

export async function deleteChecklistItem(userId: string, itemId: string) {
  const item = await prisma.checklistItem.findFirst({ where: { id: itemId, checklist: { userId } }, select: { id: true } });
  if (!item) throw new Error('CHECKLIST_ITEM_NOT_FOUND');
  await prisma.checklistItem.delete({ where: { id: itemId } });
}

export function cleanCategory(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 40;
}
