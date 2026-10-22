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
}

export interface AdminMetrics {
  gift: { active: number; received: number; converted: number; conversionRate: number | null; backToLite: number };
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
