import api from '../lib/api';
import type { Transaction, Budget, FinancialGoal } from '@noutlife/shared';

export async function fetchTransactions(filters: { from?: string; to?: string; category?: string; type?: string; search?: string } = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
  const { data } = await api.get<{ transactions: Transaction[] }>(`/finances/transactions?${params}`);
  return data.transactions;
}

export async function createTransaction(body: { type: string; amount: number; category: string; description?: string; date?: string }): Promise<Transaction> {
  const { data } = await api.post<{ transaction: Transaction }>('/finances/transactions', body);
  return data.transaction;
}

export async function updateTransaction(id: string, body: Record<string, unknown>): Promise<Transaction> {
  const { data } = await api.patch<{ transaction: Transaction }>(`/finances/transactions/${id}`, body);
  return data.transaction;
}

export async function deleteTransaction(id: string): Promise<void> {
  await api.delete(`/finances/transactions/${id}`);
}

export async function fetchTransactionSummary(from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const { data } = await api.get(`/finances/transactions/summary?${params}`);
  return data.summary;
}

export async function fetchBudgets(month?: number, year?: number): Promise<(Budget & { spent: number })[]> {
  const params = new URLSearchParams();
  if (month) params.set('month', String(month));
  if (year) params.set('year', String(year));
  const { data } = await api.get<{ budgets: (Budget & { spent: number })[] }>(`/finances/budgets?${params}`);
  return data.budgets;
}

export async function createBudget(body: { category: string; amount: number; month?: number; year?: number }): Promise<Budget> {
  const { data } = await api.post<{ budget: Budget }>('/finances/budgets', body);
  return data.budget;
}

export async function deleteBudget(id: string): Promise<void> {
  await api.delete(`/finances/budgets/${id}`);
}

export async function fetchFinancialGoals(): Promise<FinancialGoal[]> {
  const { data } = await api.get<{ goals: FinancialGoal[] }>('/finances/goals');
  return data.goals;
}

export async function createFinancialGoal(body: { title: string; targetAmount: number; description?: string; deadline?: string }): Promise<FinancialGoal> {
  const { data } = await api.post<{ goal: FinancialGoal }>('/finances/goals', body);
  return data.goal;
}

export async function contributeToGoal(id: string, amount: number): Promise<FinancialGoal> {
  const { data } = await api.post<{ goal: FinancialGoal }>(`/finances/goals/${id}/contribute`, { amount });
  return data.goal;
}

export async function deleteFinancialGoal(id: string): Promise<void> {
  await api.delete(`/finances/goals/${id}`);
}

export type FinanceSummary = {
  income: number;
  expenses: number;
  balance: number;
  byCategory: Record<string, number>;
  count: number;
};

export type FinanceDashboard = {
  totalBalance: number;
  monthSummary: FinanceSummary;
  budgets: (Budget & { spent: number })[];
  goals: FinancialGoal[];
  recent: Transaction[];
};

export async function fetchFinanceDashboard(): Promise<FinanceDashboard> {
  const { data } = await api.get<FinanceDashboard>('/finances/dashboard');
  return data;
}

export async function fetchFinanceReport(year: number, month: number) {
  const { data } = await api.get(`/finances/report/${year}/${month}`);
  return data.report;
}
