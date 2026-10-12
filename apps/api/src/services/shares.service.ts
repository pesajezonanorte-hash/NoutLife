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

const MEMBER_SELECT = {
  id: true, permission: true, createdAt: true,
  user: { select: { id: true, username: true, displayName: true } },
} as const;

export async function getOwnerShare(ownerId: string, resourceType: string, resourceId: string) {
  if (!validType(resourceType)) throw new Error('INVALID_SHARE_OPTIONS');
  return prisma.resourceShare.findFirst({
    where: { ownerId, resourceType, resourceId },
    select: { id: true, resourceType: true, resourceId: true, code: true, permission: true, isActive: true, updatedAt: true, members: { select: MEMBER_SELECT, orderBy: { createdAt: 'asc' } } },
  });
}

// ─── Colaboración por usuario o ID ───────────────────────────────────────────
// Además del enlace público, el dueño puede invitar a personas concretas por su
// @usuario o su ID. Los invitados entran sin el enlace (aunque esté desactivado)
// y ven la lista o meta en «Compartido conmigo».

export async function addShareMember(ownerId: string, resourceTypeInput: string, resourceId: string, who: string, permissionInput: string) {
  if (!validType(resourceTypeInput) || !validPermission(permissionInput)) throw new Error('INVALID_SHARE_OPTIONS');
  if (!await ownedResourceExists(ownerId, resourceTypeInput, resourceId)) throw new Error('SHARE_RESOURCE_NOT_FOUND');
  const handle = who.trim().replace(/^@/, '');
  if (!handle) throw new Error('SHARE_USER_NOT_FOUND');
  const user = await prisma.user.findFirst({
    where: { OR: [{ id: handle }, { username: { equals: handle, mode: 'insensitive' } }] },
    select: { id: true },
  });
  if (!user) throw new Error('SHARE_USER_NOT_FOUND');
  if (user.id === ownerId) throw new Error('SHARE_SELF');
  // La fila del recurso guarda también el enlace; si no existía, nace con el enlace apagado.
  const share = await prisma.resourceShare.upsert({
    where: { ownerId_resourceType_resourceId: { ownerId, resourceType: resourceTypeInput, resourceId } },
    create: { ownerId, resourceType: resourceTypeInput, resourceId, permission: 'VIEW', isActive: false },
    update: {},
    select: { id: true },
  });
  return prisma.resourceShareMember.upsert({
    where: { shareId_userId: { shareId: share.id, userId: user.id } },
    create: { shareId: share.id, userId: user.id, permission: permissionInput },
    update: { permission: permissionInput },
    select: MEMBER_SELECT,
  });
}

export async function removeShareMember(userId: string, memberId: string) {
  // El dueño puede quitar a cualquiera; un invitado puede salirse.
  const member = await prisma.resourceShareMember.findUnique({ where: { id: memberId }, select: { id: true, userId: true, share: { select: { ownerId: true } } } });
  if (!member || (member.share.ownerId !== userId && member.userId !== userId)) throw new Error('SHARE_MEMBER_NOT_FOUND');
  await prisma.resourceShareMember.delete({ where: { id: memberId } });
}

export async function listSharedWithMe(userId: string) {
  const rows = await prisma.resourceShareMember.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, permission: true, share: { select: { code: true, resourceType: true, resourceId: true, owner: { select: { username: true, displayName: true } } } } },
  });
  const checklistIds = rows.filter((r) => r.share.resourceType === 'CHECKLIST').map((r) => r.share.resourceId);
  const goalIds = rows.filter((r) => r.share.resourceType === 'GOAL').map((r) => r.share.resourceId);
  const [checklists, goals] = await Promise.all([
    prisma.checklist.findMany({ where: { id: { in: checklistIds } }, select: { id: true, title: true, category: true } }),
    prisma.masterGoal.findMany({ where: { id: { in: goalIds } }, select: { id: true, title: true, category: true } }),
  ]);
  const titles = new Map([...checklists, ...goals].map((r) => [r.id, r]));
  return rows.flatMap((row) => {
    const resource = titles.get(row.share.resourceId);
    if (!resource) return [];
    return [{
      memberId: row.id, code: row.share.code, resourceType: row.share.resourceType, permission: row.permission,
      title: resource.title, category: resource.category, owner: row.share.owner,
    }];
  });
}

/** Permiso efectivo de quien abre el código: dueño, invitado o cualquiera con el enlace activo. */
async function accessFor(share: { id: string; ownerId: string; permission: string; isActive: boolean }, userId?: string): Promise<SharePermission | null> {
  if (userId && share.ownerId === userId) return 'EDIT';
  const member = userId
    ? await prisma.resourceShareMember.findUnique({ where: { shareId_userId: { shareId: share.id, userId } }, select: { permission: true } })
    : null;
  if (member?.permission === 'EDIT' || (share.isActive && share.permission === 'EDIT')) return 'EDIT';
  if (member || share.isActive) return 'VIEW';
  return null;
}

export async function revokeShare(ownerId: string, resourceType: string, resourceId: string) {
  if (!validType(resourceType)) throw new Error('INVALID_SHARE_OPTIONS');
  await prisma.resourceShare.updateMany({ where: { ownerId, resourceType, resourceId }, data: { isActive: false } });
}

export async function resolveShare(code: string, userId?: string) {
  const found = await prisma.resourceShare.findFirst({ where: { code } });
  const permission = found ? await accessFor(found, userId) : null;
  if (!found || !permission) throw new Error('SHARE_NOT_FOUND');
  const share = { ...found, permission };
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
  const share = await prisma.resourceShare.findFirst({ where: { code } });
  const permission = share ? await accessFor(share, userId) : null;
  if (!share || !permission) throw new Error('SHARE_NOT_FOUND');
  if (permission !== 'EDIT') throw new Error('SHARE_READ_ONLY');
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
