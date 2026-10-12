import { randomBytes } from 'crypto';
import { prisma } from '../lib/prisma';
import { isBlocked } from './chat-live.service';
import { createNotification } from './notification.service';

export type ChecklistRole = 'OWNER' | 'EDIT' | 'VIEW';
export type SharePermission = 'VIEW' | 'EDIT';

const MAX_ITEMS = 300;
const OWNER_SELECT = { id: true, username: true, displayName: true, avatarUrl: true } as const;

export class ChecklistError extends Error {
  constructor(public code: 'NOT_FOUND' | 'FORBIDDEN' | 'BAD_REQUEST', message: string) {
    super(message);
  }
}

/** Rol de la persona en la lista: dueña, editora o lectora. Sin acceso → NOT_FOUND (no se revela que existe). */
async function roleIn(userId: string, checklistId: string): Promise<ChecklistRole> {
  const list = await prisma.checklist.findUnique({ where: { id: checklistId }, select: { userId: true } });
  if (!list) throw new ChecklistError('NOT_FOUND', 'Lista no encontrada.');
  if (list.userId === userId) return 'OWNER';
  const share = await prisma.checklistShare.findFirst({ where: { checklistId, userId }, select: { permission: true } });
  if (!share) throw new ChecklistError('NOT_FOUND', 'Lista no encontrada.');
  return share.permission === 'EDIT' ? 'EDIT' : 'VIEW';
}

async function requireEdit(userId: string, checklistId: string) {
  const role = await roleIn(userId, checklistId);
  if (role === 'VIEW') throw new ChecklistError('FORBIDDEN', 'Solo puedes ver esta lista.');
  return role;
}

async function requireOwner(userId: string, checklistId: string) {
  const role = await roleIn(userId, checklistId);
  if (role !== 'OWNER') throw new ChecklistError('FORBIDDEN', 'Solo la persona dueña puede hacer esto.');
}

const touch = (checklistId: string) => prisma.checklist.update({ where: { id: checklistId }, data: { updatedAt: new Date() } });

const withItems = { items: { orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }] }, user: { select: OWNER_SELECT } };

type ListRow = Awaited<ReturnType<typeof loadList>>;
async function loadList(checklistId: string) {
  return prisma.checklist.findUniqueOrThrow({
    where: { id: checklistId },
    include: { ...withItems, _count: { select: { shares: { where: { userId: { not: null } } } } } },
  });
}

function present(list: ListRow, role: ChecklistRole) {
  return {
    id: list.id,
    name: list.name,
    category: list.category,
    createdAt: list.createdAt.toISOString(),
    updatedAt: list.updatedAt.toISOString(),
    role,
    owner: list.user,
    memberCount: list._count.shares,
    items: list.items.map((item) => ({ id: item.id, text: item.text, done: item.done, position: item.position })),
  };
}

export async function listChecklists(userId: string) {
  const [owned, shared] = await Promise.all([
    prisma.checklist.findMany({
      where: { userId },
      include: { ...withItems, _count: { select: { shares: { where: { userId: { not: null } } } } } },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.checklistShare.findMany({
      where: { userId },
      include: { checklist: { include: { ...withItems, _count: { select: { shares: { where: { userId: { not: null } } } } } } } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  return [
    ...owned.map((list) => present(list, 'OWNER')),
    ...shared.map((share) => present(share.checklist, share.permission === 'EDIT' ? 'EDIT' : 'VIEW')),
  ];
}

export async function getChecklist(userId: string, checklistId: string) {
  const role = await roleIn(userId, checklistId);
  return present(await loadList(checklistId), role);
}

export async function createChecklist(userId: string, input: { name: string; category: string; items?: string[] }) {
  const items = (input.items ?? []).slice(0, MAX_ITEMS);
  const list = await prisma.checklist.create({
    data: {
      userId,
      name: input.name,
      category: input.category,
      items: { create: items.map((text, position) => ({ text, position })) },
    },
  });
  return present(await loadList(list.id), 'OWNER');
}

export async function updateChecklist(userId: string, checklistId: string, input: { name?: string; category?: string }) {
  const role = await requireEdit(userId, checklistId);
  await prisma.checklist.update({ where: { id: checklistId }, data: input });
  return present(await loadList(checklistId), role);
}

export async function deleteChecklist(userId: string, checklistId: string) {
  await requireOwner(userId, checklistId);
  await prisma.checklist.delete({ where: { id: checklistId } });
}

/** Quien recibió la lista puede salir de ella (la dueña la borra con deleteChecklist). */
export async function leaveChecklist(userId: string, checklistId: string) {
  const role = await roleIn(userId, checklistId);
  if (role === 'OWNER') throw new ChecklistError('BAD_REQUEST', 'Eres la persona dueña: elimina la lista en su lugar.');
  await prisma.checklistShare.deleteMany({ where: { checklistId, userId } });
}

export async function addItem(userId: string, checklistId: string, text: string) {
  const role = await requireEdit(userId, checklistId);
  const count = await prisma.checklistItem.count({ where: { checklistId } });
  if (count >= MAX_ITEMS) throw new ChecklistError('BAD_REQUEST', `Una lista admite hasta ${MAX_ITEMS} elementos.`);
  const last = await prisma.checklistItem.findFirst({ where: { checklistId }, orderBy: { position: 'desc' }, select: { position: true } });
  await prisma.checklistItem.create({ data: { checklistId, text, position: (last?.position ?? -1) + 1 } });
  await touch(checklistId);
  return present(await loadList(checklistId), role);
}

export async function updateItem(userId: string, checklistId: string, itemId: string, input: { text?: string; done?: boolean }) {
  const role = await requireEdit(userId, checklistId);
  const result = await prisma.checklistItem.updateMany({ where: { id: itemId, checklistId }, data: input });
  if (result.count === 0) throw new ChecklistError('NOT_FOUND', 'Elemento no encontrado.');
  await touch(checklistId);
  return present(await loadList(checklistId), role);
}

export async function deleteItem(userId: string, checklistId: string, itemId: string) {
  const role = await requireEdit(userId, checklistId);
  await prisma.checklistItem.deleteMany({ where: { id: itemId, checklistId } });
  await touch(checklistId);
  return present(await loadList(checklistId), role);
}

export async function reorderItems(userId: string, checklistId: string, ids: string[]) {
  const role = await requireEdit(userId, checklistId);
  const existing = await prisma.checklistItem.findMany({ where: { checklistId }, select: { id: true } });
  const known = new Set(existing.map((item) => item.id));
  const ordered = [...new Set(ids)].filter((id) => known.has(id));
  const rest = existing.map((item) => item.id).filter((id) => !ordered.includes(id));
  await prisma.$transaction([...ordered, ...rest].map((id, position) => prisma.checklistItem.update({ where: { id }, data: { position } })));
  await touch(checklistId);
  return present(await loadList(checklistId), role);
}

export async function clearDone(userId: string, checklistId: string) {
  const role = await requireEdit(userId, checklistId);
  await prisma.checklistItem.deleteMany({ where: { checklistId, done: true } });
  await touch(checklistId);
  return present(await loadList(checklistId), role);
}

// ─── Compartir ───────────────────────────────────────────────────────────────

export async function listShares(userId: string, checklistId: string) {
  await requireOwner(userId, checklistId);
  const shares = await prisma.checklistShare.findMany({ where: { checklistId }, orderBy: { createdAt: 'asc' } });
  const userIds = shares.map((s) => s.userId).filter((id): id is string => Boolean(id));
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: OWNER_SELECT });
  const byId = new Map(users.map((u) => [u.id, u]));
  return {
    links: shares.filter((s) => !s.userId).map((s) => ({ id: s.id, token: s.token, permission: s.permission as SharePermission, createdAt: s.createdAt.toISOString() })),
    members: shares.filter((s) => s.userId && byId.has(s.userId)).map((s) => ({ id: s.id, permission: s.permission as SharePermission, user: byId.get(s.userId!)! })),
  };
}

export async function createShareLink(userId: string, checklistId: string, permission: SharePermission) {
  await requireOwner(userId, checklistId);
  await prisma.checklistShare.create({ data: { checklistId, permission, token: randomBytes(18).toString('base64url') } });
  return listShares(userId, checklistId);
}

export async function shareWithUser(userId: string, checklistId: string, input: { user: string; permission: SharePermission }) {
  await requireOwner(userId, checklistId);
  const handle = input.user.trim().replace(/^@/, '');
  const target = await prisma.user.findFirst({
    where: { OR: [{ id: handle }, { username: { equals: handle, mode: 'insensitive' } }] },
    select: { id: true, displayName: true },
  });
  if (!target) throw new ChecklistError('NOT_FOUND', 'No encontramos a esa persona.');
  if (target.id === userId) throw new ChecklistError('BAD_REQUEST', 'Esta lista ya es tuya.');
  if (await isBlocked(userId, target.id)) throw new ChecklistError('NOT_FOUND', 'No encontramos a esa persona.');

  const existing = await prisma.checklistShare.findFirst({ where: { checklistId, userId: target.id } });
  if (existing) {
    await prisma.checklistShare.update({ where: { id: existing.id }, data: { permission: input.permission } });
  } else {
    await prisma.checklistShare.create({ data: { checklistId, userId: target.id, permission: input.permission, token: randomBytes(18).toString('base64url') } });
    const [list, owner] = await Promise.all([
      prisma.checklist.findUnique({ where: { id: checklistId }, select: { name: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } }),
    ]);
    createNotification(target.id, {
      type: 'social',
      category: 'SOCIAL',
      title: 'Te compartieron una lista',
      body: `${owner?.displayName ?? 'Alguien'} te compartió «${list?.name ?? 'una lista'}».`,
      link: `/checklists?list=${checklistId}`,
    }).catch(() => null);
  }
  return listShares(userId, checklistId);
}

export async function updateShare(userId: string, checklistId: string, shareId: string, permission: SharePermission) {
  await requireOwner(userId, checklistId);
  const result = await prisma.checklistShare.updateMany({ where: { id: shareId, checklistId }, data: { permission } });
  if (result.count === 0) throw new ChecklistError('NOT_FOUND', 'No encontramos ese acceso.');
  return listShares(userId, checklistId);
}

export async function revokeShare(userId: string, checklistId: string, shareId: string) {
  await requireOwner(userId, checklistId);
  await prisma.checklistShare.deleteMany({ where: { id: shareId, checklistId } });
  return listShares(userId, checklistId);
}

/** Enlace de invitación: solo las filas sin persona asignada sirven como enlace. */
async function linkByToken(token: string) {
  const link = await prisma.checklistShare.findUnique({
    where: { token },
    include: { checklist: { include: { user: { select: OWNER_SELECT }, _count: { select: { items: true } } } } },
  });
  if (!link || link.userId) throw new ChecklistError('NOT_FOUND', 'Este enlace ya no es válido.');
  return link;
}

export async function previewJoin(userId: string, token: string) {
  const link = await linkByToken(token);
  const list = link.checklist;
  const already = list.userId === userId || Boolean(await prisma.checklistShare.findFirst({ where: { checklistId: list.id, userId }, select: { id: true } }));
  return {
    checklistId: list.id,
    name: list.name,
    category: list.category,
    owner: list.user,
    itemCount: list._count.items,
    permission: link.permission as SharePermission,
    alreadyMember: already,
  };
}

export async function joinByToken(userId: string, token: string) {
  const link = await linkByToken(token);
  const list = link.checklist;
  if (list.userId !== userId) {
    if (await isBlocked(userId, list.userId)) throw new ChecklistError('NOT_FOUND', 'Este enlace ya no es válido.');
    const existing = await prisma.checklistShare.findFirst({ where: { checklistId: list.id, userId } });
    if (!existing) {
      await prisma.checklistShare.create({ data: { checklistId: list.id, userId, permission: link.permission, token: randomBytes(18).toString('base64url') } });
    } else if (existing.permission === 'VIEW' && link.permission === 'EDIT') {
      await prisma.checklistShare.update({ where: { id: existing.id }, data: { permission: 'EDIT' } });
    }
  }
  return getChecklist(userId, list.id);
}
