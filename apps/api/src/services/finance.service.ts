import { prisma } from '../lib/prisma';
import { checkAchievements } from './achievement.service';
import type { TransactionType, TransactionCategory } from '@prisma/client';

export async function listTransactions(userId: string, filters: { from?: string; to?: string; category?: string; type?: string; search?: string }) {
  return prisma.transaction.findMany({
    where: {
      userId,
      ...(filters.from && { date: { gte: new Date(filters.from) } }),
      ...(filters.to && { date: { lte: new Date(filters.to) } }),
      ...(filters.category && { category: filters.category as TransactionCategory }),
      ...(filters.type && { type: filters.type as TransactionType }),
      ...(filters.search && { description: { contains: filters.search, mode: 'insensitive' } }),
    },
    orderBy: { date: 'desc' },
    take: 200,
  });
}

export async function createTransaction(userId: string, body: { type: TransactionType; amount: number; category: TransactionCategory; description?: string; date?: string }) {
  return prisma.transaction.create({
    data: {
      userId,
      type: body.type,
      amount: body.amount,
      category: body.category,
      description: body.description,
      date: body.date ? new Date(body.date) : new Date(),
    },
  });
}

export async function updateTransaction(userId: string, id: string, body: Partial<{ type: TransactionType; amount: number; category: TransactionCategory; description: string; date: string }>) {
  return prisma.transaction.update({
    where: { id, userId },
    data: {
      ...(body.type && { type: body.type }),
      ...(body.amount !== undefined && { amount: body.amount }),
      ...(body.category && { category: body.category }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.date && { date: new Date(body.date) }),
    },
  });
}

export async function deleteTransaction(userId: string, id: string) {
  return prisma.transaction.delete({ where: { id, userId } });
}

export async function getTransactionSummary(userId: string, from: string, to: string) {
  const now = new Date();
  const requestedTo = new Date(to);
  // A dated transaction can be displayed as planned, but it is not realised money yet.
  const realisedTo = requestedTo > now ? now : requestedTo;
  const transactions = await prisma.transaction.findMany({
    where: { userId, date: { gte: new Date(from), lte: realisedTo } },
  });

  const income = transactions.filter(t => t.type === 'INCOME').reduce((a, t) => a + Number(t.amount), 0);
  const expenses = transactions.filter(t => t.type === 'EXPENSE').reduce((a, t) => a + Number(t.amount), 0);

  const byCategory = transactions.reduce((acc, t) => {
    if (t.type === 'EXPENSE') acc[t.category] = (acc[t.category] ?? 0) + Number(t.amount);
    return acc;
  }, {} as Record<string, number>);

  return { income, expenses, balance: income - expenses, byCategory, count: transactions.length };
}

export async function listBudgets(userId: string, month?: number, year?: number) {
  const now = new Date();
  const m = month ?? now.getMonth() + 1;
  const y = year ?? now.getFullYear();

  const budgets = await prisma.budget.findMany({ where: { userId, month: m, year: y } });

  const from = new Date(y, m - 1, 1);
  const endOfMonth = new Date(y, m, 0, 23, 59, 59);
  const to = endOfMonth > now ? now : endOfMonth;

  const transactions = from > to
    ? []
    : await prisma.transaction.findMany({
      where: { userId, type: 'EXPENSE', date: { gte: from, lte: to } },
    });

  const spentByCategory = transactions.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] ?? 0) + Number(t.amount);
    return acc;
  }, {} as Record<string, number>);

  return budgets.map(b => ({ ...b, amount: Number(b.amount), spent: spentByCategory[b.category] ?? 0 }));
}

export async function createBudget(userId: string, body: { category: TransactionCategory; amount: number; month?: number; year?: number }) {
  const now = new Date();
  return prisma.budget.create({
    data: {
      userId,
      category: body.category,
      amount: body.amount,
      month: body.month ?? now.getMonth() + 1,
      year: body.year ?? now.getFullYear(),
    },
  });
}

export async function updateBudget(userId: string, id: string, body: Partial<{ amount: number; month: number; year: number }>) {
  return prisma.budget.update({
    where: { id, userId },
    data: { ...(body.amount !== undefined && { amount: body.amount }) },
  });
}

export async function deleteBudget(userId: string, id: string) {
  return prisma.budget.delete({ where: { id, userId } });
}

export async function getBudgetAlerts(userId: string) {
  const budgets = await listBudgets(userId);
  return budgets.filter(b => b.spent / b.amount > 0.8);
}

export async function listFinancialGoals(userId: string) {
  return prisma.financialGoal.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
}

export async function createFinancialGoal(userId: string, body: { title: string; description?: string; targetAmount: number; deadline?: string }) {
  return prisma.financialGoal.create({
    data: {
      userId,
      title: body.title,
      description: body.description,
      targetAmount: body.targetAmount,
      deadline: body.deadline ? new Date(body.deadline) : undefined,
    },
  });
}

export async function updateFinancialGoal(userId: string, id: string, body: Record<string, unknown>) {
  return prisma.financialGoal.update({
    where: { id, userId },
    data: {
      ...(body.title ? { title: body.title as string } : {}),
      ...(body.description !== undefined ? { description: body.description as string } : {}),
      ...(body.targetAmount !== undefined ? { targetAmount: body.targetAmount as number } : {}),
      ...(body.deadline !== undefined ? { deadline: body.deadline ? new Date(body.deadline as string) : null } : {}),
    },
  });
}

export async function contributeToGoal(userId: string, id: string, amount: number) {
  const goal = await prisma.financialGoal.findFirst({ where: { id, userId } });
  if (!goal) throw new Error('Meta no encontrada');

  const newAmount = Number(goal.currentAmount) + amount;
  const isCompleted = newAmount >= Number(goal.targetAmount);

  const updated = await prisma.financialGoal.update({
    where: { id },
    data: {
      currentAmount: newAmount,
      isCompleted,
      completedAt: isCompleted ? new Date() : undefined,
    },
  });

  if (isCompleted) {
    checkAchievements(userId, 'finance_goal_completed', {}).catch(() => {});
  }

  return updated;
}

export async function deleteFinancialGoal(userId: string, id: string) {
  return prisma.financialGoal.delete({ where: { id, userId } });
}

export async function getFinanceDashboard(userId: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Keep the two financial concepts deliberately separate:
  // - totalBalance is the realised lifetime balance and must never reset on a new month.
  // - monthSummary is the current-month activity used for budgeting and monthly insight.
  const [monthSummary, lifetimeSummary, budgets, goals, recent] = await Promise.all([
    getTransactionSummary(userId, monthStart.toISOString(), now.toISOString()),
    getTransactionSummary(userId, new Date(0).toISOString(), now.toISOString()),
    listBudgets(userId),
    listFinancialGoals(userId),
    prisma.transaction.findMany({
      where: { userId, date: { lte: now } },
      orderBy: { date: 'desc' },
      take: 10,
    }),
  ]);

  return {
    totalBalance: lifetimeSummary.balance,
    monthSummary,
    budgets,
    goals: goals.map(g => ({ ...g, targetAmount: Number(g.targetAmount), currentAmount: Number(g.currentAmount) })),
    recent,
  };
}

export async function getFinanceReport(userId: string, year: number, month: number) {
  // Reports intentionally describe the requested calendar month; the persistent
  // balance belongs to getFinanceDashboard().totalBalance instead.
  const from = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59);
  const now = new Date();
  const to = endOfMonth > now ? now : endOfMonth;
  const summary = await getTransactionSummary(userId, from.toISOString(), to.toISOString());

  const topCategory = Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1])[0];
  const savingsRate = summary.income > 0 ? Math.round(((summary.income - summary.expenses) / summary.income) * 100) : 0;

  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const text = topCategory
    ? `En ${months[month - 1]} tus gastos más altos fueron en ${topCategory[0]} con $${topCategory[1].toLocaleString('es-CO')} COP. Ahorraste el ${savingsRate}% de tus ingresos.`
    : `No hay gastos registrados en ${months[month - 1]}.`;

  return { ...summary, savingsRate, text, month, year };
}
