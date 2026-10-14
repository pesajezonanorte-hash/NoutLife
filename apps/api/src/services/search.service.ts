import { prisma } from '../lib/prisma';

export interface SearchResult {
  type: 'quest' | 'habit' | 'transaction' | 'journal' | 'workout' | 'event';
  id: string;
  title: string;
  subtitle?: string;
  link: string;
  icon: string;
}

export async function globalSearch(userId: string, query: string): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) return [];
  const q = query.trim();

  const [quests, habits, transactions, journals, workouts, events] = await Promise.all([
    prisma.quest.findMany({
      where: { userId, title: { contains: q, mode: 'insensitive' } },
      take: 5,
      select: { id: true, title: true, type: true, status: true },
    }),
    prisma.habit.findMany({
      where: { userId, title: { contains: q, mode: 'insensitive' }, isActive: true },
      take: 5,
      select: { id: true, title: true, category: true },
    }),
    prisma.transaction.findMany({
      where: { userId, description: { contains: q, mode: 'insensitive' } },
      take: 5,
      select: { id: true, description: true, amount: true, type: true },
    }),
    prisma.journalEntry.findMany({
      where: { userId, title: { contains: q, mode: 'insensitive' } },
      take: 5,
      select: { id: true, title: true, createdAt: true },
    }),
    prisma.workout.findMany({
      where: { userId, title: { contains: q, mode: 'insensitive' } },
      take: 5,
      select: { id: true, title: true, date: true },
    }),
    prisma.agendaEvent.findMany({
      where: { userId, title: { contains: q, mode: 'insensitive' } },
      take: 5,
      select: { id: true, title: true, startDate: true },
    }),
  ]);

  const results: SearchResult[] = [
    ...quests.map((q) => ({
      type: 'quest' as const,
      id: q.id,
      title: q.title,
      subtitle: `${q.type} · ${q.status}`,
      link: '/quests',
      icon: '📜',
    })),
    ...habits.map((h) => ({
      type: 'habit' as const,
      id: h.id,
      title: h.title,
      subtitle: h.category ?? undefined,
      link: '/habits',
      icon: '🔥',
    })),
    ...transactions.map((t) => ({
      type: 'transaction' as const,
      id: t.id,
      title: t.description ?? 'Transacción',
      subtitle: `${t.type === 'INCOME' ? '+' : '-'}$${Number(t.amount).toLocaleString('es-CO')}`,
      link: '/finances',
      icon: '💰',
    })),
    ...journals.map((j) => ({
      type: 'journal' as const,
      id: j.id,
      title: j.title ?? 'Entrada',
      subtitle: new Date(j.createdAt).toLocaleDateString('es-CO'),
      link: '/journal',
      icon: '📖',
    })),
    ...workouts.map((w) => ({
      type: 'workout' as const,
      id: w.id,
      title: w.title,
      subtitle: new Date(w.date).toLocaleDateString('es-CO'),
      link: '/coliseo',
      icon: '💪',
    })),
    ...events.map((e) => ({
      type: 'event' as const,
      id: e.id,
      title: e.title,
      subtitle: new Date(e.startDate).toLocaleDateString('es-CO'),
      link: '/agenda',
      icon: '📅',
    })),
  ];

  return results;
}
