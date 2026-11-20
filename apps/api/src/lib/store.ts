import { createHash, randomInt } from 'crypto';

/**
 * Reglas puras de la tienda (módulo store): estados del pedido, WhatsApp, códigos,
 * referencias de Wompi, comisión, ganancia y vistas públicas. Sin base de datos, para
 * probarlas sin nada más (tests/store.test.ts).
 */

export const STORE_STATUSES = [
  'pendiente_pago', 'pago_reportado', 'pago_verificado', 'pendiente_proveedor',
  'en_proceso', 'entregado', 'cancelado', 'reembolsado',
] as const;
export type StoreStatus = (typeof STORE_STATUSES)[number];
export type StoreActor = 'cliente' | 'admin' | 'wompi';

export const STATUS_LABEL: Record<StoreStatus, string> = {
  pendiente_pago: 'Pendiente de pago',
  pago_reportado: 'Pago reportado',
  pago_verificado: 'Pago verificado',
  pendiente_proveedor: 'Pendiente de proveedor',
  en_proceso: 'En proceso',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
  reembolsado: 'Reembolsado',
};

const NEXT: Record<StoreStatus, StoreStatus[]> = {
  pendiente_pago: ['pago_reportado', 'pago_verificado', 'cancelado'],
  pago_reportado: ['pago_verificado', 'pendiente_pago', 'cancelado'],
  pago_verificado: ['pendiente_proveedor', 'en_proceso', 'reembolsado'],
  pendiente_proveedor: ['en_proceso', 'reembolsado'],
  en_proceso: ['entregado', 'reembolsado'],
  entregado: ['reembolsado'],
  cancelado: [],
  reembolsado: [],
};

export const isStoreStatus = (value: string): value is StoreStatus => (STORE_STATUSES as readonly string[]).includes(value);

/**
 * El cliente solo reporta su pago. Wompi solo verifica un pago (y solo él salta
 * de «Pendiente de pago» a «Pago verificado»). El admin hace lo demás.
 */
export function canTransition(from: string, to: string, actor: StoreActor): boolean {
  if (!isStoreStatus(from) || !isStoreStatus(to) || !NEXT[from].includes(to)) return false;
  if (actor === 'cliente') return from === 'pendiente_pago' && to === 'pago_reportado';
  if (actor === 'wompi') return to === 'pago_verificado';
  return !(from === 'pendiente_pago' && to === 'pago_verificado');
}

export const nextStatuses = (from: string, actor: StoreActor = 'admin'): StoreStatus[] =>
  isStoreStatus(from) ? NEXT[from].filter((to) => canTransition(from, to, actor)) : [];

/** Pagados y no reembolsados: cuentan como ingreso. */
export const PAID_STATUSES: readonly StoreStatus[] = ['pago_verificado', 'pendiente_proveedor', 'en_proceso', 'entregado'];

/** Segmentos encendidos de la barra de carga (0 a 5); null apaga la barra. */
export function chargeLevel(status: string): number | null {
  const order: StoreStatus[] = ['pendiente_pago', 'pago_reportado', 'pago_verificado', 'pendiente_proveedor', 'en_proceso', 'entregado'];
  const index = order.indexOf(status as StoreStatus);
  return index === -1 ? null : index;
}

// ─── Cliente ────────────────────────────────────────────────────────────────

/** Celular colombiano (10 dígitos que empiezan por 3, con o sin 57) a +573XXXXXXXXX. */
export function normalizeWhatsapp(input: string): string | null {
  let digits = String(input ?? '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('57')) digits = digits.slice(2);
  return digits.length === 10 && digits.startsWith('3') ? `+57${digits}` : null;
}

export const maskWhatsapp = (whatsapp: string): string =>
  whatsapp.length >= 8 ? `${whatsapp.slice(0, 6)} ••• ••${whatsapp.slice(-2)}` : '•••';

export const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? '';

/** Sin 0, 1, I, L ni O, para dictarlo sin errores. */
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function newOrderCode(pick: (max: number) => number = randomInt): string {
  let code = 'VT-';
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[pick(CODE_ALPHABET.length)];
  return code;
}

export const normalizeOrderCode = (input: string): string => String(input ?? '').trim().toUpperCase();

/** Hash corto de la IP para limitar pedidos por red sin guardar la IP. */
export const ipHash = (ip: string): string => createHash('sha256').update(`store:${ip}`).digest('hex').slice(0, 32);

// ─── Wompi ──────────────────────────────────────────────────────────────────

/** Wompi no repite referencias: cada intento de pago lleva su número. */
export const storeReference = (code: string, attempt: number): string => `${code}-${attempt}`;

const REFERENCE = new RegExp(`^(VT-[${CODE_ALPHABET}]{6})-(\\d{1,4})$`);

export function parseStoreReference(reference: string): { code: string; attempt: number } | null {
  const match = REFERENCE.exec(String(reference ?? ''));
  return match ? { code: match[1], attempt: Number(match[2]) } : null;
}

export const isStoreReference = (reference: string | null | undefined): boolean => String(reference ?? '').startsWith('VT-');

export function wompiCheckoutUrl(input: { publicKey: string; reference: string; amountInCents: number; signature: string; redirectUrl: string; customerName?: string }): string {
  const params = new URLSearchParams({
    'public-key': input.publicKey,
    currency: 'COP',
    'amount-in-cents': String(input.amountInCents),
    reference: input.reference,
    'signature:integrity': input.signature,
    'redirect-url': input.redirectUrl,
  });
  if (input.customerName) params.set('customer-data:full-name', input.customerName);
  return `https://checkout.wompi.co/p/?${params.toString()}`;
}

/** Comisión de Wompi con su IVA (19 %). null si no está configurada. */
export function wompiFee(priceCop: number, feeBps: number, feeFixedCop: number): number | null {
  if (!feeBps && !feeFixedCop) return null;
  return Math.round(((priceCop * feeBps) / 10_000 + feeFixedCop) * 1.19);
}

// ─── Dinero ─────────────────────────────────────────────────────────────────

export interface FinanceInput { status: string; priceCop: number; costCop: number | null; providerRefunded: boolean; feeCop: number | null }

/**
 * Ingreso: el precio si el pago está verificado y no se reembolsó. Costo: lo pagado al
 * proveedor si no lo devolvió (también en un reembolso). Comisión: la de Wompi si la hubo.
 */
export function orderFinance(o: FinanceInput): { revenue: number; cost: number; fee: number; profit: number } {
  const revenue = (PAID_STATUSES as readonly string[]).includes(o.status) ? o.priceCop : 0;
  const cost = o.costCop != null && !o.providerRefunded ? o.costCop : 0;
  const fee = o.feeCop ?? 0;
  return { revenue, cost, fee, profit: revenue - cost - fee };
}

// ─── Comprobantes ───────────────────────────────────────────────────────────

export const MAX_PROOF_BYTES = 2 * 1024 * 1024;
export const MAX_PROOFS = 5;
export const MAX_UNPAID_PER_WHATSAPP = 3;
export const MAX_ORDERS_PER_IP_HOUR = 10;

/** Tipo real del archivo por sus primeros bytes (no por lo que dice el navegador). */
export function detectProofMime(bytes: Uint8Array): 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf' | null {
  const b = bytes;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP') return 'image/webp';
  if (b.length >= 5 && String.fromCharCode(...b.slice(0, 5)) === '%PDF-') return 'application/pdf';
  return null;
}

// ─── Métodos de pago ────────────────────────────────────────────────────────

export interface PaymentMethod {
  id: string;
  kind: 'nequi' | 'transferencia';
  label: string;
  holder: string;
  number: string;
  bank: string;
  accountType: string;
  instructions: string;
  active: boolean;
}

/** Lo guardado en `paymentMethods` (jsonb): solo entradas con forma válida. */
export function readPaymentMethods(value: unknown): PaymentMethod[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((m): m is Record<string, unknown> => Boolean(m) && typeof m === 'object')
    .map((m) => ({
      id: String(m.id ?? ''),
      kind: m.kind === 'nequi' ? 'nequi' as const : 'transferencia' as const,
      label: String(m.label ?? ''),
      holder: String(m.holder ?? ''),
      number: String(m.number ?? ''),
      bank: String(m.bank ?? ''),
      accountType: String(m.accountType ?? ''),
      instructions: String(m.instructions ?? ''),
      active: m.active === true,
    }))
    .filter((m) => m.id);
}

/** Un método se ofrece solo si está activo y tiene titular y número. */
export const usablePaymentMethods = (value: unknown): PaymentMethod[] =>
  readPaymentMethods(value).filter((m) => m.active && m.holder.trim() && m.number.trim());

/** Para encender Wompi: el vendedor visible y el nombre del cobro (condiciones de la arquitectura). */
export function wompiMissing(s: { legalName: string; documentId: string; wompiMerchantName: string }): string[] {
  const missing: string[] = [];
  if (!s.legalName.trim()) missing.push('nombre o razón social del titular');
  if (!s.documentId.trim()) missing.push('cédula o NIT del titular');
  if (!s.wompiMerchantName.trim()) missing.push('nombre con el que aparece el cobro');
  return missing;
}

export const appendNote = (notes: string, line: string, at = new Date()): string =>
  `${notes ? `${notes}\n` : ''}[${at.toISOString().slice(0, 16).replace('T', ' ')} UTC] ${line}`;
