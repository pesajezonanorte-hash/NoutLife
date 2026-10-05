import { prisma } from '../lib/prisma';
import { accessibleRelationship, gardenLinks, PARTNER_OF } from './network.service';

export async function listRelationships(userId: string) {
  return prisma.relationship.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
}

export async function createRelationship(userId: string, body: { name: string; type: string; isPartner?: boolean; notes?: string }) {
  return prisma.relationship.create({
    data: {
      userId,
      name: body.name,
      type: body.type,
      isPartner: body.isPartner ?? false,
      notes: body.notes,
      importantDates: [],
    },
  });
}

export async function updateRelationship(userId: string, id: string, body: Record<string, unknown>) {
  // El jardín compartido lo pueden editar los dos.
  const rel = await prisma.relationship.findFirst({ where: accessibleRelationship(userId, id), select: { id: true } });
  if (!rel) throw new Error('No encontrado');
  return prisma.relationship.update({
    where: { id: rel.id },
    data: {
      ...(body.name ? { name: body.name as string } : {}),
      ...(body.type ? { type: body.type as string } : {}),
      ...(body.isPartner !== undefined ? { isPartner: body.isPartner as boolean } : {}),
      ...(body.notes !== undefined ? { notes: body.notes as string } : {}),
      ...(body.importantDates ? { importantDates: body.importantDates as never } : {}),
    },
  });
}

export async function deleteRelationship(userId: string, id: string) {
  return prisma.relationship.delete({ where: { id, userId } });
}

export interface ImportantDateData {
  id: string;
  label: string;
  date: string;
  isRecurring: boolean;
  emoji?: string;
}

export async function getImportantDates(userId: string, relationshipId: string) {
  const rel = await prisma.relationship.findFirst({ where: accessibleRelationship(userId, relationshipId) });
  return (rel?.importantDates as unknown as ImportantDateData[]) ?? [];
}

export async function addImportantDate(userId: string, relationshipId: string, body: { label: string; date: string; isRecurring?: boolean; emoji?: string }) {
  const rel = await prisma.relationship.findFirst({ where: accessibleRelationship(userId, relationshipId) });
  if (!rel) throw new Error('No encontrado');

  const dates = (rel.importantDates as unknown as ImportantDateData[]) ?? [];
  const newDate: ImportantDateData = {
    id: Math.random().toString(36).slice(2),
    label: body.label,
    date: body.date,
    isRecurring: body.isRecurring ?? false,
    emoji: body.emoji,
  };

  return prisma.relationship.update({
    where: { id: relationshipId },
    data: { importantDates: [...dates, newDate] as never },
  });
}

export async function updateImportantDate(userId: string, relationshipId: string, dateId: string, body: Partial<ImportantDateData>) {
  const rel = await prisma.relationship.findFirst({ where: accessibleRelationship(userId, relationshipId) });
  if (!rel) throw new Error('No encontrado');

  const dates = (rel.importantDates as unknown as ImportantDateData[]) ?? [];
  const updated = dates.map(d => d.id === dateId ? { ...d, ...body } : d);

  return prisma.relationship.update({ where: { id: relationshipId }, data: { importantDates: updated as never } });
}

export async function deleteImportantDate(userId: string, relationshipId: string, dateId: string) {
  const rel = await prisma.relationship.findFirst({ where: accessibleRelationship(userId, relationshipId) });
  if (!rel) throw new Error('No encontrado');

  const dates = (rel.importantDates as unknown as ImportantDateData[]) ?? [];
  const filtered = dates.filter(d => d.id !== dateId);

  return prisma.relationship.update({ where: { id: relationshipId }, data: { importantDates: filtered as never } });
}

// ─── Gift Ideas ───────────────────────────────────────────────────────────────

export async function getGiftIdeas(userId: string, relationshipId?: string) {
  return prisma.giftIdea.findMany({
    where: { userId, ...(relationshipId ? { relationshipId } : {}) },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createGiftIdea(userId: string, data: { relationshipId?: string; name: string; description?: string; url?: string; estimatedPrice?: number; occasion?: string }) {
  return prisma.giftIdea.create({
    data: { userId, ...data, estimatedPrice: data.estimatedPrice ?? null },
  });
}

export async function updateGiftIdea(userId: string, id: string, data: Partial<{ name: string; description: string; url: string; estimatedPrice: number; occasion: string; isPurchased: boolean }>) {
  return prisma.giftIdea.updateMany({ where: { id, userId }, data });
}

export async function deleteGiftIdea(userId: string, id: string) {
  return prisma.giftIdea.deleteMany({ where: { id, userId } });
}

export async function getLoveDashboard(userId: string) {
  const partner = await prisma.relationship.findFirst({ where: PARTNER_OF(userId), orderBy: { createdAt: 'asc' } });
  const links = await gardenLinks(userId, partner);

  let nextImportantDate = null;
  if (partner) {
    const dates = (partner.importantDates as unknown as ImportantDateData[]) ?? [];
    const now = new Date();
    const upcoming = dates
      .map(d => {
        let targetDate = new Date(d.date);
        if (d.isRecurring) {
          targetDate.setFullYear(now.getFullYear());
          if (targetDate < now) targetDate.setFullYear(now.getFullYear() + 1);
        }
        const daysUntil = Math.ceil((targetDate.getTime() - now.getTime()) / 86400000);
        return { ...d, daysUntil, relationshipId: partner.id };
      })
      .filter(d => d.daysUntil >= 0)
      .sort((a, b) => a.daysUntil - b.daysUntil);

    nextImportantDate = upcoming[0] ?? null;
  }

  return { relationship: partner ? { ...partner, createdAt: partner.createdAt.toISOString(), updatedAt: partner.updatedAt.toISOString() } : null, nextImportantDate, ...links };
}
