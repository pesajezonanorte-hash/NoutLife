// Flujo de caja por día (Finanzas 3D): ingresos y gastos de cada día del periodo, hasta hoy.
// Puro (sin three ni DOM): lo usan la escena, la tarjeta y los tests.
import type { Transaction } from '@noutlife/shared';

export interface CashDay {
  /** AAAA-MM-DD */
  key: string;
  income: number;
  expense: number;
}

const DAY = 86_400_000;

export function cashflowDays(txs: Pick<Transaction, 'date' | 'type' | 'amount'>[], from: string, to: string, today = new Date()): CashDay[] {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  const last = end < today ? end : today;
  const n = Math.max(1, Math.round((new Date(last.getFullYear(), last.getMonth(), last.getDate()).getTime() - start.getTime()) / DAY) + 1);
  const days: CashDay[] = Array.from({ length: n }, (_, i) => {
    const d = new Date(start.getTime() + i * DAY + 12 * 3_600_000);
    return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, income: 0, expense: 0 };
  });
  for (const t of txs) {
    const i = Math.round((new Date(`${t.date.slice(0, 10)}T00:00:00`).getTime() - start.getTime()) / DAY);
    if (i < 0 || i >= n) continue;
    if (t.type === 'INCOME') days[i].income += Number(t.amount);
    else days[i].expense += Number(t.amount);
  }
  return days;
}

/** Altura de cada barra (0–1) respecto al mayor movimiento del periodo. */
export function barHeights(days: CashDay[]): Array<{ up: number; down: number }> {
  const max = Math.max(1, ...days.map((d) => Math.max(d.income, d.expense)));
  return days.map((d) => ({ up: d.income / max, down: d.expense / max }));
}

/** Día con más dinero que entró y día con más dinero que salió (índices, o −1). */
export function cashPeaks(days: CashDay[]) {
  let inI = -1;
  let outI = -1;
  days.forEach((d, i) => {
    if (d.income > 0 && (inI < 0 || d.income > days[inI].income)) inI = i;
    if (d.expense > 0 && (outI < 0 || d.expense > days[outI].expense)) outI = i;
  });
  return { inI, outI };
}
