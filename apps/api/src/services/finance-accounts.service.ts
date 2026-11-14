// Carteras de Finanzas: dónde está el dinero (Nequi, una cuenta, una tarjeta, el efectivo…) y los traslados
// entre ellas. Un movimiento puede llevar su cartera (transactions.accountId); los que no la llevan se
// cuentan aparte como «sin cartera». El saldo no se guarda: sale de los movimientos (lib/wallets).
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError, gone } from '../lib/http';
import { netWorth, summarizeAccount, type AccountFlow, type AccountRow } from '../lib/wallets';
import type { AccountInput, AccountPatch, TransferInput } from '../schemas/finance.schemas';

export const MAX_ACCOUNTS = 30;
const DAY_MS = 86_400_000;
/** Dos ciclos de facturación completos, para el gasto del mes y el del corte. */
const RECENT_DAYS = 63;

type AccountRecord = Prisma.FinanceAccountGetPayload<object>;

const toRow = (a: AccountRecord): AccountRow => ({
  id: a.id, kind: a.kind, openingBalance: Number(a.openingBalance), creditLimit: a.creditLimit === null ? null : Number(a.creditLimit),
  cutoffDay: a.cutoffDay, archivedAt: a.archivedAt,
});

export async function listAccounts(userId: string, now = new Date()) {
  const realised = { lte: now };
  const [accounts, flowRows, inRows, outRows, expenses] = await Promise.all([
    prisma.financeAccount.findMany({ where: { userId }, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] }),
    prisma.transaction.groupBy({ by: ['accountId', 'type'], where: { userId, date: realised }, _sum: { amount: true } }),
    prisma.financeTransfer.groupBy({ by: ['toAccountId'], where: { userId, date: realised }, _sum: { amount: true } }),
    prisma.financeTransfer.groupBy({ by: ['fromAccountId'], where: { userId, date: realised }, _sum: { amount: true } }),
    prisma.transaction.findMany({
      where: { userId, type: 'EXPENSE', accountId: { not: null }, date: { gte: new Date(now.getTime() - RECENT_DAYS * DAY_MS), lte: now } },
      select: { accountId: true, amount: true, date: true },
    }),
  ]);
  const flows: AccountFlow[] = flowRows.map((f) => ({ accountId: f.accountId, type: f.type, amount: Number(f._sum.amount ?? 0) }));
  const transfersIn = inRows.map((t) => ({ accountId: t.toAccountId, amount: Number(t._sum.amount ?? 0) }));
  const transfersOut = outRows.map((t) => ({ accountId: t.fromAccountId, amount: Number(t._sum.amount ?? 0) }));
  const recent = expenses.map((e) => ({ accountId: e.accountId!, amount: Number(e.amount), date: e.date }));

  const rows = accounts.map((a) => {
    const row = toRow(a);
    return { ...a, ...row, ...summarizeAccount(row, flows, transfersIn, transfersOut, recent, now) };
  });
  return { accounts: rows, totals: netWorth(rows, flows) };
}

const owned = (userId: string, id: string) => prisma.financeAccount.findFirst({ where: { id, userId } });

/** El cupo y los días de corte y pago solo tienen sentido en una tarjeta de crédito. */
const cardFields = (kind: string) => (kind === 'CREDIT_CARD' ? {} : { creditLimit: null, cutoffDay: null, dueDay: null });

export async function createAccount(userId: string, input: AccountInput) {
  const count = await prisma.financeAccount.count({ where: { userId } });
  if (count >= MAX_ACCOUNTS) throw new ApiError(`Puedes tener hasta ${MAX_ACCOUNTS} carteras. Elimina alguna que ya no uses.`, 409);
  const account = await prisma.financeAccount.create({ data: { userId, ...input, ...cardFields(input.kind), order: count } });
  return { account };
}

export async function updateAccount(userId: string, id: string, { archived, ...input }: AccountPatch) {
  const current = await owned(userId, id);
  if (!current) throw gone('Esa cartera');
  const account = await prisma.financeAccount.update({
    where: { id },
    data: {
      ...input,
      ...cardFields(input.kind ?? current.kind),
      ...(archived !== undefined && { archivedAt: archived ? new Date() : null }),
    },
  });
  return { account };
}

/** Solo se borra una cartera sin movimientos: borrarla con ellos cambiaría los saldos de las demás. */
export async function deleteAccount(userId: string, id: string) {
  if (!(await owned(userId, id))) throw gone('Esa cartera');
  const [movements, transfers] = await Promise.all([
    prisma.transaction.count({ where: { userId, accountId: id } }),
    prisma.financeTransfer.count({ where: { userId, OR: [{ fromAccountId: id }, { toAccountId: id }] } }),
  ]);
  if (movements + transfers > 0) throw new ApiError('Esta cartera tiene movimientos. Archívala para conservar tu historial.', 409);
  await prisma.financeAccount.delete({ where: { id } });
  return { ok: true };
}

/** La cartera de un movimiento debe ser de la persona y estar activa. */
export async function assertUsableAccount(userId: string, accountId: string | null | undefined) {
  if (!accountId) return;
  const account = await owned(userId, accountId);
  if (!account) throw gone('Esa cartera');
  if (account.archivedAt) throw new ApiError('Esa cartera está archivada. Elige otra.');
}

export async function listTransfers(userId: string) {
  const transfers = await prisma.financeTransfer.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 60 });
  return { transfers: transfers.map((t) => ({ ...t, amount: Number(t.amount) })) };
}

export async function createTransfer(userId: string, input: TransferInput) {
  await Promise.all([assertUsableAccount(userId, input.fromAccountId), assertUsableAccount(userId, input.toAccountId)]);
  const transfer = await prisma.financeTransfer.create({
    // Misma regla que los movimientos: un día suelto cae a las 00:00 UTC, así el de hoy ya cuenta en el saldo.
    data: { userId, fromAccountId: input.fromAccountId, toAccountId: input.toAccountId, amount: input.amount, note: input.note || null, date: input.date ? new Date(input.date) : new Date() },
  });
  return { transfer: { ...transfer, amount: Number(transfer.amount) } };
}

export async function deleteTransfer(userId: string, id: string) {
  const { count } = await prisma.financeTransfer.deleteMany({ where: { id, userId } });
  if (!count) throw gone('Ese traslado');
  return { ok: true };
}
