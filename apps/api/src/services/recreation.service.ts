import type { RecreationEntry } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { awardXpAndGold, type AwardResult } from './xp.service';
import type { RECREATION_KINDS, RECREATION_STATUSES } from '../schemas/activity.schemas';

/** Una función vivida da XP y oro (Carisma al subir de nivel: el ocio también es vida social). */
export const RECREATION_XP = 15;
export const RECREATION_GOLD = 3;
// ponytail: ventana móvil de 24 h contada en xp_events (sobrevive a borrar y
// volver a crear); por día del calendario del usuario si hiciera falta precisión.
export const RECREATION_REWARDS_PER_DAY = 3;

export interface RecreationInput {
  title?: string;
  kind?: (typeof RECREATION_KINDS)[number];
  status?: (typeof RECREATION_STATUSES)[number];
  rating?: number | null;
  minutes?: number | null;
  notes?: string | null;
  date?: string;
}

/** «2026-10-13» cae al mediodía UTC: el mismo día del calendario en cualquier zona de América. */
function parseDate(value?: string): Date {
  if (!value) return new Date();
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return day ? new Date(Date.UTC(Number(day[1]), Number(day[2]) - 1, Number(day[3]), 12)) : new Date(value);
}

/** Lo planeado (cartelera) y lo vivido en los últimos 6 meses. */
export function listRecreation(userId: string) {
  const since = new Date(Date.now() - 180 * 86_400_000);
  return prisma.recreationEntry.findMany({
    where: { userId, OR: [{ status: 'PLANNED' }, { date: { gte: since } }] },
    orderBy: { date: 'desc' },
    take: 300,
  });
}

async function rewardIfDone(userId: string, entry: RecreationEntry): Promise<AwardResult | null> {
  if (entry.status !== 'DONE' || entry.xpEarned > 0) return null;
  const recent = await prisma.xpEvent.count({
    where: { userId, source: 'recreation', createdAt: { gte: new Date(Date.now() - 86_400_000) } },
  });
  if (recent >= RECREATION_REWARDS_PER_DAY) return null;
  const award = await awardXpAndGold(userId, RECREATION_XP, RECREATION_GOLD, 'recreation', {
    sourceId: entry.id,
    description: `Recreación: ${entry.title}`,
    category: 'SOCIAL',
  });
  await prisma.recreationEntry.update({ where: { id: entry.id }, data: { xpEarned: award.xpGained } });
  entry.xpEarned = award.xpGained;
  return award;
}

export async function createRecreation(userId: string, input: RecreationInput & { title: string; kind: string }) {
  const entry = await prisma.recreationEntry.create({
    data: {
      userId,
      title: input.title,
      kind: input.kind,
      status: input.status ?? 'DONE',
      rating: input.rating ?? null,
      minutes: input.minutes ?? null,
      notes: input.notes || null,
      date: parseDate(input.date),
    },
  });
  const rewards = await rewardIfDone(userId, entry);
  return { entry, rewards };
}

/** null si no existe o es de otra persona. Pasar de «por ver» a «vista» da la recompensa. */
export async function updateRecreation(userId: string, id: string, input: RecreationInput) {
  const owned = await prisma.recreationEntry.findFirst({ where: { id, userId }, select: { id: true } });
  if (!owned) return null;
  const entry = await prisma.recreationEntry.update({
    where: { id },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.kind !== undefined && { kind: input.kind }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.rating !== undefined && { rating: input.rating }),
      ...(input.minutes !== undefined && { minutes: input.minutes }),
      ...(input.notes !== undefined && { notes: input.notes || null }),
      ...(input.date !== undefined && { date: parseDate(input.date) }),
    },
  });
  const rewards = await rewardIfDone(userId, entry);
  return { entry, rewards };
}

export async function deleteRecreation(userId: string, id: string) {
  const { count } = await prisma.recreationEntry.deleteMany({ where: { id, userId } });
  return count > 0;
}
