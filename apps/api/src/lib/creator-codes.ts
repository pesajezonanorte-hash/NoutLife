// Códigos de creador (socios y creadores con revenue share). Reglas puras, sin base de datos, para que
// el cobro, la validación y el panel de administración usen la misma lógica y se prueben sin conexión.
// Aplicar un código y cobrar viven en services/billing.service.ts; el panel, en services/creator-code.service.ts.
//
//   · Quien aplica un código antes de su primer pago recibe el descuento del código en ese pago (mensual o anual).
//   · Desde ahí, cada cobro aprobado de la cuenta queda atribuido al creador (tabla creator_code_payments).
//   · Comisión: sharePercent de cada cobro hecho dentro de los primeros shareMonths meses desde la conversión.
import { addMonths, intervalOf, type BillingInterval } from './plans';
import { PRICE_LISTS, listInCentsFor, roundingUnitOf, type Market, type PriceCurrency } from './pricing';

/** 3 a 20 caracteres: letras sin tilde, números, guion o guion bajo, y empieza por letra o número. Se guarda en mayúsculas. */
export const CREATOR_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{2,19}$/;
/** Tope del descuento para quien compra: cuida el ingreso y el monto mínimo de un cobro en Wompi. */
export const MAX_CREATOR_DISCOUNT_PERCENT = 50;
/** Comisión propuesta en el plan v3 (decisión abierta 9): 30 % durante 6 meses. Cada código puede cambiarla. */
export const DEFAULT_SHARE_PERCENT = 30;
export const DEFAULT_SHARE_MONTHS = 6;

/** «  miguel » → «MIGUEL». null si no tiene el formato de un código. */
export function normalizeCreatorCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase();
  return CREATOR_CODE_PATTERN.test(code) ? code : null;
}

const clampPercent = (value: number, max: number) => Math.min(max, Math.max(0, Math.round(Number.isFinite(value) ? value : 0)));

export interface ChargeQuote {
  /** Moneda del precio: la del mercado de la cuenta. */
  currency: PriceCurrency;
  /** Precio de lista del periodo. */
  listInCents: number;
  discountInCents: number;
  /** Lo que se cobra, en la moneda del precio (un precio en USD se convierte a COP al cobrar en Wompi). */
  amountInCents: number;
}

/**
 * Monto de un cobro de Pro en la moneda del mercado. El descuento del código solo va en el primer pago
 * de la cuenta (la conversión); las renovaciones van a precio de lista. El COP se redondea a pesos
 * enteros (Wompi recibe centavos, pero el COP no los usa); el USD, a centavos.
 */
export function quoteCharge(interval: BillingInterval, discountPercent = 0, firstPayment = false, market: Market = 'CO'): ChargeQuote {
  const { currency } = PRICE_LISTS[market];
  const list = listInCentsFor(market, interval);
  const unit = roundingUnitOf(currency);
  const percent = firstPayment ? clampPercent(discountPercent, MAX_CREATOR_DISCOUNT_PERCENT) : 0;
  const discount = Math.round(((list / unit) * percent) / 100) * unit;
  return { currency, listInCents: list, discountInCents: discount, amountInCents: list - discount };
}

/** ¿El cobro cae dentro de la ventana de comisión? Sin `shareMonths` (null) no hay límite. */
export function inShareWindow(paidAt: Date, convertedAt: Date, shareMonths: number | null): boolean {
  if (shareMonths === null) return true;
  return paidAt.getTime() < addMonths(convertedAt, shareMonths).getTime();
}

/**
 * Comisión de un cobro, en pesos: `sharePercent` del monto cobrado si el cobro se hizo dentro de los
 * primeros `shareMonths` meses desde la conversión (el primer cobro aprobado de esa persona con el
 * código). Un cobro anual dentro de la ventana cuenta completo, como la «duración» de los programas
 * de afiliados: así empujar el plan anual también le conviene al creador.
 */
export function commissionCop(amountInCents: number, paidAt: Date, convertedAt: Date, sharePercent: number, shareMonths: number | null): number {
  if (!inShareWindow(paidAt, convertedAt, shareMonths)) return 0;
  return Math.round(((amountInCents / 100) * clampPercent(sharePercent, 100)) / 100);
}

export interface CreatorCodeRow {
  id: string;
  code: string;
  creatorName: string;
  discountPercent: number;
  sharePercent: number;
  shareMonths: number | null;
  active: boolean;
  createdAt: Date;
}

/** Una fila del libro del revenue share (creator_code_payments). */
export interface CreatorLedgerRow {
  id: string;
  creatorCodeId: string;
  userId: string;
  interval: string;
  amountInCents: number;
  discountInCents: number;
  /** 'first' (la conversión) | 'renewal' */
  kind: string;
  /** 'APPROVED' | 'VOIDED' */
  status: string;
  paidAt: Date;
}

/** Rango de fechas del informe: desde `from` (incluido) hasta `to` (excluido). null = sin límite. */
export interface ReportRange {
  from: Date | null;
  to: Date | null;
}

export interface CreatorCodeStats {
  id: string;
  code: string;
  creatorName: string;
  discountPercent: number;
  sharePercent: number;
  shareMonths: number | null;
  active: boolean;
  createdAt: string;
  /** Cuentas con el código puesto hoy, hayan pagado o no. No depende del rango. */
  applied: number;
  /** Conversiones en el rango: primeros cobros aprobados con el código. */
  conversions: number;
  monthlyConversions: number;
  annualConversions: number;
  /** Cobros aprobados en el rango: altas y renovaciones. */
  payments: number;
  revenueCop: number;
  discountCop: number;
  commissionCop: number;
  lastPaidAt: string | null;
}

export interface CreatorPaymentLine {
  id: string;
  creatorCodeId: string;
  code: string;
  creatorName: string;
  userId: string;
  interval: BillingInterval;
  kind: 'first' | 'renewal';
  status: string;
  amountCop: number;
  discountCop: number;
  commissionCop: number;
  /** Dentro de la ventana de comisión del código. */
  inWindow: boolean;
  paidAt: string;
}

export interface CreatorReport {
  codes: CreatorCodeStats[];
  /** Cobros del rango, del más reciente al más antiguo (los anulados van con comisión 0). */
  lines: CreatorPaymentLine[];
  totals: { applied: number; conversions: number; payments: number; revenueCop: number; commissionCop: number };
}

const inRange = (date: Date, { from, to }: ReportRange) => (!from || date >= from) && (!to || date < to);

/**
 * Rendimiento de cada código en el rango: usos (cuentas con el código y conversiones mensuales o
 * anuales), cobros, ingreso y comisión. La conversión de cada persona se busca en todo el historial,
 * así la ventana de comisión se mide igual sea cual sea el rango elegido.
 */
export function creatorReport(
  codes: readonly CreatorCodeRow[],
  ledger: readonly CreatorLedgerRow[],
  appliedByCode: ReadonlyMap<string, number>,
  range: ReportRange,
): CreatorReport {
  const byId = new Map(codes.map((code) => [code.id, code]));
  const keyOf = (row: CreatorLedgerRow) => `${row.creatorCodeId}:${row.userId}`;
  const convertedAt = new Map<string, Date>();
  for (const row of ledger) {
    if (row.status !== 'APPROVED') continue;
    const first = convertedAt.get(keyOf(row));
    if (!first || row.paidAt < first) convertedAt.set(keyOf(row), row.paidAt);
  }

  const stats = new Map<string, CreatorCodeStats>(codes.map((code) => [code.id, {
    id: code.id, code: code.code, creatorName: code.creatorName, discountPercent: code.discountPercent,
    sharePercent: code.sharePercent, shareMonths: code.shareMonths, active: code.active, createdAt: code.createdAt.toISOString(),
    applied: appliedByCode.get(code.id) ?? 0,
    conversions: 0, monthlyConversions: 0, annualConversions: 0, payments: 0, revenueCop: 0, discountCop: 0, commissionCop: 0, lastPaidAt: null,
  }]));

  const lines: CreatorPaymentLine[] = [];
  const newestFirst = [...ledger].sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime());
  for (const row of newestFirst) {
    const code = byId.get(row.creatorCodeId);
    if (!code || !inRange(row.paidAt, range)) continue;
    const approved = row.status === 'APPROVED';
    const since = convertedAt.get(keyOf(row)) ?? row.paidAt;
    const inWindow = inShareWindow(row.paidAt, since, code.shareMonths);
    const commission = approved ? commissionCop(row.amountInCents, row.paidAt, since, code.sharePercent, code.shareMonths) : 0;
    const interval = intervalOf(row.interval);
    const kind = row.kind === 'first' ? 'first' : 'renewal';
    lines.push({
      id: row.id, creatorCodeId: code.id, code: code.code, creatorName: code.creatorName, userId: row.userId,
      interval, kind, status: row.status, amountCop: row.amountInCents / 100, discountCop: row.discountInCents / 100,
      commissionCop: commission, inWindow, paidAt: row.paidAt.toISOString(),
    });
    if (!approved) continue;

    const entry = stats.get(code.id)!;
    entry.payments += 1;
    entry.revenueCop += row.amountInCents / 100;
    entry.discountCop += row.discountInCents / 100;
    entry.commissionCop += commission;
    if (kind === 'first') {
      entry.conversions += 1;
      if (interval === 'year') entry.annualConversions += 1;
      else entry.monthlyConversions += 1;
    }
    if (!entry.lastPaidAt) entry.lastPaidAt = row.paidAt.toISOString();
  }

  const list = [...stats.values()].sort((a, b) => b.revenueCop - a.revenueCop || a.code.localeCompare(b.code));
  const sum = (pick: (entry: CreatorCodeStats) => number) => list.reduce((total, entry) => total + pick(entry), 0);
  return {
    codes: list,
    lines,
    totals: {
      applied: sum((e) => e.applied), conversions: sum((e) => e.conversions), payments: sum((e) => e.payments),
      revenueCop: sum((e) => e.revenueCop), commissionCop: sum((e) => e.commissionCop),
    },
  };
}
