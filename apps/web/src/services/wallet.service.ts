// Carteras de Finanzas: dónde está el dinero (billetera digital, cuenta, tarjeta, efectivo u otro activo) y
// los traslados entre ellas. El saldo lo calcula la API con los movimientos de cada cartera.
import api from '../lib/api';

export type AccountKind = 'WALLET' | 'BANK' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'CASH' | 'ASSET';
export type AccountColor = 'jade' | 'ambar' | 'oceano' | 'coral' | 'bosque' | 'oro';

export interface FinanceAccount {
  id: string;
  name: string;
  kind: AccountKind;
  provider: string | null;
  /** Últimos 4 dígitos, solo para reconocer la tarjeta. */
  last4: string | null;
  color: AccountColor;
  openingBalance: number;
  creditLimit: number | null;
  cutoffDay: number | null;
  dueDay: number | null;
  archivedAt: string | null;
  /** Lo que hay (negativo en una tarjeta de crédito: lo que se debe). */
  balance: number;
  monthSpent: number;
  /** Tarjeta de crédito: gastado desde el último corte. */
  cycleSpent: number | null;
  /** Tarjeta de crédito con cupo: lo que queda por usar y la parte usada (0–1). */
  available: number | null;
  usage: number | null;
}

export interface WalletTotals { unassigned: number; assets: number; debt: number; total: number }
export interface FinanceTransfer { id: string; fromAccountId: string; toAccountId: string; amount: number; date: string; note: string | null }

export type AccountInput = Pick<FinanceAccount, 'name' | 'kind'> & Partial<Pick<FinanceAccount, 'provider' | 'last4' | 'color' | 'openingBalance' | 'creditLimit' | 'cutoffDay' | 'dueDay'>>;

export async function fetchAccounts(): Promise<{ accounts: FinanceAccount[]; totals: WalletTotals }> {
  return (await api.get('/finances/accounts')).data;
}
export const createAccount = (body: AccountInput) => api.post('/finances/accounts', body).then(() => undefined);
export const updateAccount = (id: string, body: Partial<AccountInput & { archived: boolean }>) => api.patch(`/finances/accounts/${id}`, body).then(() => undefined);
export const deleteAccount = (id: string) => api.delete(`/finances/accounts/${id}`).then(() => undefined);

export const fetchTransfers = () => api.get<{ transfers: FinanceTransfer[] }>('/finances/transfers').then((r) => r.data.transfers);
export const createTransfer = (body: { fromAccountId: string; toAccountId: string; amount: number; date?: string; note?: string }) => api.post('/finances/transfers', body).then(() => undefined);
export const deleteTransfer = (id: string) => api.delete(`/finances/transfers/${id}`).then(() => undefined);

/** Texto de la API para la persona (cartera con movimientos, cartera archivada…). */
export const walletMessage = (err: unknown, fallback: string): string =>
  (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;

/** Próximo día de pago de una tarjeta (el 31 cae en el último día de los meses cortos). */
export function nextDueDate(dueDay: number, now = new Date()): Date {
  const at = (month: number) => new Date(now.getFullYear(), month, Math.min(dueDay, new Date(now.getFullYear(), month + 1, 0).getDate()));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisMonth = at(now.getMonth());
  return thisMonth >= today ? thisMonth : at(now.getMonth() + 1);
}
