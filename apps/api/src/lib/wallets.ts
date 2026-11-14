// Carteras de Finanzas: saldo de cada una a partir de su saldo inicial, sus movimientos y sus traslados.
// Lógica pura (sin base de datos): la usa finance-accounts.service y se prueba en tests/wallets.test.ts.

export const ACCOUNT_KINDS = ['WALLET', 'BANK', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH', 'ASSET'] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];

export interface AccountRow {
  id: string;
  kind: string;
  /** Saldo al crearla. En una tarjeta de crédito, lo que ya se debía (en positivo). */
  openingBalance: number;
  creditLimit: number | null;
  cutoffDay: number | null;
  archivedAt: Date | null;
}

export interface AccountFlow { accountId: string | null; type: 'INCOME' | 'EXPENSE'; amount: number }
export interface TransferSum { accountId: string; amount: number }
export interface ExpenseRow { accountId: string; amount: number; date: Date }

export interface AccountSummary {
  /** Lo que hay (negativo en una tarjeta de crédito: lo que se debe). */
  balance: number;
  /** Gastos del mes en curso con esta cartera. */
  monthSpent: number;
  /** Tarjeta de crédito: gastos desde el último corte. */
  cycleSpent: number | null;
  /** Tarjeta de crédito con cupo: cuánto queda por usar. */
  available: number | null;
  /** Tarjeta de crédito con cupo: parte usada, 0–1 (puede pasar de 1 si se excede). */
  usage: number | null;
}

/**
 * Primer día del ciclo de facturación en curso: el día siguiente al último corte. Un corte el 31 cae en el
 * último día de los meses más cortos. Sin día de corte, el ciclo es el mes del calendario.
 */
export function cycleStart(cutoffDay: number | null, now: Date): Date {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  if (!cutoffDay) return new Date(Date.UTC(y, m, 1));
  const cutoffOf = (month: number) => Math.min(cutoffDay, new Date(Date.UTC(y, month + 1, 0)).getUTCDate());
  // El día de corte todavía es del ciclo que se cierra: el nuevo empieza al día siguiente.
  const month = now.getUTCDate() > cutoffOf(m) ? m : m - 1;
  return new Date(Date.UTC(y, month, cutoffOf(month) + 1));
}

const sum = (rows: { amount: number }[]) => rows.reduce((total, row) => total + row.amount, 0);

// ponytail: los cortes se cuentan en UTC; cerca de la medianoche de Colombia un gasto puede caer en el ciclo
// vecino. Pasar la zona horaria de la persona si eso llega a notarse.
export function summarizeAccount(
  account: AccountRow,
  flows: AccountFlow[],
  transfersIn: TransferSum[],
  transfersOut: TransferSum[],
  recentExpenses: ExpenseRow[],
  now: Date,
): AccountSummary {
  const own = flows.filter((f) => f.accountId === account.id);
  const credit = account.kind === 'CREDIT_CARD';
  const balance = (credit ? -account.openingBalance : account.openingBalance)
    + sum(own.filter((f) => f.type === 'INCOME')) - sum(own.filter((f) => f.type === 'EXPENSE'))
    + sum(transfersIn.filter((t) => t.accountId === account.id)) - sum(transfersOut.filter((t) => t.accountId === account.id));

  const expenses = recentExpenses.filter((e) => e.accountId === account.id);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const since = cycleStart(account.cutoffDay, now);
  const limit = credit && account.creditLimit ? account.creditLimit : null;
  const owed = Math.max(0, -balance);
  return {
    balance,
    monthSpent: sum(expenses.filter((e) => e.date >= monthStart)),
    cycleSpent: credit ? sum(expenses.filter((e) => e.date >= since)) : null,
    available: limit === null ? null : limit - owed,
    usage: limit === null ? null : owed / limit,
  };
}

/** Patrimonio: lo que hay en las carteras activas más el dinero que aún no tiene cartera. */
export function netWorth(accounts: Array<AccountRow & AccountSummary>, flows: AccountFlow[]) {
  const loose = flows.filter((f) => f.accountId === null);
  const unassigned = sum(loose.filter((f) => f.type === 'INCOME')) - sum(loose.filter((f) => f.type === 'EXPENSE'));
  const active = accounts.filter((a) => !a.archivedAt);
  const assets = sum(active.filter((a) => a.balance > 0).map((a) => ({ amount: a.balance })));
  const debt = sum(active.filter((a) => a.balance < 0).map((a) => ({ amount: -a.balance })));
  return { unassigned, assets, debt, total: assets - debt + unassigned };
}
