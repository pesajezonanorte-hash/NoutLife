import { prisma } from '../lib/prisma';

export async function exportUserData(userId: string) {
  const [user, quests, habits, transactions, journals, workouts, sleep, meals, goals, checklists, antiHabits] =
    await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          displayName: true, email: true, level: true, xp: true,
          gold: true, currentStreak: true, createdAt: true,
          strength: true, intelligence: true, charisma: true,
        },
      }),
      prisma.quest.findMany({ where: { userId } }),
      prisma.habit.findMany({ where: { userId } }),
      prisma.transaction.findMany({ where: { userId }, orderBy: { date: 'desc' } }),
      prisma.journalEntry.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      prisma.workout.findMany({ where: { userId }, orderBy: { date: 'desc' } }),
      prisma.sleepLog.findMany({ where: { userId }, orderBy: { date: 'desc' } }),
      prisma.meal.findMany({ where: { userId }, orderBy: { date: 'desc' } }),
      prisma.masterGoal.findMany({ where: { userId } }),
      prisma.checklist.findMany({ where: { userId }, include: { items: true } }),
      prisma.antiHabit.findMany({ where: { userId }, include: { logs: { orderBy: { date: 'desc' } } } }),
    ]);

  return {
    exportedAt: new Date().toISOString(),
    version: '10.0.0',
    user,
    quests,
    habits,
    transactions,
    journals,
    workouts,
    sleep,
    meals,
    goals,
    checklists,
    antiHabits,
  };
}

export async function exportTransactionsCSV(userId: string): Promise<string> {
  const transactions = await prisma.transaction.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
    select: { date: true, description: true, amount: true, type: true, category: true },
  });

  const header = 'Fecha,Descripción,Monto,Tipo,Categoría';
  const rows = transactions.map((t) =>
    [
      new Date(t.date).toLocaleDateString('es-CO'),
      `"${(t.description ?? '').replace(/"/g, '""')}"`,
      Number(t.amount).toFixed(2),
      t.type,
      t.category ?? '',
    ].join(',')
  );

  return [header, ...rows].join('\n');
}
