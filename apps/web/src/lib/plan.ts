// Planes de NoutLife: lo que el cliente necesita saber para mostrar precios,
// límites de Lite y el estado de la suscripción. La regla real vive en la API
// (apps/api/src/lib/plans.ts); estos valores solo sirven para los textos.
import type { Subscription } from '@noutlife/shared';

export const PRO_PRICE_COP = 9900;
export const TRIAL_DAYS = 7;
export const LITE_LIMITS = { activeHabits: 3, historyDays: 7, sageChatPerDay: 3 } as const;

/** Funciones que Lite limita (la API responde 402 con `feature`). */
export type ProFeature = 'habits' | 'history' | 'ai';

/** «$9.900» con separador de miles colombiano. */
export const formatCop = (value: number) => `$${value.toLocaleString('es-CO')}`;

const DAY_MS = 24 * 60 * 60_000;

/** Días que faltan hasta `iso` (0 si ya pasó). */
export function daysUntil(iso: string | null | undefined, now = Date.now()): number {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now) / DAY_MS));
}

/** «19 de octubre». */
export function longDay(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
}

export const isLite = (subscription?: Subscription | null) => subscription?.plan === 'lite';

/** Error de axios con el 402 de un límite de Lite. */
export function isProRequired(error: unknown): boolean {
  const res = (error as { response?: { status?: number; data?: { code?: string } } })?.response;
  return res?.status === 402 && res.data?.code === 'PRO_REQUIRED';
}

export interface PlanRow {
  label: string;
  lite: string | boolean;
  pro: string | boolean;
}

/** Comparación Lite / Pro. true = incluido, false = no incluido, texto = el límite. */
export const PLAN_ROWS: PlanRow[] = [
  { label: 'Hábitos activos', lite: `Hasta ${LITE_LIMITS.activeHabits}`, pro: 'Sin límite' },
  { label: 'Historial y estadísticas', lite: `Últimos ${LITE_LIMITS.historyDays} días`, pro: 'Todo tu historial' },
  { label: 'Mensajes con el Sabio', lite: `${LITE_LIMITS.sageChatPerDay} al día`, pro: 'Cupo completo del día' },
  { label: 'Análisis de IA de hábitos, finanzas y entrenos', lite: false, pro: true },
  { label: 'Misiones sugeridas por el Sabio', lite: false, pro: true },
  { label: 'Zonas, misiones, logros y social', lite: true, pro: true },
  { label: 'Exportar tus datos', lite: true, pro: true },
];
