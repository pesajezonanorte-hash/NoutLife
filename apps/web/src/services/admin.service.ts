import api from '../lib/api';

export type AdminPlan = 'pro' | 'lite';
export type AdminStatus = 'trialing' | 'active' | 'canceled' | 'lite';

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  username: string;
  level: number;
  gender: string | null;
  createdAt: string;
  lastSeenAt: string | null;
  plan: AdminPlan;
  status: AdminStatus;
  hasPaid: boolean;
  paidCount: number;
  paidTotalCop: number;
  lastPaidAt: string | null;
  pendingPayments: number;
  hasPaymentMethod: boolean;
  paymentMethod: string | null;
  complimentary: boolean;
  trialEndsAt: string;
  accessEndsAt: string | null;
  currentPeriodEnd: string | null;
  /** Qué pasa en nextEventAt: cobro con tarjeta, o pasa a Lite. */
  nextEventAt: string | null;
  nextEvent: 'charge' | 'expire' | 'none';
  liteSince: string | null;
  lastPaymentError: string | null;
  /** Prueba de regalo (cuenta Lite o invitación): vence sin cobro. */
  giftTrial: boolean;
  /** Regalo disponible, todavía sin activar: se activa cuando la persona vuelve a entrar. */
  giftAvailable: boolean;
  /** Plan del próximo cobro. Ausente en APIs sin plan anual. */
  interval?: 'month' | 'year';
  /** Código de creador de la cuenta, si tiene. */
  creatorCode?: string | null;
}

/** Un código de creador con su rendimiento en el rango pedido. */
export interface CreatorCodeStats {
  id: string;
  code: string;
  creatorName: string;
  discountPercent: number;
  sharePercent: number;
  /** null: comisión sin límite de meses. */
  shareMonths: number | null;
  active: boolean;
  createdAt: string;
  /** Cuentas con el código puesto hoy (pagaron o no). */
  applied: number;
  conversions: number;
  monthlyConversions: number;
  annualConversions: number;
  payments: number;
  revenueCop: number;
  discountCop: number;
  commissionCop: number;
  lastPaidAt: string | null;
}

/** Un cobro atribuido a un código (el libro del revenue share). */
export interface CreatorPaymentLine {
  id: string;
  creatorCodeId: string;
  code: string;
  creatorName: string;
  userId: string;
  /** null si la cuenta se borró: el cobro se conserva, sin datos de la persona. */
  email: string | null;
  displayName: string | null;
  interval: 'month' | 'year';
  kind: 'first' | 'renewal';
  status: string;
  amountCop: number;
  discountCop: number;
  commissionCop: number;
  inWindow: boolean;
  paidAt: string;
}

export interface CreatorReport {
  range: { from: string | null; to: string | null };
  codes: CreatorCodeStats[];
  lines: CreatorPaymentLine[];
  totals: { applied: number; conversions: number; payments: number; revenueCop: number; commissionCop: number };
}

export interface CreatorCodeInput {
  code: string;
  creatorName: string;
  discountPercent: number;
  sharePercent: number;
  shareMonths: number | null;
}

export interface AdminMetrics {
  gift: { available: number; active: number; received: number; converted: number; conversionRate: number | null; backToLite: number };
  referrals: {
    total: number; pending: number; activated: number; flagged: number;
    monthStart: string; activatedThisMonth: number; daysGrantedThisMonth: number; capDays: number; atCap: number;
  };
}

export interface PushCategoryStats { sent: number; clicked: number; disabled: number; clickRate: number | null; disableRate: number | null }
export interface PushStats { since: string; byCategory: Record<string, PushCategoryStats> }

export async function listUsers(): Promise<AdminUser[]> {
  const { data } = await api.get<{ users: AdminUser[] }>('/admin/users');
  return data.users;
}

/** Vuelve a consultar en Wompi los cobros cerrados por tiempo. `approved`: cobros que Wompi sí aprobó. */
export async function recheckBilling(id: string): Promise<{ checked: number; approved: number }> {
  const { data } = await api.post<{ checked: number; approved: number }>(`/admin/users/${id}/billing-recheck`);
  return data;
}

export async function getMetrics(): Promise<AdminMetrics> {
  const { data } = await api.get<AdminMetrics>('/admin/metrics');
  return data;
}

export async function getPushStats(): Promise<PushStats> {
  const { data } = await api.get<PushStats>('/admin/push-stats');
  return data;
}

/** Borra la cuenta y todos sus datos. Irreversible. */
export async function deleteUser(id: string): Promise<void> {
  await api.delete(`/admin/users/${id}`);
}

/** Rendimiento de los códigos de creador entre `from` (incluido) y `to` (excluido). Sin fechas: todo el historial. */
export async function getCreatorReport(range: { from?: Date | null; to?: Date | null } = {}): Promise<CreatorReport> {
  const params = {
    ...(range.from ? { from: range.from.toISOString() } : {}),
    ...(range.to ? { to: range.to.toISOString() } : {}),
  };
  const { data } = await api.get<CreatorReport>('/admin/creator-codes', { params });
  return data;
}

export async function createCreatorCode(input: CreatorCodeInput): Promise<void> {
  await api.post('/admin/creator-codes', input);
}

/** Nombre, descuento, comisión o activo. El código en sí no cambia. */
export async function updateCreatorCode(id: string, input: Partial<Omit<CreatorCodeInput, 'code'>> & { active?: boolean }): Promise<void> {
  await api.patch(`/admin/creator-codes/${id}`, input);
}

// ─── Enlaces de recompensa (Instagram) ───────────────────────────────────────

export interface RewardLinkRow {
  id: string;
  note: string | null;
  proDays: number;
  theme: string;
  status: 'available' | 'claimed' | 'expired';
  createdAt: string;
  expiresAt: string | null;
  claimedAt: string | null;
  outcome: 'activated' | 'extended' | 'complimentary' | null;
  claimedBy: { id: string; username: string | null; displayName: string | null } | null;
}

/** Enlace recién creado: el token completo solo llega aquí, una vez. */
export interface NewRewardLink { id: string; token: string; note: string | null; expiresAt: string | null }

export async function listRewardLinks(): Promise<RewardLinkRow[]> {
  const { data } = await api.get<{ links: RewardLinkRow[] }>('/admin/reward-links');
  return data.links;
}

/** expiresInDays null = no vence. */
export async function createRewardLinks(input: { count: number; note?: string; expiresInDays: number | null }): Promise<NewRewardLink[]> {
  const { data } = await api.post<{ links: NewRewardLink[] }>('/admin/reward-links', input);
  return data.links;
}

export async function revokeRewardLink(id: string): Promise<void> {
  await api.post(`/admin/reward-links/${id}/revoke`);
}

/** URL que se envía por Instagram. */
export function rewardLinkUrl(token: string, origin = window.location.origin): string {
  return `${origin.replace(/\/+$/, '')}/claim?token=${encodeURIComponent(token)}`;
}

// ─── Pro de cortesía (/admin/recompensas) ────────────────────────────────────

export type CompOutcome = 'activated' | 'extended' | 'permanent';

export interface CompGrantRecord {
  id: string;
  targetUsername: string;
  days: number | null;
  outcome: CompOutcome;
  accessEndsAt: string | null;
  note: string | null;
  createdAt: string;
}

export interface CompGrantRow extends CompGrantRecord {
  /** Admin que concedió (su @usuario), o null si su cuenta ya no existe. */
  grantedBy: string | null;
}

export interface CompGrantInput {
  /** Correo o @usuario de la cuenta. */
  target: string;
  /** Días (1 a 3650), o null para Pro indefinido. */
  days: number | null;
  note?: string;
}

export async function listCompGrants(): Promise<CompGrantRow[]> {
  const { data } = await api.get<{ grants: CompGrantRow[] }>('/admin/comp-grants');
  return data.grants;
}

export async function grantComp(input: CompGrantInput): Promise<CompGrantRecord> {
  const { data } = await api.post<{ grant: CompGrantRecord }>('/admin/comp-grants', input);
  return data.grant;
}
