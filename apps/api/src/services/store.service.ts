import { createHash } from 'crypto';
import jwt from 'jsonwebtoken';
import { Prisma, type StoreOrder, type StoreProduct, type StoreSettings } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { isAdminEmail } from '../lib/admin';
import { WompiError, getTransaction, integritySignature, wompiConfig } from '../lib/wompi';
import {
  MAX_ORDERS_PER_IP_HOUR, MAX_PROOF_BYTES, MAX_PROOFS, MAX_UNPAID_PER_WHATSAPP, PAID_STATUSES, STATUS_LABEL,
  appendNote, canTransition, chargeLevel, detectProofMime, firstName, ipHash, isStoreStatus, maskWhatsapp,
  newOrderCode, nextStatuses, normalizeOrderCode, normalizeWhatsapp, orderFinance, parseStoreReference,
  readPaymentMethods, storeReference, usablePaymentMethods, wompiCheckoutUrl, wompiFee, wompiMissing,
  type StoreActor, type StoreStatus,
} from '../lib/store';

/**
 * Tienda (módulo store): un sitio de venta aparte que usa esta API, esta base y el
 * comercio de Wompi. Todo cambio de estado de un pedido pasa por `applyTransition`.
 * Las respuestas públicas nunca llevan costo, proveedor, notas internas ni comisión.
 */

export class StoreError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = 'StoreError';
  }
}

type Tx = Prisma.TransactionClient;
const db = () => prisma;

// ─── Ajustes ────────────────────────────────────────────────────────────────

export const getSettings = (): Promise<StoreSettings> =>
  db().storeSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });

/** Llaves de Wompi suficientes para cobrar y consultar (las mismas de los cobros de la app). */
const wompiReady = () => wompiConfig().configured;
const wompiOn = (s: StoreSettings) => s.wompiEnabled && wompiReady();

export function publicSettings(s: StoreSettings) {
  return {
    legalName: s.legalName,
    documentId: s.documentId,
    city: s.city,
    address: s.address,
    email: s.email,
    whatsapp: s.whatsapp,
    supportHours: s.supportHours,
    deliveryEstimate: s.deliveryEstimate,
    manualPayments: usablePaymentMethods(s.paymentMethods).length > 0,
    wompi: wompiOn(s) ? { merchantName: s.wompiMerchantName } : null,
  };
}

// ─── Catálogo ───────────────────────────────────────────────────────────────

export function publicProduct(p: StoreProduct, s: StoreSettings) {
  return {
    slug: p.slug,
    name: p.name,
    platform: p.platform,
    accessMode: p.accessMode,
    category: p.category,
    shortDescription: p.shortDescription,
    description: p.description,
    conditions: p.conditions,
    coverage: p.coverage,
    deliveryEstimate: p.deliveryEstimate || s.deliveryEstimate,
    ageRating: p.ageRating,
    priceCop: p.priceCop,
    compareAtCop: p.compareAtCop,
    availability: p.availability,
    availabilityCheckedAt: p.availabilityCheckedAt,
    images: p.images,
    featured: p.featured,
  };
}

export async function getCatalog() {
  const [settings, products] = await Promise.all([
    getSettings(),
    db().storeProduct.findMany({ where: { active: true }, orderBy: [{ featured: 'desc' }, { createdAt: 'asc' }] }),
  ]);
  return { settings: publicSettings(settings), products: products.map((p) => publicProduct(p, settings)) };
}

export async function getPublicProduct(slug: string) {
  const [settings, product] = await Promise.all([getSettings(), db().storeProduct.findUnique({ where: { slug } })]);
  if (!product || !product.active) throw new StoreError(404, 'NOT_FOUND', 'Ese juego no está en el catálogo.');
  return { settings: publicSettings(settings), product: publicProduct(product, settings) };
}

// ─── Pedidos (cliente) ──────────────────────────────────────────────────────

type OrderWithRelations = StoreOrder & { product: StoreProduct; events: { status: string; note: string; createdAt: Date }[]; _count: { files: number } };

const orderInclude = {
  product: true,
  events: { orderBy: { createdAt: 'asc' as const }, select: { status: true, note: true, createdAt: true } },
  _count: { select: { files: true } },
};

export function publicOrder(o: OrderWithRelations, s: StoreSettings) {
  const waiting = o.status === 'pendiente_pago';
  return {
    id: o.id,
    code: o.code,
    status: o.status,
    statusLabel: STATUS_LABEL[o.status as StoreStatus] ?? o.status,
    chargeLevel: chargeLevel(o.status),
    createdAt: o.createdAt,
    product: { name: o.productName, slug: o.product.slug, platform: o.product.platform, accessMode: o.product.accessMode },
    priceCop: o.priceCop,
    customerFirstName: firstName(o.customerName),
    whatsappMasked: maskWhatsapp(o.customerWhatsapp),
    events: o.events.map((e) => ({ status: e.status, statusLabel: STATUS_LABEL[e.status as StoreStatus] ?? e.status, note: e.note, createdAt: e.createdAt })),
    paymentMethod: o.paymentMethod,
    wompiStatus: o.wompiStatus,
    payment: waiting
      ? {
          methods: usablePaymentMethods(s.paymentMethods).map(({ active: _active, ...m }) => m),
          wompi: wompiOn(s) ? { merchantName: s.wompiMerchantName } : null,
          proofCount: o._count.files,
          maxProofs: MAX_PROOFS,
        }
      : null,
    deliveryEstimate: o.product.deliveryEstimate || s.deliveryEstimate,
    supportWhatsapp: s.whatsapp,
  };
}

async function loadOrder(id: string): Promise<OrderWithRelations> {
  const order = await db().storeOrder.findUnique({ where: { id }, include: orderInclude }).catch(() => null);
  if (!order) throw new StoreError(404, 'NOT_FOUND', 'No encontramos ese pedido.');
  return order;
}

export async function getPublicOrder(id: string) {
  const [order, settings] = await Promise.all([loadOrder(id), getSettings()]);
  return publicOrder(order, settings);
}

export async function createOrder(input: { slug: string; name: string; whatsapp: string; accept: true }, ip: string): Promise<{ id: string; code: string }> {
  const whatsapp = normalizeWhatsapp(input.whatsapp);
  if (!whatsapp) throw new StoreError(400, 'WHATSAPP', 'Escribe un celular colombiano de 10 dígitos (empieza por 3).');
  const product = await db().storeProduct.findUnique({ where: { slug: input.slug } });
  if (!product || !product.active) throw new StoreError(404, 'NOT_FOUND', 'Ese juego no está en el catálogo.');
  if (product.availability !== 'disponible') {
    throw new StoreError(409, 'UNAVAILABLE', 'Este juego todavía no tiene disponibilidad confirmada. Escríbenos por WhatsApp y te avisamos.');
  }
  const unpaid = await db().storeOrder.count({ where: { customerWhatsapp: whatsapp, status: 'pendiente_pago' } });
  if (unpaid >= MAX_UNPAID_PER_WHATSAPP) {
    throw new StoreError(429, 'TOO_MANY_UNPAID', `Ya tienes ${MAX_UNPAID_PER_WHATSAPP} pedidos sin pagar con este número. Paga uno o escríbenos por WhatsApp para cancelarlo.`);
  }
  const hash = ipHash(ip);
  const recent = await db().storeOrder.count({ where: { ipHash: hash, createdAt: { gte: new Date(Date.now() - 3_600_000) } } });
  if (recent >= MAX_ORDERS_PER_IP_HOUR) throw new StoreError(429, 'TOO_MANY', 'Demasiados pedidos desde esta conexión. Intenta en una hora o escríbenos por WhatsApp.');

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newOrderCode();
    try {
      const order = await db().storeOrder.create({
        data: {
          code,
          productId: product.id,
          productName: product.name,
          priceCop: product.priceCop,
          customerName: input.name.trim(),
          customerWhatsapp: whatsapp,
          termsAcceptedAt: new Date(),
          ipHash: hash,
          events: { create: { status: 'pendiente_pago', actor: 'cliente', note: 'Pedido creado.' } },
        },
        select: { id: true, code: true },
      });
      return order;
    } catch (err) {
      const duplicateCode = err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
      if (!duplicateCode) throw err;
    }
  }
  throw new StoreError(503, 'CODE', 'No pudimos crear el pedido. Intenta otra vez.');
}

export async function findOrder(code: string, whatsappInput: string): Promise<{ id: string }> {
  const whatsapp = normalizeWhatsapp(whatsappInput);
  const order = whatsapp
    ? await db().storeOrder.findFirst({ where: { code: normalizeOrderCode(code), customerWhatsapp: whatsapp }, select: { id: true } })
    : null;
  if (!order) throw new StoreError(404, 'NOT_FOUND', 'No hay un pedido con ese código y ese WhatsApp.');
  return order;
}

/** Único lugar que cambia el estado: valida la transición y deja el evento en la misma transacción. */
async function applyTransition(tx: Tx, order: Pick<StoreOrder, 'id' | 'status'>, to: StoreStatus, actor: StoreActor, opts: { note?: string; patch?: Prisma.StoreOrderUncheckedUpdateManyInput } = {}) {
  if (!canTransition(order.status, to, actor)) {
    const from = STATUS_LABEL[order.status as StoreStatus] ?? order.status;
    throw new StoreError(409, 'TRANSITION', `Un pedido en «${from}» no puede pasar a «${STATUS_LABEL[to]}».`);
  }
  const updated = await tx.storeOrder.updateMany({ where: { id: order.id, status: order.status }, data: { ...opts.patch, status: to } });
  if (updated.count !== 1) throw new StoreError(409, 'CONFLICT', 'El pedido cambió mientras tanto. Recarga e intenta otra vez.');
  await tx.storeOrderEvent.create({ data: { orderId: order.id, status: to, actor, note: opts.note ?? '' } });
}

export async function addProof(orderId: string, input: { method: 'nequi' | 'transferencia'; reference: string; data: string }) {
  const [order, settings] = await Promise.all([loadOrder(orderId), getSettings()]);
  if (order.status !== 'pendiente_pago') throw new StoreError(409, 'NOT_WAITING', 'Este pedido ya no espera un pago.');
  if (!usablePaymentMethods(settings.paymentMethods).some((m) => m.kind === input.method)) {
    throw new StoreError(400, 'METHOD', 'Ese medio de pago no está activo.');
  }
  const bytes = Buffer.from(input.data, 'base64');
  if (!bytes.length) throw new StoreError(400, 'EMPTY', 'El archivo está vacío.');
  if (bytes.length > MAX_PROOF_BYTES) throw new StoreError(413, 'TOO_BIG', 'El comprobante pesa más de 2 MB. Sube una captura más liviana.');
  const mime = detectProofMime(bytes);
  if (!mime) throw new StoreError(415, 'TYPE', 'Sube una foto (JPG, PNG o WebP) o un PDF.');
  if (order._count.files >= MAX_PROOFS) throw new StoreError(409, 'TOO_MANY_FILES', 'Este pedido ya tiene 5 comprobantes. Escríbenos por WhatsApp.');

  const label = input.method === 'nequi' ? 'Nequi' : 'transferencia';
  await db().$transaction(async (tx) => {
    await tx.storeFile.create({ data: { orderId, mime, size: bytes.length, bytes } });
    await applyTransition(tx, order, 'pago_reportado', 'cliente', {
      note: `Comprobante enviado (${label}${input.reference ? `, referencia ${input.reference}` : ''}).`,
      patch: { paymentMethod: input.method, paymentReference: input.reference || null },
    });
  });
  return getPublicOrder(orderId);
}

// ─── Wompi ──────────────────────────────────────────────────────────────────

const WOMPI_PENDING_WINDOW_MS = 45 * 60_000;

export async function startWompi(orderId: string): Promise<{ url: string }> {
  const [order, settings] = await Promise.all([loadOrder(orderId), getSettings()]);
  if (order.status !== 'pendiente_pago') throw new StoreError(409, 'NOT_WAITING', 'Este pedido ya no espera un pago.');
  const cfg = wompiConfig();
  if (!wompiOn(settings) || !cfg.publicKey || !cfg.integritySecret) throw new StoreError(409, 'WOMPI_OFF', 'El pago en línea no está disponible. Paga por Nequi o transferencia.');
  if (!settings.siteUrl) throw new StoreError(503, 'SITE_URL', 'Falta la dirección del sitio en Ajustes.');
  if (order.wompiStatus === 'PENDING' && Date.now() - order.updatedAt.getTime() < WOMPI_PENDING_WINDOW_MS) {
    throw new StoreError(409, 'WOMPI_PENDING', 'Tienes un pago en proceso en Wompi. Espera unos minutos antes de intentar otra vez.');
  }
  const { wompiAttempts } = await db().storeOrder.update({ where: { id: orderId }, data: { wompiAttempts: { increment: 1 } }, select: { wompiAttempts: true } });
  const reference = storeReference(order.code, wompiAttempts);
  const amountInCents = order.priceCop * 100;
  return {
    url: wompiCheckoutUrl({
      publicKey: cfg.publicKey,
      reference,
      amountInCents,
      signature: integritySignature(reference, amountInCents, 'COP', cfg.integritySecret),
      redirectUrl: `${settings.siteUrl.replace(/\/+$/, '')}/pedido/${order.id}`,
      customerName: order.customerName,
    }),
  };
}

export interface StoreWompiTransaction { id: string; reference: string; status: string; amountInCents: number; currency: string }

/**
 * Aplica una transacción de Wompi a su pedido (webhook, regreso del cliente o botón del
 * panel). Idempotente. Devuelve false si la referencia no es de un pedido de la tienda.
 */
export async function applyWompiTransaction(t: StoreWompiTransaction): Promise<boolean> {
  const ref = parseStoreReference(t.reference);
  if (!ref) return false;
  const order = await db().storeOrder.findUnique({ where: { code: ref.code } });
  if (!order) return false;
  if (t.currency !== 'COP' || t.amountInCents !== order.priceCop * 100) {
    console.error('[STORE_WOMPI_MISMATCH]', order.code, t.id, t.amountInCents, t.currency);
    return false;
  }
  if (t.status === 'APPROVED') {
    if (order.wompiTransactionId === t.id) return true;
    if (order.status === 'pendiente_pago' || order.status === 'pago_reportado') {
      const settings = await getSettings();
      try {
        await db().$transaction((tx) => applyTransition(tx, order, 'pago_verificado', 'wompi', {
          note: `Pago aprobado por Wompi (transacción ${t.id}).`,
          patch: {
            paymentMethod: 'wompi',
            paymentReference: t.reference,
            wompiTransactionId: t.id,
            wompiStatus: 'APPROVED',
            feeCop: wompiFee(order.priceCop, settings.wompiFeeBps, settings.wompiFeeFixedCop),
          },
        }));
      } catch (err) {
        // Webhook y regreso del cliente a la vez: si el otro ya lo aplicó, listo.
        const now = await db().storeOrder.findUnique({ where: { id: order.id }, select: { wompiTransactionId: true } });
        if (now?.wompiTransactionId === t.id) return true;
        throw err;
      }
      return true;
    }
    await db().storeOrder.update({
      where: { id: order.id },
      data: { notes: appendNote(order.notes, `Pago duplicado por Wompi (transacción ${t.id}, ${t.reference}) con el pedido en «${STATUS_LABEL[order.status as StoreStatus] ?? order.status}»: reembolsar.`) },
    });
    return true;
  }
  if (order.status === 'pendiente_pago' && !order.wompiTransactionId && ['PENDING', 'DECLINED', 'ERROR', 'VOIDED'].includes(t.status)) {
    await db().storeOrder.update({ where: { id: order.id }, data: { wompiStatus: t.status } });
  }
  return true;
}

async function checkWompiTransaction(order: Pick<StoreOrder, 'code'>, transactionId: string) {
  if (!wompiConfig().privateKey) throw new StoreError(409, 'WOMPI_OFF', 'Wompi no está configurado.');
  let t;
  try {
    t = await getTransaction(transactionId);
  } catch (err) {
    if (err instanceof WompiError && err.status === 404) throw new StoreError(404, 'WOMPI_NOT_FOUND', 'No encontramos ese pago en Wompi.');
    throw new StoreError(502, 'WOMPI_DOWN', 'No pudimos consultar a Wompi. Intenta en un momento.');
  }
  if (parseStoreReference(t.reference)?.code !== order.code) throw new StoreError(400, 'WOMPI_OTHER', 'Ese pago no corresponde a este pedido.');
  await applyWompiTransaction(t);
}

/** Al volver de Wompi: el id de la URL solo dice qué consultar; el resultado lo da Wompi con la llave privada. */
export async function confirmWompi(orderId: string, transactionId: string) {
  const order = await loadOrder(orderId);
  await checkWompiTransaction(order, transactionId);
  return getPublicOrder(orderId);
}

// ─── Panel: sesión ──────────────────────────────────────────────────────────

const list = (value: string | undefined) => String(value ?? '').split(',').map((v) => v.trim()).filter(Boolean);

/** STORE_ADMIN_USER_IDS manda; sin ella, los administradores de la app. */
export function isStoreAdmin(userId: string, email: string | null | undefined): boolean {
  const ids = list(process.env.STORE_ADMIN_USER_IDS);
  return ids.length ? ids.includes(userId) : isAdminEmail(email);
}

/** Secreto propio del panel: un token de la tienda no sirve en el resto de la API, ni al revés. */
function panelSecret(): string {
  const base = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!base) throw new StoreError(503, 'AUTH_OFF', 'El panel no está configurado.');
  return createHash('sha256').update(`${base}:store-panel`).digest('hex');
}

interface PanelClaims { userId: string; email: string; typ: 'handoff' | 'session' }

export async function createHandoff(userId: string): Promise<{ url: string }> {
  const [user, settings] = await Promise.all([db().user.findUnique({ where: { id: userId }, select: { id: true, email: true } }), getSettings()]);
  if (!user || !isStoreAdmin(user.id, user.email)) throw new StoreError(403, 'FORBIDDEN', 'Tu cuenta no administra la tienda.');
  if (!settings.siteUrl) throw new StoreError(503, 'SITE_URL', 'Falta la dirección del sitio en Ajustes.');
  const token = jwt.sign({ userId: user.id, email: user.email, typ: 'handoff' } satisfies PanelClaims, panelSecret(), { expiresIn: '2m' });
  return { url: `${settings.siteUrl.replace(/\/+$/, '')}/admin/entrar#t=${token}` };
}

function readPanelToken(token: string, typ: PanelClaims['typ']): PanelClaims {
  let claims: PanelClaims;
  try {
    claims = jwt.verify(token, panelSecret()) as PanelClaims;
  } catch {
    throw new StoreError(401, 'SESSION', typ === 'handoff' ? 'El enlace de entrada venció. Ábrelo otra vez desde NoutLife.' : 'Tu sesión venció. Entra otra vez.');
  }
  if (claims.typ !== typ || !isStoreAdmin(claims.userId, claims.email)) throw new StoreError(401, 'SESSION', 'Tu sesión no es válida. Entra otra vez.');
  return claims;
}

export function exchangeHandoff(token: string): { token: string; email: string; expiresInSeconds: number } {
  const claims = readPanelToken(token, 'handoff');
  const expiresInSeconds = 12 * 3600;
  return {
    token: jwt.sign({ userId: claims.userId, email: claims.email, typ: 'session' } satisfies PanelClaims, panelSecret(), { expiresIn: expiresInSeconds }),
    email: claims.email,
    expiresInSeconds,
  };
}

export const verifyPanelSession = (token: string): PanelClaims => readPanelToken(token, 'session');

// ─── Panel: pedidos ─────────────────────────────────────────────────────────

const ADMIN_LIST_LIMIT = 300;

export async function listOrders(filter: { status?: string; q?: string; from?: Date; to?: Date }) {
  const q = filter.q?.trim();
  const qWhatsapp = q ? normalizeWhatsapp(q) : null;
  const orders = await db().storeOrder.findMany({
    where: {
      ...(filter.status && isStoreStatus(filter.status) ? { status: filter.status } : {}),
      ...(filter.from || filter.to ? { createdAt: { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lt: filter.to } : {}) } } : {}),
      ...(q
        ? {
            OR: [
              { code: { contains: q.toUpperCase() } },
              { customerName: { contains: q, mode: 'insensitive' as const } },
              { customerWhatsapp: { contains: qWhatsapp ?? (q.replace(/\D/g, '') || q) } },
              { productName: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: ADMIN_LIST_LIMIT,
    select: { id: true, code: true, customerName: true, customerWhatsapp: true, productName: true, priceCop: true, status: true, paymentMethod: true, createdAt: true, updatedAt: true },
  });
  return orders.map((o) => ({ ...o, statusLabel: STATUS_LABEL[o.status as StoreStatus] ?? o.status }));
}

export async function orderDetail(id: string) {
  const order = await db().storeOrder.findUnique({
    where: { id },
    include: {
      product: { select: { id: true, slug: true, name: true, availability: true, availabilityCheckedAt: true } },
      provider: { select: { id: true, name: true, whatsapp: true } },
      events: { orderBy: { createdAt: 'asc' } },
      files: { orderBy: { createdAt: 'asc' }, select: { id: true, mime: true, size: true, createdAt: true } },
    },
  }).catch(() => null);
  if (!order) throw new StoreError(404, 'NOT_FOUND', 'No encontramos ese pedido.');
  const [offers, settings] = await Promise.all([
    db().storeProviderProduct.findMany({ where: { productId: order.productId }, include: { provider: { select: { id: true, name: true, active: true } } }, orderBy: [{ isDefault: 'desc' }, { costCop: 'asc' }] }),
    getSettings(),
  ]);
  const { ipHash: _ip, ...rest } = order;
  return {
    ...rest,
    statusLabel: STATUS_LABEL[order.status as StoreStatus] ?? order.status,
    chargeLevel: chargeLevel(order.status),
    next: nextStatuses(order.status, 'admin').map((s) => ({ status: s, label: STATUS_LABEL[s] })),
    finance: orderFinance(order),
    offers: offers.map((o) => ({ providerId: o.providerId, providerName: o.provider.name, providerActive: o.provider.active, costCop: o.costCop, available: o.available, checkedAt: o.checkedAt, isDefault: o.isDefault })),
    wompiReady: wompiReady(),
    estimatedFee: wompiFee(order.priceCop, settings.wompiFeeBps, settings.wompiFeeFixedCop),
  };
}

export async function adminTransition(id: string, input: { status: StoreStatus; note: string; providerId?: string; costCop?: number }) {
  await db().$transaction(async (tx) => {
    const order = await tx.storeOrder.findUnique({ where: { id } });
    if (!order) throw new StoreError(404, 'NOT_FOUND', 'No encontramos ese pedido.');
    const patch: Prisma.StoreOrderUncheckedUpdateManyInput = {};
    if (input.status === 'en_proceso') {
      let providerId = input.providerId ?? order.providerId;
      let costCop = input.costCop ?? order.costCop;
      if (!providerId || costCop == null) {
        const offer = await tx.storeProviderProduct.findFirst({ where: { productId: order.productId, ...(providerId ? { providerId } : { isDefault: true }) } });
        providerId ??= offer?.providerId ?? null;
        costCop ??= offer?.costCop ?? null;
      }
      if (!providerId || costCop == null) throw new StoreError(409, 'PROVIDER', 'Asigna el proveedor y el costo antes de pasar a «En proceso».');
      const exists = await tx.storeProvider.findUnique({ where: { id: providerId }, select: { id: true } });
      if (!exists) throw new StoreError(400, 'PROVIDER', 'Ese proveedor no existe.');
      Object.assign(patch, { providerId, costCop });
    }
    await applyTransition(tx, order, input.status, 'admin', { note: input.note, patch });
  });
  return orderDetail(id);
}

export async function updateOrder(id: string, input: { notes?: string; providerId?: string | null; costCop?: number | null; feeCop?: number | null; providerRefunded?: boolean }) {
  if (input.providerId) {
    const exists = await db().storeProvider.findUnique({ where: { id: input.providerId }, select: { id: true } });
    if (!exists) throw new StoreError(400, 'PROVIDER', 'Ese proveedor no existe.');
  }
  await db().storeOrder.update({ where: { id }, data: input }).catch((err) => {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') throw new StoreError(404, 'NOT_FOUND', 'No encontramos ese pedido.');
    throw err;
  });
  return orderDetail(id);
}

export async function adminCheckWompi(id: string, transactionId: string) {
  const order = await db().storeOrder.findUnique({ where: { id }, select: { code: true } });
  if (!order) throw new StoreError(404, 'NOT_FOUND', 'No encontramos ese pedido.');
  await checkWompiTransaction(order, transactionId);
  return orderDetail(id);
}

export async function getFile(id: string) {
  const file = await db().storeFile.findUnique({ where: { id } });
  if (!file) throw new StoreError(404, 'NOT_FOUND', 'No encontramos ese archivo.');
  return file;
}

// ─── Panel: clientes, ventas y resumen ──────────────────────────────────────

/** ponytail: agrupa en memoria; con miles de pedidos, pasar a groupBy en SQL. */
export async function listCustomers(q?: string) {
  const orders = await db().storeOrder.findMany({ orderBy: { createdAt: 'desc' }, select: { customerName: true, customerWhatsapp: true, status: true, priceCop: true, createdAt: true, code: true, id: true } });
  const byNumber = new Map<string, { whatsapp: string; name: string; orders: number; paidCop: number; lastOrderAt: Date; lastOrderId: string; codes: string[] }>();
  for (const o of orders) {
    const c = byNumber.get(o.customerWhatsapp) ?? { whatsapp: o.customerWhatsapp, name: o.customerName, orders: 0, paidCop: 0, lastOrderAt: o.createdAt, lastOrderId: o.id, codes: [] };
    c.orders += 1;
    if ((PAID_STATUSES as readonly string[]).includes(o.status)) c.paidCop += o.priceCop;
    c.codes.push(o.code);
    byNumber.set(o.customerWhatsapp, c);
  }
  const needle = q?.trim().toLowerCase();
  const digits = q?.replace(/\D/g, '');
  return [...byNumber.values()].filter((c) => !needle || c.name.toLowerCase().includes(needle) || (digits && c.whatsapp.includes(digits)) || c.codes.some((code) => code.toLowerCase().includes(needle)));
}

export async function sales(filter: { from?: Date; to?: Date }) {
  const orders = await db().storeOrder.findMany({
    where: {
      status: { in: [...PAID_STATUSES, 'reembolsado'] },
      ...(filter.from || filter.to ? { createdAt: { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lt: filter.to } : {}) } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: { provider: { select: { name: true } } },
  });
  const rows = orders.map((o) => ({
    id: o.id, code: o.code, createdAt: o.createdAt, productName: o.productName, customerName: o.customerName,
    status: o.status, statusLabel: STATUS_LABEL[o.status as StoreStatus] ?? o.status, paymentMethod: o.paymentMethod,
    priceCop: o.priceCop, costCop: o.costCop, feeCop: o.feeCop, providerRefunded: o.providerRefunded, providerName: o.provider?.name ?? null,
    missingFee: o.paymentMethod === 'wompi' && o.feeCop == null,
    ...orderFinance(o),
  }));
  const totals = rows.reduce((t, r) => ({ revenue: t.revenue + r.revenue, cost: t.cost + r.cost, fee: t.fee + r.fee, profit: t.profit + r.profit, orders: t.orders + 1 }), { revenue: 0, cost: 0, fee: 0, profit: 0, orders: 0 });
  return { rows, totals };
}

export async function summary(filter: { from?: Date; to?: Date }) {
  const [{ totals }, waiting, recent, settings] = await Promise.all([
    sales(filter),
    db().storeOrder.groupBy({ by: ['status'], where: { status: { in: ['pendiente_pago', 'pago_reportado', 'pago_verificado', 'pendiente_proveedor', 'en_proceso'] } }, _count: { _all: true } }),
    listOrders({}).then((rows) => rows.slice(0, 8)),
    getSettings(),
  ]);
  const count = (s: StoreStatus) => waiting.find((w) => w.status === s)?._count._all ?? 0;
  const methods = readPaymentMethods(settings.paymentMethods);
  return {
    totals,
    actions: {
      pago_reportado: count('pago_reportado'),
      pago_verificado: count('pago_verificado'),
      pendiente_proveedor: count('pendiente_proveedor'),
      en_proceso: count('en_proceso'),
      pendiente_pago: count('pendiente_pago'),
    },
    recent,
    setup: {
      manualPayments: usablePaymentMethods(methods).length > 0,
      sellerData: Boolean(settings.legalName && settings.documentId && settings.email),
      supportHours: Boolean(settings.supportHours),
      whatsapp: Boolean(settings.whatsapp),
      wompiReady: wompiReady(),
      wompiEnabled: settings.wompiEnabled,
    },
  };
}

// ─── Panel: productos ───────────────────────────────────────────────────────

const productError = (err: unknown): never => {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw new StoreError(409, 'SLUG', 'Ya hay un producto con ese enlace (slug).');
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') throw new StoreError(404, 'NOT_FOUND', 'No encontramos ese producto.');
  if (err instanceof Prisma.PrismaClientUnknownRequestError && /store_products_price_check/.test(err.message)) throw new StoreError(400, 'PRICE', 'El precio «antes» debe ser mayor que el precio.');
  throw err;
};

type ProductInput = Partial<Omit<StoreProduct, 'id' | 'createdAt' | 'updatedAt' | 'availabilityCheckedAt'>>;

/** Confirmar «disponible» (o «agotado») deja la fecha; volver a «por confirmar» la borra. */
const availabilityStamp = (availability: string | undefined) =>
  availability === undefined ? {} : { availabilityCheckedAt: availability === 'por_confirmar' ? null : new Date() };

const checkCompare = (price?: number | null, compare?: number | null) => {
  if (price != null && compare != null && compare <= price) throw new StoreError(400, 'PRICE', 'El precio «antes» debe ser mayor que el precio.');
};

export async function listProducts() {
  const products = await db().storeProduct.findMany({ orderBy: [{ active: 'desc' }, { featured: 'desc' }, { createdAt: 'asc' }], include: { providers: { include: { provider: { select: { name: true } } } }, _count: { select: { orders: true } } } });
  return products.map(({ providers, _count, ...p }) => ({
    ...p,
    orders: _count.orders,
    offers: providers.map((o) => ({ providerId: o.providerId, providerName: o.provider.name, costCop: o.costCop, available: o.available, isDefault: o.isDefault })),
  }));
}

export async function getProduct(id: string) {
  const product = await db().storeProduct.findUnique({ where: { id }, include: { providers: { include: { provider: { select: { id: true, name: true, active: true } } } } } });
  if (!product) throw new StoreError(404, 'NOT_FOUND', 'No encontramos ese producto.');
  return product;
}

export async function createProduct(input: ProductInput & { slug: string; name: string; platform: string; accessMode: string; category: string; priceCop: number }) {
  checkCompare(input.priceCop, input.compareAtCop);
  const created = await db().storeProduct.create({ data: { ...input, ...availabilityStamp(input.availability) } }).catch(productError);
  return getProduct(created.id);
}

export async function updateProduct(id: string, input: ProductInput) {
  const current = await db().storeProduct.findUnique({ where: { id }, select: { priceCop: true, compareAtCop: true } });
  if (!current) throw new StoreError(404, 'NOT_FOUND', 'No encontramos ese producto.');
  checkCompare(input.priceCop ?? current.priceCop, input.compareAtCop === undefined ? current.compareAtCop : input.compareAtCop);
  await db().storeProduct.update({ where: { id }, data: { ...input, ...availabilityStamp(input.availability) } }).catch(productError);
  return getProduct(id);
}

// ─── Panel: proveedores ─────────────────────────────────────────────────────

export async function listProviders() {
  const providers = await db().storeProvider.findMany({
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
    include: {
      products: { include: { product: { select: { id: true, name: true } } }, orderBy: { updatedAt: 'desc' } },
      orders: { where: { costCop: { not: null } }, orderBy: { createdAt: 'desc' }, select: { id: true, code: true, productName: true, costCop: true, providerRefunded: true, status: true, createdAt: true } },
    },
  });
  return providers.map(({ orders, ...p }) => ({
    ...p,
    purchases: orders.map((o) => ({ ...o, statusLabel: STATUS_LABEL[o.status as StoreStatus] ?? o.status })),
    spentCop: orders.reduce((sum, o) => sum + (o.providerRefunded ? 0 : o.costCop ?? 0), 0),
  }));
}

export async function createProvider(input: { name: string; whatsapp: string; notes: string; active: boolean }) {
  return db().storeProvider.create({ data: input });
}

export async function updateProvider(id: string, input: Partial<{ name: string; whatsapp: string; notes: string; active: boolean }>) {
  return db().storeProvider.update({ where: { id }, data: input }).catch((err) => {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') throw new StoreError(404, 'NOT_FOUND', 'No encontramos ese proveedor.');
    throw err;
  });
}

export async function setProviderProduct(providerId: string, productId: string, input: { costCop: number; available: boolean; isDefault: boolean }) {
  const [provider, product] = await Promise.all([
    db().storeProvider.findUnique({ where: { id: providerId }, select: { id: true } }),
    db().storeProduct.findUnique({ where: { id: productId }, select: { id: true } }),
  ]);
  if (!provider || !product) throw new StoreError(404, 'NOT_FOUND', 'Proveedor o producto no encontrado.');
  await db().$transaction(async (tx) => {
    if (input.isDefault) await tx.storeProviderProduct.updateMany({ where: { productId, NOT: { providerId } }, data: { isDefault: false } });
    await tx.storeProviderProduct.upsert({
      where: { providerId_productId: { providerId, productId } },
      create: { providerId, productId, ...input, checkedAt: new Date() },
      update: { ...input, checkedAt: new Date() },
    });
  });
  return listProviders();
}

export async function removeProviderProduct(providerId: string, productId: string) {
  await db().storeProviderProduct.deleteMany({ where: { providerId, productId } });
  return listProviders();
}

// ─── Panel: ajustes ─────────────────────────────────────────────────────────

export async function adminSettings() {
  const s = await getSettings();
  return { ...s, paymentMethods: readPaymentMethods(s.paymentMethods), wompiReady: wompiReady(), wompiMissing: wompiMissing(s) };
}

export async function updateSettings(input: Omit<StoreSettings, 'id' | 'updatedAt' | 'paymentMethods'> & { paymentMethods: unknown[] }) {
  let whatsapp = '';
  if (input.whatsapp.trim()) {
    const normalized = normalizeWhatsapp(input.whatsapp);
    if (!normalized) throw new StoreError(400, 'WHATSAPP', 'El WhatsApp de la tienda debe ser un celular colombiano de 10 dígitos.');
    whatsapp = normalized;
  }
  const ids = new Set<string>();
  for (const m of readPaymentMethods(input.paymentMethods)) {
    if (ids.has(m.id)) throw new StoreError(400, 'METHOD', 'Dos medios de pago tienen el mismo identificador.');
    ids.add(m.id);
    if (m.active && (!m.holder.trim() || !m.number.trim())) throw new StoreError(400, 'METHOD', `Para activar «${m.label}» faltan el titular o el número.`);
  }
  if (input.wompiEnabled) {
    const missing = wompiMissing(input);
    if (missing.length) throw new StoreError(400, 'WOMPI', `Para encender Wompi faltan: ${missing.join(', ')}.`);
    if (!wompiReady()) throw new StoreError(400, 'WOMPI', 'Las llaves de Wompi no están configuradas en el servidor.');
  }
  await db().storeSettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...input, whatsapp, paymentMethods: input.paymentMethods as Prisma.InputJsonValue },
    update: { ...input, whatsapp, paymentMethods: input.paymentMethods as Prisma.InputJsonValue },
  });
  return adminSettings();
}
