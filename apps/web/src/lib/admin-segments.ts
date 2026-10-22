// Segmentos de la base para el panel de administración: estado del plan y actividad
// reciente. Funciones puras sobre la lista de /admin/users.
import type { AdminUser } from '@/services/admin.service';

const DAY_MS = 24 * 60 * 60_000;

export type PlanSegment = 'paid' | 'gift' | 'trial' | 'canceled' | 'lite' | 'complimentary';
export type ActivitySegment = 'week' | 'month' | 'dormant';

export const PLAN_SEGMENT_LABEL: Record<PlanSegment, string> = {
  paid: 'Pro pagado', gift: 'Prueba de regalo', trial: 'Prueba de alta', canceled: 'Cancelado', lite: 'Lite', complimentary: 'Cortesía',
};
export const ACTIVITY_SEGMENT_LABEL: Record<ActivitySegment, string> = {
  week: 'Activas 7 días', month: 'Activas 8–30 días', dormant: 'Sin abrir +30 días',
};

export function planSegment(u: Pick<AdminUser, 'status' | 'complimentary' | 'giftTrial'>): PlanSegment {
  if (u.complimentary) return 'complimentary';
  if (u.status === 'trialing') return u.giftTrial ? 'gift' : 'trial';
  if (u.status === 'active') return 'paid';
  return u.status;
}

export function activitySegment(lastSeenAt: string | null, now = Date.now()): ActivitySegment {
  if (!lastSeenAt) return 'dormant';
  const days = (now - new Date(lastSeenAt).getTime()) / DAY_MS;
  return days <= 7 ? 'week' : days <= 30 ? 'month' : 'dormant';
}

export interface Segments {
  plan: Record<PlanSegment, number>;
  activity: Record<ActivitySegment, number>;
  newThisWeek: number;
}

export function segmentUsers(users: AdminUser[], now = Date.now()): Segments {
  const plan: Record<PlanSegment, number> = { paid: 0, gift: 0, trial: 0, canceled: 0, lite: 0, complimentary: 0 };
  const activity: Record<ActivitySegment, number> = { week: 0, month: 0, dormant: 0 };
  let newThisWeek = 0;
  for (const u of users) {
    plan[planSegment(u)] += 1;
    activity[activitySegment(u.lastSeenAt, now)] += 1;
    if (now - new Date(u.createdAt).getTime() <= 7 * DAY_MS) newThisWeek += 1;
  }
  return { plan, activity, newThisWeek };
}
