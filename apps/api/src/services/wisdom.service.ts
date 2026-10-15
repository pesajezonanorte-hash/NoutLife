import { createHash } from 'node:crypto';
import { prisma } from '../lib/prisma';
import { WISDOM_QUOTES } from '../lib/wisdom-quotes';

/** Id estable por cita: los guardados del usuario sobreviven a cada despliegue. */
const idOf = (q: { quote: string; author: string }) => 'wc_' + createHash('sha1').update(q.author + '|' + q.quote).digest('hex').slice(0, 20);

/** Deja wisdom_cards igual a WISDOM_QUOTES (idempotente y seguro en paralelo). */
export async function seedWisdomCards() {
  const rows = WISDOM_QUOTES.map((q) => ({ id: idOf(q), ...q }));
  await prisma.wisdomCard.deleteMany({ where: { id: { notIn: rows.map((r) => r.id) } } });
  await prisma.wisdomCard.createMany({ data: rows, skipDuplicates: true });
}

export async function getDailyCard(userLevel: number) {
  // Orden por id (hash): el repertorio rota mezclado, sin agrupar autores ni temas.
  const available = await prisma.wisdomCard.findMany({
    where: { levelRequired: { lte: userLevel } },
    orderBy: { id: 'asc' },
  });
  if (available.length === 0) return null;
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  return available[dayOfYear % available.length];
}

export async function listAvailableCards(userLevel: number) {
  return prisma.wisdomCard.findMany({
    where: { levelRequired: { lte: userLevel } },
    orderBy: [{ levelRequired: 'asc' }, { category: 'asc' }],
  });
}

export async function listLockedCards(userLevel: number) {
  return prisma.wisdomCard.findMany({
    where: { levelRequired: { gt: userLevel } },
    select: { id: true, category: true, levelRequired: true },
    orderBy: { levelRequired: 'asc' },
  });
}
