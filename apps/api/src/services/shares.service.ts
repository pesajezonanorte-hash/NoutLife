import { prisma } from '../lib/prisma';

export type ShareResourceType = 'CHECKLIST' | 'GOAL';
export type SharePermission = 'VIEW' | 'EDIT';
const validType = (value: string): value is ShareResourceType => value === 'CHECKLIST' || value === 'GOAL';
const validPermission = (value: string): value is SharePermission => value === 'VIEW' || value === 'EDIT';

async function ownedResourceExists(ownerId: string, resourceType: ShareResourceType, resourceId: string) {
  if (resourceType === 'CHECKLIST') return Boolean(await prisma.checklist.findFirst({ where: { id: resourceId, userId: ownerId }, select: { id: true } }));
  return Boolean(await prisma.masterGoal.findFirst({ where: { id: resourceId, userId: ownerId }, select: { id: true } }));
}

export async function createShare(ownerId: string, resourceTypeInput: string, resourceId: string, permissionInput: string) {
  if (!validType(resourceTypeInput) || !validPermission(permissionInput)) throw new Error('INVALID_SHARE_OPTIONS');
  if (!await ownedResourceExists(ownerId, resourceTypeInput, resourceId)) throw new Error('SHARE_RESOURCE_NOT_FOUND');
  return prisma.resourceShare.upsert({
    where: { ownerId_resourceType_resourceId: { ownerId, resourceType: resourceTypeInput, resourceId } },
    create: { ownerId, resourceType: resourceTypeInput, resourceId, permission: permissionInput, isActive: true },
    update: { permission: permissionInput, isActive: true },
    select: { id: true, resourceType: true, resourceId: true, code: true, permission: true, isActive: true, updatedAt: true },
  });
}

export async function getOwnerShare(ownerId: string, resourceType: string, resourceId: string) {
  if (!validType(resourceType)) throw new Error('INVALID_SHARE_OPTIONS');
  return prisma.resourceShare.findFirst({
    where: { ownerId, resourceType, resourceId },
    select: { id: true, resourceType: true, resourceId: true, code: true, permission: true, isActive: true, updatedAt: true },
  });
}

export async function revokeShare(ownerId: string, resourceType: string, resourceId: string) {
  if (!validType(resourceType)) throw new Error('INVALID_SHARE_OPTIONS');
  await prisma.resourceShare.updateMany({ where: { ownerId, resourceType, resourceId }, data: { isActive: false } });
}

export async function resolveShare(code: string) {
  const share = await prisma.resourceShare.findFirst({ where: { code, isActive: true } });
  if (!share) throw new Error('SHARE_NOT_FOUND');
  if (share.resourceType === 'CHECKLIST') {
    const resource = await prisma.checklist.findUnique({
      where: { id: share.resourceId },
      select: { id: true, title: true, description: true, category: true, isTemplate: true, items: { orderBy: { order: 'asc' } } },
    });
    if (!resource) throw new Error('SHARE_NOT_FOUND');
    return { resourceType: 'CHECKLIST' as const, permission: share.permission as SharePermission, resource };
  }
  if (share.resourceType === 'GOAL') {
    const resource = await prisma.masterGoal.findUnique({
      where: { id: share.resourceId },
      select: { id: true, title: true, description: true, category: true, icon: true, targetDate: true, why: true, status: true, progress: true, milestones: { orderBy: { order: 'asc' } } },
    });
    if (!resource) throw new Error('SHARE_NOT_FOUND');
    return { resourceType: 'GOAL' as const, permission: share.permission as SharePermission, resource };
  }
  throw new Error('SHARE_NOT_FOUND');
}

export async function updateSharedResource(code: string, userId: string | undefined, body: Record<string, unknown>) {
  const share = await prisma.resourceShare.findFirst({ where: { code, isActive: true } });
  if (!share) throw new Error('SHARE_NOT_FOUND');
  if (share.permission !== 'EDIT' && share.ownerId !== userId) throw new Error('SHARE_READ_ONLY');
  if (share.resourceType === 'CHECKLIST') {
    const itemId = typeof body.itemId === 'string' ? body.itemId : '';
    if (!itemId || (body.isDone === undefined && body.title === undefined)) throw new Error('INVALID_SHARED_CHANGE');
    const item = await prisma.checklistItem.findFirst({ where: { id: itemId, checklistId: share.resourceId }, select: { id: true } });
    if (!item) throw new Error('SHARE_RESOURCE_NOT_FOUND');
    if (body.isDone !== undefined && typeof body.isDone !== 'boolean') throw new Error('INVALID_SHARED_CHANGE');
    if (body.title !== undefined && (typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 160)) throw new Error('INVALID_SHARED_CHANGE');
    const updated = await prisma.checklistItem.update({
      where: { id: itemId },
      data: { ...(body.isDone !== undefined && { isDone: body.isDone }), ...(body.title !== undefined && { title: body.title.trim() }) },
    });
    return { resourceType: 'CHECKLIST' as const, updated };
  }
  if (share.resourceType === 'GOAL') {
    const milestoneId = typeof body.milestoneId === 'string' ? body.milestoneId : '';
    if (!milestoneId || typeof body.isCompleted !== 'boolean') throw new Error('INVALID_SHARED_CHANGE');
    const milestone = await prisma.goalMilestone.findFirst({ where: { id: milestoneId, goalId: share.resourceId }, select: { id: true } });
    if (!milestone) throw new Error('SHARE_RESOURCE_NOT_FOUND');
    await prisma.goalMilestone.update({
      where: { id: milestoneId },
      data: { isCompleted: body.isCompleted, completedAt: body.isCompleted ? new Date() : null },
    });
    const [milestones, currentGoal] = await Promise.all([
      prisma.goalMilestone.findMany({ where: { goalId: share.resourceId }, select: { isCompleted: true } }),
      prisma.masterGoal.findUnique({ where: { id: share.resourceId }, select: { status: true } }),
    ]);
    if (!currentGoal) throw new Error('SHARE_RESOURCE_NOT_FOUND');
    const progress = milestones.length ? Math.round(milestones.filter((m) => m.isCompleted).length * 100 / milestones.length) : 0;
    const goal = await prisma.masterGoal.update({
      where: { id: share.resourceId },
      data: {
        progress,
        status: progress === 100 ? 'ACHIEVED' : currentGoal.status === 'PAUSED' ? 'PAUSED' : 'ACTIVE',
        achievedAt: progress === 100 ? new Date() : null,
      },
      select: { id: true, progress: true, status: true },
    });
    return { resourceType: 'GOAL' as const, updated: goal };
  }
  throw new Error('SHARE_NOT_FOUND');
}
