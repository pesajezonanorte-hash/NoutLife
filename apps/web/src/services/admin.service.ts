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
}

export async function listUsers(): Promise<AdminUser[]> {
  const { data } = await api.get<{ users: AdminUser[] }>('/admin/users');
  return data.users;
}
