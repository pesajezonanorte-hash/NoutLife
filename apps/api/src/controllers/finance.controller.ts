import { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware';
import * as svc from '../services/finance.service';

const serDate = (obj: { createdAt: Date; updatedAt?: Date; date?: Date; [k: string]: unknown }) => ({
  ...obj,
  amount: obj.amount !== undefined ? Number(obj.amount) : undefined,
  targetAmount: obj.targetAmount !== undefined ? Number(obj.targetAmount) : undefined,
  currentAmount: obj.currentAmount !== undefined ? Number(obj.currentAmount) : undefined,
  createdAt: obj.createdAt.toISOString(),
  updatedAt: obj.updatedAt?.toISOString(),
  date: obj.date instanceof Date ? obj.date.toISOString() : obj.date,
  deadline: (obj.deadline instanceof Date) ? (obj.deadline as Date).toISOString() : obj.deadline,
  completedAt: (obj.completedAt instanceof Date) ? (obj.completedAt as Date).toISOString() : obj.completedAt,
});

export async function listTransactions(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { from, to, category, type, search } = req.query as Record<string, string>;
    const transactions = await svc.listTransactions(req.userId!, { from, to, category, type, search });
    res.json({ transactions: transactions.map(serDate) });
  } catch { res.status(500).json({ error: 'Error al obtener transacciones.' }); }
}

export async function createTransaction(req: AuthRequest, res: Response): Promise<void> {
  try {
    const t = await svc.createTransaction(req.userId!, req.body);
    res.status(201).json({ transaction: serDate(t) });
  } catch { res.status(500).json({ error: 'Error al crear transacción.' }); }
}

export async function updateTransaction(req: AuthRequest, res: Response): Promise<void> {
  try {
    const t = await svc.updateTransaction(req.userId!, req.params.id, req.body);
    res.json({ transaction: serDate(t) });
  } catch { res.status(500).json({ error: 'Error al actualizar transacción.' }); }
}

export async function deleteTransaction(req: AuthRequest, res: Response): Promise<void> {
  try {
    await svc.deleteTransaction(req.userId!, req.params.id);
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Error al eliminar transacción.' }); }
}

export async function getTransactionSummary(req: AuthRequest, res: Response): Promise<void> {
  try {
    const now = new Date();
    const { from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), to = now.toISOString() } = req.query as Record<string, string>;
    const summary = await svc.getTransactionSummary(req.userId!, from, to);
    res.json({ summary });
  } catch { res.status(500).json({ error: 'Error al obtener resumen.' }); }
}

export async function listBudgets(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { month, year } = req.query as Record<string, string>;
    const budgets = await svc.listBudgets(req.userId!, month ? Number(month) : undefined, year ? Number(year) : undefined);
    res.json({ budgets: budgets.map(b => ({ ...b, createdAt: b.createdAt.toISOString(), updatedAt: b.updatedAt.toISOString() })) });
  } catch { res.status(500).json({ error: 'Error al obtener presupuestos.' }); }
}

export async function createBudget(req: AuthRequest, res: Response): Promise<void> {
  try {
    const b = await svc.createBudget(req.userId!, req.body);
    res.status(201).json({ budget: { ...b, amount: Number(b.amount), createdAt: b.createdAt.toISOString(), updatedAt: b.updatedAt.toISOString() } });
  } catch { res.status(500).json({ error: 'Error al crear presupuesto.' }); }
}

export async function updateBudget(req: AuthRequest, res: Response): Promise<void> {
  try {
    const b = await svc.updateBudget(req.userId!, req.params.id, req.body);
    res.json({ budget: { ...b, amount: Number(b.amount), createdAt: b.createdAt.toISOString(), updatedAt: b.updatedAt.toISOString() } });
  } catch { res.status(500).json({ error: 'Error al actualizar presupuesto.' }); }
}

export async function deleteBudget(req: AuthRequest, res: Response): Promise<void> {
  try {
    await svc.deleteBudget(req.userId!, req.params.id);
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Error al eliminar presupuesto.' }); }
}

export async function getBudgetAlerts(req: AuthRequest, res: Response): Promise<void> {
  try {
    const alerts = await svc.getBudgetAlerts(req.userId!);
    res.json({ alerts: alerts.map(b => ({ ...b, createdAt: b.createdAt.toISOString(), updatedAt: b.updatedAt.toISOString() })) });
  } catch { res.status(500).json({ error: 'Error al obtener alertas.' }); }
}

export async function listFinancialGoals(req: AuthRequest, res: Response): Promise<void> {
  try {
    const goals = await svc.listFinancialGoals(req.userId!);
    res.json({ goals: goals.map(serDate) });
  } catch { res.status(500).json({ error: 'Error al obtener metas.' }); }
}

export async function createFinancialGoal(req: AuthRequest, res: Response): Promise<void> {
  try {
    const g = await svc.createFinancialGoal(req.userId!, req.body);
    res.status(201).json({ goal: serDate(g) });
  } catch { res.status(500).json({ error: 'Error al crear meta.' }); }
}

export async function updateFinancialGoal(req: AuthRequest, res: Response): Promise<void> {
  try {
    const g = await svc.updateFinancialGoal(req.userId!, req.params.id, req.body);
    res.json({ goal: serDate(g) });
  } catch { res.status(500).json({ error: 'Error al actualizar meta.' }); }
}

export async function contributeToGoal(req: AuthRequest, res: Response): Promise<void> {
  try {
    const g = await svc.contributeToGoal(req.userId!, req.params.id, Number(req.body.amount));
    res.json({ goal: serDate(g) });
  } catch { res.status(500).json({ error: 'Error al agregar aporte.' }); }
}

export async function deleteFinancialGoal(req: AuthRequest, res: Response): Promise<void> {
  try {
    await svc.deleteFinancialGoal(req.userId!, req.params.id);
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Error al eliminar meta.' }); }
}

export async function getFinanceDashboard(req: AuthRequest, res: Response): Promise<void> {
  try {
    const data = await svc.getFinanceDashboard(req.userId!);
    res.json(data);
  } catch { res.status(500).json({ error: 'Error al obtener dashboard financiero.' }); }
}

export async function getFinanceReport(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { year, month } = req.params;
    const report = await svc.getFinanceReport(req.userId!, Number(year), Number(month));
    res.json({ report });
  } catch { res.status(500).json({ error: 'Error al obtener reporte.' }); }
}

export async function getSavings(req: AuthRequest, res: Response): Promise<void> {
  try {
    const d = await svc.getSavings(req.userId!);
    res.json({ savings: { ...d, entries: d.entries.map((e) => ({ ...e, amount: Number(e.amount), createdAt: e.createdAt.toISOString() })) } });
  } catch { res.status(500).json({ error: 'Error al cargar el ahorro.' }); }
}

export async function moveSavings(req: AuthRequest, res: Response): Promise<void> {
  try {
    await svc.moveSavings(req.userId!, req.body);
    res.status(201).json({ success: true });
  } catch (e) {
    if (e instanceof Error && e.message === 'INSUFFICIENT_SAVINGS') { res.status(400).json({ error: 'No tienes tanto ahorrado.' }); return; }
    res.status(500).json({ error: 'Error al registrar el movimiento de ahorro.' });
  }
}
