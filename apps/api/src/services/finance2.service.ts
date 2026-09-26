import { prisma } from '../lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

// ─── Recurring Transactions ────────────────────────────────────────────────────

export async function getRecurringTransactions(userId: string) {
  return prisma.recurringTransaction.findMany({
    where: { userId, isActive: true },
    orderBy: { dayOfMonth: 'asc' },
  });
}

export async function createRecurringTransaction(
  userId: string,
  data: { type: string; amount: number; category: string; description: string; dayOfMonth: number }
) {
  return prisma.recurringTransaction.create({
    data: { userId, ...data },
  });
}

export async function updateRecurringTransaction(userId: string, id: string, data: Partial<{ type: string; amount: number; category: string; description: string; dayOfMonth: number; isActive: boolean }>) {
  return prisma.recurringTransaction.updateMany({ where: { id, userId }, data });
}

export async function deleteRecurringTransaction(userId: string, id: string) {
  return prisma.recurringTransaction.deleteMany({ where: { id, userId } });
}

// ─── Debts ─────────────────────────────────────────────────────────────────────

export async function getDebts(userId: string) {
  return prisma.debt.findMany({
    where: { userId },
    include: { payments: { orderBy: { date: 'desc' } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createDebt(
  userId: string,
  data: { title: string; type: string; originalAmount: number; interestRate?: number; personName?: string; dueDate?: Date }
) {
  return prisma.debt.create({
    data: {
      userId,
      title: data.title,
      type: data.type,
      originalAmount: data.originalAmount,
      currentAmount: data.originalAmount,
      interestRate: data.interestRate,
      personName: data.personName,
      dueDate: data.dueDate,
    },
  });
}

export async function updateDebt(userId: string, id: string, data: Partial<{ title: string; isPaid: boolean; dueDate: Date; personName: string }>) {
  return prisma.debt.updateMany({ where: { id, userId }, data });
}

export async function addDebtPayment(userId: string, debtId: string, amount: number, date: Date, notes?: string) {
  const debt = await prisma.debt.findFirst({ where: { id: debtId, userId } });
  if (!debt) throw new Error('Deuda no encontrada');

  const newAmount = Math.max(0, Number(debt.currentAmount) - amount);
  const isPaid = newAmount <= 0;

  const [payment] = await prisma.$transaction([
    prisma.debtPayment.create({ data: { debtId, amount, date, notes } }),
    prisma.debt.update({
      where: { id: debtId },
      data: { currentAmount: newAmount, isPaid },
    }),
  ]);

  return payment;
}

export async function deleteDebt(userId: string, id: string) {
  return prisma.debt.deleteMany({ where: { id, userId } });
}

// ─── Financial Projection ──────────────────────────────────────────────────────

export async function getFinancialProjection(userId: string, months = 3) {
  const [recurring, debts, recentTransactions] = await Promise.all([
    prisma.recurringTransaction.findMany({ where: { userId, isActive: true } }),
    prisma.debt.findMany({ where: { userId, isPaid: false }, include: { payments: { orderBy: { date: 'desc' }, take: 3 } } }),
    prisma.transaction.findMany({
      where: { userId, date: { gte: new Date(Date.now() - 90 * 86400000), lt: new Date() } },
      select: { type: true, amount: true },
    }),
  ]);

  const monthlyIncome = recurring
    .filter((r) => r.type === 'INCOME')
    .reduce((sum, r) => sum + Number(r.amount), 0);

  const monthlyExpenses = recurring
    .filter((r) => r.type === 'EXPENSE')
    .reduce((sum, r) => sum + Number(r.amount), 0);

  // Average variable expenses (non-recurring) from last 3 months
  const variableExpenseTotal = recentTransactions
    .filter((t) => t.type === 'EXPENSE')
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const avgVariableExpenses = variableExpenseTotal / 3;

  const netMonthly = monthlyIncome - monthlyExpenses - avgVariableExpenses;

  const projection: Array<{ month: string; balance: number; income: number; expenses: number }> = [];
  const now = new Date();

  for (let i = 1; i <= months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    projection.push({
      month: d.toISOString().slice(0, 7),
      balance: Math.round(netMonthly * i),
      income: Math.round(monthlyIncome * i),
      expenses: Math.round((monthlyExpenses + avgVariableExpenses) * i),
    });
  }

  // Debt payoff estimates
  const debtProjections = debts.map((d) => {
    const payments = d.payments;
    let avgPayment = 0;
    if (payments.length >= 2) {
      const total = payments.reduce((sum, p) => sum + Number(p.amount), 0);
      avgPayment = total / payments.length;
    }
    const remaining = Number(d.currentAmount);
    const monthsToPayoff = avgPayment > 0 ? Math.ceil(remaining / avgPayment) : null;
    return {
      id: d.id,
      title: d.title,
      remaining,
      avgMonthlyPayment: Math.round(avgPayment),
      monthsToPayoff,
    };
  });

  return {
    monthlyIncome: Math.round(monthlyIncome),
    monthlyRecurringExpenses: Math.round(monthlyExpenses),
    avgVariableExpenses: Math.round(avgVariableExpenses),
    netMonthly: Math.round(netMonthly),
    projection,
    debtProjections,
  };
}
