// Panel de creadores (solo administración): alta y edición de códigos, y su rendimiento (usos,
// conversiones mensuales y anuales, cobros, ingreso y comisión) para calcular el revenue share. Las
// reglas viven en lib/creator-codes; aplicar un código y cobrar, en billing.service.
import { prisma } from '../lib/prisma';
import { creatorReport, normalizeCreatorCode, type ReportRange } from '../lib/creator-codes';
import type { CreateCreatorCodeBody, UpdateCreatorCodeBody } from '../schemas/creator-code.schemas';
import { recordCreatorPayment } from './billing.service';

export class CreatorCodeError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = 'CreatorCodeError';
  }
}

/**
 * Repone el libro si una escritura falló al aprobarse un cobro: anota los cobros aprobados con
 * código que faltan y marca los que Wompi anuló después. Idempotente: corre antes de cada informe.
 */
export async function reconcileCreatorLedger(): Promise<{ added: number; voided: number }> {
  const [approved, voided, ledger] = await Promise.all([
    prisma.subscriptionPayment.findMany({
      where: { status: 'APPROVED', creatorCodeId: { not: null } },
      select: { reference: true, userId: true, creatorCodeId: true, billingInterval: true, amountInCents: true, discountInCents: true, createdAt: true },
    }),
    prisma.subscriptionPayment.findMany({ where: { status: 'VOIDED', creatorCodeId: { not: null } }, select: { reference: true } }),
    prisma.creatorCodePayment.findMany({ select: { reference: true } }),
  ]);
  const known = new Set(ledger.map((row) => row.reference));
  const missing = approved.filter((payment) => !known.has(payment.reference));
  for (const payment of missing) await recordCreatorPayment(payment);
  const { count } = voided.length
    ? await prisma.creatorCodePayment.updateMany({ where: { status: 'APPROVED', reference: { in: voided.map((p) => p.reference) } }, data: { status: 'VOIDED' } })
    : { count: 0 };
  return { added: missing.length, voided: count };
}

/** Rango desde la consulta (?from=…&to=… en ISO). Una fecha que no se entiende cuenta como sin límite. */
export function rangeOf(query: { from?: unknown; to?: unknown }): ReportRange {
  const parse = (value: unknown) => {
    if (typeof value !== 'string' || !value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  return { from: parse(query.from), to: parse(query.to) };
}

/**
 * Informe del panel: cada código con sus usos y su comisión en el rango, y el detalle de cobros
 * (fecha, código, quién pagó, plan, alta o renovación, monto y comisión). De quien pagó solo se
 * muestra el correo mientras la cuenta exista; una cuenta borrada conserva su fila sin datos.
 */
export async function creatorCodesReport(range: ReportRange) {
  await reconcileCreatorLedger().catch((error) => console.error('[CREATOR_LEDGER_RECONCILE_ERROR]', error));
  const [codes, ledger, applied] = await Promise.all([
    prisma.creatorCode.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.creatorCodePayment.findMany({
      select: { id: true, creatorCodeId: true, userId: true, interval: true, amountInCents: true, discountInCents: true, kind: true, status: true, paidAt: true },
    }),
    prisma.user.groupBy({ by: ['creatorCodeId'], where: { creatorCodeId: { not: null } }, _count: { _all: true } }),
  ]);
  const appliedByCode = new Map(applied.map((row) => [row.creatorCodeId!, row._count._all]));
  const report = creatorReport(codes, ledger, appliedByCode, range);

  const ids = [...new Set(report.lines.map((line) => line.userId))];
  const users = ids.length
    ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true, displayName: true } })
    : [];
  const byId = new Map(users.map((user) => [user.id, user]));
  return {
    range: { from: range.from?.toISOString() ?? null, to: range.to?.toISOString() ?? null },
    codes: report.codes,
    totals: report.totals,
    lines: report.lines.map((line) => ({
      ...line,
      email: byId.get(line.userId)?.email ?? null,
      displayName: byId.get(line.userId)?.displayName ?? null,
    })),
  };
}

export async function createCreatorCode(input: CreateCreatorCodeBody) {
  const code = normalizeCreatorCode(input.code);
  if (!code) throw new CreatorCodeError('El código lleva de 3 a 20 letras sin tilde, números, guion o guion bajo.');
  try {
    return await prisma.creatorCode.create({
      data: { code, creatorName: input.creatorName, discountPercent: input.discountPercent, sharePercent: input.sharePercent, shareMonths: input.shareMonths },
    });
  } catch (error) {
    if ((error as { code?: unknown }).code === 'P2002') throw new CreatorCodeError(`El código ${code} ya existe.`, 409);
    throw error;
  }
}

/**
 * Editar el nombre, el descuento, la comisión o activarlo. El descuento rige los próximos cobros (el
 * monto de cada cobro ya quedó fijo); la comisión se calcula en cada informe con la configuración actual.
 */
export async function updateCreatorCode(id: string, input: UpdateCreatorCodeBody) {
  try {
    return await prisma.creatorCode.update({ where: { id }, data: input });
  } catch (error) {
    if ((error as { code?: unknown }).code === 'P2025') throw new CreatorCodeError('Código no encontrado.', 404);
    throw error;
  }
}
